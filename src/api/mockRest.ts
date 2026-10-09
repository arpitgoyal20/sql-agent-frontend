// Mock mode REST data: threads (fed by mock chat turns), /api/tables, table previews and
// /api/query/run — all in memory, reset on page reload. The X-Client-Id header is not checked.

import { MOCK_TABLES, SQL, mockTitle } from './mockData';
import { previewMock, runMock, tableInfo } from './mockDb';
import type {
  ChatRequest,
  Intent,
  PreviewResponse,
  RunRequest,
  RunResponse,
  TablesResponse,
  ThreadDetail,
  ThreadMessage,
  ThreadSummary,
} from './types';

/** Thrown by mock endpoints with the status and `detail` the real backend would send. */
export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---- Threads and saved queries ----------------------------------------------

interface MockThread {
  title: string;
  updated_at: string;
  messages: ThreadMessage[];
  last_sql: string | null;
}

interface Store {
  threads: Map<string, MockThread>;
}

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

function thread(
  title: string,
  at: string,
  prompt: string,
  sql: string,
  reply: string,
  intent: Intent = 'generate',
): MockThread {
  return {
    title,
    updated_at: at,
    last_sql: sql,
    messages: [
      { role: 'user', content: prompt, created_at: at },
      { role: 'assistant', content: reply, intent, sql, kind: 'answer', created_at: at },
    ],
  };
}

/** A few sample threads. */
function seed(): Store {
  return {
    threads: new Map([
      [
        `mock-thread-employees`,
        thread(
          'Employees Hired — 2024',
          ago(2),
          'Show all employees hired after January 2024',
          SQL.employees2024,
          'This lists employees who joined the company on or after 1 January 2024, showing their name, hire date and salary.',
        ),
      ],
      [
        `mock-thread-customers`,
        thread(
          'Customers by State',
          ago(26),
          'Show all customers',
          SQL.customers,
          'This lists every customer with their ID, name, city and state.',
        ),
      ],
      [
        `mock-thread-orders`,
        thread(
          'Pending Orders',
          ago(24 * 4),
          "Optimize this query: SELECT * FROM Orders o JOIN Customers c ON c.CustomerID = o.CustomerID WHERE o.Status = 'pending'",
          SQL.optimized,
          'This returns pending orders with the customer who placed each one, newest first.',
          'optimize',
        ),
      ],
    ]),
  };
}

let store: Store = seed();

/** Reset the store (tests). */
export function resetMockStore(): void {
  store = seed();
}

const summary = (thread_id: string, t: MockThread): ThreadSummary => ({
  thread_id,
  title: t.title,
  updated_at: t.updated_at,
});

export function mockListThreads(): ThreadSummary[] {
  return [...store.threads.entries()]
    .map(([id, t]) => summary(id, t))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function threadOr404(id: string): MockThread {
  const t = store.threads.get(id);
  if (!t) throw new MockHttpError(404, 'Thread not found');
  return t;
}

export function mockGetThread(id: string): ThreadDetail {
  const t = threadOr404(id);
  return { messages: [...t.messages], last_sql: t.last_sql };
}

export function mockDeleteThread(id: string): void {
  threadOr404(id);
  store.threads.delete(id);
}

/** Persist one finished mock turn the way the backend would (with a generated title). */
export function recordMockTurn(
  req: ChatRequest,
  intent: Intent,
  kind: 'answer' | 'clarify' | 'refusal',
  reply: string,
  sql: string | null,
): void {
  const now = new Date().toISOString();
  const threads = store.threads;
  const t = threads.get(req.thread_id) ?? {
    title: mockTitle(req.message),
    updated_at: now,
    messages: [],
    last_sql: null,
  };
  t.messages.push(
    { role: 'user', content: req.message, created_at: now },
    { role: 'assistant', content: reply, intent, sql, kind, created_at: now },
  );
  t.updated_at = now;
  if (sql) t.last_sql = sql;
  threads.set(req.thread_id, t);
}

// ---- Workbench: /api/tables, preview, /api/query/run ---------------------------------------

export function mockTables(): TablesResponse {
  return { tables: MOCK_TABLES };
}

export function mockPreview(name: string, limit: number, offset: number): PreviewResponse {
  const table = tableInfo(name);
  if (!table) throw new MockHttpError(404, 'That table does not exist.');
  const size = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  return previewMock(table, size, Math.max(Math.trunc(offset) || 0, 0));
}

export function mockRun({ sql, dialect, limit, offset }: RunRequest): RunResponse {
  const size = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  return runMock(sql, size, Math.max(Math.trunc(offset) || 0, 0), dialect);
}
