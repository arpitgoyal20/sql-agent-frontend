import { redo, undo } from '@codemirror/commands';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runQuery } from '../../api/client';
import { useWorkbench } from '../../context/WorkbenchContext';
import { sqlOnly } from '../../context/chatModel';
import {
  Probe,
  editorView,
  renderWithProviders,
  restoreMockTiming,
  typeInEditor,
  useFastMock,
} from '../../test/providers';
import EditorToolbar from './EditorToolbar';
import ResultsArea from '../results/ResultsArea';
import SqlEditor from './SqlEditor';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return { ...actual, runQuery: vi.fn(actual.runQuery) };
});

const CHAT_SQL = "SELECT *\nFROM Customers\nWHERE State = 'California'";

/** Stands in for the chat stream: hands an `sql` event to the workbench. */
function ChatSqlButton() {
  const { chatSql } = useWorkbench();
  return (
    <button type="button" onClick={() => chatSql(sqlOnly(CHAT_SQL, 'sqlite'), false)}>
      chat sql
    </button>
  );
}

function renderEditor() {
  return renderWithProviders(
    <>
      <EditorToolbar />
      <SqlEditor />
      <ChatSqlButton />
      <Probe />
    </>,
  );
}

describe('SqlEditor', () => {
  beforeEach(() => {
    useFastMock();
    vi.mocked(runQuery).mockClear();
  });
  afterAll(restoreMockTiming);

  it('Run with a selection runs only the selection', async () => {
    renderEditor();
    const view = await editorView();
    typeInEditor(view, 'SELECT * FROM Orders;\nSELECT * FROM Products;');
    const start = view.state.doc.toString().indexOf('SELECT * FROM Products');
    view.dispatch({ selection: { anchor: start, head: view.state.doc.length } });

    const run = screen.getByRole('button', { name: /^Run query/ });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    expect(runQuery).toHaveBeenLastCalledWith('SELECT * FROM Products;', 'sqlite', 100, 0);
    await waitFor(() =>
      expect(screen.getByTestId('probe-results')).toHaveTextContent('ok total=50'),
    );
  });

  it.each([
    [
      'ok',
      'SELECT * FROM Orders;\nSELECT * FROM Products;',
      'SELECT * FROM Products;',
      /^ok total=50/,
    ],
    ['invalid', 'SELECT 1;\nSELECT nope FROM Customers', 'SELECT nope FROM Customers', /^invalid/],
    ['refused', 'SELECT 1;\nDELETE FROM Orders', 'DELETE FROM Orders', /^refused/],
  ])(
    'a selection Run (%s) sends exactly the selection and keeps the editor intact',
    async (_status, doc, selected, expected) => {
      renderWithProviders(
        <>
          <EditorToolbar />
          <SqlEditor />
          <ResultsArea />
          <Probe />
        </>,
      );
      const view = await editorView();
      typeInEditor(view, doc);
      const from = doc.indexOf(selected);
      view.dispatch({ selection: { anchor: from, head: from + selected.length } });
      const run = screen.getByRole('button', { name: /^Run query/ });
      await waitFor(() => expect(run).toBeEnabled());
      fireEvent.click(run);

      expect(runQuery).toHaveBeenLastCalledWith(selected, 'sqlite', 100, 0);
      await waitFor(() => expect(screen.getByTestId('probe-results')).toHaveTextContent(expected));
      // No crash, nothing lost: same document, same selection, same editor view.
      expect(await editorView()).toBe(view);
      expect(view.state.doc.toString()).toBe(doc);
      expect(
        view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
      ).toBe(selected);
      expect(screen.getByTestId('probe-sql').textContent).toBe(doc);
      expect(screen.getByRole('region', { name: 'Results area' })).toBeInTheDocument();
    },
  );

  it('runs the whole query when nothing is selected, also with Ctrl/⌘+Enter', async () => {
    renderEditor();
    const view = await editorView();
    typeInEditor(view, 'SELECT * FROM Orders');
    view.dispatch({ selection: { anchor: 3 } });
    // jsdom is not a Mac, so CodeMirror's Mod is Ctrl here (⌘ in the real browser on macOS).
    fireEvent.keyDown(view.contentDOM, { key: 'Enter', code: 'Enter', keyCode: 13, ctrlKey: true });
    expect(runQuery).toHaveBeenLastCalledWith('SELECT * FROM Orders', 'sqlite', 100, 0);
    // The shortcut must not insert a line break.
    expect(view.state.doc.toString()).toBe('SELECT * FROM Orders');
  });

  it('replaces the editor with chat SQL in one undoable transaction and flashes', async () => {
    renderEditor();
    const view = await editorView();
    typeInEditor(view, 'SELECT Name FROM Customers');
    fireEvent.click(screen.getByRole('button', { name: 'chat sql' }));

    expect(view.state.doc.toString()).toBe(CHAT_SQL);
    expect(screen.getByTestId('probe-sql').textContent).toBe(CHAT_SQL);
    expect(screen.getByTestId('sql-editor')).toHaveAttribute('data-flashing', 'true');

    undo(view);
    expect(view.state.doc.toString()).toBe('SELECT Name FROM Customers');
    await waitFor(() =>
      expect(screen.getByTestId('probe-sql').textContent).toBe('SELECT Name FROM Customers'),
    );
    redo(view);
    expect(view.state.doc.toString()).toBe(CHAT_SQL);
  });

  it('formats the query for the selected dialect (undoable)', async () => {
    renderEditor();
    const view = await editorView();
    typeInEditor(view, 'select name, city from customers where state = "x"');
    const format = screen.getByRole('button', { name: 'Format SQL (SQLite)' });
    await waitFor(() => expect(format).toBeEnabled());
    fireEvent.click(format);
    await waitFor(() =>
      expect(view.state.doc.toString()).toBe(
        'SELECT\n  name,\n  city\nFROM\n  customers\nWHERE\n  state = "x"',
      ),
    );
    undo(view);
    expect(view.state.doc.toString()).toBe('select name, city from customers where state = "x"');
  });

  it('disables Run, Explain and Optimize while the editor is empty', async () => {
    renderEditor();
    await editorView();
    for (const name of [/^Run query/, /^Explain this query/, /^Optimize this query/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
