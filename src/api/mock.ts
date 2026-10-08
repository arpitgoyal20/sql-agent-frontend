// Mock mode (VITE_MOCK=true): replays a scripted SSE sequence per intent so the UI can be
// built and demoed without the backend. Event names and payloads match the real contract
// (REQUIREMENTS.md §4 plus docs/API_ADDITIONS.md).

import {
  ABOVE_AVERAGE,
  CA_CUSTOMERS,
  CUSTOMERS,
  EMPLOYEES_2024,
  MONTHLY_REVENUE,
  PENDING_ORDERS,
  SQL,
  TOP_CUSTOMERS,
  inspectSql,
  passingValidation,
} from './mockData';
import { recordMockTurn } from './mockRest';
import type { ChatEvent, ChatRequest, Intent, ResultEvent, SqlEvent, StepEvent } from './types';

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
const DESTRUCTIVE_TEXT =
  "I can only generate read-only (SELECT) queries, so I can't help with inserting, updating, deleting or altering data. I can help you write a SELECT to preview the rows that would be affected.";

/** The SQL the user pasted, from the first SELECT/WITH onwards. */
function userSql(message: string): string {
  const i = message.search(/\b(select|with)\b/i);
  return (i >= 0 ? message.slice(i) : message).trim();
}

/** Pick a scripted reply from keywords in the message. Exported for tests. */
export function pickScript(req: ChatRequest): Script {
  const m = req.message.trim();
  const lower = m.toLowerCase();
  const hasSql = /\bselect\b[\s\S]+\bfrom\b/i.test(m);
  const run = (r: ResultEvent) => (req.execute ? r : null);

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
  if (hasSql && /^\s*(fix|debug)|why is this|failing|error|broken|wrong/.test(lower)) {
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
        run(ABOVE_AVERAGE),
        'This lists employees whose salary is above the company-wide average salary. The original query referenced a table and column that do not exist and used an average directly in the filter, so the average is now calculated in a subquery first.',
        ['"name" was interpreted as first and last name.'],
      ),
    };
  }
  if (hasSql && /optimi[sz]e|faster|slow|improve/.test(lower)) {
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
        run(PENDING_ORDERS),
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
        'This query reads rows from the tables it names, keeps the rows that match its WHERE filters and returns the selected columns in the requested order.',
        [],
      ),
    };
  }
  if (/^(only|just|sort|order|now|also|and|those|top \d+ of)/.test(lower)) {
    return {
      intent: 'modify',
      events: pipeline(
        'modify',
        'generate_sql',
        sqlEvent(SQL.caCustomers, req, { modified_previous: true }),
        run(CA_CUSTOMERS),
        'This narrows the previous customer list to customers located in California, keeping the same columns.',
        ['"California" matches the full state name stored in Customers.State.'],
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
        run(MONTHLY_REVENUE),
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
    return {
      intent: 'generate',
      events: pipeline(
        'generate',
        'generate_sql',
        sqlEvent(SQL.topCustomers, req),
        run(TOP_CUSTOMERS),
        'This finds the ten customers who have spent the most across all their orders. Each order line is valued as quantity times unit price, added up per customer, and sorted from highest to lowest.',
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
        run(CA_CUSTOMERS),
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
        run(CUSTOMERS),
        'This lists every customer with their ID, name, city and state.',
        [],
      ),
    };
  }
  return {
    intent: 'generate',
    events: pipeline(
      'generate',
      'generate_sql',
      sqlEvent(SQL.employees2024, req),
      run(EMPLOYEES_2024),
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
