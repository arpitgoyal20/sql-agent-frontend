// A saved query (UI_SPEC §25): original prompt, SQL card, explanation, last execution and results.
// Opening it runs the SQL via POST /api/execute (no LLM, read-only).

import { Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { SavedQuery } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { explainMessage, optimizeMessage, sqlOnly } from '../../context/chatModel';
import { runSql, type ExecOutcome } from '../../context/execution';
import { formatRelative, formatTime } from '../../utils/format';
import { ExecutingSkeleton } from './AgentMessage';
import ErrorCard from './ErrorCard';
import ExplanationPanel from './ExplanationPanel';
import ResultTable from './ResultTable';
import SqlCard, { RUN_SQLITE_ONLY } from './SqlCard';

function SavedBody({ item }: { item: SavedQuery }) {
  const { send, streaming, deleteSavedQuery } = useChat();
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<ExecOutcome | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canRun = item.dialect === 'sqlite';

  const run = useCallback(() => {
    setRunning(true);
    void runSql(item.sql, item.dialect).then((out) => {
      setOutcome(out);
      setRanAt(new Date().toISOString());
      setRunning(false);
    });
  }, [item.sql, item.dialect]);

  useEffect(() => {
    if (canRun) run();
  }, [canRun, run]);

  const sql = {
    ...sqlOnly(item.sql, item.dialect),
    validation: outcome?.validation ?? undefined,
    inspection: outcome?.inspection ?? null,
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 fill-warning text-warning" aria-hidden="true" />
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item.title}</h2>
          <span className="text-xs text-muted">Saved {formatRelative(item.created_at)}</span>
          {confirming ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                className="btn h-6 bg-danger px-2 text-xs text-white hover:bg-danger/90"
                onClick={() => void deleteSavedQuery(item.id)}
                aria-label={`Confirm delete of saved query: ${item.title}`}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn-ghost h-6 px-2 text-xs"
                onClick={() => setConfirming(false)}
                aria-label="Cancel delete"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Delete saved query: ${item.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
        <article
          aria-label="Original prompt"
          className="rounded-lg border border-line bg-elevated/60 px-3 py-2"
        >
          <p className="section-label mb-0.5">Prompt</p>
          <p className="whitespace-pre-wrap break-words text-[14px] leading-6">{item.prompt}</p>
        </article>
        <SqlCard
          sql={sql}
          title="Saved SQL"
          running={running}
          runDisabledReason={canRun ? null : RUN_SQLITE_ONLY}
          busy={streaming}
          onRun={run}
          onOptimize={() => send(optimizeMessage(item.sql))}
          onExplain={() => send(explainMessage(item.sql))}
        />
        {ranAt && !running && (
          <p className="text-xs text-muted">Last execution: {formatTime(ranAt)}</p>
        )}
        {running && <ExecutingSkeleton />}
        {!running && outcome?.error && (
          <ErrorCard
            title="Unable to execute query"
            text={outcome.error}
            onRetry={run}
            retryLabel="Try running the query again"
          />
        )}
        {!running && outcome?.result && <ResultTable result={outcome.result} />}
        <ExplanationPanel text={item.explanation} assumptions={[]} />
      </div>
    </div>
  );
}

export default function SavedQueryView({ id }: { id: string }) {
  const { saved } = useChat();
  const item = saved?.find((q) => q.id === id);
  if (!item) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted">
        {saved ? 'This saved query no longer exists.' : 'Loading saved query…'}
      </div>
    );
  }
  // Re-mount per item so each opens with fresh results.
  return <SavedBody key={item.id} item={item} />;
}
