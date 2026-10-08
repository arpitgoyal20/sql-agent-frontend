// OPTIMIZATION REPORT (UI_SPEC §17): ✓ notes and removed joins, ⚠ index suggestions (copyable).
// No invented performance numbers.

import { AlertTriangle, Check } from 'lucide-react';

import type { SqlEvent } from '../../api/types';
import CopyButton from '../common/CopyButton';

export default function OptimizationReport({ sql }: { sql: SqlEvent }) {
  const done = [
    ...sql.optimization_notes,
    ...sql.removed_joins.map((j) => `Removed unnecessary join: ${j}`),
  ];
  if (!done.length && !sql.index_suggestions.length) return null;
  return (
    <section aria-label="Optimization report" className="card min-w-0 px-3 py-2.5">
      <h4 className="section-label mb-1.5">Optimization report</h4>
      <ul className="space-y-1">
        {done.map((note, i) => (
          <li key={`n${i}`} className="flex items-start gap-2 text-sm">
            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <span className="min-w-0 break-words">{note}</span>
          </li>
        ))}
      </ul>
      {sql.index_suggestions.length > 0 && (
        <div className={done.length ? 'mt-2' : ''}>
          <p className="mb-1 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Consider {sql.index_suggestions.length === 1 ? 'this index' : 'these indexes'}
          </p>
          <ul className="space-y-1">
            {sql.index_suggestions.map((stmt, i) => (
              <li
                key={i}
                className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-bg/50 py-0.5 pl-2.5 pr-0.5"
              >
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px]">
                  {stmt}
                </code>
                <CopyButton text={stmt} ariaLabel={`Copy index suggestion ${i + 1}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
