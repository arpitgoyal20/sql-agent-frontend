// Composer (UI_SPEC §15): auto-growing textarea, Enter / ⌘↵ sends, Shift+Enter newline,
// rotating placeholder, [＋] example menu, [Schema] toggle, [SQL Mode] toggle, Send →.

import { ArrowRight, Code2, Database, Plus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { looksLikeSql } from '../../utils/format';
import { useDismiss } from '../common/useDismiss';

const PLACEHOLDERS = [
  'Show customers from California',
  'Find the top 10 products by revenue',
  'Why is this query failing?',
  'Optimize this SQL query',
  'Show monthly revenue for 2025',
];

const ROTATE_MS = 4000;
const MAX_HEIGHT = 220;

function ExamplesMenu({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [root]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-icon"
        aria-label="Example prompts"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Example prompts"
          className="menu absolute bottom-full left-0 mb-1.5 w-72"
        >
          <p className="section-label px-2 pb-1 pt-1.5" aria-hidden="true">
            Examples
          </p>
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                onPick(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Composer() {
  const {
    draft,
    setDraft,
    send,
    streaming,
    registerInput,
    threadLoading,
    sqlMode,
    setSqlMode,
    focusComposer,
  } = useChat();
  const { toggleSchema, schemaVisible } = useUi();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState(0);
  const disabled = streaming || threadLoading;

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

  // Rotate the placeholder only while the box is empty.
  useEffect(() => {
    if (draft || disabled) return;
    const timer = setInterval(() => setHint((i) => (i + 1) % PLACEHOLDERS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [draft, disabled]);

  // Give focus back once a turn finishes, unless the user moved elsewhere.
  useEffect(() => {
    if (!disabled && document.activeElement === document.body) ref.current?.focus();
  }, [disabled]);

  const submit = () => {
    if (disabled || !draft.trim()) return;
    send(draft);
    setDraft('');
    setSqlMode(false);
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
      className="shrink-0 border-t border-line bg-bg px-3 pb-3 pt-2 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-line bg-surface transition-colors focus-within:border-accent/70">
        <label htmlFor="composer" className="sr-only">
          Ask anything about your database
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            if (looksLikeSql(e.clipboardData.getData('text'))) setSqlMode(true);
          }}
          placeholder={
            streaming
              ? 'Waiting for the reply…'
              : // Short form on phones so the placeholder fits on one line.
                window.innerWidth >= 640
                ? `Ask anything about your database... e.g. ${PLACEHOLDERS[hint]}`
                : `${PLACEHOLDERS[hint]}…`
          }
          aria-describedby="composer-hint"
          className={`block max-h-[220px] min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 text-fg placeholder:text-muted focus:outline-none disabled:cursor-not-allowed ${
            sqlMode ? 'font-mono text-[13px] leading-5' : 'text-[14px] leading-6'
          }`}
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <ExamplesMenu
            disabled={disabled}
            onPick={(p) => {
              setDraft(p);
              focusComposer();
            }}
          />
          <button
            type="button"
            className={`btn-ghost ${schemaVisible ? 'text-fg' : ''}`}
            onClick={toggleSchema}
            aria-label="Toggle schema panel"
            aria-pressed={schemaVisible}
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            Schema
          </button>
          <button
            type="button"
            className={`btn-ghost ${sqlMode ? 'bg-elevated text-fg' : ''}`}
            onClick={() => {
              setSqlMode(!sqlMode);
              ref.current?.focus();
            }}
            aria-label="SQL mode"
            aria-pressed={sqlMode}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">SQL Mode</span>
          </button>
          <span id="composer-hint" className="ml-auto hidden text-2xs text-muted sm:inline">
            <kbd className="font-sans">⌘ Enter</kbd> to send · Shift+Enter for a new line
          </span>
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            aria-label="Send message"
            className="btn-primary ml-auto sm:ml-2"
          >
            Send
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
