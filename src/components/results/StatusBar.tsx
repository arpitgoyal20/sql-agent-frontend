// Status bar above the grid: `500 rows · 4 ms · page 1 of 5`, paging, page size and "Download
// page as CSV"; below it a red bar for validator errors (with Fix with AI) or run errors (with
// Retry).

import { AlertCircle, RotateCcw, Sparkles } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { fixMessage } from '../../context/chatModel';
import { useWorkbench } from '../../context/WorkbenchContext';
import { toCsv } from '../../utils/csv';
import { errorText, pageSummary } from '../../utils/format';
import DownloadButton from '../common/DownloadButton';
import Pagination from './Pagination';

export default function StatusBar() {
  const { results, goToPage, setPageSize, pageSize, retry } = useWorkbench();
  const { send, streaming } = useChat();
  const { page, status, running } = results;
  const pages = page ? Math.max(1, Math.ceil(page.total / Math.max(page.limit, 1))) : 1;
  const current = page ? Math.floor(page.offset / Math.max(page.limit, 1)) : 0;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1 text-xs text-muted">
        <span aria-live="polite" className="tabular-nums">
          {running && !page
            ? 'Running…'
            : page
              ? pageSummary(page.total, page.elapsed_ms, current + 1, pages)
              : 'No results yet'}
        </span>
        {page && (
          <span className="ml-auto flex items-center gap-1">
            <Pagination
              page={current}
              pages={pages}
              pageSize={page.limit && [50, 100, 200].includes(page.limit) ? page.limit : pageSize}
              disabled={running || !results.source}
              onPage={goToPage}
              onPageSize={setPageSize}
            />
            <DownloadButton
              filename={`results-page-${current + 1}.csv`}
              getContent={() => `\uFEFF${toCsv(page.columns, page.rows)}`}
              mime="text/csv"
              label="Download page as CSV"
              ariaLabel={`Download page ${current + 1} as CSV`}
              labelClassName="hidden sm:inline"
            />
          </span>
        )}
      </div>
      {status === 'invalid' && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-sm"
        >
          <AlertCircle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
          <ul className="min-w-0 flex-1 space-y-0.5">
            {results.errors.map((e, i) => (
              <li key={i} className="break-words" title={e}>
                <span className="font-medium text-danger">
                  {e.match(/^[A-Z_]+(?=:)/)?.[0] ?? 'Invalid'}
                </span>{' '}
                {errorText(e)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-secondary h-6 shrink-0 px-2 text-xs"
            disabled={streaming || !results.failedSql}
            onClick={() => send(fixMessage(results.failedSql ?? '', results.errors))}
            aria-label="Fix with AI: ask the assistant to fix this query"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-fg" aria-hidden="true" />
            Fix with AI
          </button>
        </div>
      )}
      {status === 'error' && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-sm"
        >
          <AlertCircle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{results.message}</p>
          <button
            type="button"
            className="btn-secondary h-6 shrink-0 px-2 text-xs"
            onClick={retry}
            disabled={running}
            aria-label="Retry running the query"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </>
  );
}
