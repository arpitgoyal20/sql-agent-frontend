// POST /api/execute wrapped for the UI: never throws, returns display-ready text.

import { executeSql } from '../api/client';
import type { Dialect, QueryInspection, ResultEvent, ValidationCheck } from '../api/types';
import { humanizeCheckError } from './chatModel';

export interface ExecOutcome {
  result: ResultEvent | null;
  /** Human-readable reason the query did not run, e.g. `No such column: revenue`. */
  error: string | null;
  validation: ValidationCheck[] | null;
  inspection: QueryInspection | null;
}

export async function runSql(sql: string, dialect: Dialect): Promise<ExecOutcome> {
  try {
    const res = await executeSql({ sql, dialect });
    if (res.ok && res.result) {
      return {
        result: res.result,
        error: null,
        validation: res.validation ?? null,
        inspection: res.inspection ?? null,
      };
    }
    const reasons = (res.errors ?? []).map(humanizeCheckError);
    return {
      result: null,
      error: reasons.join(' ') || 'The query could not be run.',
      validation: res.validation ?? null,
      inspection: res.inspection ?? null,
    };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'The query could not be run.',
      validation: null,
      inspection: null,
    };
  }
}
