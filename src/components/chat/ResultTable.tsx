// RESULTS (UI_SPEC §12): sticky header, horizontal scroll, monospace cells, NULL greyed,
// client-side pagination, row count, truncation note, Download CSV and Copy Results (TSV).

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CellValue, ResultEvent } from '../../api/types';
import { toCsv, toTsv } from '../../utils/csv';
import { formatCount } from '../../utils/format';
import CopyButton from '../common/CopyButton';
import DownloadButton from '../common/DownloadButton';

export const PAGE_SIZE = 25;

function Cell({ value }: { value: CellValue }) {
  if (value === null) return <span className="italic text-muted">NULL</span>;
  return <>{String(value)}</>;
}

const isNumeric = (v: CellValue) => typeof v === 'number';

export default function ResultTable({ result }: { result: ResultEvent }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  useEffect(() => setPage(0), [result]);
  const start = page * PAGE_SIZE;
  const rows = result.rows.slice(start, start + PAGE_SIZE);
  const numericCols = result.columns.map((_, c) => result.rows.some((r) => isNumeric(r[c])));

  return (
    <section aria-label="Query results" className="card min-w-0 overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5">
        <h4 className="section-label">Results</h4>
        <span className="text-xs text-muted">
          {formatCount(result.row_count)} {result.row_count === 1 ? 'row' : 'rows'}
        </span>
        {result.truncated && (
          <span className="text-xs text-warning">
            Showing first {formatCount(result.rows.length)} rows
          </span>
        )}
        {result.columns.length > 0 && (
          <span className="ml-auto flex items-center gap-0.5">
            <DownloadButton
              filename="results.csv"
              getContent={() => `\uFEFF${toCsv(result.columns, result.rows)}`}
              mime="text/csv"
              label="Download CSV"
              ariaLabel="Download results as results.csv"
            />
            <CopyButton
              text={() => toTsv(result.columns, result.rows)}
              label="Copy Results"
              ariaLabel="Copy results as tab-separated text"
            />
          </span>
        )}
      </header>
      {result.columns.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted">The query returned no columns.</p>
      ) : (
        <>
          <div
            className="max-h-[420px] overflow-auto"
            tabIndex={0}
            role="region"
            aria-label="Results table, scrollable"
          >
            <table className="min-w-full border-collapse font-mono text-[12.5px]">
              <thead>
                <tr>
                  {result.columns.map((c, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={`sticky top-0 z-10 whitespace-nowrap border-b border-line bg-elevated px-3 py-1.5 font-medium text-muted ${
                        numericCols[i] ? 'text-right' : 'text-left'
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr
                    key={start + r}
                    className="border-b border-line/60 last:border-0 hover:bg-elevated/50"
                  >
                    {row.map((value, c) => (
                      <td
                        key={c}
                        className={`whitespace-nowrap px-3 py-1 align-top ${
                          numericCols[c] ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        <Cell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted">No rows matched.</p>
            )}
          </div>
          {pages > 1 && (
            <nav
              aria-label="Results pages"
              className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-xs text-muted"
            >
              <span aria-live="polite">
                Rows {formatCount(start + 1)}–{formatCount(start + rows.length)} of{' '}
                {formatCount(result.rows.length)}
              </span>
              <span className="ml-auto">
                Page {page + 1} of {pages}
              </span>
              <button
                type="button"
                className="btn-icon h-6 w-6"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-icon h-6 w-6"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pages - 1}
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
