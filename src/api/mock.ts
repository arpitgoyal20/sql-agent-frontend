// Mock mode (VITE_MOCK=true): replays a scripted SSE sequence per intent so the UI can be
// built and demoed without the backend. Event names and payloads match the real contract
// (REQUIREMENTS.md §4, docs/API_ADDITIONS.md and docs/BACKEND-CHANGES-v2.md): `result` events
// carry total / limit / offset, and follow-ups build on `current_sql` like the real agent.

import { SQL, inspectSql, knownTable, passingValidation, referencedTables } from './mockData';
import {
  DESTRUCTIVE_TEXT,
  fixSql,
  resultEventFor,
  tableInfo,
  toSqliteMock,
  unknownColumns,
  unsupportedMessage,
  unsupportedOnSqlite,
  validateSql,
} from './mockDb';
import { recordMockTurn } from './mockRest';
import type { ChatEvent, ChatRequest, Intent, ResultEvent, SqlEvent, StepEvent } from './types';
import { humanizeCheckError } from '../context/chatModel';
import { formatSql } from '../utils/sqlFormat';

type Emit = (event: ChatEvent) => void;

const LABELS: Record<string, string> = {
  guard_input: 'Checking request',
  classify_intent: 'Understanding request',
  retrieve_schema: 'Checking database schema',
  generate_sql: 'Generating SQL',
  rewrite_user_sql: 'Rewriting SQL',
  validate_sql: 'Validating query',
  execute_sql: 'Running query',
  explain_sql: 'Explaining',
  clarify: 'Asking a question',
  refuse: 'Checking scope',
};

const step = (node: string, status: StepEvent['status'], errors?: string[]): ChatEvent => ({
  event: 'step',
  data: { node, status, label: LABELS[node] ?? node, ...(errors ? { errors } : {}) },
});

const sqlEvent = (sql: string, req: ChatRequest, extra: Partial<SqlEvent> = {}): ChatEvent => ({
  event: 'sql',
  data: {
    sql,
    dialect: req.dialect,
    warnings: [],
    optimization_notes: [],
    index_suggestions: [],
    issues: [],
    removed_joins: [],
    validation: passingValidation(req.dialect),
    inspection: inspectSql(sql),
    modified_previous: false,
    original_sql: null,
    executed_sql: toSqliteMock(sql, req.dialect),
    ...extra,
  },
});

interface Script {
  intent: Intent;
  events: ChatEvent[];
}

function pipeline(
  intent: Intent,
  writer: 'generate_sql' | 'rewrite_user_sql',
  sql: ChatEvent,
  result: ResultEvent | null,
  explanation: string,
  assumptions: string[],
  opts: { retryErrors?: string[] } = {},
): ChatEvent[] {
  const events: ChatEvent[] = [
    step('guard_input', 'start'),
    step('guard_input', 'ok'),
    step('classify_intent', 'start'),
    step('classify_intent', 'ok'),
    { event: 'intent', data: { intent } },
    step('retrieve_schema', 'start'),
    step('retrieve_schema', 'ok'),
    step(writer, 'start'),
    step(writer, 'ok'),
    step('validate_sql', 'start'),
  ];
  if (opts.retryErrors) {
    events.push(step('validate_sql', 'retry', opts.retryErrors), step(writer, 'start'));
    events.push(step(writer, 'ok'), step('validate_sql', 'start'));
  }
  events.push(step('validate_sql', 'ok'), sql, step('execute_sql', 'start'));
  if (result) events.push(step('execute_sql', 'ok'), { event: 'result', data: result });
  else events.push(step('execute_sql', 'skip'));
  events.push(step('explain_sql', 'start'));
  for (const word of explanation.match(/\S+\s*/g) ?? []) {
    events.push({ event: 'token', data: { text: word } });
  }
  events.push(step('explain_sql', 'ok'), {
    event: 'explanation',
    data: { text: explanation, assumptions },
  });
  return events;
}

function shortCircuit(intent: Intent, node: 'refuse' | 'clarify', final: ChatEvent): ChatEvent[] {
  return [
    step('guard_input', 'start'),
    step('guard_input', 'ok'),
    step('classify_intent', 'start'),
    step('classify_intent', 'ok'),
    { event: 'intent', data: { intent } },
    step(node, 'start'),
    final,
    step(node, 'ok'),
  ];
}

const OUT_OF_SCOPE_TEXT =
  "I'm designed to assist only with SQL and database-related tasks. Please ask a question related to the provided database schema.";
/** The SQL in a message: a ```sql fenced block, or from the first SELECT/WITH onwards. */
function userSql(message: string): string {
  const fenced = /```(?:sql)?\s*\n([\s\S]*?)```/i.exec(message);
  if (fenced) return fenced[1].trim();
  const i = message.search(/\b(select|with)\b/i);
  return (i >= 0 ? message.slice(i) : message).trim();
}

const pretty = (sql: string) => {
  try {
    return formatSql(sql, 'sqlite');
  } catch {
    return sql;
  }
};

/** Drop a trailing `;` and the browser's LIMIT/OFFSET, like the backend does for current_sql. */
function withoutPaging(sql: string): string {
  return sql
    .trim()
    .replace(/;\s*$/, '')
    .replace(/\s+limit\s+\d+(\s+offset\s+\d+)?\s*$/i, '')
    .trim();
}

/** Add `cond` to a query's WHERE (or create one), before ORDER BY / LIMIT. */
function addFilter(sql: string, cond: string): string {
  const base = withoutPaging(sql);
  const tail = /\s+(order\s+by|group\s+by)\b[\s\S]*$/i.exec(base);
  const head = tail ? base.slice(0, tail.index) : base;
  const rest = tail ? tail[0] : '';
  const joined = /\bwhere\b/i.test(head) ? `${head} AND ${cond}` : `${head} WHERE ${cond}`;
  return pretty(`${joined}${rest}`);
}

const STATES = ['California', 'Texas', 'New York', 'Florida', 'Washington', 'Illinois', 'Colorado'];
const ORDER_STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

/** The follow-up query for "only those from California" etc., built on the editor's SQL. */
function modifiedSql(message: string, current: string | undefined): string {
  const lower = message.toLowerCase();
  const base = current?.trim() ? current : SQL.customers;
  const table = referencedTables(base).map(knownTable)[0];
  const state = STATES.find((st) => lower.includes(st.toLowerCase()));
  const status = ORDER_STATUSES.find((st) => lower.includes(st));
  if (table === 'Customers') return addFilter(base, `State = '${state ?? 'California'}'`);
  if (table === 'Orders' && status) return addFilter(base, `Status = '${status}'`);
  return SQL.caCustomers;
}

/** A plain-English description of a query for the mock "explain" turn. */
function describe(sql: string): string {
  const tables = referencedTables(sql).map((t) => knownTable(t) ?? t);
  const parts = [
    `This query reads rows from ${tables.length ? tables.join(' and ') : 'the database'}`,
  ];
  if (/\bjoin\b/i.test(sql)) parts.push('matches related rows across the tables');
  if (/\bwhere\b/i.test(sql)) parts.push('keeps only the rows that match its WHERE filter');
  if (/\bgroup\s+by\b/i.test(sql)) parts.push('groups them and calculates totals per group');
  if (/select\s+\*/i.test(sql)) parts.push('returns every column');
  else parts.push('returns the selected columns');
  const limit = /\blimit\s+(\d+)/i.exec(sql);
  if (limit) parts.push(`stops after ${limit[1]} rows`);
  return `${parts.join(', ')}.`;
}

/** Generic optimize: replace SELECT * on one table with its columns; suggest an index. */
function optimizeGeneric(sql: string): Partial<SqlEvent> & { sql: string } {
  const table = tableInfo(referencedTables(sql)[0] ?? '');
  const notes: string[] = [];
  let out = withoutPaging(sql);
  const limit = /\blimit\s+\d+(\s+offset\s+\d+)?\s*;?\s*$/i.exec(sql.trim())?.[0] ?? '';
  if (table && /select\s+\*/i.test(out)) {
    out = out.replace(/select\s+\*/i, `SELECT ${table.columns.map((c) => c.name).join(', ')}`);
    notes.push(
      `Replaced SELECT * with the ${table.columns.length} columns of ${table.name}, so the result no longer changes if columns are added.`,
    );
  }
  if (limit) notes.push('Kept the LIMIT so only one page of rows is read.');
  if (!notes.length) notes.push('The query already reads only what it needs; no rewrite needed.');
  const filter = /\bwhere\s+(?:\w+\.)?(\w+)\s*(=|>|<|>=|<=|like)/i.exec(out);
  const index =
    table && filter
      ? [
          `CREATE INDEX idx_${table.name.toLowerCase()}_${filter[1].toLowerCase()} ON ${table.name}(${filter[1]});`,
        ]
      : [];
  return {
    sql: pretty(`${out}${limit ? ` ${limit.replace(/;\s*$/, '')}` : ''}`),
    optimization_notes: notes,
    index_suggestions: index,
  };
}

/** Pick a scripted reply from keywords in the message. Exported for tests. */
export function pickScript(req: ChatRequest): Script {
  const m = req.message.trim();
  const lower = m.toLowerCase();
  const hasSql = /\bselect\b[\s\S]+\bfrom\b/i.test(m);
  const run = (sql: string): ResultEvent | null => {
    if (!req.execute) return null;
    if (unsupportedOnSqlite(sql, req.dialect)) {
      return {
        columns: [],
        rows: [],
        row_count: 0,
        truncated: false,
        total: 0,
        limit: 0,
        offset: 0,
        error: unsupportedMessage(req.dialect),
      };
    }
    return resultEventFor(toSqliteMock(sql, req.dialect) ?? sql);
  };
  // Editor actions arrive as "Explain / Optimize / Fix this query:\n```sql …```".
  const action = /^(explain|optimi[sz]e|fix) this query:/i.exec(m)?.[1].toLowerCase() ?? null;

  if (lower.includes('mock error')) {
    return {
      intent: 'generate',
      events: [
        step('guard_input', 'start'),
        step('guard_input', 'ok'),
        step('classify_intent', 'start'),
        {
          event: 'error',
          data: { text: 'Something went wrong while answering. Please try again.' },
        },
      ],
    };
  }
  if (/fifa|world cup|weather|poem|president|capital of/.test(lower)) {
    return {
      intent: 'out_of_scope',
      events: shortCircuit('out_of_scope', 'refuse', {
        event: 'refusal',
        data: { text: OUT_OF_SCOPE_TEXT, reason: 'out_of_scope' },
      }),
    };
  }
  if (!hasSql && /\b(delete|drop|insert|update|truncate|alter)\b/.test(lower)) {
    return {
      intent: 'destructive',
      events: shortCircuit('destructive', 'refuse', {
        event: 'refusal',
        data: { text: DESTRUCTIVE_TEXT, reason: 'destructive' },
      }),
    };
  }
  if (/important ones|\bthe best\b|interesting/.test(lower)) {
    return {
      intent: 'clarify',
      events: shortCircuit('clarify', 'clarify', {
        event: 'clarify',
        data: {
          text: 'Which "important" records do you mean? For example: Customers with the highest total order value, Orders with Status = \'pending\', or Employees with the highest Salary?',
        },
      }),
    };
  }
  const isDebug =
    action === 'fix' ||
    (!action && hasSql && /^\s*(fix|debug)|why is this|failing|error|broken|wrong/.test(lower));
  if (isDebug && unknownColumns(userSql(m)).length) {
    const original = userSql(m);
    const fixed = pretty(fixSql(original));
    const reported = /\nError:\s*([\s\S]+)$/.exec(m)?.[1].split(/;\s+(?=[A-Z_]+:)/) ?? [];
    return {
      intent: 'debug',
      events: pipeline(
        'debug',
        'rewrite_user_sql',
        sqlEvent(fixed, req, {
          original_sql: original,
          issues: (reported.length ? reported : validateSql(original)).map(humanizeCheckError),
        }),
        run(fixed),
        `The original query referenced a column that does not exist. ${describe(fixed)}`,
        ['The closest existing column name was used in place of the unknown one.'],
      ),
    };
  }
  if (isDebug) {
    return {
      intent: 'debug',
      events: pipeline(
        'debug',
        'rewrite_user_sql',
        sqlEvent(SQL.debugFixed, req, {
          original_sql: userSql(m),
          issues: [
            'Table "Employee" does not exist; the table is "Employees".',
            'Column "name" does not exist; use FirstName and LastName.',
            'Aggregate AVG() cannot be used directly in WHERE; compare against a subquery instead.',
          ],
        }),
        run(SQL.debugFixed),
        'This lists employees whose salary is above the company-wide average salary. The original query referenced a table and column that do not exist and used an average directly in the filter, so the average is now calculated in a subquery first.',
        ['"name" was interpreted as first and last name.'],
      ),
    };
  }
  const isOptimize =
    action === 'optimize' || (!action && hasSql && /optimi[sz]e|faster|slow|improve/.test(lower));
  if (isOptimize && !/\bjoin\s+customers\b/i.test(userSql(m))) {
    const original = userSql(m);
    const opt = optimizeGeneric(original);
    return {
      intent: 'optimize',
      events: pipeline(
        'optimize',
        'rewrite_user_sql',
        sqlEvent(opt.sql, req, { ...opt, original_sql: original }),
        run(opt.sql),
        describe(opt.sql),
        [],
      ),
    };
  }
  if (isOptimize) {
    return {
      intent: 'optimize',
      events: pipeline(
        'optimize',
        'rewrite_user_sql',
        sqlEvent(SQL.optimized, req, {
          original_sql: userSql(m),
          optimization_notes: [
            'Replaced SELECT * with the four columns the result needs.',
            'Filtered on Orders.Status before the join so fewer rows are joined.',
          ],
          index_suggestions: ['CREATE INDEX idx_orders_status_date ON Orders(Status, OrderDate);'],
          removed_joins: [],
        }),
        run(SQL.optimized),
        'This returns pending orders with the customer who placed each one, newest first. It reads only the columns it needs instead of every column from both tables.',
        [],
      ),
    };
  }
  if (hasSql) {
    const sql = userSql(m);
    return {
      intent: 'explain',
      events: pipeline(
        'explain',
        'rewrite_user_sql',
        sqlEvent(sql, req, { original_sql: sql }),
        null,
        describe(sql),
        [],
      ),
    };
  }
  if (/^(only|just|sort|order|now|also|and|those|top \d+ of)/.test(lower)) {
    const sql = modifiedSql(m, req.current_sql);
    const state = STATES.find((st) => lower.includes(st.toLowerCase())) ?? 'California';
    return {
      intent: 'modify',
      events: pipeline(
        'modify',
        'generate_sql',
        sqlEvent(sql, req, { modified_previous: true }),
        run(sql),
        `This narrows the previous query to the matching rows, keeping the same columns. ${describe(sql)}`,
        [`"${state}" matches the full state name stored in Customers.State.`],
      ),
    };
  }
  if (/revenue/.test(lower) && /month/.test(lower)) {
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(SQL.monthlyRevenue, req),
        run(SQL.monthlyRevenue),
        'This adds up the value of every order line (quantity × unit price) for orders placed in 2025 and groups the totals by calendar month, from January to December.',
        ['Revenue includes orders of every status, including cancelled ones.'],
        {
          retryErrors: [
            "UNKNOWN_COLUMN: column 'revenue_total' does not exist. Columns available: OrderItems.Quantity, OrderItems.UnitPrice, Orders.OrderDate",
          ],
        },
      ),
    };
  }
  if (/top \d+ customers|by revenue|total order value/.test(lower)) {
    const n = /top (\d+)/.exec(lower)?.[1] ?? '10';
    const sql = SQL.topCustomers.replace('LIMIT 10', `LIMIT ${n}`);
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(sql, req),
        run(sql),
        `This finds the ${n === '10' ? 'ten' : n} customers who have spent the most across all their orders. Each order line is valued as quantity times unit price, added up per customer, and sorted from highest to lowest.`,
        ['Revenue includes orders of every status, including cancelled ones.'],
        {
          retryErrors: ["UNKNOWN_TABLE: table 'Customer' does not exist. Did you mean: Customers?"],
        },
      ),
    };
  }
  if (/customers/.test(lower) && /california/.test(lower)) {
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(SQL.caCustomers, req),
        run(SQL.caCustomers),
        'This lists customers located in California with their ID, name, city and state.',
        ['"California" matches the full state name stored in Customers.State.'],
      ),
    };
  }
  if (/customers/.test(lower)) {
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(SQL.customers, req),
        run(SQL.customers),
        'This lists every customer with their ID, name, city and state.',
        [],
      ),
    };
  }
  if (/employees/.test(lower) && /department/.test(lower)) {
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(SQL.employeesWithDepartment, req),
        run(SQL.employeesWithDepartment),
        'This lists employees hired after January 2024 together with the name of their department, joining each employee to the Departments table through DepartmentID. The newest hires come last.',
        ['"After January 2024" was read as hired on or after 2024-02-01.'],
      ),
    };
  }
  return {
    intent: 'generate',
    events: pipeline(
      'generate',
      'generate_sql',
      sqlEvent(SQL.employees2024, req),
      run(SQL.employees2024),
      'This lists employees who joined the company on or after 1 January 2024, showing their name, hire date and salary. Results are ordered from the earliest to the most recent hire.',
      ['"After January 2024" was read as on or after 2024-01-01.'],
    ),
  };
}

/** Multiplier for every scripted delay; tests lower it to run faster. */
export const mockTiming = { scale: 1 };

function delayFor(event: ChatEvent): number {
  const base =
    event.event === 'token'
      ? 25
      : event.event === 'step' && event.data.status === 'start'
        ? 350
        : 60;
  return base * mockTiming.scale;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

// What the backend would persist for the assistant turn.
function replyText(events: ChatEvent[]): string {
  for (const e of [...events].reverse()) {
    if (e.event === 'explanation' || e.event === 'refusal' || e.event === 'clarify') {
      return e.data.text;
    }
    if (e.event === 'error') return e.data.text;
  }
  return '';
}

function sqlText(events: ChatEvent[]): string | null {
  const e = events.find((x) => x.event === 'sql');
  return e?.event === 'sql' ? e.data.sql : null;
}

function kindOf(intent: Intent): 'answer' | 'clarify' | 'refusal' {
  if (intent === 'clarify') return 'clarify';
  if (intent === 'destructive' || intent === 'out_of_scope') return 'refusal';
  return 'answer';
}

/** Replay the script for `req` through `emit`, ending with `done`. */
export async function runMockChat(
  req: ChatRequest,
  emit: Emit,
  signal: AbortSignal,
): Promise<void> {
  const { intent, events } = pickScript(req);
  for (const event of events) {
    await sleep(delayFor(event), signal);
    if (signal.aborted) return;
    emit(event);
  }
  await sleep(60 * mockTiming.scale, signal);
  if (signal.aborted) return;
  const failed = events.some((e) => e.event === 'error');
  if (!failed) recordMockTurn(req, intent, kindOf(intent), replyText(events), sqlText(events));
  emit({ event: 'done', data: { thread_id: req.thread_id, intent: failed ? null : intent } });
}
