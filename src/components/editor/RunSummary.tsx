// Narrow layout only: the outcome of the last run, under the editor, so running never takes the
// user away from their query. "View results" opens the Results tab on purpose.

import { AlertCircle, Loader2, RotateCcw, Shield, Sparkles, Table2 } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import { fixMessage } from '../../context/chatModel';
import { errorText, pageSummary } from '../../utils/format';

export default function RunSummary() {
  const { results, retry, setResultsTab } = useWorkbench();
  const { send, streaming } = useChat();
  const { setMobileTab } = useUi();
  const { status, page, running } = results;
  if (!running && status === 'idle') return null;

  const view = () => {
    setResultsTab('results');
    setMobileTab('results');
  };
  const viewButton = (
    <button
      type="button"
      className="btn-secondary h-6 shrink-0 px-2 text-xs"
      onClick={view}
      aria-label="View results"
    >
      <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
      View results
    </button>
  );

  let body;
  if (running) {
    body = (
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Running…
      </span>
    );
  } else if (status === 'invalid') {
    body = (
      <>
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" title={results.errors.join('\n')}>
          {errorText(results.errors[0] ?? '')}
        </span>
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
      </>
    );
  } else if (status === 'refused') {
    body = (
      <>
        <Shield className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          Read-only queries only. Nothing was executed.
        </span>
        {viewButton}
      </>
    );
  } else if (status === 'error') {
    body = (
      <>
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" title={results.message ?? ''}>
          {results.message}
        </span>
        <button
          type="button"
          className="btn-secondary h-6 shrink-0 px-2 text-xs"
          onClick={retry}
          aria-label="Retry running the query"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </>
    );
  } else {
    const pages = page ? Math.max(1, Math.ceil(page.total / Math.max(page.limit, 1))) : 1;
    const current = page ? Math.floor(page.offset / Math.max(page.limit, 1)) + 1 : 1;
    body = (
      <>
        <span className="min-w-0 flex-1 truncate tabular-nums text-muted">
          {page ? pageSummary(page.total, page.elapsed_ms, current, pages) : ''}
        </span>
        {viewButton}
      </>
    );
  }

  return (
    <div
      data-testid="run-summary"
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-1.5 text-xs"
    >
      {body}
    </div>
  );
}
