// End-to-end Workbench flows against the in-memory mock backend (no network, sped-up timings),
// with the real (lazy-loaded) CodeMirror editor.

import { undo } from '@codemirror/commands';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { mockRun } from './api/mockRest';
import { EXAMPLES } from './components/chat/ExampleChips';
import { EXPLANATION_EMPTY } from './components/results/ExplanationTab';
import { CHAT_OPEN_STORAGE_KEY } from './context/UiContext';
import { EDITOR_STORAGE_KEY } from './context/WorkbenchContext';
import { explainMessage, fixMessage, optimizeMessage } from './context/chatModel';
import { mockClipboard } from './test/fixtures';
import { editorView, restoreMockTiming, typeInEditor, useFastMock } from './test/providers';

const PREVIEW_SQL = 'SELECT *\nFROM Customers\nLIMIT 100;';

const composer = () => screen.getByRole('textbox', { name: 'Ask about your data' });

/** Wait until the current chat turn has finished streaming. */
async function settle() {
  await waitFor(() => expect(composer()).not.toBeDisabled(), { timeout: 15_000 });
}

async function ask(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  fireEvent.keyDown(composer(), { key: 'Enter' });
  expect(composer()).toBeDisabled();
  await settle();
}

const statusText = () => screen.getByText(/ rows? · /);
const grid = () => screen.getByRole('region', { name: 'Results grid, scrollable' });
const dataRows = () => within(grid()).getAllByRole('row').slice(1);
const firstId = () => dataRows()[0].querySelectorAll('td')[1].textContent;
const tab = (name: RegExp | string) => screen.getByRole('tab', { name });
const replies = () => screen.getAllByRole('article', { name: 'SQL Agent reply' });
const lastReply = () => replies()[replies().length - 1];
const userMessages = () => screen.getAllByRole('article', { name: 'Your message' });

async function openCustomers() {
  const view = await editorView();
  fireEvent.click(await screen.findByRole('button', { name: /^Preview Customers/ }));
  await waitFor(() => expect(view.state.doc.toString()).toBe(PREVIEW_SQL));
  await waitFor(() => expect(statusText()).toHaveTextContent('500 rows'));
  return view;
}

async function clickWhenEnabled(name: RegExp | string) {
  const button = screen.getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('Workbench (mock backend)', () => {
  beforeEach(() => {
    useFastMock();
    mockClipboard();
  });
  afterAll(restoreMockTiming);

  it('clicking Customers puts the preview SQL in the editor and pages 100 of 500 rows to page 5', async () => {
    render(<App />);
    await openCustomers();
    expect(statusText()).toHaveTextContent(/^500 rows · \d+ ms · page 1 of 5$/);
    expect(dataRows()).toHaveLength(100);
    expect(firstId()).toBe('1');
    for (let page = 2; page <= 5; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await waitFor(() => expect(statusText()).toHaveTextContent(`page ${page} of 5`));
    }
    expect(firstId()).toBe('401');
    expect(dataRows()).toHaveLength(100);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(statusText()).toHaveTextContent('page 4 of 5'));
  });

  it('a chat follow-up replaces the editor SQL (undoable) and shows the new results', async () => {
    render(<App />);
    const view = await openCustomers();
    await ask('only those from California');

    const sql = view.state.doc.toString();
    expect(sql).toMatch(/FROM\s+Customers/);
    expect(sql).toMatch(/State = 'California'/);
    expect(sql).not.toMatch(/LIMIT/);
    expect(within(lastReply()).getByText('Modified previous query')).toBeInTheDocument();
    expect(tab('Results')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(statusText()).toHaveTextContent(/^\d+ rows · page 1 of 2$/));
    const state = within(grid())
      .getAllByRole('columnheader')
      .findIndex((h) => h.textContent === 'State');
    expect(
      dataRows().every((r) => r.querySelectorAll('td')[state].textContent === 'California'),
    ).toBe(true);
    // Paging a chat result goes through /api/query/run (no LLM call).
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(statusText()).toHaveTextContent('page 2 of 2'));
    expect(screen.getByRole('textbox', { name: 'Ask about your data' })).not.toBeDisabled();

    undo(view);
    expect(view.state.doc.toString()).toBe(PREVIEW_SQL);
  });

  it('running an unknown column shows the validator error and Fix with AI sends the right message', async () => {
    render(<App />);
    const view = await editorView();
    typeInEditor(view, 'SELECT nope FROM Customers');
    await clickWhenEnabled(/^Run query/);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("UNKNOWN_COLUMN Column 'nope' does not exist");
    const run = mockRun({
      sql: 'SELECT nope FROM Customers',
      dialect: 'sqlite',
      limit: 100,
      offset: 0,
    });
    const errors = run.status === 'invalid' ? run.errors : [];

    fireEvent.click(within(alert).getByRole('button', { name: /^Fix with AI/ }));
    expect(userMessages()[0].textContent).toBe(
      `You${fixMessage('SELECT nope FROM Customers', errors)}`,
    );
    await settle();
    expect(within(lastReply()).getByText('Debug')).toBeInTheDocument();
    expect(view.state.doc.toString()).not.toMatch(/nope/);
    // The corrected query ran and the issues are in Notes.
    await waitFor(() => expect(statusText()).toHaveTextContent('500 rows'));
    expect(screen.getByTestId('notes-dot')).toBeInTheDocument();
    fireEvent.click(tab(/^Notes/));
    expect(screen.getByRole('region', { name: 'Issues found' })).toHaveTextContent(
      "Column 'nope' does not exist",
    );
  });

  it('DELETE FROM Orders in the editor shows the refusal card and nothing runs', async () => {
    render(<App />);
    const view = await editorView();
    typeInEditor(view, 'DELETE FROM Orders');
    fireEvent.keyDown(view.contentDOM, { key: 'Enter', keyCode: 13, ctrlKey: true });
    const card = await screen.findByRole('note', { name: 'Request declined' });
    expect(card).toHaveTextContent('Read-only operation required');
    expect(card).toHaveTextContent('I can only generate read-only (SELECT) queries');
    expect(screen.getByText('Nothing was executed.')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Results grid, scrollable' }),
    ).not.toBeInTheDocument();
  });

  it('Explain and Optimize route through the chat and fill the Explanation and Notes tabs', async () => {
    render(<App />);
    const view = await openCustomers();
    fireEvent.click(tab('Explanation'));
    expect(screen.getByText(EXPLANATION_EMPTY)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explain this query with the assistant' }));
    expect(userMessages()[0].textContent).toBe(`You${explainMessage(PREVIEW_SQL)}`);
    await settle();
    expect(tab('Explanation')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Explanation' })).toHaveTextContent(
      'This query reads rows from Customers',
    );
    // Explaining does not change the editor.
    expect(view.state.doc.toString()).toBe(PREVIEW_SQL);

    await clickWhenEnabled('Optimize this query with the assistant');
    expect(userMessages()[1].textContent).toBe(`You${optimizeMessage(PREVIEW_SQL)}`);
    await settle();
    expect(tab(/^Notes/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('notes-dot')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Optimisation notes' })).toHaveTextContent(
      'Replaced SELECT * with the 6 columns of Customers',
    );
    expect(view.state.doc.toString()).toMatch(/SignupDate/);
    undo(view);
    expect(view.state.doc.toString()).toBe(PREVIEW_SQL);
  });

  it('is dark by default and persists the light theme', async () => {
    const { unmount } = render(<App />);
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
    unmount();
    render(<App />);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('shows example chips; refusals and errors render as cards in the chat', async () => {
    render(<App />);
    expect(composer()).toHaveAttribute(
      'placeholder',
      'Ask about your data — or click a table to start',
    );
    for (const example of EXAMPLES) {
      expect(screen.getByRole('button', { name: `Ask: ${example}` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ask: Who won the FIFA World Cup?' }));
    await settle();
    const refusal = within(lastReply()).getByRole('note', { name: 'Request declined' });
    expect(refusal).toHaveTextContent('Outside my scope');

    await ask('mock error');
    const error = within(lastReply()).getByRole('alert');
    expect(error).toHaveTextContent('Something went wrong');
    fireEvent.click(within(error).getByRole('button', { name: 'Try again: resend this message' }));
    await settle();
    expect(userMessages().filter((m) => m.textContent === 'Youmock error')).toHaveLength(1);
  });

  it('a generated query lands in the editor and the grid; Load in editor brings it back', async () => {
    render(<App />);
    const view = await editorView();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask: Top 5 customers by total order value' }),
    );
    await settle();
    expect(view.state.doc.toString()).toMatch(/LIMIT 5/);
    await waitFor(() => expect(statusText()).toHaveTextContent(/^5 rows · page 1 of 1$/));
    expect(
      within(lastReply()).getByRole('button', { name: 'Show 5 rows in Results' }),
    ).toBeInTheDocument();
    // The activity panel shows the check that failed and was retried.
    fireEvent.click(within(lastReply()).getByRole('button', { name: 'Show agent activity' }));
    expect(within(lastReply()).getByRole('list', { name: 'Agent activity' })).toHaveTextContent(
      "Table 'Customer' does not exist — fixed and retried",
    );

    typeInEditor(view, 'SELECT 1 FROM Orders');
    fireEvent.click(
      within(lastReply()).getByRole('button', { name: 'Load this SQL in the editor' }),
    );
    expect(view.state.doc.toString()).toMatch(/LIMIT 5/);
  });

  it('switches, deletes and starts chats from the thread switcher (⌘K opens it)', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const menu = await screen.findByRole('dialog', { name: 'Chats' });
    await waitFor(() =>
      expect(within(menu).getByRole('textbox', { name: 'Search chats' })).toHaveFocus(),
    );
    fireEvent.change(within(menu).getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'pending' },
    });
    const list = within(menu).getByRole('list', { name: 'Chat list' });
    expect(within(list).getAllByRole('button', { name: /^Open chat/ })).toHaveLength(1);
    fireEvent.click(within(list).getByRole('button', { name: 'Open chat: Pending Orders' }));
    await waitFor(() => expect(replies()).toHaveLength(1));
    expect(screen.getByRole('button', { name: /^Chat: Pending Orders/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Chat: Pending Orders/ }));
    const menu2 = await screen.findByRole('dialog', { name: 'Chats' });
    fireEvent.click(within(menu2).getByRole('button', { name: 'Delete chat: Pending Orders' }));
    fireEvent.click(
      within(menu2).getByRole('button', { name: 'Confirm delete of chat: Pending Orders' }),
    );
    // Deleting the open chat starts a new one and drops it from the list.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Chat: New chat/ })).toBeInTheDocument(),
    );
    expect(
      within(menu2).queryByRole('button', { name: 'Open chat: Pending Orders' }),
    ).not.toBeInTheDocument();
    expect(within(menu2).queryByText(/Pending Orders/)).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await ask('Show all customers');
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.queryAllByRole('article', { name: 'SQL Agent reply' })).toHaveLength(0);
  });

  it('collapses the chat to a floating Ask AI button and remembers it', async () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat panel' }));
    expect(screen.queryByRole('complementary', { name: 'AI assistant' })).not.toBeInTheDocument();
    expect(localStorage.getItem(CHAT_OPEN_STORAGE_KEY)).toBe('false');
    unmount();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI: open the assistant panel' }));
    expect(screen.getByRole('complementary', { name: 'AI assistant' })).toBeInTheDocument();
  });

  it('Ask AI about a table prefills the composer; PostgreSQL still runs on the demo database', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Orders' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ask AI about this table' }));
    expect(composer()).toHaveValue('Describe the Orders table and what I can ask about it');

    const toggle = screen.getByRole('switch', { name: 'Run on demo database (SQLite)' });
    expect(toggle).toHaveAttribute(
      'title',
      'Queries are translated to SQLite and run on the bundled sample data.',
    );
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByRole('combobox', { name: 'SQL dialect' }), {
      target: { value: 'postgres' },
    });
    // Every dialect runs: the toggle stays on and enabled.
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).not.toBeDisabled();
    await ask('Show all customers');
    expect(within(lastReply()).getByRole('button', { name: /in Results$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Format SQL (PostgreSQL)' })).toBeInTheDocument();
    // Notes shows what actually ran on SQLite.
    fireEvent.click(tab(/Notes/));
    expect(screen.getByRole('region', { name: 'Executed as (SQLite)' })).toBeInTheDocument();
  });

  it('a PostgreSQL feature SQLite lacks shows a readable error and keeps the SQL', async () => {
    render(<App />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'SQL dialect' }), {
      target: { value: 'postgres' },
    });
    const view = await editorView();
    typeInEditor(view, 'SELECT ARRAY_AGG(Name) FROM Products');
    await clickWhenEnabled(/^Run query/);
    expect(
      (
        await screen.findAllByText(
          /This PostgreSQL feature isn't supported on the SQLite demo database\./,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(view.state.doc.toString()).toBe('SELECT ARRAY_AGG(Name) FROM Products');
    fireEvent.click(tab(/Notes/));
    expect(screen.getByRole('region', { name: 'Executed as (SQLite)' })).toBeInTheDocument();
  });

  it('SQLite runs show no "Executed as" section', async () => {
    render(<App />);
    const view = await editorView();
    typeInEditor(view, 'SELECT Name FROM Products');
    await clickWhenEnabled(/^Run query/);
    await screen.findByText(/ rows? · /);
    fireEvent.click(tab(/Notes/));
    expect(screen.queryByRole('region', { name: 'Executed as (SQLite)' })).toBeNull();
  });
});

describe('Workbench below 1024 px (tabbed layout)', () => {
  beforeEach(() => {
    useFastMock();
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(restoreMockTiming);

  const tabBar = () => screen.getByRole('navigation', { name: 'Workbench sections' });
  const activeTab = () => within(tabBar()).getByRole('button', { current: 'page' });

  it('an editor Run (selection) stays on the Editor tab and shows the outcome inline', async () => {
    render(<App />);
    fireEvent.click(within(tabBar()).getByRole('button', { name: 'Editor' }));
    const view = await editorView();
    const doc = 'SELECT 1;\nSELECT * FROM Products;';
    typeInEditor(view, doc);
    view.dispatch({ selection: { anchor: doc.indexOf('SELECT *'), head: doc.length } });
    await clickWhenEnabled(/^Run query/);

    const summary = await screen.findByTestId('run-summary');
    await waitFor(() => expect(summary).toHaveTextContent(/^50 rows · \d+ ms · page 1 of 1/));
    expect(activeTab()).toHaveTextContent('Editor');
    expect(view.state.doc.toString()).toBe(doc);

    typeInEditor(view, 'DELETE FROM Orders');
    await clickWhenEnabled(/^Run query/);
    await waitFor(() => expect(summary).toHaveTextContent('Nothing was executed'));
    expect(activeTab()).toHaveTextContent('Editor');
    fireEvent.click(within(summary).getByRole('button', { name: 'View results' }));
    expect(activeTab()).toHaveTextContent('Results');
    expect(screen.getByRole('note', { name: 'Request declined' })).toBeInTheDocument();
  });

  it('tapping a table still switches to Results', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Preview Customers/ }));
    expect(activeTab()).toHaveTextContent('Results');
    const area = screen.getByRole('region', { name: 'Results area' });
    await waitFor(() => expect(within(area).getByText(/ rows · /)).toHaveTextContent('500 rows'));
  });
});

describe('Editor persistence', () => {
  beforeEach(useFastMock);
  afterAll(restoreMockTiming);

  it('saves the query to localStorage and restores it after a reload', async () => {
    const { unmount } = render(<App />);
    const view = await editorView();
    typeInEditor(view, 'SELECT Name FROM Customers');
    await waitFor(() =>
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBe('SELECT Name FROM Customers'),
    );
    unmount();
    render(<App />);
    const restored = await editorView();
    expect(restored.state.doc.toString()).toBe('SELECT Name FROM Customers');
  });
});
