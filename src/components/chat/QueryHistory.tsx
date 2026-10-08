// QUERY HISTORY (UI_SPEC §27): numbered prompts that produced SQL; click to jump to that card.

import { X } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { sqlTurns } from '../../context/chatModel';

export default function QueryHistory({ onClose }: { onClose: () => void }) {
  const { messages, highlightTurn, highlightedId } = useChat();
  const turns = sqlTurns(messages);
  return (
    <section
      aria-labelledby="query-history-heading"
      className="fade-in border-b border-line bg-surface px-3 py-2 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center">
          <h3 id="query-history-heading" className="section-label mr-auto">
            Query history
          </h3>
          <button
            type="button"
            className="btn-icon h-6 w-6"
            onClick={onClose}
            aria-label="Close query history"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        {turns.length === 0 ? (
          <p className="pb-1 text-sm text-muted">No queries in this thread yet.</p>
        ) : (
          <ol className="max-h-40 space-y-px overflow-y-auto">
            {turns.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => highlightTurn(t.id)}
                  aria-label={`Go to query ${i + 1}: ${t.request}`}
                  className={`flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors hover:bg-elevated ${
                    highlightedId === t.id ? 'bg-elevated' : ''
                  }`}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 truncate">{t.request.split('\n')[0]}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
