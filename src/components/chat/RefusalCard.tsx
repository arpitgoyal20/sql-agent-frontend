// A refusal is correct behaviour, not an error: neutral grey card with a shield icon
// (UI_SPEC §20/§21). The body is the backend's text verbatim, then a clickable suggestion.

import { Shield } from 'lucide-react';

import type { RefusalReason } from '../../api/types';

export const REFUSAL_SUGGESTION = 'Show the top 10 customers by revenue';

const TITLES: Record<RefusalReason, string> = {
  destructive: 'Read-only operation required',
  out_of_scope: 'Outside my scope',
};

interface Props {
  text: string;
  reason?: RefusalReason;
  onSuggest?: (text: string) => void;
  disabled?: boolean;
}

export default function RefusalCard({ text, reason, onSuggest, disabled }: Props) {
  return (
    <div
      role="note"
      aria-label="Request declined"
      data-testid="refusal-card"
      className="flex gap-3 rounded-lg border border-line bg-elevated p-3 text-fg"
    >
      <Shield
        className="mt-0.5 h-4 w-4 shrink-0 text-muted"
        aria-hidden="true"
        data-testid="refusal-shield"
      />
      <div className="min-w-0 space-y-1.5">
        <p className="text-[14px] font-semibold">{TITLES[reason ?? 'out_of_scope']}</p>
        <p className="break-words text-sm leading-6 text-fg/90">{text}</p>
        <p className="text-sm text-muted">
          Try asking something like:{' '}
          <button
            type="button"
            onClick={() => onSuggest?.(REFUSAL_SUGGESTION)}
            disabled={disabled || !onSuggest}
            aria-label={`Ask: ${REFUSAL_SUGGESTION}`}
            className="rounded text-accent-fg underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
          >
            “{REFUSAL_SUGGESTION}.”
          </button>
        </p>
      </div>
    </div>
  );
}
