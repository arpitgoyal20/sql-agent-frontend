// Client-side SQL formatting (editor "Format" button and mock replies) with sql-formatter.
// Only the three dialects the app offers are imported so the rest tree-shakes away.

import { formatDialect, mysql, postgresql, sqlite, type DialectOptions } from 'sql-formatter';

import type { Dialect } from '../api/types';

const DIALECTS: Record<Dialect, DialectOptions> = { sqlite, postgres: postgresql, mysql };

/** Pretty-print SQL for a dialect; throws if sql-formatter cannot parse it. */
export function formatSql(sql: string, dialect: Dialect): string {
  return (
    formatDialect(sql, { dialect: DIALECTS[dialect], keywordCase: 'upper', tabWidth: 2 })
      // Keep `LIMIT 100` / `OFFSET 200` on one line, like the backend's pretty-printer.
      .replace(/^(\s*)(LIMIT|OFFSET)\n\s+(\S+)/gm, '$1$2 $3')
  );
}
