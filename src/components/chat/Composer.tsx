// Chat input: auto-growing textarea; Enter or ⌘/Ctrl+Enter sends, Shift+Enter adds a line.
// Pasted SQL switches to a monospace font. The editor's SQL is sent along as `current_sql`.

import { ArrowUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';

import { useChat } from '../../context/ChatContext';
import { looksLikeSql } from '../../utils/format';

export const COMPOSER_PLACEHOLDER = 'Ask about your data — or click a table to start';
const MAX_HEIGHT = 180;

export default function Composer() {
  const { draft, setDraft, send, streaming, registerInput, threadLoading } = useChat();
  const ref = useRef<HTMLTextAreaElement>(null);
  const disabled = streaming || threadLoading;
  const sqlish = looksLikeSql(draft);

  useEffect(() => {
    registerInput(ref.current);
    return () => registerInput(null);
  }, [registerInput]);

  // Grow with the content up to MAX_HEIGHT, then scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [draft]);

  const submit = () => {
    if (disabled || !draft.trim()) return;
    send(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (e.metaKey || e.ctrlKey || !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="shrink-0 border-t border-line bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-1.5 rounded-lg border border-line bg-bg pr-1.5 transition-colors focus-within:border-accent/70">
        <label htmlFor="composer" className="sr-only">
          Ask about your data
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={streaming ? 'Waiting for the reply…' : COMPOSER_PLACEHOLDER}
          aria-describedby="composer-hint"
          className={`block max-h-[180px] min-h-[40px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-fg placeholder:text-muted focus:outline-none disabled:cursor-not-allowed ${
            sqlish ? 'font-mono text-[12.5px] leading-5' : 'text-sm leading-6'
          }`}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send message"
          title="Send (Enter)"
          className="btn-primary mb-1.5 h-7 w-7 px-0"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p id="composer-hint" className="mt-1 hidden px-1 text-2xs text-muted sm:block">
        Enter to send · Shift+Enter for a new line · the editor&apos;s query is sent as context
      </p>
    </form>
  );
}
