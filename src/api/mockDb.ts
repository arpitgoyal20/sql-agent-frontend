// Mock mode "database": deterministic generated rows for the 7 demo tables (with the real row
// counts), a tiny engine for single-table SELECTs, and a regex imitation of the backend
// validator. It backs GET /api/tables/{name}/preview, POST /api/query/run and the result events
// of the scripted chat. None of this runs against the real backend.

import {
  ABOVE_AVERAGE,
  CA_CUSTOMERS,
  EMPLOYEES_2024,
  MOCK_TABLES,
  MONTHLY_REVENUE,
  PENDING_ORDERS,
  SQL,
  TOP_CUSTOMERS,
  knownTable,
  referencedTables,
} from './mockData';
import type { CellValue, Dialect, PageData, ResultEvent, RunResponse, TableInfo } from './types';
import { formatSql } from '../utils/sqlFormat';

// ---- Generated rows -------------------------------------------------------------------

/** Small deterministic hash so every reload shows the same data. */
function pick(i: number, salt: number, m: number): number {
  let h = Math.imul((i + 1) ^ Math.imul(salt, 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % m;
}

const FIRST = [
  'Priya',
  'Marcus',
  'Elena',
  'Tom',
  'Aisha',
  'Daniel',
  'Mei',
  'Luis',
  'Hannah',
  'Kofi',
  'Olivia',
  'Ivan',
  'Sara',
  'Jennifer',
  'Robert',
  'Noah',
  'Yuki',
  'Fatima',
  'Liam',
  'Grace',
];
const LAST = [
  'Shah',
  'Lee',
  'García',
  "O'Brien",
  'Khan',
  'Okafor',
  'Wong',
  'Romero',
  'Becker',
  'Mensah',
  'Park',
  'Petrov',
  'Nilsson',
  'Ortiz',
  'Hall',
  'Brooks',
  'Tanaka',
  'Haddad',
  'Murphy',
  'Chen',
];
const PLACES: [string, string][] = [
  ['Los Angeles', 'California'],
  ['Houston', 'Texas'],
  ['San Diego', 'California'],
  ['Buffalo', 'New York'],
  ['Miami', 'Florida'],
  ['San Jose', 'California'],
  ['Austin', 'Texas'],
  ['Seattle', 'Washington'],
  ['Chicago', 'Illinois'],
  ['Denver', 'Colorado'],
];
const DEPARTMENTS = [
  'Sales',
  'Engineering',
  'Marketing',
  'Finance',
  'Support',
  'Operations',
  'People',
  'Legal',
];
const CATEGORIES = ['Electronics', 'Office', 'Home', 'Outdoors', 'Books'];
const PRODUCTS = [
  'Desk Lamp',
  'Notebook',
  'Monitor',
  'Backpack',
  'Headphones',
  'Kettle',
  'Chair',
  'Tent',
  'Mouse',
  'Planner',
];
const STATUSES = ['delivered', 'delivered', 'shipped', 'pending', 'cancelled', 'delivered'];
const METHODS = ['card', 'card', 'paypal', 'bank_transfer'];

const pad = (n: number) => String(n).padStart(2, '0');
function dateFrom(start: Date, days: number): string {
  const d = new Date(start.getTime() + days * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const money = (cents: number) => Math.round(cents) / 100;
const person = (i: number) => [FIRST[pick(i, 1, FIRST.length)], LAST[pick(i, 2, LAST.length)]];
const emailOf = (first: string, last: string, i: number, domain: string) =>
  `${first}.${last}${i}@${domain}`
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9.@]/g, '');

const productPrice = (id: number) => money(499 + pick(id, 9, 40000));

const GENERATORS: Record<string, (id: number) => CellValue[]> = {
  Departments: (id) => [id, DEPARTMENTS[id - 1], id === 8 ? null : PLACES[id % PLACES.length][0]],
  Employees: (id) => {
    const [first, last] = person(id);
    return [
      id,
      first,
      last,
      emailOf(first, last, id, 'company.com'),
      dateFrom(new Date(Date.UTC(2019, 0, 7)), pick(id, 3, 2550)),
      id % 37 === 0 ? null : 45000 + pick(id, 4, 115) * 1000,
      ((id - 1) % 8) + 1,
      id <= 8 ? null : ((id * 7) % 8) + 1,
    ];
  },
  Customers: (id) => {
    const [first, last] = person(id + 500);
    const [city, state] = PLACES[pick(id, 5, PLACES.length)];
    return [
      id,
      `${first} ${last}`,
      id % 41 === 0 ? null : emailOf(first, last, id, 'example.com'),
      city,
      state,
      dateFrom(new Date(Date.UTC(2022, 0, 3)), pick(id, 6, 1400)),
    ];
  },
  Products: (id) => [
    id,
    `${PRODUCTS[(id - 1) % PRODUCTS.length]} ${String.fromCharCode(65 + Math.floor((id - 1) / 10))}`,
    id % 17 === 0 ? null : CATEGORIES[pick(id, 7, CATEGORIES.length)],
    productPrice(id),
  ],
  Orders: (id) => [
    id,
    pick(id, 8, 500) + 1,
    id % 23 === 0 ? null : pick(id, 10, 200) + 1,
    dateFrom(new Date(Date.UTC(2024, 0, 1)), Math.floor((id - 1) * 0.365)),
    STATUSES[pick(id, 11, STATUSES.length)],
  ],
  OrderItems: (id) => {
    const product = pick(id, 12, 50) + 1;
    return [id, ((id - 1) % 2000) + 1, product, 1 + pick(id, 13, 5), productPrice(product)];
  },
  Payments: (id) => [
    id,
    id,
    money(1999 + pick(id, 14, 90000)),
    METHODS[pick(id, 15, METHODS.length)],
    id % 29 === 0
      ? null
      : `${dateFrom(new Date(Date.UTC(2024, 0, 2)), Math.floor((id - 1) * 0.365))}T${pad(8 + pick(id, 16, 10))}:${pad(pick(id, 17, 60))}:00`,
  ],
};

const cache = new Map<string, CellValue[][]>();

export function tableInfo(name: string): TableInfo | null {
  const canonical = knownTable(name);
  return MOCK_TABLES.find((t) => t.name === canonical) ?? null;
}

/** Every row of a table, generated once and cached. */
export function tableRows(table: TableInfo): CellValue[][] {
  let rows = cache.get(table.name);
  if (!rows) {
    const make = GENERATORS[table.name];
    rows = Array.from({ length: table.row_count }, (_, i) => make(i + 1));
    cache.set(table.name, rows);
  }
  return rows;
}

// ---- Validator imitation ----------------------------------------------------------------

export const DESTRUCTIVE_TEXT =
  "I can only generate read-only (SELECT) queries, so I can't help with inserting, updating, deleting or altering data. I can help you write a SELECT to preview the rows that would be affected.";
export const TIMEOUT_TEXT = 'Query took longer than 5 seconds and was stopped.';
const DESTRUCTIVE_WORDS =
  /\b(insert|update|delete|drop|alter|truncate|create|attach|detach|pragma|vacuum|grant|merge)\b/i;

/** SQL with comments removed and string literals emptied, for keyword checks. */
function scrub(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

const KEYWORDS = new Set(
  `select from where and or not null is in like glob between group by order having limit offset as on
  join inner left right full outer cross natural using union all intersect except distinct case when
  then else end asc desc exists with recursive true false collate escape cast integer int real text
  numeric date datetime time strftime julianday count sum avg min max total round abs coalesce ifnull
  nullif lower upper length substr substring trim ltrim rtrim replace instr printf typeof random over
  partition rows range preceding following current row unbounded row_number rank dense_rank lag lead
  first_value last_value ntile filter window extract year month day interval now current_date
  current_timestamp concat iif if date_trunc to_char varchar char bigint decimal float double boolean
  values top nulls first last unixepoch`.split(/\s+/),
);

const ALL_COLUMNS = new Map<string, string>(
  MOCK_TABLES.flatMap((t) => t.columns.map((c) => [c.name.toLowerCase(), c.name] as const)),
);

/** Identifiers that are not a keyword, table, column or alias: the mock's UNKNOWN_COLUMN. */
export function unknownColumns(sql: string): string[] {
  const text = scrub(sql).replace(/"(\w+)"/g, '$1');
  const known = new Set(KEYWORDS);
  for (const t of MOCK_TABLES) known.add(t.name.toLowerCase());
  for (const m of text.matchAll(/\bas\s+(\w+)/gi)) known.add(m[1].toLowerCase());
  for (const m of text.matchAll(/\b(?:from|join)\s+\w+\s+(?:as\s+)?(\w+)/gi)) {
    known.add(m[1].toLowerCase());
  }
  for (const m of text.matchAll(/\b(\w+)\s+as\s*\(/gi)) known.add(m[1].toLowerCase());
  const out: string[] = [];
  for (const m of text.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const word = m[0].toLowerCase();
    if (known.has(word) || ALL_COLUMNS.has(word)) continue;
    if (!out.includes(m[0])) out.push(m[0]);
  }
  return out;
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Columns of the tables a query reads, as `Table.Column`. */
function columnsOf(sql: string): { table: string; column: string }[] {
  const tables = referencedTables(sql)
    .map(tableInfo)
    .filter((t): t is TableInfo => !!t);
  return (tables.length ? tables : MOCK_TABLES).flatMap((t) =>
    t.columns.map((c) => ({ table: t.name, column: c.name })),
  );
}

/** The closest existing column to an unknown name, for "Did you mean" and the mock fix. */
export function closestColumn(sql: string, name: string): string {
  const lower = name.toLowerCase();
  let best = columnsOf(sql)[0]?.column ?? 'Name';
  let score = Infinity;
  for (const { column } of columnsOf(sql)) {
    const s = distance(lower, column.toLowerCase());
    if (s < score) [best, score] = [column, s];
  }
  return best;
}

/** `CATEGORY: message` validator errors (empty when the query passes). */
export function validateSql(sql: string): string[] {
  const text = scrub(sql);
  if (!/^\s*(select|with)\b/i.test(text)) {
    return ['NOT_SELECT: only SELECT statements can be run.'];
  }
  if (/;\s*\S/.test(text)) return ['MULTI: run one statement at a time.'];
  const tables = referencedTables(text);
  const missing = tables.find((t) => !knownTable(t));
  if (missing) {
    return [
      `UNKNOWN_TABLE: table '${missing}' does not exist. Available tables: ${MOCK_TABLES.map((t) => t.name).join(', ')}`,
    ];
  }
  return unknownColumns(sql).map((name) => {
    const available = columnsOf(sql)
      .map((c) => `${c.table}.${c.column}`)
      .join(', ');
    return `UNKNOWN_COLUMN: column '${name}' does not exist. Did you mean: ${closestColumn(sql, name)}? Columns available: ${available}`;
  });
}

/** Replace unknown columns with their closest match (the mock's "corrected SQL"). */
export function fixSql(sql: string): string {
  let out = sql;
  for (const name of unknownColumns(sql)) {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), closestColumn(sql, name));
  }
  return out;
}

// ---- Tiny engine for single-table SELECTs ----------------------------------------------------

interface Condition {
  index: number;
  op: string;
  value: CellValue;
}

interface Plan {
  table: TableInfo;
  columns: number[] | 'count';
  where: Condition[];
  order: { index: number; desc: boolean } | null;
  limit: number | null;
  offset: number;
}

const SIMPLE =
  /^select\s+(.+?)\s+from\s+"?(\w+)"?(?:\s+(?:as\s+)?(?!where\b|order\b|limit\b)(\w+))?(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+)(?:\s+offset\s+(\d+))?)?$/i;

function literal(raw: string): CellValue {
  if (raw.startsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return Number(raw);
}

/** Plan a `SELECT cols|*|COUNT(*) FROM t [WHERE a op v AND …] [ORDER BY c] [LIMIT n]`. */
function plan(sql: string): Plan | null {
  const text = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;$/, '')
    .trim();
  const m = SIMPLE.exec(text);
  if (!m) return null;
  const table = tableInfo(m[2]);
  if (!table) return null;
  const indexOf = (ref: string) =>
    table.columns.findIndex(
      (c) =>
        c.name.toLowerCase() ===
        ref
          .replace(/^\w+\./, '')
          .replace(/"/g, '')
          .toLowerCase(),
    );

  let columns: Plan['columns'];
  if (/^count\(\*\)(\s+as\s+\w+)?$/i.test(m[1])) columns = 'count';
  else if (m[1] === '*') columns = table.columns.map((_, i) => i);
  else {
    columns = m[1].split(',').map((part) => indexOf(part.trim()));
    if (columns.some((i) => i < 0)) return null;
  }

  const where: Condition[] = [];
  if (m[4]) {
    for (const part of m[4].split(/\s+and\s+/i)) {
      const c = /^([\w.]+)\s*(=|!=|<>|>=|<=|>|<|like)\s*('(?:[^']|'')*'|-?\d+(?:\.\d+)?)$/i.exec(
        part.trim(),
      );
      if (!c || indexOf(c[1]) < 0) return null;
      where.push({ index: indexOf(c[1]), op: c[2].toLowerCase(), value: literal(c[3]) });
    }
  }

  let order: Plan['order'] = null;
  if (m[5]) {
    const o = /^([\w.]+)(?:\s+(asc|desc))?$/i.exec(m[5].trim());
    if (!o || indexOf(o[1]) < 0) return null;
    order = { index: indexOf(o[1]), desc: (o[2] ?? '').toLowerCase() === 'desc' };
  }
  return {
    table,
    columns,
    where,
    order,
    limit: m[6] ? Number(m[6]) : null,
    offset: m[7] ? Number(m[7]) : 0,
  };
}

function matches(row: CellValue[], c: Condition): boolean {
  const v = row[c.index];
  if (v === null) return false;
  switch (c.op) {
    case '=':
      return v === c.value || String(v).toLowerCase() === String(c.value).toLowerCase();
    case '!=':
    case '<>':
      return String(v) !== String(c.value);
    case '>':
      return (v as number) > (c.value as number);
    case '<':
      return (v as number) < (c.value as number);
    case '>=':
      return (v as number) >= (c.value as number);
    case '<=':
      return (v as number) <= (c.value as number);
    default: {
      const pattern = String(c.value)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*');
      return new RegExp(`^${pattern.replace(/_/g, '.')}$`, 'i').test(String(v));
    }
  }
}

function execute(p: Plan): { columns: string[]; rows: CellValue[][] } {
  let rows = tableRows(p.table).filter((r) => p.where.every((c) => matches(r, c)));
  if (p.order) {
    const { index, desc } = p.order;
    rows = [...rows].sort((a, b) => {
      const [x, y] = [a[index], b[index]];
      const cmp = x === y ? 0 : x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
      return desc ? -cmp : cmp;
    });
  }
  if (p.limit !== null || p.offset) {
    rows = rows.slice(p.offset, p.limit === null ? undefined : p.offset + p.limit);
  }
  if (p.columns === 'count') return { columns: ['COUNT(*)'], rows: [[rows.length]] };
  const cols = p.columns;
  return {
    columns: cols.map((i) => p.table.columns[i].name),
    rows: rows.map((r) => cols.map((i) => r[i])),
  };
}

// Fixed results for the scripted multi-table queries.
const KNOWN_RESULTS: [string, ResultEvent][] = [
  [SQL.employees2024, EMPLOYEES_2024],
  [SQL.monthlyRevenue, MONTHLY_REVENUE],
  [SQL.topCustomers, TOP_CUSTOMERS],
  [SQL.caCustomers, CA_CUSTOMERS],
  [SQL.debugFixed, ABOVE_AVERAGE],
  [SQL.optimized, PENDING_ORDERS],
];

const squash = (s: string) => s.replace(/\s+/g, ' ').replace(/;\s*$/, '').trim().toLowerCase();

function fixtureFor(sql: string): ResultEvent {
  const exact = KNOWN_RESULTS.find(([known]) => squash(known) === squash(sql));
  if (exact) return exact[1];
  const lower = sql.toLowerCase();
  if (/revenue|sum\(/.test(lower) && /month|strftime/.test(lower)) return MONTHLY_REVENUE;
  if (/orderitems/.test(lower) && /customers/.test(lower)) return TOP_CUSTOMERS;
  if (/\bfrom\s+orders\b/.test(lower)) return PENDING_ORDERS;
  if (/avg\(/.test(lower)) return ABOVE_AVERAGE;
  if (/\bfrom\s+employees\b/.test(lower)) return EMPLOYEES_2024;
  return { columns: ['result'], rows: [[42]], row_count: 1, truncated: false };
}

/** The scripted employees ⨝ departments query, computed from the generated rows. */
function employeesWithDepartment(): { columns: string[]; rows: CellValue[][] } {
  const departments = tableRows(tableInfo('Departments')!);
  const rows = tableRows(tableInfo('Employees')!)
    .filter((e) => String(e[4]) >= '2024-02-01')
    .sort((a, b) => String(a[4]).localeCompare(String(b[4])))
    .map((e) => [e[0], e[1], e[2], e[4], departments[(e[6] as number) - 1][1]]);
  return { columns: ['EmployeeID', 'FirstName', 'LastName', 'HireDate', 'Department'], rows };
}

/** All rows of a valid query: generated data for simple SELECTs, fixtures otherwise. */
function allRows(sql: string): { columns: string[]; rows: CellValue[][] } {
  const p = plan(sql);
  if (p) return execute(p);
  if (squash(sql) === squash(SQL.employeesWithDepartment)) return employeesWithDepartment();
  const fixture = fixtureFor(sql);
  const limit = /\blimit\s+(\d+)\s*;?\s*$/i.exec(sql.trim());
  const rows = limit ? fixture.rows.slice(0, Number(limit[1])) : fixture.rows;
  return { columns: fixture.columns, rows };
}

function page(sql: string, limit: number, offset: number): PageData {
  const { columns, rows } = allRows(sql);
  const slice = rows.slice(offset, offset + limit);
  return {
    sql,
    columns,
    rows: slice,
    row_count: slice.length,
    total: rows.length,
    limit,
    offset,
    elapsed_ms: 2 + (rows.length % 11),
  };
}

const DIALECT_NAMES: Record<Dialect, string> = {
  sqlite: 'SQLite',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
};

/** Features the real backend's SQLite demo database cannot run (regex ~, ARRAY_AGG, ...). */
const SQLITE_UNSUPPORTED =
  /\bARRAY_AGG\b|\s~\*?\s|\bEXTRACT\s*\(|\bSIMILAR\s+TO\b|\bGENERATE_SERIES\b/i;

export function unsupportedMessage(dialect: Dialect): string {
  return `This ${DIALECT_NAMES[dialect]} feature isn't supported on the SQLite demo database.`;
}

/** Rough stand-in for sqlglot's translation to SQLite (mock only). */
export function toSqliteMock(sql: string, dialect: Dialect): string | null {
  if (dialect === 'sqlite') return null;
  return sql
    .replace(/`/g, '')
    .replace(/"/g, '')
    .replace(/\bILIKE\b/gi, 'LIKE');
}

export function unsupportedOnSqlite(sql: string, dialect: Dialect): boolean {
  return dialect !== 'sqlite' && SQLITE_UNSUPPORTED.test(sql);
}

/** POST /api/query/run (mock): the four statuses of the real endpoint. */
export function runMock(
  sql: string,
  limit: number,
  offset: number,
  dialect: Dialect = 'sqlite',
): RunResponse {
  if (sql.length > 10_000) {
    return {
      status: 'invalid',
      errors: ['TOO_LONG: the query is longer than 10,000 characters.'],
      warnings: [],
    };
  }
  if (DESTRUCTIVE_WORDS.test(scrub(sql))) return { status: 'refused', text: DESTRUCTIVE_TEXT };
  if (/\bslow\b/i.test(sql)) return { status: 'error', text: TIMEOUT_TEXT };
  const executed = toSqliteMock(sql, dialect);
  if (unsupportedOnSqlite(sql, dialect)) {
    return { status: 'error', text: unsupportedMessage(dialect), executed_sql: executed };
  }
  const errors = validateSql(executed ?? sql);
  if (errors.length) return { status: 'invalid', errors, warnings: [] };
  return {
    status: 'ok',
    warnings: [],
    executed_sql: executed,
    ...page(formatSql(executed ?? sql, 'sqlite'), limit, offset),
  };
}

/** Preview SQL exactly as the backend pretty-prints it. */
export function previewSql(table: string, limit: number, offset: number): string {
  return `SELECT *\nFROM ${table}\nLIMIT ${limit}${offset > 0 ? `\nOFFSET ${offset}` : ''};`;
}

export function previewMock(table: TableInfo, limit: number, offset: number): PageData {
  const rows = tableRows(table).slice(offset, offset + limit);
  return {
    sql: previewSql(table.name, limit, offset),
    columns: table.columns.map((c) => c.name),
    rows,
    row_count: rows.length,
    total: table.row_count,
    limit,
    offset,
    elapsed_ms: 1 + (table.row_count % 7),
  };
}

/** A chat `result` event (first page of 100) for a scripted query. */
export function resultEventFor(sql: string): ResultEvent {
  const p = page(sql, 100, 0);
  return {
    columns: p.columns,
    rows: p.rows,
    row_count: p.row_count,
    truncated: p.total > p.row_count,
    total: p.total,
    limit: p.limit,
    offset: p.offset,
  };
}
