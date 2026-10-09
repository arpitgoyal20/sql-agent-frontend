// One assistant turn in the chat column: intent indicator, Agent Activity, clarify / refusal /
// error cards, a compact SQL card (Load in editor), a pointer to the results / notes, and the
// streamed explanation. The full results, explanation and notes live in the centre column.

import {
  AlertTriangle,
  CornerDownRight,
  HelpCircle,
  Loader2,
  NotebookPen,
  Table2,
} from 'lucide-react';

import type { Intent } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import { hasNotes, type AssistantMessage } from '../../context/chatModel';
import { INTENT_BADGES, formatTime, rowsLabel } from '../../utils/format';
import AgentActivity from './AgentActivity';
import ChatSqlCard from './ChatSqlCard';
import ErrorCard from './ErrorCard';
import RefusalCard from './RefusalCard';

const SQL_TITLES: Partial<Record<Intent, string>> = {
  debug: 'Corrected SQL',
  optimize: 'Optimized SQL',
  explain: 'Your SQL',
};

export default function AgentMessage({ turn }: { turn: AssistantMessage }) {
  const { send, retry, streaming } = useChat();
  const { setEditorText, setResultsTab } = useWorkbench();
  const { showOnMobile } = useUi();
  const pending = turn.status === 'pending';
  const sql = turn.sql;
  const modified = !!sql?.modified_previous || turn.intent === 'modify';
  const badge = turn.intent ? INTENT_BADGES[turn.intent] : undefined;
  const executing =
    pending &&
    !turn.result &&
    turn.steps.some((s) => s.node === 'execute_sql' && s.status === 'start');
  const text = turn.explanation?.text ?? turn.tokens;
  const showActivity = turn.steps.length > 0 || pending;
  const runError = turn.result?.error ?? null;
  const total = turn.result && !runError ? (turn.result.total ?? turn.result.row_count) : null;

  const openTab = (tab: 'results' | 'notes') => {
    setResultsTab(tab);
    showOnMobile('results');
  };

  return (
    <article aria-label="SQL Agent reply" className="min-w-0 space-y-2">
      {(modified || badge) && (
        <div className="flex flex-wrap items-center gap-2">
          {modified && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              Modified previous query
            </span>
          )}
          {badge && (
            <span className="rounded border border-accent/40 px-1.5 text-2xs font-medium uppercase tracking-wide text-accent-fg">
              {badge}
            </span>
          )}
        </div>
      )}

      {showActivity && (
        <AgentActivity steps={turn.steps} pending={pending} outcome={sql ? 'Query ready' : null} />
      )}

      {turn.clarify && (
        <div
          role="note"
          aria-label="Clarifying question"
          className="flex gap-2.5 rounded-lg border border-accent/30 bg-accent/5 p-2.5"
        >
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />
          <p className="min-w-0 break-words text-sm leading-6">{turn.clarify}</p>
        </div>
      )}

      {turn.refusal && (
        <RefusalCard
          text={turn.refusal.text}
          reason={turn.refusal.reason}
          onSuggest={send}
          disabled={streaming}
        />
      )}

      {sql && (
        <ChatSqlCard
          sql={sql}
          title={(turn.intent && SQL_TITLES[turn.intent]) || 'Generated SQL'}
          onLoad={() => {
            setEditorText(sql.sql, { flash: true });
            showOnMobile('editor');
          }}
        />
      )}

      {executing && (
        <p className="flex items-center gap-1.5 text-xs text-muted" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Executing query...
        </p>
      )}
      {runError && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-fg"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {runError} The query is in the editor; the SQL itself may be valid for your database.
          </span>
        </p>
      )}
      {(total !== null || (sql && hasNotes(sql))) && (
        <div className="flex flex-wrap gap-1">
          {total !== null && (
            <button
              type="button"
              className="btn-secondary h-6 px-2 text-xs"
              onClick={() => openTab('results')}
              aria-label={`Show ${rowsLabel(total)} in Results`}
            >
              <Table2 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {rowsLabel(total)} in Results
            </button>
          )}
          {sql && hasNotes(sql) && (
            <button
              type="button"
              className="btn-secondary h-6 px-2 text-xs"
              onClick={() => openTab('notes')}
              aria-label="Show notes for this query"
            >
              <NotebookPen className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              See Notes
            </button>
          )}
        </div>
      )}
      {sql && !turn.result && !pending && !turn.executed && !turn.fromHistory && (
        <p className="text-xs text-muted">Not run automatically. Press Run in the editor.</p>
      )}

      {!turn.refusal && !turn.clarify && (text || (pending && sql)) && (
        <section aria-label="Why this query" className="min-w-0">
          <h4 className="section-label mb-0.5">Why this query?</h4>
          {text ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-fg/90">{text}</p>
          ) : (
            <div className="space-y-1.5 pt-1" role="status" aria-label="Writing explanation">
              <div className="skeleton h-3 w-11/12" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          )}
        </section>
      )}

      {turn.error && (
        <ErrorCard
          title="Couldn't finish this request"
          text={turn.error}
          onRetry={() => retry(turn.id)}
          retryLabel="Try again: resend this message"
          retryDisabled={streaming}
        />
      )}
      {turn.status === 'aborted' && <p className="text-xs text-muted">Stopped.</p>}
      {!pending && turn.createdAt && (
        <time dateTime={turn.createdAt} className="block text-2xs text-muted">
          {formatTime(turn.createdAt)}
        </time>
      )}
    </article>
  );
}
