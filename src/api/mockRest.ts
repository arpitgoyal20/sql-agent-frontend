// Mock mode REST data: threads (fed by mock chat turns), saved queries,
// /api/execute and the 7-table schema — all in memory, reset on page reload.

import {
  DESTRUCTIVE_RE,
  MOCK_SCHEMA,
  SQL,
  CA_CUSTOMERS,
  CUSTOMERS,
  EMPLOYEES_2024,
  MONTHLY_REVENUE,
  PENDING_ORDERS,
  ABOVE_AVERAGE,
  TOP_CUSTOMERS,
  inspectSql,
  knownTable,
  mockTitle,
  passingValidation,
  referencedTables,
} from './mockData';
import type {
  ChatRequest,
  ExecuteRequest,
  ExecuteResponse,
  Intent,
  ResultEvent,
  SavedQuery,
  SavedQueryInput,
  ThreadDetail,
  ThreadMessage,
  ThreadSummary,
} from './types';

export { MOCK_SCHEMA };

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
  saved: SavedQuery[];
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

/** A few sample threads (one per sidebar group) and a saved query. */
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
    saved: [
      {
        id: 'mock-saved-top-customers',
        title: 'Top 10 Customers by Revenue',
        prompt: 'Show the top 10 customers by revenue',
        sql: SQL.topCustomers,
        dialect: 'sqlite',
        explanation:
          'This finds the ten customers who have spent the most across all their orders, valuing each order line as quantity times unit price.',
        created_at: ago(30),
      },
    ],
  };
}

let store: Store = seed();
let counter = 0;

/** Reset the store (tests). */
export function resetMockStore(): void {
  store = seed();
  counter = 0;
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

export function mockRenameThread(id: string, title: string): ThreadSummary {
  const t = threadOr404(id);
  t.title = title.trim().slice(0, 120) || t.title;
  t.updated_at = new Date().toISOString();
  return summary(id, t);
}

export function mockDuplicateThread(id: string): ThreadSummary {
  const t = threadOr404(id);
  const copy: MockThread = {
    ...t,
    title: `${t.title} (copy)`,
    updated_at: new Date().toISOString(),
    messages: t.messages.map((m) => ({ ...m })),
  };
  const newId = `mock-copy-${++counter}-${Date.now().toString(36)}`;
  store.threads.set(newId, copy);
  return summary(newId, copy);
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

export function mockListSaved(): SavedQuery[] {
  return [...store.saved].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockCreateSaved(input: SavedQueryInput): SavedQuery {
  const item: SavedQuery = {
    ...input,
    id: `mock-saved-${++counter}`,
    created_at: new Date().toISOString(),
  };
  store.saved.push(item);
  return item;
}

export function mockDeleteSaved(id: string): void {
  if (!store.saved.some((q) => q.id === id)) throw new MockHttpError(404, 'Saved query not found');
  store.saved = store.saved.filter((q) => q.id !== id);
}

// ---- /api/execute ------------------------------------------------------------------

const KNOWN_RESULTS: [string, ResultEvent][] = [
  [SQL.employees2024, EMPLOYEES_2024],
  [SQL.monthlyRevenue, MONTHLY_REVENUE],
  [SQL.topCustomers, TOP_CUSTOMERS],
  [SQL.customers, CUSTOMERS],
  [SQL.caCustomers, CA_CUSTOMERS],
  [SQL.debugFixed, ABOVE_AVERAGE],
  [SQL.optimized, PENDING_ORDERS],
];

const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function resultFor(sql: string): ResultEvent {
  const exact = KNOWN_RESULTS.find(([known]) => squash(known) === squash(sql));
  if (exact) return exact[1];
  const lower = sql.toLowerCase();
  if (/revenue|sum\(/.test(lower) && /month|strftime/.test(lower)) return MONTHLY_REVENUE;
  if (/customers/.test(lower) && /california/.test(lower)) return CA_CUSTOMERS;
  if (/orderitems/.test(lower) && /customers/.test(lower)) return TOP_CUSTOMERS;
  if (/\bfrom\s+customers\b/.test(lower)) return CUSTOMERS;
  if (/\bfrom\s+orders\b/.test(lower)) return PENDING_ORDERS;
  if (/avg\(/.test(lower)) return ABOVE_AVERAGE;
  if (/\bfrom\s+employees\b/.test(lower)) return EMPLOYEES_2024;
  return { columns: ['result'], rows: [[42]], row_count: 1, truncated: false };
}

/** Deterministic "validator + read-only execution" stand-in. Destructive SQL is never run. */
export function mockExecute({ sql, dialect }: ExecuteRequest): ExecuteResponse {
  const fail = (error: string, check: string): ExecuteResponse => ({
    ok: false,
    sql,
    errors: [error],
    warnings: [],
    validation: passingValidation(dialect).map((v) =>
      v.check === check ? { ...v, status: 'fail', detail: error.replace(/^[A-Z_]+:\s*/, '') } : v,
    ),
    inspection: null,
    result: null,
  });
  if (DESTRUCTIVE_RE.test(sql)) {
    return fail('DESTRUCTIVE: Only read-only SELECT queries can be run.', 'read_only');
  }
  if (!/^\s*(select|with)\b/i.test(sql)) {
    return fail('NOT_SELECT: Only SELECT statements can be run.', 'read_only');
  }
  if (/;\s*\S/.test(sql)) {
    return fail('MULTI: Run one statement at a time.', 'single');
  }
  const unknown = referencedTables(sql).find((t) => !knownTable(t));
  if (unknown) {
    return fail(`UNKNOWN_TABLE: table '${unknown}' does not exist.`, 'tables');
  }
  return {
    ok: true,
    sql,
    errors: [],
    warnings: [],
    validation: passingValidation(dialect),
    inspection: inspectSql(sql),
    result: resultFor(sql),
  };
}
