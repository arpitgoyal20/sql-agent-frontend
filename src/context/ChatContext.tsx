// Chat state: the current thread and its turns, the thread list, the "Run queries" preference
// and the composer draft. Every request sends the editor contents as `current_sql`; SQL,
// results and explanations from the stream are handed to the workbench (editor, grid, tabs).

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
import { deleteThread as apiDeleteThread, getThread, getThreads } from '../api/client';
import type { Intent, SqlEvent, ThreadSummary } from '../api/types';
import { newId } from '../utils/format';
import {
  applyStep,
  emptyTurn,
  messagesFromThread,
  type AssistantMessage,
  type ChatMessage,
  type UserMessage,
} from './chatModel';
import { useToast } from './ToastContext';
import { useUi } from './UiContext';
import { useWorkbench } from './WorkbenchContext';

interface ChatValue {
  threadId: string;
  messages: ChatMessage[];
  streaming: boolean;
  threadLoading: boolean;
  threadError: string | null;
  /** Title of the open thread: the backend's (generated) title once it exists. */
  currentTitle: string;

  threads: ThreadSummary[] | null;
  threadsError: string | null;
  refreshThreads: () => void;

  /** The user's "Run queries" preference; only effective on SQLite. */
  autoRun: boolean;
  setAutoRun: (on: boolean) => void;
  executionEnabled: boolean;

  showWakingBanner: boolean;
  dismissWakingBanner: () => void;

  draft: string;
  setDraft: (text: string) => void;
  registerInput: (el: HTMLTextAreaElement | null) => void;
  focusComposer: () => void;
  /** Put text in the composer (navigator "Ask AI about this table"), show the chat and focus. */
  prefill: (text: string) => void;

  send: (text: string) => void;
  retry: (assistantId: string) => void;
  newChat: () => void;
  loadThread: (threadId: string) => void;
  removeThread: (threadId: string) => Promise<boolean>;
}

const ChatContext = createContext<ChatValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const { showChat } = useUi();
  const workbench = useWorkbench();
  const { dialect, editorSql } = workbench;
  const [threadId, setThreadId] = useState(newId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [threadsVersion, setThreadsVersion] = useState(0);
  const [autoRun, setAutoRun] = useState(true);
  const [showWakingBanner, setShowWakingBanner] = useState(false);
  const [draft, setDraft] = useState('');

  const executionEnabled = autoRun; // every dialect runs on the SQLite demo database

  const abortRef = useRef<AbortController | null>(null);
  const loadRef = useRef(0);
  const bannerShownRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadIdRef = useRef(threadId);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // The bridge functions are stable, but read the editor through a ref so `send` always sends
  // what is in the editor right now.
  const editorSqlRef = useRef(editorSql);
  editorSqlRef.current = editorSql;
  const bridge = useRef(workbench);
  bridge.current = workbench;

  useEffect(() => () => abortRef.current?.abort(), []);

  // ---- Thread list -------------------------------------------------------------

  useEffect(() => {
    let live = true;
    getThreads().then(
      (list) => {
        if (!live) return;
        setThreads(list);
        setThreadsError(null);
      },
      () => live && setThreadsError('Could not load chats.'),
    );
    return () => {
      live = false;
    };
  }, [threadsVersion]);

  const refreshThreads = useCallback(() => setThreadsVersion((v) => v + 1), []);

  // ---- Turns -------------------------------------------------------------------

  const updateTurn = useCallback(
    (id: string, fn: (m: AssistantMessage) => Partial<AssistantMessage>) =>
      setMessages((ms) =>
        ms.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...fn(m) } : m)),
      ),
    [],
  );

  const stopTurn = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      bridge.current.chatTurnEnded(null, false);
    }
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
    },
    [stopTurn],
  );

  const newChat = useCallback(() => resetThread(newId()), [resetThread]);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || abortRef.current) return;
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
      showChat();
      const update = (fn: (m: AssistantMessage) => Partial<AssistantMessage>) =>
        updateTurn(turn.id, fn);
      const wb = () => bridge.current;
      let sqlEvent: SqlEvent | null = null;
      let hadResult = false;
      let turnIntent: Intent | null = null;
      const currentSql = editorSqlRef.current.trim();

      void streamChat(
        {
          thread_id: threadIdRef.current,
          message,
          dialect,
          execute: executionEnabled,
          ...(currentSql ? { current_sql: currentSql } : {}),
        },
        {
          onStep: (s) => update((m) => ({ steps: applyStep(m.steps, s) })),
          onIntent: ({ intent }) => {
            turnIntent = intent;
            update(() => ({ intent }));
          },
          onSql: (sql) => {
            sqlEvent = sql;
            update(() => ({ sql }));
            wb().chatSql(sql, executionEnabled);
          },
          onResult: (result) => {
            hadResult = true;
            update(() => ({ result }));
            wb().chatResult(result, sqlEvent);
          },
          onToken: ({ text: t }) => {
            update((m) => ({ tokens: m.tokens + t }));
            if (sqlEvent) wb().chatToken(t);
          },
          onExplanation: (explanation) => {
            update(() => ({ explanation }));
            if (sqlEvent) wb().chatExplanation(explanation);
          },
          onClarify: ({ text: t }) => update(() => ({ clarify: t })),
          onRefusal: (refusal) => update(() => ({ refusal })),
          onError: ({ text: t }) => update(() => ({ error: t, status: 'error' })),
          onDone: ({ intent }) => {
            turnIntent ??= intent;
            update((m) => ({
              intent: m.intent ?? (m.error ? null : intent),
              status: m.error ? 'error' : 'done',
            }));
          },
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
        wb().chatTurnEnded(outcome === 'done' ? turnIntent : null, hadResult);
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setStreaming(false);
          setShowWakingBanner(false);
        }
        // The backend may have generated a new title for the thread.
        if (outcome === 'done') refreshThreads();
      });
    },
    [dialect, executionEnabled, updateTurn, refreshThreads, showChat],
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
          setThreadError(err instanceof Error ? err.message : 'Could not load this chat.');
          setThreadLoading(false);
        },
      );
    },
    [resetThread, dialect],
  );

  const removeThread = useCallback(
    async (id: string) => {
      try {
        await apiDeleteThread(id);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not delete the chat.', 'error');
        return false;
      }
      if (id === threadIdRef.current) newChat();
      setThreads((ts) => ts?.filter((t) => t.thread_id !== id) ?? ts);
      refreshThreads();
      return true;
    },
    [notify, newChat, refreshThreads],
  );

  // ---- Composer bridge -------------------------------------------------------------

  const registerInput = useCallback((el: HTMLTextAreaElement | null) => {
    inputRef.current = el;
  }, []);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const prefill = useCallback(
    (text: string) => {
      setDraft(text);
      showChat();
      focusComposer();
    },
    [showChat, focusComposer],
  );

  const currentTitle = useMemo(() => {
    const fromList = threads?.find((t) => t.thread_id === threadId)?.title;
    if (fromList) return fromList;
    const first = messages.find((m) => m.role === 'user');
    return first ? first.content.split('\n')[0].slice(0, 80) : 'New chat';
  }, [threads, threadId, messages]);

  const value: ChatValue = {
    threadId,
    messages,
    streaming,
    threadLoading,
    threadError,
    currentTitle,
    threads,
    threadsError,
    refreshThreads,
    autoRun,
    setAutoRun,
    executionEnabled,
    showWakingBanner,
    dismissWakingBanner: () => setShowWakingBanner(false),
    draft,
    setDraft,
    registerInput,
    focusComposer,
    prefill,
    send,
    retry,
    newChat,
    loadThread,
    removeThread,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat(): ChatValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside <ChatProvider>');
  return value;
}
