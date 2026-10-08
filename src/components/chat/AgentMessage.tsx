// One assistant turn: intent indicator, Agent Activity, clarify / refusal / error, the SQL card
// with validation and results, mode-specific reports and WHY THIS QUERY?.

import { CornerDownRight, HelpCircle, Loader2 } from 'lucide-react';

import type { Intent } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { explainMessage, optimizeMessage, type AssistantMessage } from '../../context/chatModel';
import { INTENT_BADGES, formatTime } from '../../utils/format';
import AgentActivity from './AgentActivity';
import DebugReport from './DebugReport';
import ErrorCard from './ErrorCard';
import ExplanationPanel from './ExplanationPanel';
import OptimizationReport from './OptimizationReport';
import RefusalCard from './RefusalCard';
import ResultTable from './ResultTable';
import SqlCard, { RUN_SQLITE_ONLY } from './SqlCard';

const SQL_TITLES: Partial<Record<Intent, string>> = {
  debug: 'Corrected SQL',
  optimize: 'Optimized SQL',
  explain: 'Your SQL',
};

export function ExecutingSkeleton() {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Executing query">
      <p className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Executing query...
      </p>
      <div className="space-y-2 p-3" aria-hidden="true">
        {[100, 92, 96, 88].map((w, i) => (
          <div key={i} className="skeleton h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function AgentMessage({ turn }: { turn: AssistantMessage }) {
  const { send, retry, streaming, runTurn, saveTurn, applyFix, highlightedId, highlightTurn } =
    useChat();
  const pending = turn.status === 'pending';
  const sql = turn.sql;
  const modified = !!sql?.modified_previous || turn.intent === 'modify';
  const badge = turn.intent ? INTENT_BADGES[turn.intent] : undefined;
  const executing =
    turn.run.status === 'running' ||
    (pending &&
      !turn.result &&
      turn.steps.some((s) => s.node === 'execute_sql' && s.status === 'start'));
  const text = turn.explanation?.text ?? turn.tokens;
  const showActivity = turn.steps.length > 0 || pending;

  return (
    <article aria-label="SQL Agent reply" className="min-w-0 space-y-2.5">
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
          className="flex gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3"
        >
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />
          <p className="min-w-0 break-words text-[14px] leading-6">{turn.clarify}</p>
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

      {turn.intent === 'debug' && sql && (
        <DebugReport issues={sql.issues} original={sql.original_sql} />
      )}

      {sql && (
        <SqlCard
          id={`sql-card-${turn.id}`}
          sql={sql}
          title={(turn.intent && SQL_TITLES[turn.intent]) || 'Generated SQL'}
          highlighted={highlightedId === turn.id}
          running={turn.run.status === 'running'}
          runDisabledReason={sql.dialect !== 'sqlite' ? RUN_SQLITE_ONLY : null}
          busy={streaming}
          original={turn.intent === 'optimize' ? sql.original_sql : null}
          onRun={() => runTurn(turn.id)}
          onOptimize={() => send(optimizeMessage(sql.sql))}
          onExplain={() => send(explainMessage(sql.sql))}
          onSave={() => saveTurn(turn.id)}
          onApplyFix={turn.intent === 'debug' ? () => applyFix(sql.sql) : undefined}
        />
      )}

      {executing && <ExecutingSkeleton />}
      {turn.run.status === 'error' && turn.run.error && (
        <ErrorCard
          title="Unable to execute query"
          text={turn.run.error}
          onRetry={() => runTurn(turn.id)}
          retryLabel="Try running the query again"
          onViewSql={() => highlightTurn(turn.id)}
        />
      )}
      {turn.result && !executing && <ResultTable result={turn.result} />}
      {sql && !turn.result && !executing && !pending && turn.run.status !== 'error' && (
        <p className="text-xs text-muted">
          {turn.fromHistory
            ? 'Results are not stored with the thread. Run the query to see them.'
            : turn.executed
              ? 'This query was not run.'
              : 'Automatic execution is off. Use Run Query to see results.'}
        </p>
      )}

      {turn.intent === 'optimize' && sql && <OptimizationReport sql={sql} />}

      {!turn.refusal && !turn.clarify && (
        <ExplanationPanel
          text={text}
          assumptions={turn.explanation?.assumptions ?? []}
          streaming={pending && !!sql && !turn.explanation}
        />
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
