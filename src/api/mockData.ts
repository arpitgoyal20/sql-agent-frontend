// Mock mode fixtures shared by the scripted chat (mock.ts) and the in-memory REST API
// (mockRest.ts): result tables, the 7-table schema with row counts, and crude stand-ins for the backend's
// validator, query inspector and title generator. None of this runs against the real backend.

import type {
  Dialect,
  QueryInspection,
  ResultEvent,
  TableColumn,
  TableInfo,
  ValidationCheck,
} from './types';

// ---- Result tables ----------------------------------------------------------

export const EMPLOYEES_2024: ResultEvent = {
  columns: ['EmployeeID', 'FirstName', 'LastName', 'HireDate', 'Salary'],
  rows: [
    [42, 'Priya', 'Shah', '2024-01-15', 98500],
    [57, 'Marcus', 'Lee', '2024-03-02', 72300],
    [88, 'Elena', 'García', '2024-06-21', null],
    [103, 'Tom', "O'Brien", '2024-09-09', 64100],
    [161, 'Aisha', 'Khan', '2025-02-17', 121700],
  ],
  row_count: 5,
  truncated: false,
};

export const ABOVE_AVERAGE: ResultEvent = {
  columns: ['FirstName', 'LastName', 'Salary'],
  rows: [
    ['Aisha', 'Khan', 121700],
    ['Priya', 'Shah', 98500],
    ['Daniel', 'Okafor', 94250],
    ['Mei', 'Wong', 91000],
  ],
  row_count: 4,
  truncated: false,
};

export const TOP_CUSTOMERS: ResultEvent = {
  columns: ['CustomerID', 'Name', 'TotalRevenue'],
  rows: [
    [311, 'Jennifer Ortiz', 18422.15],
    [77, 'Daniel "Danny" Brooks', 17110.4],
    [204, 'Wong, Mei', 16987.0],
    [12, 'Robert Hall', 15530.75],
    [458, 'Sara Nilsson', 15002.3],
    [96, 'Luis Romero', 14870.2],
    [150, 'Hannah Becker', 14211.0],
    [233, 'Kofi Mensah', 13950.55],
    [19, 'Olivia Park', 13402.1],
    [402, 'Ivan Petrov', 12988.45],
  ],
  row_count: 10,
  truncated: false,
};

const CITIES = ['Los Angeles', 'Houston', 'Buffalo', 'Miami'];
const STATES = ['California', 'Texas', 'New York', 'Florida'];

export const CUSTOMERS: ResultEvent = {
  columns: ['CustomerID', 'Name', 'City', 'State'],
  rows: Array.from({ length: 200 }, (_, i) => [
    i + 1,
    `Customer ${i + 1}`,
    CITIES[i % 4],
    STATES[i % 4],
  ]),
  row_count: 200,
  truncated: true,
};

export const CA_CUSTOMERS: ResultEvent = {
  columns: ['CustomerID', 'Name', 'City', 'State'],
  rows: [
    [1, 'Customer 1', 'Los Angeles', 'California'],
    [5, 'Customer 5', 'San Diego', 'California'],
    [9, 'Customer 9', 'San Jose', 'California'],
    [13, 'Customer 13', 'Sacramento', 'California'],
  ],
  row_count: 4,
  truncated: false,
};

export const MONTHLY_REVENUE: ResultEvent = {
  columns: ['month', 'revenue'],
  rows: [
    ['2025-01', 48210.5],
    ['2025-02', 45120.0],
    ['2025-03', 52984.25],
    ['2025-04', 50110.8],
    ['2025-05', 55402.1],
    ['2025-06', 58944.0],
    ['2025-07', 61230.45],
    ['2025-08', 59870.3],
    ['2025-09', 57312.9],
    ['2025-10', 63021.15],
    ['2025-11', 70455.6],
    ['2025-12', 81240.75],
  ],
  row_count: 12,
  truncated: false,
};

export const PENDING_ORDERS: ResultEvent = {
  columns: ['OrderID', 'OrderDate', 'Status', 'CustomerName'],
  rows: [
    [1984, '2025-12-29', 'pending', 'Jennifer Ortiz'],
    [1870, '2025-12-14', 'pending', 'Robert Hall'],
    [1802, '2025-11-30', 'pending', 'Sara Nilsson'],
  ],
  row_count: 3,
  truncated: false,
};

// ---- Scripted SQL -------------------------------------------------------------

export const SQL = {
  employees2024:
    "SELECT\n  EmployeeID,\n  FirstName,\n  LastName,\n  HireDate,\n  Salary\nFROM Employees\nWHERE\n  HireDate >= '2024-01-01'\nORDER BY\n  HireDate",
  monthlyRevenue:
    "SELECT\n  STRFTIME('%Y-%m', o.OrderDate) AS month,\n  SUM(oi.Quantity * oi.UnitPrice) AS revenue\nFROM Orders AS o\nJOIN OrderItems AS oi\n  ON oi.OrderID = o.OrderID\nWHERE\n  o.OrderDate >= '2025-01-01'\n  AND o.OrderDate < '2026-01-01'\nGROUP BY\n  month\nORDER BY\n  month ASC",
  topCustomers:
    'SELECT\n  c.CustomerID,\n  c.Name,\n  SUM(oi.Quantity * oi.UnitPrice) AS TotalRevenue\nFROM Customers AS c\nJOIN Orders AS o\n  ON o.CustomerID = c.CustomerID\nJOIN OrderItems AS oi\n  ON oi.OrderID = o.OrderID\nGROUP BY\n  c.CustomerID,\n  c.Name\nORDER BY\n  TotalRevenue DESC\nLIMIT 10',
  employeesWithDepartment:
    "SELECT\n  e.EmployeeID,\n  e.FirstName,\n  e.LastName,\n  e.HireDate,\n  d.Name AS Department\nFROM Employees AS e\nJOIN Departments AS d\n  ON d.DepartmentID = e.DepartmentID\nWHERE\n  e.HireDate >= '2024-02-01'\nORDER BY\n  e.HireDate",
  customers: 'SELECT\n  CustomerID,\n  Name,\n  City,\n  State\nFROM Customers',
  caCustomers:
    "SELECT\n  CustomerID,\n  Name,\n  City,\n  State\nFROM Customers\nWHERE\n  State = 'California'",
  debugFixed:
    'SELECT\n  FirstName,\n  LastName,\n  Salary\nFROM Employees\nWHERE\n  Salary > (\n    SELECT\n      AVG(Salary)\n    FROM Employees\n  )',
  optimized:
    "SELECT\n  o.OrderID,\n  o.OrderDate,\n  o.Status,\n  c.Name AS CustomerName\nFROM Orders AS o\nJOIN Customers AS c\n  ON c.CustomerID = o.CustomerID\nWHERE\n  o.Status = 'pending'\nORDER BY\n  o.OrderDate DESC",
} as const;

// ---- Schema (GET /api/tables) ------------------------------------------------------

const col = (
  name: string,
  type: string,
  doc: string,
  opts: { pk?: boolean; null?: boolean; fk?: [string, string] } = {},
): TableColumn => ({
  name,
  type,
  doc,
  pk: !!opts.pk,
  fk: opts.fk ? { table: opts.fk[0], column: opts.fk[1] } : null,
  nullable: opts.pk ? false : (opts.null ?? false),
});
const pk = (name: string) => col(name, 'INTEGER', 'Primary key.', { pk: true });

/** The demo database: 7 tables with the real row counts. */
export const MOCK_TABLES: TableInfo[] = [
  {
    name: 'Departments',
    row_count: 8,
    columns: [
      pk('DepartmentID'),
      col('Name', 'TEXT', 'Department name, e.g. Sales or Engineering.'),
      col('Location', 'TEXT', 'City where the department is based.', { null: true }),
    ],
  },
  {
    name: 'Employees',
    row_count: 200,
    columns: [
      pk('EmployeeID'),
      col('FirstName', 'TEXT', 'Given name.'),
      col('LastName', 'TEXT', 'Family name.'),
      col('Email', 'TEXT', 'Work email address.'),
      col('HireDate', 'TEXT', 'Date hired, ISO format YYYY-MM-DD.'),
      col('Salary', 'REAL', 'Annual salary in USD.', { null: true }),
      col('DepartmentID', 'INTEGER', 'Department the employee belongs to.', {
        fk: ['Departments', 'DepartmentID'],
      }),
      col('ManagerID', 'INTEGER', "The employee's manager; NULL for top-level managers.", {
        null: true,
        fk: ['Employees', 'EmployeeID'],
      }),
    ],
  },
  {
    name: 'Customers',
    row_count: 500,
    columns: [
      pk('CustomerID'),
      col('Name', 'TEXT', 'Customer full name.'),
      col('Email', 'TEXT', 'Contact email address.', { null: true }),
      col('City', 'TEXT', 'City of the customer.', { null: true }),
      col('State', 'TEXT', 'Full US state name, e.g. California.', { null: true }),
      col('SignupDate', 'TEXT', 'Date the customer signed up, YYYY-MM-DD.'),
    ],
  },
  {
    name: 'Products',
    row_count: 50,
    columns: [
      pk('ProductID'),
      col('Name', 'TEXT', 'Product name.'),
      col('Category', 'TEXT', 'Product category.', { null: true }),
      col('Price', 'REAL', 'Current list price in USD.'),
    ],
  },
  {
    name: 'Orders',
    row_count: 2000,
    columns: [
      pk('OrderID'),
      col('CustomerID', 'INTEGER', 'Customer who placed the order.', {
        fk: ['Customers', 'CustomerID'],
      }),
      col('EmployeeID', 'INTEGER', 'Employee who handled the order.', {
        null: true,
        fk: ['Employees', 'EmployeeID'],
      }),
      col('OrderDate', 'TEXT', 'Date the order was placed, YYYY-MM-DD.'),
      col('Status', 'TEXT', 'pending, shipped, delivered or cancelled.'),
    ],
  },
  {
    name: 'OrderItems',
    row_count: 6035,
    columns: [
      pk('OrderItemID'),
      col('OrderID', 'INTEGER', 'Order this line belongs to.', { fk: ['Orders', 'OrderID'] }),
      col('ProductID', 'INTEGER', 'Product ordered.', { fk: ['Products', 'ProductID'] }),
      col('Quantity', 'INTEGER', 'Units ordered.'),
      col('UnitPrice', 'REAL', 'Price per unit at the time of the order.'),
    ],
  },
  {
    name: 'Payments',
    row_count: 1791,
    columns: [
      pk('PaymentID'),
      col('OrderID', 'INTEGER', 'Order being paid for.', { fk: ['Orders', 'OrderID'] }),
      col('Amount', 'REAL', 'Amount paid in USD.'),
      col('Method', 'TEXT', 'Payment method, e.g. card or paypal.'),
      col('PaidAt', 'TEXT', 'Payment timestamp, ISO format.', { null: true }),
    ],
  },
];

// ---- Crude validator / inspector / title generator --------------------------------

export const DESTRUCTIVE_RE =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|attach|detach|pragma|vacuum|grant)\b/i;

/** Table names after FROM / JOIN, as written (aliases dropped). */
export function referencedTables(sql: string): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/\b(?:from|join)\s+([A-Za-z_][\w]*)/gi)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

export function knownTable(name: string): string | null {
  return MOCK_TABLES.find((t) => t.name.toLowerCase() === name.toLowerCase())?.name ?? null;
}

/** Split on commas that are not inside parentheses. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Text of the first top-level clause starting at `start` and ending at any of `ends`. */
function clause(sql: string, start: RegExp, ends: string[]): string | null {
  const m = start.exec(sql);
  if (!m) return null;
  const rest = sql.slice(m.index + m[0].length);
  const end = new RegExp(`\\b(${ends.join('|')})\\b`, 'i').exec(rest);
  return (end ? rest.slice(0, end.index) : rest).trim();
}

/** A regex-level imitation of the backend's Query Inspector, good enough for mock data. */
export function inspectSql(sql: string): QueryInspection {
  const select = clause(sql, /\bselect\b/i, ['from']) ?? '';
  // Use the outermost WHERE only (subqueries are kept intact inside it).
  const where = clause(sql, /\bwhere\b/i, ['group\\s+by', 'order\\s+by', 'limit', 'having']);
  const group = clause(sql, /\bgroup\s+by\b/i, ['order\\s+by', 'limit', 'having']);
  const order = clause(sql, /\border\s+by\b/i, ['limit']);
  const limit = /\blimit\s+(\d+)/i.exec(sql);
  const items = splitTop(select);
  return {
    tables: referencedTables(sql).map((t) => knownTable(t) ?? t),
    columns: items.map((i) => i.replace(/\s+as\s+\w+$/i, '')),
    joins: [...sql.matchAll(/\bon\s+([\w.]+\s*=\s*[\w.]+)/gi)].map((m) => m[1]),
    filters: where ? where.split(/\s+\band\b\s+/i).map((f) => f.replace(/\s+/g, ' ').trim()) : [],
    aggregations: items
      .map((i) => /\b(SUM|AVG|COUNT|MIN|MAX)\s*\(.*\)/i.exec(i)?.[0])
      .filter((x): x is string => !!x),
    grouping: group ? splitTop(group) : [],
    ordering: order ? splitTop(order) : [],
    limit: limit ? Number(limit[1]) : null,
    safety: { read_only: true, single_statement: true },
  };
}

/** The seven checks the backend reports for a query that passed validation. */
export function passingValidation(dialect: Dialect, joinWarning?: string): ValidationCheck[] {
  return [
    { check: 'syntax', label: 'SQL syntax valid', status: 'pass' },
    { check: 'single', label: 'Single statement', status: 'pass' },
    { check: 'read_only', label: 'Read-only query', status: 'pass' },
    { check: 'tables', label: 'Tables exist', status: 'pass' },
    { check: 'columns', label: 'Columns exist', status: 'pass' },
    joinWarning
      ? { check: 'joins', label: 'Relationships valid', status: 'warn', detail: joinWarning }
      : { check: 'joins', label: 'Relationships valid', status: 'pass' },
    dialect === 'sqlite'
      ? { check: 'database', label: 'Database accepts query', status: 'pass' }
      : {
          check: 'database',
          label: 'Database accepts query',
          status: 'skip',
          detail: 'Only checked against the SQLite demo database.',
        },
  ];
}

const TITLE_STOP = /^(show|list|find|get|give|display|fetch|what|which|who|me|all|the|are|is|of)$/i;
const SMALL = /^(a|an|and|by|for|from|in|of|on|or|the|to|with)$/i;

/**
 * Imitates the backend's generated thread titles, e.g.
 * "Show monthly revenue for 2025" → "Monthly Revenue — 2025".
 */
export function mockTitle(message: string): string {
  const text = message.trim().replace(/[.?!]+$/, '');
  if (/\bselect\b[\s\S]+\bfrom\b/i.test(text)) {
    const verb = /optimi[sz]e/i.test(text)
      ? 'Optimize'
      : /fix|debug|error/i.test(text)
        ? 'Debug'
        : 'Explain';
    const table = referencedTables(text)[0];
    return `${verb} ${table ? `${knownTable(table) ?? table} ` : ''}Query`;
  }
  const year = /\b(19|20)\d{2}\b/.exec(text)?.[0];
  const words = text
    .replace(/\b(19|20)\d{2}\b/g, '')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length && TITLE_STOP.test(words[0])) words.shift();
  const kept = words.slice(0, 5);
  while (kept.length && SMALL.test(kept[kept.length - 1])) kept.pop();
  const title = kept
    .map((w, i) => (i > 0 && SMALL.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
  if (!title) return text.slice(0, 60) || 'New thread';
  return year ? `${title} — ${year}` : title;
}
