// The in-memory backend used by mock mode follows the v2 contract.

import { describe, expect, it } from 'vitest';

import { pickScript } from './mock';
import { mockPreview, mockRun, mockTables } from './mockRest';
import type { ChatRequest, ResultEvent, SqlEvent } from './types';

const COUNTS = {
  Departments: 8,
  Employees: 200,
  Customers: 500,
  Products: 50,
  Orders: 2000,
  OrderItems: 6035,
  Payments: 1791,
};

describe('mock /api/tables and preview', () => {
  it('lists the 7 tables with real row counts and FK info', () => {
    const { tables } = mockTables();
    expect(Object.fromEntries(tables.map((t) => [t.name, t.row_count]))).toEqual(COUNTS);
    const orders = tables.find((t) => t.name === 'Orders')!;
    expect(orders.columns.find((c) => c.name === 'CustomerID')?.fk).toEqual({
      table: 'Customers',
      column: 'CustomerID',
    });
    expect(orders.columns.find((c) => c.name === 'OrderID')?.pk).toBe(true);
  });

  it.each(Object.entries(COUNTS))('previews %s with total = row count', (name, count) => {
    const page = mockPreview(name, 100, 0);
    expect(page.total).toBe(count);
    expect(page.rows).toHaveLength(Math.min(100, count));
    expect(page.sql).toBe(`SELECT *\nFROM ${name}\nLIMIT 100;`);
  });

  it('pages a preview with OFFSET and returns the last rows', () => {
    const page = mockPreview('orders', 100, 1900);
    expect(page.sql).toBe('SELECT *\nFROM Orders\nLIMIT 100\nOFFSET 1900;');
    expect(page.rows).toHaveLength(100);
    expect(page.rows[99][0]).toBe(2000);
    expect(page.offset).toBe(1900);
  });

  it('404s an unknown table', () => {
    expect(() => mockPreview('Nope"; DROP', 100, 0)).toThrow(/does not exist/);
  });
});

describe('mock /api/query/run', () => {
  const run = (sql: string, limit = 100, offset = 0) =>
    mockRun({ sql, dialect: 'sqlite', limit, offset });

  it('runs and paginates a single-table query', () => {
    const res = run("SELECT * FROM Customers WHERE State = 'California'", 50, 50);
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.total).toBeGreaterThan(100);
    expect(res.offset).toBe(50);
    expect(res.rows).toHaveLength(50);
    const state = res.columns.indexOf('State');
    expect(res.rows.every((r) => r[state] === 'California')).toBe(true);
  });

  it('counts rows', () => {
    const res = run('SELECT COUNT(*) FROM Orders;');
    expect(res).toMatchObject({ status: 'ok', columns: ['COUNT(*)'], rows: [[2000]] });
  });

  it('returns an empty page beyond the total', () => {
    expect(run('SELECT * FROM Products', 100, 400)).toMatchObject({ status: 'ok', rows: [] });
  });

  it.each(['DELETE FROM Orders', 'DROP TABLE Orders', 'PRAGMA table_info(Orders)'])(
    'refuses %s',
    (sql) => {
      expect(run(sql)).toMatchObject({ status: 'refused' });
    },
  );

  it('reports an unknown column as invalid', () => {
    const res = run('SELECT nope FROM Customers');
    expect(res.status).toBe('invalid');
    if (res.status === 'invalid') expect(res.errors[0]).toMatch(/^UNKNOWN_COLUMN: column 'nope'/);
  });

  it('reports an unknown table and multiple statements as invalid', () => {
    expect(run('SELECT * FROM Nope')).toMatchObject({ status: 'invalid' });
    expect(run('SELECT 1 FROM Orders; SELECT 2 FROM Orders')).toMatchObject({ status: 'invalid' });
  });

  it('times out a "slow" query', () => {
    expect(run('SELECT * FROM Orders -- slow')).toEqual({
      status: 'error',
      text: 'Query took longer than 5 seconds and was stopped.',
    });
  });

  it('rejects SQL over 10,000 characters', () => {
    const res = run(`SELECT * FROM Orders WHERE Status = '${'x'.repeat(10_000)}'`);
    expect(res.status).toBe('invalid');
    if (res.status === 'invalid') expect(res.errors[0]).toMatch(/^TOO_LONG/);
  });
});

describe('mock chat scripts (v2)', () => {
  const req = (message: string, current_sql?: string): ChatRequest => ({
    thread_id: 't',
    message,
    dialect: 'sqlite',
    execute: true,
    current_sql,
  });
  const events = (r: ChatRequest) => pickScript(r).events;
  const sqlOf = (r: ChatRequest) =>
    (events(r).find((e) => e.event === 'sql')?.data as SqlEvent).sql;
  const resultOf = (r: ChatRequest) =>
    events(r).find((e) => e.event === 'result')?.data as ResultEvent;

  it('builds a follow-up on current_sql without the preview LIMIT', () => {
    const r = req('only those from California', 'SELECT *\nFROM Customers\nLIMIT 100;');
    const sql = sqlOf(r);
    expect(sql).toMatch(/FROM\s+Customers/);
    expect(sql).toMatch(/State = 'California'/);
    expect(sql).not.toMatch(/LIMIT/);
    const result = resultOf(r);
    expect(result).toMatchObject({ limit: 100, offset: 0 });
    expect(result.total).toBeGreaterThan(100);
  });

  it('routes the editor action phrasings to explain / optimize / debug', () => {
    const fence = (s: string) => `\`\`\`sql\n${s}\n\`\`\``;
    const intent = (m: string) => pickScript(req(m)).intent;
    expect(intent(`Explain this query:\n${fence('SELECT * FROM Customers LIMIT 100;')}`)).toBe(
      'explain',
    );
    expect(intent(`Optimize this query:\n${fence('SELECT * FROM Customers LIMIT 100;')}`)).toBe(
      'optimize',
    );
    const fix = `Fix this query:\n${fence('SELECT nope FROM Customers')}\nError: UNKNOWN_COLUMN: column 'nope' does not exist.`;
    expect(intent(fix)).toBe('debug');
    expect(sqlOf(req(fix))).not.toMatch(/nope/);
  });
});

describe('mock run: other dialects run on the SQLite demo database', () => {
  it('reports the translated SQL for postgres and mysql', () => {
    const pg = mockRun({
      sql: 'SELECT "Name" FROM "Products" WHERE "Name" ILIKE \'a%\'',
      dialect: 'postgres',
      limit: 100,
      offset: 0,
    });
    expect(pg.status).toBe('ok');
    if (pg.status === 'ok')
      expect(pg.executed_sql).toBe("SELECT Name FROM Products WHERE Name LIKE 'a%'");
    const my = mockRun({
      sql: 'SELECT `Name` FROM `Products`',
      dialect: 'mysql',
      limit: 100,
      offset: 0,
    });
    if (my.status === 'ok') expect(my.executed_sql).toBe('SELECT Name FROM Products');
    const lite = mockRun({
      sql: 'SELECT Name FROM Products',
      dialect: 'sqlite',
      limit: 100,
      offset: 0,
    });
    if (lite.status === 'ok') expect(lite.executed_sql ?? null).toBeNull();
  });

  it('a feature SQLite lacks is an error with the standard text', () => {
    const r = mockRun({
      sql: 'SELECT ARRAY_AGG(Name) FROM Products',
      dialect: 'postgres',
      limit: 100,
      offset: 0,
    });
    expect(r).toMatchObject({
      status: 'error',
      text: "This PostgreSQL feature isn't supported on the SQLite demo database.",
    });
  });
});
