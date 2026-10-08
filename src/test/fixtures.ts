// Shared test data.

import { vi } from 'vitest';

import type { SqlEvent } from '../api/types';

export const SQL_EVENT: SqlEvent = {
  sql: "SELECT\n  CustomerID,\n  Name\nFROM Customers\nWHERE\n  State = 'California'",
  dialect: 'sqlite',
  warnings: ['No LIMIT; large result sets are capped at 200 rows.'],
  optimization_notes: [],
  index_suggestions: [],
  issues: [],
  removed_joins: [],
  validation: [
    { check: 'syntax', label: 'SQL syntax valid', status: 'pass' },
    { check: 'read_only', label: 'Read-only query', status: 'pass' },
    { check: 'tables', label: 'Tables exist', status: 'pass' },
    {
      check: 'joins',
      label: 'Relationships valid',
      status: 'warn',
      detail: 'Orders.EmployeeID = Customers.CustomerID is not a declared foreign key.',
    },
    { check: 'database', label: 'Database accepts query', status: 'skip' },
  ],
  inspection: {
    tables: ['Customers'],
    columns: ['CustomerID', 'Name'],
    joins: [],
    filters: ["State = 'California'"],
    aggregations: [],
    grouping: [],
    ordering: [],
    limit: null,
    safety: { read_only: true, single_statement: true },
  },
  modified_previous: false,
  original_sql: null,
};

export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}
