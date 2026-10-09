// POST /api/chat as Server-Sent Events, turned into typed callbacks.
//
// Guarantees for callers:
// - `streamChat` never rejects; it resolves with how the turn ended.
// - Client-side failures (network, non-200, 30 s with no event, connection closed early) are
//   reported through `onError`, exactly like a server `error` event.
// - Nothing is dispatched after `done` or after a client-side failure.
// - The request is never retried automatically (a retry would re-send the user's message).

import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';

import { HttpError, apiUrl, isMockMode } from './client';
import { CLIENT_ID_HEADER, getClientId } from './clientId';
import {
  CHAT_EVENT_NAMES,
  type ChatEvent,
  type ChatEventMap,
  type ChatEventName,
  type ChatRequest,
} from './types';

export const IDLE_TIMEOUT_MS = 30_000;
export const SLOW_AFTER_MS = 5_000;

type HandlerName<K extends ChatEventName> = `on${Capitalize<K>}`;

export type ChatStreamHandlers = {
  [K in ChatEventName as HandlerName<K>]?: (data: ChatEventMap[K]) => void;
} & {
  /** Called for every event, before the specific handler. */
  onEvent?: (event: ChatEvent) => void;
  /** Called once if no event has arrived after `slowAfterMs` (server may be cold-starting). */
  onSlow?: () => void;
};

export interface ChatStreamOptions {
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  slowAfterMs?: number;
  /** Replay a scripted sequence instead of calling the backend. Defaults to mock mode. */
  mock?: boolean;
}

/** How a turn ended: a `done` event, an error (server or client side), or caller abort. */
export type StreamOutcome = 'done' | 'error' | 'aborted';

export const ERROR_TEXT = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: 'No response from the server for 30 seconds. Please try again.',
  closed: 'The connection closed before the reply finished. Please try again.',
  rateLimited: 'Too many requests. Please wait a moment and try again.',
} as const;

export function httpErrorText(status: number): string {
  if (status === 429) return ERROR_TEXT.rateLimited;
  if (status >= 500) return `The server had a problem (HTTP ${status}). Please try again.`;
  return `The request failed (HTTP ${status}). Please try again.`;
}

const KNOWN_EVENTS = new Set<string>(CHAT_EVENT_NAMES);

/** Parse one raw SSE message into a typed event, or null if it is not one of ours. */
export function parseChatEvent(msg: Pick<EventSourceMessage, 'event' | 'data'>): ChatEvent | null {
  if (!KNOWN_EVENTS.has(msg.event) || !msg.data) return null;
  try {
    return { event: msg.event, data: JSON.parse(msg.data) } as ChatEvent;
  } catch {
    return null;
  }
}

function handlerFor(handlers: ChatStreamHandlers, name: ChatEventName) {
  const key = `on${name[0].toUpperCase()}${name.slice(1)}` as HandlerName<ChatEventName>;
  return handlers[key] as ((data: unknown) => void) | undefined;
}

export function streamChat(
  request: ChatRequest,
  handlers: ChatStreamHandlers,
  options: ChatStreamOptions = {},
): Promise<StreamOutcome> {
  const {
    signal,
    idleTimeoutMs = IDLE_TIMEOUT_MS,
    slowAfterMs = SLOW_AFTER_MS,
    mock = isMockMode(),
  } = options;

  return new Promise<StreamOutcome>((resolve) => {
    if (signal?.aborted) {
      resolve('aborted');
      return;
    }
    const ctrl = new AbortController();
    let finished = false;
    let serverErrored = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (outcome: StreamOutcome) => {
      if (finished) return;
      finished = true;
      clearTimeout(idleTimer);
      clearTimeout(slowTimer);
      signal?.removeEventListener('abort', onExternalAbort);
      ctrl.abort();
      resolve(outcome);
    };

    const fail = (text: string) => {
      if (finished) return;
      const event: ChatEvent = { event: 'error', data: { text } };
      handlers.onEvent?.(event);
      handlers.onError?.(event.data);
      finish('error');
    };

    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => fail(ERROR_TEXT.timeout), idleTimeoutMs);
    };

    const dispatch = (event: ChatEvent) => {
      if (finished) return;
      clearTimeout(slowTimer);
      armIdleTimer();
      if (event.event === 'error') serverErrored = true;
      handlers.onEvent?.(event);
      handlerFor(handlers, event.event)?.(event.data);
      if (event.event === 'done') finish('done');
    };

    // The server normally sends `done` after `error`; if it just closes instead, end quietly
    // rather than reporting a second error.
    const onClosed = () => {
      if (finished) return;
      if (serverErrored) finish('error');
      else fail(ERROR_TEXT.closed);
    };

    function onExternalAbort() {
      finish('aborted');
    }

    signal?.addEventListener('abort', onExternalAbort);
    armIdleTimer();
    const slowTimer = setTimeout(() => handlers.onSlow?.(), slowAfterMs);

    if (mock) {
      // Loaded on demand so the scripted replies stay out of the production bundle.
      import('./mock')
        .then(({ runMockChat }) => runMockChat(request, dispatch, ctrl.signal))
        .then(onClosed, () => fail(ERROR_TEXT.network));
      return;
    }

    fetchEventSource(apiUrl('/api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        [CLIENT_ID_HEADER]: getClientId(),
      },
      body: JSON.stringify(request),
      signal: ctrl.signal,
      // Without this the library closes and re-POSTs when the tab is hidden.
      openWhenHidden: true,
      async onopen(response) {
        if (!response.ok) throw new HttpError(response.status, httpErrorText(response.status));
        const type = response.headers.get('content-type') ?? '';
        if (!type.includes('text/event-stream')) {
          throw new HttpError(response.status, ERROR_TEXT.closed);
        }
      },
      onmessage(msg) {
        const event = parseChatEvent(msg);
        if (event) dispatch(event);
      },
      onclose: onClosed,
      onerror(err) {
        throw err; // rethrowing stops the library's automatic retry
      },
    }).then(
      // Resolves on close or when our controller aborts; onclose already handled the rest.
      () => onClosed(),
      (err: unknown) => fail(err instanceof HttpError ? err.message : ERROR_TEXT.network),
    );
  });
}
