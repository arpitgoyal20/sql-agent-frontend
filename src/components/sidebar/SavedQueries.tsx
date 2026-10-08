// ⭐ Saved Queries list (GET /api/saved).

import { FileCode2, RefreshCw, Star } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { formatRelative } from '../../utils/format';

export default function SavedQueries({ onNavigate }: { onNavigate: () => void }) {
  const { saved, savedError, refreshSaved, view, openSaved } = useChat();
  return (
    <section aria-labelledby="saved-heading" className="border-t border-line px-2 pb-2 pt-3">
      <h2 id="saved-heading" className="section-label mb-1 flex items-center gap-1.5 px-1.5">
        <Star className="h-3 w-3 text-warning" aria-hidden="true" />
        Saved queries
      </h2>
      {savedError && !saved && (
        <div className="flex items-center gap-2 px-1.5 text-sm">
          <span className="flex-1 text-muted">{savedError}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={refreshSaved}
            aria-label="Reload saved queries"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      {!saved && !savedError && (
        <div className="space-y-1.5 px-1.5 py-1" aria-hidden="true">
          <div className="skeleton h-3 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      )}
      {saved && saved.length === 0 && (
        <p className="px-1.5 py-1 text-xs text-muted">
          Save a query from its SQL card to keep it here.
        </p>
      )}
      {saved && saved.length > 0 && (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {saved.map((q) => {
            const active = view.kind === 'saved' && view.id === q.id;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => {
                    openSaved(q.id);
                    onNavigate();
                  }}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Open saved query: ${q.title}`}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                    active ? 'bg-elevated' : 'hover:bg-elevated/60'
                  }`}
                >
                  <FileCode2
                    className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${active ? 'text-accent-fg' : 'text-muted'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{q.title}</span>
                    <span className="block text-2xs text-muted">
                      {formatRelative(q.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
