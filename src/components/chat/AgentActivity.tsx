// Expandable "✦ SQL Agent" activity panel built from `step` events (UI_SPEC §8). Expanded while
// the turn runs, collapsed by default once it is done. Labels come from the backend.

import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Minus,
  RotateCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useId, useState } from 'react';

import { humanizeCheckError, type ActivityStep } from '../../context/chatModel';

interface Props {
  steps: ActivityStep[];
  pending: boolean;
  /** Final line once the turn is done, e.g. "Query ready". */
  outcome?: string | null;
}

function StepIcon({ step }: { step: ActivityStep }) {
  switch (step.status) {
    case 'start':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-fg" aria-hidden="true" />;
    case 'ok':
      return <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />;
    case 'retry':
      return <RotateCw className="h-3.5 w-3.5 text-warning" aria-hidden="true" />;
    case 'skip':
      return <Minus className="h-3.5 w-3.5 text-muted" aria-hidden="true" />;
    default:
      return (
        <span className="h-3.5 w-3.5 text-center text-muted" aria-hidden="true">
          ◌
        </span>
      );
  }
}

const STATUS_TEXT: Record<string, string> = {
  start: 'in progress',
  ok: 'done',
  retry: 'retrying',
  skip: 'skipped',
};

export default function AgentActivity({ steps, pending, outcome }: Props) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? pending;
  const listId = useId();
  const current = [...steps].reverse().find((s) => s.status === 'start');
  const retries = steps.filter((s) => s.retried).length;
  const summary = pending
    ? (current?.label ?? steps[steps.length - 1]?.label ?? 'Starting…')
    : `${steps.length} step${steps.length === 1 ? '' : 's'}${retries ? ` · ${retries} retried` : ''}`;

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${open ? 'Hide' : 'Show'} agent activity`}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-elevated/50"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-hidden="true" />
        <span className="font-medium">SQL Agent</span>
        <span className="min-w-0 truncate text-xs text-muted">{summary}</span>
        {pending && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted" aria-hidden="true" />
        )}
        <span className="ml-auto shrink-0 text-muted" aria-hidden="true">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {open && (
        <ol
          id={listId}
          aria-label="Agent activity"
          className="space-y-1 border-t border-line px-3 py-2"
        >
          {steps.length === 0 && (
            <li className="flex items-center gap-2 text-sm text-muted">
              <span className="w-3.5 text-center" aria-hidden="true">
                ◌
              </span>
              Connecting…
            </li>
          )}
          {steps.map((s) => (
            <li key={s.node} className="text-sm">
              <span className="flex items-center gap-2">
                <StepIcon step={s} />
                <span className={s.status === 'start' ? 'text-fg' : 'text-fg/85'}>{s.label}</span>
                <span className="sr-only">({STATUS_TEXT[s.status] ?? s.status})</span>
              </span>
              {s.retried &&
                (s.errors.length ? s.errors : ['A check failed']).map((e, i) => (
                  <span
                    key={i}
                    className="ml-[22px] mt-0.5 flex items-start gap-1.5 text-xs text-muted"
                  >
                    <X className="mt-[2px] h-3 w-3 shrink-0 text-danger" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {humanizeCheckError(e)}
                      {' — '}
                      {s.status === 'ok' ? 'fixed and retried' : 'retrying…'}
                    </span>
                  </span>
                ))}
            </li>
          ))}
          {!pending && outcome && (
            <li className="flex items-center gap-2 pt-0.5 text-sm font-medium text-fg">
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              {outcome}
            </li>
          )}
        </ol>
      )}
      <p className="sr-only" aria-live="polite">
        {pending ? (current?.label ?? '') : ''}
      </p>
    </div>
  );
}
