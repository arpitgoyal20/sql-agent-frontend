// Workbench state (CHANGES-v2.md): the table list, the SQL editor (the single source of truth
// for "the current query"), the results grid with its paging source, and the Explanation /
// Notes tabs fed by the chat. The chat talks to it through the `chat*` bridge functions.
//
// Paging rule: a table preview pages through GET /api/tables/{name}/preview (its SQL has its own
// LIMIT, so re-running it through /api/query/run would cap `total`); editor runs and chat results
// page through POST /api/query/run with the same SQL and a new offset.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getTables, previewTable as apiPreview, runQuery } from '../api/client';
import type {
  Dialect,
  ExplanationEvent,
  Intent,
  PageData,
  ResultEvent,
  SqlEvent,
  TableInfo,
} from '../api/types';
import { hasNotes } from './chatModel';
import { useToast } from './ToastContext';
import { useUi } from './UiContext';

export const PAGE_SIZES = [50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 100;

export type ResultSource =
  { kind: 'preview'; table: string } | { kind: 'query'; sql: string; dialect: Dialect };

export type ResultsTab = 'results' | 'explanation' | 'notes';

/** One page in the grid. `elapsed_ms` is null for chat results (the event has no timing). */
export interface GridPage {
  columns: string[];
  rows: PageData['rows'];
  row_count: number;
  total: number;
  limit: number;
  offset: number;
  elapsed_ms: number | null;
}

export type ResultsStatus = 'idle' | 'ok' | 'invalid' | 'refused' | 'error';

export interface ResultsState {
  status: ResultsStatus;
  /** The last successful page; kept (greyed) while an invalid / error state is shown. */
  page: GridPage | null;
  /** What produced `page`, so paging knows which endpoint to call. */
  source: ResultSource | null;
  running: boolean;
  /** Validator errors for `invalid` (`CATEGORY: message`). */
  errors: string[];
  /** Refusal or error text. */
  message: string | null;
  /** The SQL that failed validation (for Fix with AI). */
  failedSql: string | null;
  /** Warnings from the last successful editor run. */
  warnings: string[];
  /** For PostgreSQL / MySQL: the SQLite that actually ran for the current results. */
  executedSql: string | null;
}

export interface ExplanationState {
  text: string;
  assumptions: string[];
  streaming: boolean;
}

/** What the CodeMirror editor exposes once mounted. */
export interface EditorApi {
  getText: () => string;
  /** The selected text, or '' when nothing is selected. */
  getSelection: () => string;
  /** Replace the whole document in one undoable transaction. */
  replaceAll: (text: string) => void;
  /** Insert at the cursor (replacing the selection) and focus. */
  insert: (text: string) => void;
  focus: () => void;
}

interface WorkbenchValue {
  tables: TableInfo[] | null;
  tablesError: string | null;
  reloadTables: () => void;
  selectedTable: string | null;

  dialect: Dialect;
  setDialect: (d: Dialect) => void;

  editorSql: string;
  setEditorSql: (sql: string) => void;
  registerEditor: (api: EditorApi | null) => void;
  /** Replace the editor content (undoable). `flash` briefly highlights the editor border. */
  setEditorText: (sql: string, opts?: { flash?: boolean }) => void;
  insertIntoEditor: (text: string) => void;
  focusEditor: () => void;
  /** Increments whenever the editor should flash. */
  flashKey: number;
  /** Run the selection, or the whole editor when nothing is selected. */
  runEditor: () => void;
  /** Put `sql` in the editor and run it (navigator "Count rows"). */
  runInEditor: (sql: string) => void;

  previewTable: (name: string) => void;
  results: ResultsState;
  pageSize: number;
  setPageSize: (n: number) => void;
  goToPage: (index: number) => void;
  retry: () => void;

  resultsTab: ResultsTab;
  setResultsTab: (tab: ResultsTab) => void;
  explanation: ExplanationState;
  /** The latest chat `sql` event (Notes tab: warnings, issues, optimisation, validation…). */
  notesSql: SqlEvent | null;
  notesHaveContent: boolean;

  // Chat bridge (called by ChatContext while a turn streams).
  chatSql: (sql: SqlEvent, executing: boolean) => void;
  chatResult: (result: ResultEvent, sql: SqlEvent | null) => void;
  chatToken: (text: string) => void;
  chatExplanation: (e: ExplanationEvent) => void;
  chatTurnEnded: (intent: Intent | null, hadResult: boolean) => void;
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null);

const IDLE: ResultsState = {
  status: 'idle',
  page: null,
  source: null,
  running: false,
  errors: [],
  message: null,
  failedSql: null,
  warnings: [],
  executedSql: null,
};

export const EDITOR_STORAGE_KEY = 'sqlagent.editorSql';
const SAVE_DELAY_MS = 400;

function readSavedSql(): string {
  try {
    return localStorage.getItem(EDITOR_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

const EMPTY_EXPLANATION: ExplanationState = { text: '', assumptions: [], streaming: false };

const toGrid = (p: PageData): GridPage => ({
  columns: p.columns,
  rows: p.rows,
  row_count: p.row_count,
  total: p.total,
  limit: p.limit,
  offset: p.offset,
  elapsed_ms: p.elapsed_ms,
});

/** A chat `result` event as a grid page; an older backend without paging is one page. */
function fromResultEvent(r: ResultEvent): GridPage {
  return {
    columns: r.columns,
    rows: r.rows,
    row_count: r.row_count,
    total: r.total ?? r.row_count,
    limit: r.limit ?? Math.max(r.row_count, 1),
    offset: r.offset ?? 0,
    elapsed_ms: null,
  };
}

interface Request {
  source: ResultSource;
  limit: number;
  offset: number;
  /** Put the preview's SQL in the editor when it arrives (first click on a table). */
  fillEditor: boolean;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const { showOnMobile } = useUi();
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tablesVersion, setTablesVersion] = useState(0);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [dialect, setDialect] = useState<Dialect>('sqlite');
  const [editorSql, setEditorSql] = useState(readSavedSql);
  const [flashKey, setFlashKey] = useState(0);
  const [results, setResults] = useState<ResultsState>(IDLE);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [resultsTab, setResultsTab] = useState<ResultsTab>('results');
  const [explanation, setExplanation] = useState<ExplanationState>(EMPTY_EXPLANATION);
  const [notesSql, setNotesSql] = useState<SqlEvent | null>(null);

  const editorRef = useRef<EditorApi | null>(null);
  const editorSqlRef = useRef(editorSql);
  editorSqlRef.current = editorSql;
  const requestId = useRef(0);
  const lastRequest = useRef<Request | null>(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const dialectRef = useRef(dialect);
  dialectRef.current = dialect;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  // Keep the editor's query across reloads (debounced; storage may be unavailable).
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (editorSql) localStorage.setItem(EDITOR_STORAGE_KEY, editorSql);
        else localStorage.removeItem(EDITOR_STORAGE_KEY);
      } catch {
        // Private mode / blocked storage: the query just won't survive a reload.
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [editorSql]);

  // ---- Tables ------------------------------------------------------------------------

  useEffect(() => {
    let live = true;
    setTablesError(null);
    getTables().then(
      (res) => live && setTables(res.tables),
      (err: unknown) =>
        live && setTablesError(err instanceof Error ? err.message : 'Could not load tables.'),
    );
    return () => {
      live = false;
    };
  }, [tablesVersion]);

  const reloadTables = useCallback(() => setTablesVersion((v) => v + 1), []);

  // ---- Editor bridge -----------------------------------------------------------------

  const registerEditor = useCallback((api: EditorApi | null) => {
    editorRef.current = api;
  }, []);

  const setEditorText = useCallback((sql: string, opts: { flash?: boolean } = {}) => {
    const api = editorRef.current;
    if (api) api.replaceAll(sql);
    // Mirror immediately so the next chat request sees it even before onChange fires.
    editorSqlRef.current = sql;
    setEditorSql(sql);
    if (opts.flash) setFlashKey((k) => k + 1);
  }, []);

  const insertIntoEditor = useCallback((text: string) => {
    const api = editorRef.current;
    if (api) api.insert(text);
    else setEditorSql((cur) => (cur && !/\s$/.test(cur) ? `${cur} ${text}` : `${cur}${text}`));
  }, []);

  const focusEditor = useCallback(() => editorRef.current?.focus(), []);

  // ---- Results -----------------------------------------------------------------------

  const load = useCallback(
    async (req: Request) => {
      const id = ++requestId.current;
      lastRequest.current = req;
      setResults((r) => ({ ...r, running: true }));
      const stale = () => id !== requestId.current;
      const { source, limit, offset } = req;
      try {
        if (source.kind === 'preview') {
          const res = await apiPreview(source.table, limit, offset);
          if (stale()) return;
          if (req.fillEditor) setEditorText(res.sql);
          setResults({ ...IDLE, status: 'ok', page: toGrid(res), source });
          return;
        }
        const res = await runQuery(source.sql, source.dialect, limit, offset);
        if (stale()) return;
        switch (res.status) {
          case 'ok':
            setResults({
              ...IDLE,
              status: 'ok',
              page: toGrid(res),
              source,
              warnings: res.warnings ?? [],
              executedSql: res.executed_sql ?? null,
            });
            break;
          case 'invalid':
            setResults((r) => ({
              ...r,
              status: 'invalid',
              running: false,
              errors: res.errors.length ? res.errors : ['The query is not valid.'],
              message: null,
              failedSql: source.sql,
            }));
            break;
          case 'refused':
            setResults((r) => ({ ...r, status: 'refused', running: false, message: res.text }));
            break;
          default:
            setResults((r) => ({
              ...r,
              status: 'error',
              running: false,
              message: res.text || 'The query could not be run.',
              executedSql: res.executed_sql ?? null,
            }));
        }
      } catch (err) {
        if (stale()) return;
        setResults((r) => ({
          ...r,
          status: 'error',
          running: false,
          message: err instanceof Error ? err.message : 'The query could not be run.',
        }));
      }
    },
    [setEditorText],
  );

  const showResults = useCallback(() => {
    setResultsTab('results');
    showOnMobile('results');
  }, [showOnMobile]);

  const previewTable = useCallback(
    (name: string) => {
      setSelectedTable(name);
      showResults();
      void load({
        source: { kind: 'preview', table: name },
        limit: pageSizeRef.current,
        offset: 0,
        fillEditor: true,
      });
    },
    [load, showResults],
  );

  /**
   * Run SQL through /api/query/run. `stay` keeps the narrow layout on the current tab: an editor
   * Run must never take the user away from their query (the Editor tab shows a run summary with
   * a "View results" button instead).
   */
  const runSql = useCallback(
    (sql: string, { stay = false }: { stay?: boolean } = {}) => {
      const text = sql.trim();
      if (!text) {
        notify('Write a query first, or click a table to start.', 'error');
        return;
      }
      setResultsTab('results');
      if (!stay) showOnMobile('results');
      void load({
        source: { kind: 'query', sql: text, dialect: dialectRef.current },
        limit: pageSizeRef.current,
        offset: 0,
        fillEditor: false,
      });
    },
    [load, notify, showOnMobile],
  );

  const runEditor = useCallback(() => {
    const api = editorRef.current;
    const selection = api?.getSelection() ?? '';
    runSql(selection.trim() ? selection : (api?.getText() ?? editorSqlRef.current), {
      stay: true,
    });
  }, [runSql]);

  const runInEditor = useCallback(
    (sql: string) => {
      setEditorText(sql);
      runSql(sql);
    },
    [setEditorText, runSql],
  );

  const goToPage = useCallback(
    (index: number) => {
      const { source, page } = resultsRef.current;
      if (!source || !page) return;
      void load({
        source,
        limit: page.limit,
        offset: Math.max(0, index) * page.limit,
        fillEditor: false,
      });
    },
    [load],
  );

  const setPageSize = useCallback(
    (n: number) => {
      setPageSizeState(n);
      const { source } = resultsRef.current;
      if (source) void load({ source, limit: n, offset: 0, fillEditor: false });
    },
    [load],
  );

  const retry = useCallback(() => {
    if (lastRequest.current) void load({ ...lastRequest.current, fillEditor: false });
  }, [load]);

  // ---- Chat bridge -------------------------------------------------------------------

  const chatRunning = useRef(false);

  const chatSql = useCallback(
    (sql: SqlEvent, executing: boolean) => {
      if (sql.sql.trim() !== editorSqlRef.current.trim()) setEditorText(sql.sql, { flash: true });
      setNotesSql(sql);
      setExplanation({ text: '', assumptions: [], streaming: true });
      if (executing) {
        chatRunning.current = true;
        // A newer request supersedes any editor run still in flight.
        requestId.current += 1;
        setResults((r) => ({ ...r, running: true }));
      }
      showOnMobile(executing ? 'results' : 'editor');
    },
    [setEditorText, showOnMobile],
  );

  const chatResult = useCallback(
    (result: ResultEvent, sql: SqlEvent | null) => {
      requestId.current += 1;
      chatRunning.current = false;
      const page = fromResultEvent(result);
      const source: ResultSource | null = sql
        ? { kind: 'query', sql: sql.sql, dialect: sql.dialect }
        : null;
      const executedSql = sql?.executed_sql ?? null;
      if (result.error) {
        // Valid in its own dialect, but the SQLite demo database cannot run it. The SQL stays
        // in the editor; the previous grid stays (greyed) behind the message.
        setResults((r) => ({
          ...r,
          status: 'error',
          running: false,
          message: result.error ?? null,
          executedSql,
        }));
        setResultsTab('results');
        showOnMobile('results');
        return;
      }
      lastRequest.current = source
        ? { source, limit: page.limit, offset: 0, fillEditor: false }
        : null;
      setResults({ ...IDLE, status: 'ok', page, source, executedSql });
      setResultsTab('results');
      showOnMobile('results');
    },
    [showOnMobile],
  );

  const chatToken = useCallback(
    (text: string) => setExplanation((e) => ({ ...e, text: e.text + text, streaming: true })),
    [],
  );

  const chatExplanation = useCallback(
    (e: ExplanationEvent) =>
      setExplanation({ text: e.text, assumptions: e.assumptions ?? [], streaming: false }),
    [],
  );

  const chatTurnEnded = useCallback((intent: Intent | null, hadResult: boolean) => {
    setExplanation((e) => (e.streaming ? { ...e, streaming: false } : e));
    if (chatRunning.current) {
      chatRunning.current = false;
      setResults((r) => ({ ...r, running: false }));
    }
    // Editor actions land on the tab they are about.
    if (intent === 'explain') setResultsTab('explanation');
    else if (intent === 'optimize') setResultsTab('notes');
    else if (hadResult) setResultsTab('results');
  }, []);

  const notesHaveContent =
    hasNotes(notesSql, results.warnings) || !!(results.executedSql ?? notesSql?.executed_sql);

  const value = useMemo<WorkbenchValue>(
    () => ({
      tables,
      tablesError,
      reloadTables,
      selectedTable,
      dialect,
      setDialect,
      editorSql,
      setEditorSql,
      registerEditor,
      setEditorText,
      insertIntoEditor,
      focusEditor,
      flashKey,
      runEditor,
      runInEditor,
      previewTable,
      results,
      pageSize,
      setPageSize,
      goToPage,
      retry,
      resultsTab,
      setResultsTab,
      explanation,
      notesSql,
      notesHaveContent,
      chatSql,
      chatResult,
      chatToken,
      chatExplanation,
      chatTurnEnded,
    }),
    [
      tables,
      tablesError,
      reloadTables,
      selectedTable,
      dialect,
      editorSql,
      registerEditor,
      setEditorText,
      insertIntoEditor,
      focusEditor,
      flashKey,
      runEditor,
      runInEditor,
      previewTable,
      results,
      pageSize,
      setPageSize,
      goToPage,
      retry,
      resultsTab,
      explanation,
      notesSql,
      notesHaveContent,
      chatSql,
      chatResult,
      chatToken,
      chatExplanation,
      chatTurnEnded,
    ],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkbench(): WorkbenchValue {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error('useWorkbench must be used inside <WorkbenchProvider>');
  return value;
}
