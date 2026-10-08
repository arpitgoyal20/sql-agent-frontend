// Human-readable error (UI_SPEC §24) with the backend's text and Try Again; never a raw 500.

import { AlertCircle, Code2, RotateCcw } from 'lucide-react';

interface Props {
  title: string;
  text: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  onViewSql?: () => void;
}

export default function ErrorCard({
  title,
  text,
  onRetry,
  retryLabel = 'Try again',
  retryDisabled,
  onViewSql,
}: Props) {
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-danger/40 bg-danger/5 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="break-words text-sm leading-6 text-fg/90">{text}</p>
        {(onRetry || onViewSql) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {onViewSql && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onViewSql}
                aria-label="View SQL"
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                View SQL
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onRetry}
                disabled={retryDisabled}
                aria-label={retryLabel}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
