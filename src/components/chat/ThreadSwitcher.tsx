// Thread dropdown in the chat header: search, switch, delete (inline confirm). ⌘K opens it.

import { Check, ChevronDown, MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { formatRelative } from '../../utils/format';
import { useDismiss } from '../common/useDismiss';

export default function ThreadSwitcher() {
  const {
    threads,
    threadsError,
    refreshThreads,
    threadId,
    currentTitle,
    loadThread,
    removeThread,
  } = useChat();
  const { threadMenuOpen: open, setThreadMenuOpen: setOpen } = useUi();
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, [root]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setConfirming(null);
    refreshThreads();
    requestAnimationFrame(() => search.current?.focus());
  }, [open, refreshThreads]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (threads ?? []).filter((t) => !q || (t.title || '').toLowerCase().includes(q));
  }, [threads, query]);

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-[13px] font-medium text-fg hover:bg-elevated"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Chat: ${currentTitle}. Switch chat (⌘K)`}
        onClick={() => setOpen(!open)}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 truncate">{currentTitle}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Chats"
          className="menu absolute left-0 top-full mt-1 w-[min(320px,calc(100vw-24px))] p-0"
        >
          <div className="flex items-center gap-2 border-b border-line px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
            />
          </div>
          <ul aria-label="Chat list" className="max-h-[50vh] overflow-y-auto p-1">
            {threadsError && !threads && (
              <li className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
                <span className="flex-1">{threadsError}</span>
                <button
                  type="button"
                  className="btn-icon h-6 w-6"
                  onClick={refreshThreads}
                  aria-label="Reload chats"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )}
            {threads && items.length === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted">
                {query ? 'No chats match.' : 'No chats yet.'}
              </li>
            )}
            {items.map((t) => {
              const current = t.thread_id === threadId;
              const title = t.title || 'Untitled chat';
              if (confirming === t.thread_id) {
                return (
                  <li
                    key={t.thread_id}
                    className="flex items-center gap-1 rounded-md bg-bg/60 py-1 pl-2.5 pr-1"
                  >
                    <span className="mr-auto truncate text-sm">Delete “{title}”?</span>
                    <button
                      type="button"
                      className="btn h-6 bg-danger px-2 text-xs text-white hover:bg-danger/90"
                      onClick={async () => {
                        await removeThread(t.thread_id);
                        setConfirming(null);
                      }}
                      aria-label={`Confirm delete of chat: ${title}`}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-6 px-2 text-xs"
                      onClick={() => setConfirming(null)}
                      aria-label="Cancel delete"
                    >
                      Cancel
                    </button>
                  </li>
                );
              }
              return (
                <li key={t.thread_id} className="group flex items-center rounded-md hover:bg-bg/60">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                    aria-current={current ? 'true' : undefined}
                    aria-label={`Open chat: ${title}`}
                    onClick={() => {
                      close();
                      if (!current) loadThread(t.thread_id);
                    }}
                  >
                    {current ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-hidden="true" />
                    ) : (
                      <span className="w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                    <span className="shrink-0 text-2xs text-muted">
                      {formatRelative(t.updated_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-icon mr-0.5 h-6 w-6 opacity-100 group-hover:opacity-100 lg:opacity-0 lg:focus:opacity-100"
                    onClick={() => setConfirming(t.thread_id)}
                    aria-label={`Delete chat: ${title}`}
                    title="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
