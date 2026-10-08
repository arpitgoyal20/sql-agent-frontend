// End-to-end UI flows against the in-memory mock backend (no network, sped-up timings).

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { mockRestTiming, setMockMode } from './api/client';
import { mockTiming } from './api/mock';
import { resetMockStore } from './api/mockRest';
import { resetSchemaCache } from './components/schema/SchemaPanel';
import { mockClipboard } from './test/fixtures';

const LONG = 10_000;

const composer = () =>
  screen.getByRole('textbox', { name: 'Ask anything about your database' }) as HTMLTextAreaElement;

/** Wait until the current turn has finished streaming. */
async function settle() {
  await waitFor(() => expect(composer()).not.toBeDisabled(), { timeout: LONG });
}

async function ask(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  fireEvent.keyDown(composer(), { key: 'Enter' });
  expect(composer()).toBeDisabled();
  await settle();
}

const replies = () => screen.getAllByRole('article', { name: 'SQL Agent reply' });
const lastReply = () => replies()[replies().length - 1];
const threadList = () => screen.getByRole('navigation', { name: 'Thread list' });

async function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  return screen.getByRole('dialog', { name: 'Settings' });
}

describe('App (mock backend)', () => {
  beforeEach(() => {
    setMockMode(true);
    mockRestTiming.delayMs = 0;
    mockTiming.scale = 0.02;
    resetMockStore();
    resetSchemaCache();
    localStorage.clear();
    document.documentElement.className = '';
    mockClipboard();
  });

  afterAll(() => {
    setMockMode(null);
    mockRestTiming.delayMs = 150;
    mockTiming.scale = 1;
  });

  it(
    'runs a question through activity, validated SQL, results and explanation',
    async () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /^Analyze: Revenue trends/ }));
      // Agent activity is expanded while the turn runs.
      expect(await screen.findByRole('list', { name: 'Agent activity' })).toBeInTheDocument();
      await settle();

      const reply = lastReply();
      // Collapsed once done; expanding shows the retried check from step.errors.
      fireEvent.click(within(reply).getByRole('button', { name: 'Show agent activity' }));
      const activity = within(reply).getByRole('list', { name: 'Agent activity' });
      expect(activity).toHaveTextContent(
        "Column 'revenue_total' does not exist — fixed and retried",
      );
      expect(activity).toHaveTextContent('Query ready');

      const card = within(reply).getByRole('region', { name: 'Generated SQL' });
      expect(card).toHaveTextContent('FROM Orders');
      expect(within(card).getByText('Valid')).toBeInTheDocument();
      const checks = within(card).getByRole('region', { name: 'Query validation' });
      expect(checks).toHaveTextContent('Tables exist');
      expect(checks).toHaveTextContent('Read-only query');

      const results = within(reply).getByRole('region', { name: 'Query results' });
      expect(results).toHaveTextContent('12 rows');
      expect(results).toHaveTextContent('2025-12');

      expect(within(reply).getByRole('region', { name: 'Why this query' })).toHaveTextContent(
        'groups the totals by calendar month',
      );
      // The thread appears with its generated title, also shown in the chat header.
      expect(
        await within(threadList()).findByRole('button', {
          name: 'Open thread: Monthly Revenue — 2025',
        }),
      ).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('heading', { name: 'Monthly Revenue — 2025' })).toBeInTheDocument();
    },
    LONG * 2,
  );

  it(
    'marks a follow-up as "Modified previous query"',
    async () => {
      render(<App />);
      await ask('Show all customers');
      expect(within(lastReply()).queryByText('Modified previous query')).not.toBeInTheDocument();
      await ask('Only those from California');
      expect(within(lastReply()).getByText('Modified previous query')).toBeInTheDocument();
      expect(within(lastReply()).getByRole('region', { name: 'Generated SQL' })).toHaveTextContent(
        "State = 'California'",
      );
    },
    LONG * 2,
  );

  it(
    'shows a refusal as a grey shield card with a clickable suggestion',
    async () => {
      render(<App />);
      await ask('Who won the FIFA World Cup?');
      const card = screen.getByRole('note', { name: 'Request declined' });
      expect(card).toHaveTextContent('Outside my scope');
      expect(card).toHaveTextContent('assist only with SQL and database-related tasks');
      expect(within(card).getByTestId('refusal-shield')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.click(
        within(card).getByRole('button', { name: 'Ask: Show the top 10 customers by revenue' }),
      );
      await settle();
      expect(within(lastReply()).getByRole('region', { name: 'Query results' })).toHaveTextContent(
        '10 rows',
      );
    },
    LONG * 2,
  );

  it(
    'labels a destructive request "Read-only operation required"',
    async () => {
      render(<App />);
      await ask('delete all orders');
      expect(screen.getByRole('note', { name: 'Request declined' })).toHaveTextContent(
        'Read-only operation required',
      );
    },
    LONG,
  );

  it(
    'shows a readable error with Try Again',
    async () => {
      render(<App />);
      await ask('mock error please');
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent("Couldn't finish this request");
      expect(alert).toHaveTextContent('Something went wrong while answering');
      fireEvent.click(
        within(alert).getByRole('button', { name: 'Try again: resend this message' }),
      );
      expect(composer()).toBeDisabled();
      await settle();
      // The failed pair was replaced by the retried one.
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getAllByRole('article', { name: 'Your message' })).toHaveLength(1);
    },
    LONG,
  );

  it('renames, duplicates and deletes a thread', async () => {
    render(<App />);
    const list = threadList();
    fireEvent.click(
      await within(list).findByRole('button', { name: 'Thread actions: Pending Orders' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Thread title' });
    fireEvent.change(input, { target: { value: 'Open orders' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await within(list).findByRole('button', { name: 'Open thread: Open orders' });

    fireEvent.click(within(list).getByRole('button', { name: 'Thread actions: Open orders' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(
      await within(list).findByRole('button', { name: 'Open thread: Open orders (copy)' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByRole('heading', { name: 'Open orders (copy)' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Optimized SQL' })).toBeInTheDocument();

    fireEvent.click(
      within(list).getByRole('button', { name: 'Thread actions: Open orders (copy)' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(
      within(list).getByRole('button', { name: 'Confirm delete of thread: Open orders (copy)' }),
    );
    await waitFor(() =>
      expect(
        within(list).queryByRole('button', { name: 'Open thread: Open orders (copy)' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'New thread' })).toBeInTheDocument();
    expect(
      within(list).getByRole('button', { name: 'Open thread: Open orders' }),
    ).toBeInTheDocument();
  });

  it('reloads a thread with its SQL and runs it via /api/execute', async () => {
    render(<App />);
    fireEvent.click(
      await within(threadList()).findByRole('button', { name: 'Open thread: Customers by State' }),
    );
    const card = await screen.findByRole('region', { name: 'Generated SQL' });
    expect(card).toHaveTextContent('FROM Customers');
    // History has no validation data until the query is run.
    expect(
      within(card).queryByRole('region', { name: 'Query validation' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Results are not stored with the thread/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Run query' }));
    const results = await screen.findByRole('region', { name: 'Query results' });
    expect(results).toHaveTextContent('200 rows');
    expect(results).toHaveTextContent('Showing first 200 rows');
    expect(within(card).getByRole('region', { name: 'Query validation' })).toBeInTheDocument();
  });

  it(
    'runs a query on demand when automatic execution is off',
    async () => {
      render(<App />);
      const settings = await openSettings();
      fireEvent.click(within(settings).getByRole('switch', { name: 'Run queries automatically' }));
      await ask('Show all employees hired after January 2024');
      const reply = lastReply();
      expect(
        within(reply).queryByRole('region', { name: 'Query results' }),
      ).not.toBeInTheDocument();
      expect(reply).toHaveTextContent('Automatic execution is off');
      fireEvent.click(within(reply).getByRole('button', { name: 'Run query' }));
      const results = await within(reply).findByRole('region', { name: 'Query results' });
      expect(results).toHaveTextContent('5 rows');
      expect(within(results).getByText('NULL')).toBeInTheDocument();
    },
    LONG,
  );

  it(
    'saves a query, opens it from Saved Queries (running it) and deletes it',
    async () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /^Explore: Customer data/ }));
      await settle();
      await within(threadList()).findByRole('button', {
        name: 'Open thread: Customers from California',
      });
      fireEvent.click(within(lastReply()).getByRole('button', { name: 'Save query' }));
      expect(
        await within(lastReply()).findByRole('button', { name: 'Saved to Saved Queries' }),
      ).toBeDisabled();
      expect(await screen.findByText('Saved to Saved Queries')).toBeInTheDocument();

      const savedSection = screen.getByRole('region', { name: 'Saved queries' });
      fireEvent.click(
        await within(savedSection).findByRole('button', {
          name: 'Open saved query: Customers from California',
        }),
      );
      expect(screen.getByRole('article', { name: 'Original prompt' })).toHaveTextContent(
        'Show all customers from California',
      );
      expect(screen.getByRole('region', { name: 'Saved SQL' })).toHaveTextContent(
        "State = 'California'",
      );
      expect(await screen.findByRole('region', { name: 'Query results' })).toHaveTextContent(
        '4 rows',
      );
      expect(screen.getByText(/Last execution:/)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Why this query' })).toHaveTextContent(
        'customers located in California',
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Delete saved query: Customers from California' }),
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Confirm delete of saved query: Customers from California',
        }),
      );
      await waitFor(() =>
        expect(
          within(savedSection).queryByRole('button', {
            name: 'Open saved query: Customers from California',
          }),
        ).not.toBeInTheDocument(),
      );
    },
    LONG,
  );

  it('rejects destructive SQL in the mock /api/execute', async () => {
    render(<App />);
    fireEvent.click(
      await within(screen.getByRole('region', { name: 'Saved queries' })).findByRole('button', {
        name: 'Open saved query: Top 10 Customers by Revenue',
      }),
    );
    expect(await screen.findByRole('region', { name: 'Query results' })).toHaveTextContent(
      '10 rows',
    );
    const { mockExecute } = await import('./api/mockRest');
    const out = mockExecute({ sql: 'DELETE FROM Orders', dialect: 'sqlite' });
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toMatch(/^DESTRUCTIVE:/);
    expect(out.result).toBeNull();
  });

  it('searches the schema, shows column details and inserts a column', async () => {
    render(<App />);
    const schema = screen.getByRole('complementary', { name: 'Database schema' });
    for (const t of ['Departments', 'Employees', 'Customers', 'Orders', 'Payments']) {
      expect(
        await within(schema).findByRole('button', { name: `Show columns of ${t}` }),
      ).toBeInTheDocument();
    }
    expect(within(schema).getByRole('region', { name: 'Relationships' })).toHaveTextContent(
      'Customers.CustomerID└── Orders.CustomerID',
    );

    fireEvent.change(within(schema).getByRole('searchbox', { name: 'Search tables and columns' }), {
      target: { value: 'departmentid' },
    });
    expect(within(schema).queryByRole('button', { name: /columns of Customers/ })).toBeNull();
    expect(
      within(schema).getByRole('button', {
        name: /^Column Departments\.DepartmentID, INTEGER, primary key/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(schema).getByRole('button', { name: /^Column Employees\.DepartmentID/ }),
    );
    const details = within(schema).getByRole('region', { name: 'Column details' });
    expect(details).toHaveTextContent('NullableNo');
    expect(details).toHaveTextContent('TableEmployees');
    expect(details).toHaveTextContent('ReferencesDepartments.DepartmentID');

    const input = composer();
    fireEvent.change(input, { target: { value: 'Average by' } });
    input.setSelectionRange(10, 10);
    fireEvent.click(
      within(details).getByRole('button', { name: 'Insert DepartmentID into query' }),
    );
    expect(input.value).toBe('Average by DepartmentID');
  });

  it('switching the database to PostgreSQL forces automatic execution off', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Database: Demo DB' }));
    expect(screen.getByRole('menuitem', { name: 'Connect database (coming soon)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'PostgreSQL' }));
    expect(screen.getByRole('button', { name: 'Database: PostgreSQL' })).toBeInTheDocument();

    let settings = await openSettings();
    let toggle = within(settings).getByRole('switch', { name: 'Run queries automatically' });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(settings).toHaveTextContent('Queries only run on the SQLite demo database');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    fireEvent.click(screen.getByRole('button', { name: 'Database: PostgreSQL' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'SQLite' }));
    settings = await openSettings();
    toggle = within(settings).getByRole('switch', { name: 'Run queries automatically' });
    expect(toggle).not.toBeDisabled();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('is dark by default and persists the light theme', async () => {
    const { unmount } = render(<App />);
    expect(document.documentElement).toHaveClass('dark');
    const settings = await openSettings();
    const toggle = within(settings).getByRole('switch', { name: 'Dark mode' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
    unmount();
    render(<App />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('opens a thread from the ⌘K palette', async () => {
    render(<App />);
    await within(threadList()).findByRole('button', { name: 'Open thread: Pending Orders' });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const palette = screen.getByRole('dialog', { name: 'Search threads' });
    const search = within(palette).getByRole('combobox', {
      name: 'Search threads and saved queries',
    });
    fireEvent.change(search, { target: { value: 'pending' } });
    expect(within(palette).getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Pending Orders' })).toBeInTheDocument();
  });

  it(
    'lists SQL turns in Query History and highlights the chosen card',
    async () => {
      render(<App />);
      await ask('Show all customers');
      await ask('Only those from California');
      fireEvent.click(screen.getByRole('button', { name: 'Thread options' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Query history' }));
      const history = screen.getByRole('region', { name: 'Query history' });
      const items = within(history).getAllByRole('button', { name: /^Go to query/ });
      expect(items.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Go to query 1: Show all customers',
        'Go to query 2: Only those from California',
      ]);
      fireEvent.click(items[0]);
      expect(screen.getAllByRole('region', { name: 'Generated SQL' })[0].className).toMatch(
        /ring-2/,
      );
    },
    LONG * 2,
  );

  it('applies a debug fix to the composer in SQL mode', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Debug SQL: Fix a query/ }));
    await settle();
    const reply = lastReply();
    expect(within(reply).getByRole('region', { name: 'SQL error' })).toHaveTextContent(
      'Table "Employee" does not exist',
    );
    fireEvent.click(within(reply).getByRole('button', { name: /^Apply fix/ }));
    expect(composer().value).toContain('SELECT\n  FirstName');
    expect(screen.getByRole('button', { name: 'SQL mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
