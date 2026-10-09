// Results grid: sticky header, monospace cells, NULL greyed, numbers right-aligned, scrolling
// inside the grid only. Clicking a header sorts the current page client-side (a full sort is a
// new query — ask the assistant). `stale` greys the grid out behind an invalid / error state.

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CellValue } from '../../api/types';
import type { GridPage } from '../../context/WorkbenchContext';

interface Props {
  page: GridPage;
  stale?: boolean;
}

type Sort = { col: number; dir: 'asc' | 'desc' } | null;

function compare(a: CellValue, b: CellValue): number {
  if (a === b) return 0;
  if (a === null) return 1; // NULLs last in both directions
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function Cell({ value }: { value: CellValue }) {
  if (value === null) return <span className="italic text-muted/80">NULL</span>;
  return <>{String(value)}</>;
}

export default function ResultsGrid({ page, stale }: Props) {
  const [sort, setSort] = useState<Sort>(null);
  useEffect(() => setSort(null), [page]);

  const numeric = useMemo(
    () =>
      page.columns.map(
        (_, c) =>
          page.rows.some((r) => typeof r[c] === 'number') &&
          page.rows.every((r) => r[c] === null || typeof r[c] === 'number'),
      ),
    [page],
  );

  const rows = useMemo(() => {
    if (!sort) return page.rows;
    const sorted = [...page.rows].sort((a, b) => compare(a[sort.col], b[sort.col]));
    if (sort.dir === 'desc') {
      // Reverse non-null values but keep NULLs at the end.
      const values = sorted.filter((r) => r[sort.col] !== null).reverse();
      return [...values, ...sorted.filter((r) => r[sort.col] === null)];
    }
    return sorted;
  }, [page.rows, sort]);

  const toggle = (col: number) =>
    setSort((s) =>
      !s || s.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null,
    );

  if (page.columns.length === 0) {
    return <p className="p-4 text-center text-sm text-muted">The query returned no columns.</p>;
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${stale ? 'opacity-40' : ''}`}>
      {sort && (
        <p className="shrink-0 border-b border-line bg-surface px-3 py-0.5 text-2xs text-muted">
          Sorted on this page only — ask the assistant to sort the full result.
        </p>
      )}
      <div
        className="min-h-0 flex-1 overflow-auto"
        tabIndex={0}
        role="region"
        aria-label="Results grid, scrollable"
        aria-busy={stale || undefined}
      >
        <table className="min-w-full border-separate border-spacing-0 font-mono text-[12.5px]">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 w-px border-b border-r border-line bg-elevated px-2 py-1 text-right font-normal text-muted/70"
              >
                <span className="sr-only">Row number</span>#
              </th>
              {page.columns.map((name, i) => {
                const active = sort?.col === i;
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={i}
                    scope="col"
                    aria-sort={
                      active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-elevated p-0 font-medium text-muted"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-label={`Sort this page by ${name}${
                        active
                          ? sort.dir === 'asc'
                            ? ', currently ascending'
                            : ', currently descending'
                          : ''
                      }`}
                      title="Sort this page"
                      className={`group flex w-full items-center gap-1 px-3 py-1 hover:text-fg ${
                        numeric[i] ? 'flex-row-reverse text-right' : 'text-left'
                      } ${active ? 'text-fg' : ''}`}
                    >
                      <span>{name}</span>
                      <Icon
                        className={`h-3 w-3 shrink-0 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="hover:bg-elevated/50">
                <td className="sticky left-0 border-b border-r border-line/60 bg-surface px-2 py-[3px] text-right text-2xs tabular-nums text-muted/70">
                  {page.offset + (sort ? page.rows.indexOf(row) : r) + 1}
                </td>
                {row.map((value, c) => (
                  <td
                    key={c}
                    className={`max-w-[420px] truncate whitespace-nowrap border-b border-line/60 px-3 py-[3px] ${
                      numeric[c] ? 'text-right tabular-nums' : ''
                    }`}
                    title={value === null ? 'NULL' : String(value)}
                  >
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {page.rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">
            {page.total > 0 ? 'No rows on this page.' : 'No rows matched.'}
          </p>
        )}
      </div>
    </div>
  );
}
