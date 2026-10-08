// Chat state: current thread and its turns, the thread list, saved queries, database/dialect
// settings and the bridge to the composer (draft, SQL mode, insert at cursor).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { streamChat } from '../api/chatStream';
import {
  createSaved,
  deleteSaved as apiDeleteSaved,
  deleteThread as apiDeleteThread,
  duplicateThread as apiDuplicateThread,
  getSaved,
  getThread,
  getThreads,
  renameThread as apiRenameThread,
} from '../api/client';
import type { Dialect, SavedQuery, SavedQueryInput, ThreadSummary } from '../api/types';
import { DATABASES, newId, type DatabaseId } from '../utils/format';
import {
  IDLE_RUN,
  applyStep,
  emptyTurn,
  messagesFromThread,
  sqlTurns,
  type AssistantMessage,
  type ChatMessage,
  type UserMessage,
} from './chatModel';
import { runSql } from './execution';
import { useToast } from './ToastContext';

export type View = { kind: 'thread' } | { kind: 'saved'; id: string };

interface ChatValue {
  threadId: string;
  messages: ChatMessage[];
  streaming: boolean;
  threadLoading: boolean;
  threadError: string | null;
  /** Title of the open thread: the backend's (generated) title once it exists. */
  currentTitle: string;
  /** Whether the open thread exists on the server (rename / duplicate / delete apply). */
  threadPersisted: boolean;

  threads: ThreadSummary[] | null;
  threadsError: string | null;
  refreshThreads: () => void;

  saved: SavedQuery[] | null;
  savedError: string | null;
  refreshSaved: () => void;
  view: View;
  openSaved: (id: string) => void;
  deleteSavedQuery: (id: string) => Promise<boolean>;

  database: DatabaseId;
  setDatabase: (id: DatabaseId) => void;
  dialect: Dialect;
  /** The user's "Run queries automatically" preference; only effective on SQLite. */
  autoRun: boolean;
  setAutoRun: (on: boolean) => void;
  executionEnabled: boolean;

  showWakingBanner: boolean;
  dismissWakingBanner: () => void;

  draft: string;
  setDraft: (text: string) => void;
  sqlMode: boolean;
  setSqlMode: (on: boolean) => void;
  registerInput: (el: HTMLTextAreaElement | null) => void;
  insertAtCursor: (text: string) => void;
  focusComposer: () => void;
  applyFix: (sql: string) => void;

  send: (text: string) => void;
  retry: (assistantId: string) => void;
  newChat: () => void;
  loadThread: (threadId: string) => void;
  renameThread: (threadId: string, title: string) => Promise<boolean>;
  duplicateThread: (threadId: string) => Promise<boolean>;
  removeThread: (threadId: string) => Promise<boolean>;
  saveThread: (threadId: string) => Promise<boolean>;

  runTurn: (assistantId: string) => void;
  saveTurn: (assistantId: string) => Promise<boolean>;
  highlightedId: string | null;
  highlightTurn: (assistantId: string) => void;
}

const ChatContext = createContext<ChatValue | null>(null);

const HIGHLIGHT_MS = 2000;

function explanationOf(turn: AssistantMessage): string {
  return turn.explanation?.text ?? turn.tokens;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const [threadId, setThreadId] = useState(newId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [threadsVersion, setThreadsVersion] = useState(0);
  const [saved, setSaved] = useState<SavedQuery[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [view, setView] = useState<View>({ kind: 'thread' });
  const [database, setDatabase] = useState<DatabaseId>('demo');
  const [autoRun, setAutoRun] = useState(true);
  const [showWakingBanner, setShowWakingBanner] = useState(false);
  const [draft, setDraft] = useState('');
  const [sqlMode, setSqlMode] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const dialect = DATABASES.find((d) => d.id === database)?.dialect ?? 'sqlite';
  const executionEnabled = dialect === 'sqlite' && autoRun;

  const abortRef = useRef<AbortController | null>(null);
  const loadRef = useRef(0);
  const bannerShownRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadIdRef = useRef(threadId);
  const messagesRef = useRef(messages);
  const draftRef = useRef(draft);
  const viewRef = useRef(view);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  messagesRef.current = messages;
  draftRef.current = draft;
  viewRef.current = view;

  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearTimeout(highlightTimer.current);
    },
    [],
  );

  // ---- Lists -------------------------------------------------------------------

  useEffect(() => {
    let live = true;
    getThreads().then(
      (list) => {
        if (!live) return;
        setThreads(list);
        setThreadsError(null);
      },
      () => live && setThreadsError('Could not load threads.'),
    );
    return () => {
      live = false;
    };
  }, [threadsVersion]);

  useEffect(() => {
    let live = true;
    getSaved().then(
      (list) => {
        if (!live) return;
        setSaved(list);
        setSavedError(null);
      },
      () => live && setSavedError('Could not load saved queries.'),
    );
    return () => {
      live = false;
    };
  }, [savedVersion]);

  const refreshThreads = useCallback(() => setThreadsVersion((v) => v + 1), []);
  const refreshSaved = useCallback(() => setSavedVersion((v) => v + 1), []);

  // ---- Turns -------------------------------------------------------------------

  const updateTurn = useCallback(
    (id: string, fn: (m: AssistantMessage) => Partial<AssistantMessage>) =>
      setMessages((ms) =>
        ms.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...fn(m) } : m)),
      ),
    [],
  );

  const stopTurn = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setShowWakingBanner(false);
  }, []);

  const resetThread = useCallback(
    (id: string) => {
      stopTurn();
      loadRef.current += 1;
      threadIdRef.current = id;
      setThreadId(id);
      setMessages([]);
      setThreadError(null);
      setThreadLoading(false);
      setView({ kind: 'thread' });
    },
    [stopTurn],
  );

  const newChat = useCallback(() => resetThread(newId()), [resetThread]);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || abortRef.current) return;
      // Sending from a saved query starts a fresh thread.
      if (viewRef.current.kind === 'saved') resetThread(newId());
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const turn = emptyTurn(message, executionEnabled);
      const user: UserMessage = {
        id: newId(),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((ms) => [...ms, user, turn]);
      setStreaming(true);
      const update = (fn: (m: AssistantMessage) => Partial<AssistantMessage>) =>
        updateTurn(turn.id, fn);

      void streamChat(
        { thread_id: threadIdRef.current, message, dialect, execute: executionEnabled },
        {
          onStep: (s) => update((m) => ({ steps: applyStep(m.steps, s) })),
          onIntent: ({ intent }) => update(() => ({ intent })),
          onSql: (sql) => update(() => ({ sql })),
          onResult: (result) => update(() => ({ result })),
          onToken: ({ text: t }) => update((m) => ({ tokens: m.tokens + t })),
          onExplanation: (explanation) => update(() => ({ explanation })),
          onClarify: ({ text: t }) => update(() => ({ clarify: t })),
          onRefusal: (refusal) => update(() => ({ refusal })),
          onError: ({ text: t }) => update(() => ({ error: t, status: 'error' })),
          onDone: ({ intent }) =>
            update((m) => ({
              intent: m.intent ?? (m.error ? null : intent),
              status: m.error ? 'error' : 'done',
            })),
          onSlow: () => {
            if (bannerShownRef.current) return;
            bannerShownRef.current = true;
            setShowWakingBanner(true);
          },
        },
        { signal: ctrl.signal },
      ).then((outcome) => {
        if (outcome === 'aborted') return;
        update((m) => (m.status === 'pending' ? { status: outcome } : {}));
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setStreaming(false);
          setShowWakingBanner(false);
        }
        // The backend may have generated a new title for the thread.
        if (outcome === 'done') refreshThreads();
      });
    },
    [dialect, executionEnabled, updateTurn, resetThread, refreshThreads],
  );

  const retry = useCallback(
    (assistantId: string) => {
      if (abortRef.current) return;
      const ms = messagesRef.current;
      const i = ms.findIndex((m) => m.id === assistantId);
      const turn = ms[i];
      if (!turn || turn.role !== 'assistant') return;
      // Drop the failed pair and resend the same text as a fresh turn.
      const start = i > 0 && ms[i - 1].role === 'user' ? i - 1 : i;
      setMessages((cur) => cur.filter((_, j) => j < start || j > i));
      send(turn.request);
    },
    [send],
  );

  const loadThread = useCallback(
    (id: string) => {
      resetThread(id);
      const token = loadRef.current;
      setThreadLoading(true);
      getThread(id).then(
        (detail) => {
          if (loadRef.current !== token) return;
          setMessages(messagesFromThread(detail, dialect));
          setThreadLoading(false);
        },
        (err: unknown) => {
          if (loadRef.current !== token) return;
          setThreadError(err instanceof Error ? err.message : 'Could not load this thread.');
          setThreadLoading(false);
        },
      );
    },
    [resetThread, dialect],
  );

  const runTurn = useCallback(
    (assistantId: string) => {
      const turn = messagesRef.current.find(
        (m): m is AssistantMessage => m.id === assistantId && m.role === 'assistant',
      );
      if (!turn?.sql || turn.run.status === 'running') return;
      const { sql, dialect: d } = turn.sql;
      updateTurn(assistantId, () => ({ run: { status: 'running', error: null } }));
      void runSql(sql, d).then((out) =>
        updateTurn(assistantId, (m) => ({
          result: out.result ?? m.result,
          run: out.error ? { status: 'error', error: out.error } : IDLE_RUN,
          // A reloaded turn has no checklist / inspection yet; take them from /execute.
          sql:
            m.sql && (!m.sql.validation || !m.sql.inspection)
              ? {
                  ...m.sql,
                  validation: m.sql.validation ?? out.validation ?? undefined,
                  inspection: m.sql.inspection ?? out.inspection,
                }
              : m.sql,
        })),
      );
    },
    [updateTurn],
  );

  // ---- Threads -------------------------------------------------------------------

  const renameThread = useCallback(
    async (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return false;
      try {
        const updated = await apiRenameThread(id, clean);
        setThreads((ts) =>
          ts ? ts.map((t) => (t.thread_id === id ? { ...t, title: updated.title } : t)) : ts,
        );
        refreshThreads();
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not rename the thread.', 'error');
        return false;
      }
    },
    [notify, refreshThreads],
  );

  const duplicateThread = useCallback(
    async (id: string) => {
      try {
        const copy = await apiDuplicateThread(id);
        refreshThreads();
        loadThread(copy.thread_id);
        notify(`Duplicated as “${copy.title}”`);
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not duplicate the thread.', 'error');
        return false;
      }
    },
    [notify, refreshThreads, loadThread],
  );

  const removeThread = useCallback(
    async (id: string) => {
      try {
        await apiDeleteThread(id);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not delete the thread.', 'error');
        return false;
      }
      if (id === threadIdRef.current) newChat();
      setThreads((ts) => ts?.filter((t) => t.thread_id !== id) ?? ts);
      refreshThreads();
      return true;
    },
    [notify, newChat, refreshThreads],
  );

  // ---- Saved queries -------------------------------------------------------------

  const createSavedQuery = useCallback(
    async (input: SavedQueryInput) => {
      try {
        await createSaved(input);
        refreshSaved();
        notify('Saved to Saved Queries');
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not save the query.', 'error');
        return false;
      }
    },
    [notify, refreshSaved],
  );

  const titleFor = useCallback(
    (id: string, fallback: string) =>
      threads?.find((t) => t.thread_id === id)?.title || fallback.slice(0, 80),
    [threads],
  );

  const saveTurn = useCallback(
    (assistantId: string) => {
      const turn = messagesRef.current.find(
        (m): m is AssistantMessage => m.id === assistantId && m.role === 'assistant',
      );
      if (!turn?.sql) return Promise.resolve(false);
      return createSavedQuery({
        title: titleFor(threadIdRef.current, turn.request),
        prompt: turn.request,
        sql: turn.sql.sql,
        dialect: turn.sql.dialect,
        explanation: explanationOf(turn),
      });
    },
    [createSavedQuery, titleFor],
  );

  const saveThread = useCallback(
    async (id: string) => {
      let turns: AssistantMessage[];
      if (id === threadIdRef.current && messagesRef.current.length) {
        turns = sqlTurns(messagesRef.current);
      } else {
        try {
          turns = sqlTurns(messagesFromThread(await getThread(id), dialect));
        } catch (err) {
          notify(err instanceof Error ? err.message : 'Could not load the thread.', 'error');
          return false;
        }
      }
      const last = turns[turns.length - 1];
      if (!last?.sql) {
        notify('This thread has no SQL to save yet.', 'error');
        return false;
      }
      return createSavedQuery({
        title: titleFor(id, last.request),
        prompt: last.request,
        sql: last.sql.sql,
        dialect: last.sql.dialect,
        explanation: explanationOf(last),
      });
    },
    [createSavedQuery, titleFor, dialect, notify],
  );

  const openSaved = useCallback(
    (id: string) => {
      stopTurn();
      setView({ kind: 'saved', id });
    },
    [stopTurn],
  );

  const deleteSavedQuery = useCallback(
    async (id: string) => {
      try {
        await apiDeleteSaved(id);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not delete the saved query.', 'error');
        return false;
      }
      setSaved((s) => s?.filter((q) => q.id !== id) ?? s);
      if (viewRef.current.kind === 'saved' && viewRef.current.id === id) {
        setView({ kind: 'thread' });
      }
      refreshSaved();
      notify('Saved query deleted');
      return true;
    },
    [notify, refreshSaved],
  );

  // ---- Composer bridge -------------------------------------------------------------

  const registerInput = useCallback((el: HTMLTextAreaElement | null) => {
    inputRef.current = el;
  }, []);

  const focusAt = useCallback((caret: number | null) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (caret !== null) el.setSelectionRange(caret, caret);
    });
  }, []);

  const focusComposer = useCallback(() => focusAt(null), [focusAt]);

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = inputRef.current;
      const current = draftRef.current;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const before = current.slice(0, start);
      const pad = before && !/\s$/.test(before) ? ' ' : '';
      const next = `${before}${pad}${text}${current.slice(end)}`;
      draftRef.current = next;
      setDraft(next);
      focusAt(start + pad.length + text.length);
    },
    [focusAt],
  );

  const applyFix = useCallback(
    (sql: string) => {
      setDraft(sql);
      setSqlMode(true);
      focusAt(sql.length);
    },
    [focusAt],
  );

  const highlightTurn = useCallback((assistantId: string) => {
    setHighlightedId(assistantId);
    // Scroll only the conversation, never the page.
    const el = document.getElementById(`sql-card-${assistantId}`);
    const scroller = el?.closest<HTMLElement>('[data-scroller]');
    if (el && scroller) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const top =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo?.({ top: Math.max(0, top - 16), behavior: reduce ? 'auto' : 'smooth' });
    }
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
  }, []);

  const currentTitle = useMemo(() => {
    const fromList = threads?.find((t) => t.thread_id === threadId)?.title;
    if (fromList) return fromList;
    const first = messages.find((m) => m.role === 'user');
    return first ? first.content.split('\n')[0].slice(0, 80) : 'New thread';
  }, [threads, threadId, messages]);

  const value: ChatValue = {
    threadId,
    messages,
    streaming,
    threadLoading,
    threadError,
    currentTitle,
    threadPersisted: !!threads?.some((t) => t.thread_id === threadId),
    threads,
    threadsError,
    refreshThreads,
    saved,
    savedError,
    refreshSaved,
    view,
    openSaved,
    deleteSavedQuery,
    database,
    setDatabase,
    dialect,
    autoRun,
    setAutoRun,
    executionEnabled,
    showWakingBanner,
    dismissWakingBanner: () => setShowWakingBanner(false),
    draft,
    setDraft,
    sqlMode,
    setSqlMode,
    registerInput,
    insertAtCursor,
    focusComposer,
    applyFix,
    send,
    retry,
    newChat,
    loadThread,
    renameThread,
    duplicateThread,
    removeThread,
    saveThread,
    runTurn,
    saveTurn,
    highlightedId,
    highlightTurn,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat(): ChatValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside <ChatProvider>');
  return value;
}
