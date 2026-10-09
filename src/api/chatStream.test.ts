import { fetchEventSource, type FetchEventSourceInit } from '@microsoft/fetch-event-source';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_TEXT, httpErrorText, streamChat, type ChatStreamHandlers } from './chatStream';
import { CLIENT_ID_HEADER, CLIENT_ID_STORAGE_KEY, resetClientIdCache } from './clientId';
// Preload the lazily imported mock so fake timers see its first delay.
import './mock';
import type { ChatEvent, ChatRequest } from './types';

vi.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: vi.fn() }));
const mockedFES = vi.mocked(fetchEventSource);

const REQUEST: ChatRequest = {
  thread_id: 't-1',
  message: 'Show all employees hired after January 2024',
  dialect: 'sqlite',
  execute: true,
};

type Raw = { event: string; data: unknown };

/**
 * Fake fetchEventSource that behaves like the library: calls onopen, then onmessage per
 * event, then onclose; errors go through onerror and reject if it rethrows.
 */
function serve(
  messages: Raw[],
  { status = 200, close = true, contentType = 'text/event-stream' } = {},
) {
  mockedFES.mockImplementation(async (_input, init) => {
    const opts = init as FetchEventSourceInit;
    try {
      await opts.onopen!({
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'content-type': contentType }),
      } as Response);
      for (const m of messages) {
        if (opts.signal?.aborted) return;
        const data = typeof m.data === 'string' ? m.data : JSON.stringify(m.data);
        opts.onmessage!({ id: '', event: m.event, data });
      }
      if (close && !opts.signal?.aborted) opts.onclose!();
    } catch (err) {
      opts.onerror!(err);
    }
  });
}

/** Handlers that record every specific callback in call order. */
function recorder() {
  const calls: string[] = [];
  const names = [
    'step',
    'intent',
    'sql',
    'result',
    'token',
    'explanation',
    'clarify',
    'refusal',
    'error',
    'done',
  ] as const;
  const handlers: ChatStreamHandlers = { onSlow: () => calls.push('slow') };
  for (const n of names) {
    const key = `on${n[0].toUpperCase()}${n.slice(1)}` as keyof ChatStreamHandlers;
    (handlers as Record<string, (d: unknown) => void>)[key] = () => calls.push(n);
  }
  return { calls, handlers };
}

const SQL = {
  sql: 'SELECT 1',
  dialect: 'sqlite',
  warnings: [],
  optimization_notes: [],
  index_suggestions: [],
  issues: [],
  removed_joins: [],
};

const HAPPY_PATH: Raw[] = [
  {
    event: 'step',
    data: { node: 'classify_intent', status: 'start', label: 'Understanding request' },
  },
  { event: 'intent', data: { intent: 'generate' } },
  { event: 'step', data: { node: 'validate_sql', status: 'ok', label: 'Validating SQL' } },
  { event: 'sql', data: SQL },
  { event: 'result', data: { columns: ['a'], rows: [[1]], row_count: 1, truncated: false } },
  { event: 'token', data: { text: 'This ' } },
  { event: 'token', data: { text: 'query' } },
  { event: 'explanation', data: { text: 'This query', assumptions: [] } },
  { event: 'done', data: { thread_id: 't-1', intent: 'generate' } },
];

describe('streamChat', () => {
  beforeEach(() => {
    mockedFES.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('POSTs the request without auto-retry on hidden tabs', async () => {
    serve(HAPPY_PATH);
    await streamChat(REQUEST, {}, { mock: false });
    const [url, init] = mockedFES.mock.calls[0];
    expect(url).toMatch(/\/api\/chat$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
    expect(init.openWhenHidden).toBe(true);
  });

  it('sends the editor SQL as current_sql in the request body', async () => {
    serve(HAPPY_PATH);
    const request: ChatRequest = {
      ...REQUEST,
      message: 'only those from California',
      current_sql: 'SELECT *\nFROM Customers\nLIMIT 100;',
    };
    await streamChat(request, {}, { mock: false });
    const body = JSON.parse(mockedFES.mock.calls[0][1].body as string);
    expect(body.current_sql).toBe('SELECT *\nFROM Customers\nLIMIT 100;');
    expect(body).toEqual(request);
  });

  it('sends a stable X-Client-Id (UUID v4, stored in localStorage) with the stream request', async () => {
    localStorage.clear();
    resetClientIdCache();
    serve(HAPPY_PATH);
    await streamChat(REQUEST, {}, { mock: false });
    serve(HAPPY_PATH);
    await streamChat(REQUEST, {}, { mock: false });
    const headers = mockedFES.mock.calls.map(([, init]) => init.headers as Record<string, string>);
    const id = headers[0][CLIENT_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(headers[1][CLIENT_ID_HEADER]).toBe(id);
    expect(localStorage.getItem(CLIENT_ID_STORAGE_KEY)).toBe(id);
    expect(headers[0]['Content-Type']).toBe('application/json');
  });

  it('fires callbacks in event order and resolves "done" after the done event', async () => {
    serve(HAPPY_PATH);
    const { calls, handlers } = recorder();
    const outcome = await streamChat(REQUEST, handlers, { mock: false });
    expect(calls).toEqual([
      'step',
      'intent',
      'step',
      'sql',
      'result',
      'token',
      'token',
      'explanation',
      'done',
    ]);
    expect(outcome).toBe('done');
  });

  it('passes typed payloads to handlers and every event to onEvent', async () => {
    serve(HAPPY_PATH);
    const seen: ChatEvent[] = [];
    const onSql = vi.fn();
    await streamChat(REQUEST, { onEvent: (e) => seen.push(e), onSql }, { mock: false });
    expect(onSql).toHaveBeenCalledWith(SQL);
    expect(seen.map((e) => e.event)).toEqual(HAPPY_PATH.map((m) => m.event));
  });

  it('ignores anything after done and aborts the connection', async () => {
    let signal: AbortSignal | undefined;
    mockedFES.mockImplementation(async (_url, init) => {
      signal = init.signal ?? undefined;
      await init.onopen!({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      } as Response);
      init.onmessage!({ id: '', event: 'done', data: '{"thread_id":"t-1","intent":"generate"}' });
      init.onmessage!({ id: '', event: 'token', data: '{"text":"late"}' });
    });
    const { calls, handlers } = recorder();
    await streamChat(REQUEST, handlers, { mock: false });
    expect(calls).toEqual(['done']);
    expect(signal?.aborted).toBe(true);
  });

  it('skips unknown events, comments and malformed JSON', async () => {
    serve([
      { event: 'ping', data: '{}' },
      { event: '', data: '' },
      { event: 'token', data: '{not json' },
      { event: 'done', data: { thread_id: 't-1', intent: null } },
    ]);
    const { calls, handlers } = recorder();
    expect(await streamChat(REQUEST, handlers, { mock: false })).toBe('done');
    expect(calls).toEqual(['done']);
  });

  it('reports a server error event once, then still finishes on done', async () => {
    serve([
      { event: 'error', data: { text: 'boom' } },
      { event: 'done', data: { thread_id: 't-1', intent: null } },
    ]);
    const onError = vi.fn();
    const onDone = vi.fn();
    expect(await streamChat(REQUEST, { onError, onDone }, { mock: false })).toBe('done');
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith({ text: 'boom' });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does not double-report when the server errors and closes without done', async () => {
    serve([{ event: 'error', data: { text: 'boom' } }]);
    const onError = vi.fn();
    expect(await streamChat(REQUEST, { onError }, { mock: false })).toBe('error');
    expect(onError).toHaveBeenCalledOnce();
  });

  it.each([
    [500, httpErrorText(500)],
    [429, ERROR_TEXT.rateLimited],
    [422, httpErrorText(422)],
  ])('turns HTTP %i into an error event', async (status, text) => {
    serve([], { status });
    const { calls, handlers } = recorder();
    const onError = vi.fn();
    const outcome = await streamChat(REQUEST, { ...handlers, onError }, { mock: false });
    expect(outcome).toBe('error');
    expect(onError).toHaveBeenCalledWith({ text });
    expect(calls).not.toContain('done');
  });

  it('treats a non-SSE 200 response as an error', async () => {
    serve([], { contentType: 'application/json' });
    const onError = vi.fn();
    expect(await streamChat(REQUEST, { onError }, { mock: false })).toBe('error');
    expect(onError).toHaveBeenCalledWith({ text: ERROR_TEXT.closed });
  });

  it('turns a network failure into an error event', async () => {
    mockedFES.mockRejectedValue(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    expect(await streamChat(REQUEST, { onError }, { mock: false })).toBe('error');
    expect(onError).toHaveBeenCalledWith({ text: ERROR_TEXT.network });
  });

  it('reports a connection that closes before done', async () => {
    serve(HAPPY_PATH.slice(0, 3));
    const onError = vi.fn();
    expect(await streamChat(REQUEST, { onError }, { mock: false })).toBe('error');
    expect(onError).toHaveBeenCalledWith({ text: ERROR_TEXT.closed });
  });

  it('times out after 30 s with no events and aborts the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mockedFES.mockImplementation((_url, init) => {
      signal = init.signal ?? undefined;
      return new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()));
    });
    const onError = vi.fn();
    const promise = streamChat(REQUEST, { onError }, { mock: false });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await promise).toBe('error');
    expect(onError).toHaveBeenCalledWith({ text: ERROR_TEXT.timeout });
    expect(signal?.aborted).toBe(true);
  });

  it('resets the idle timer on every event', async () => {
    vi.useFakeTimers();
    let init!: FetchEventSourceInit;
    mockedFES.mockImplementation((_url, i) => {
      init = i;
      return new Promise<void>((resolve) => i.signal?.addEventListener('abort', () => resolve()));
    });
    const onError = vi.fn();
    const promise = streamChat(REQUEST, { onError }, { mock: false, idleTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(900);
    init.onmessage!({ id: '', event: 'token', data: '{"text":"a"}' });
    await vi.advanceTimersByTimeAsync(900);
    expect(onError).not.toHaveBeenCalled();
    init.onmessage!({ id: '', event: 'done', data: '{"thread_id":"t-1","intent":null}' });
    expect(await promise).toBe('done');
  });

  it('calls onSlow once when the first event takes longer than 5 s', async () => {
    vi.useFakeTimers();
    let init!: FetchEventSourceInit;
    mockedFES.mockImplementation((_url, i) => {
      init = i;
      return new Promise<void>((resolve) => i.signal?.addEventListener('abort', () => resolve()));
    });
    const onSlow = vi.fn();
    const promise = streamChat(REQUEST, { onSlow }, { mock: false });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onSlow).toHaveBeenCalledOnce();
    init.onmessage!({ id: '', event: 'done', data: '{"thread_id":"t-1","intent":null}' });
    await promise;
    expect(onSlow).toHaveBeenCalledOnce();
  });

  it('does not call onSlow when the first event arrives quickly', async () => {
    vi.useFakeTimers();
    serve(HAPPY_PATH);
    const onSlow = vi.fn();
    await streamChat(REQUEST, { onSlow }, { mock: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('resolves "aborted" without an error when the caller aborts', async () => {
    mockedFES.mockImplementation(
      (_url, init) =>
        new Promise<void>((resolve) => init.signal?.addEventListener('abort', () => resolve())),
    );
    const ctrl = new AbortController();
    const onError = vi.fn();
    const promise = streamChat(REQUEST, { onError }, { mock: false, signal: ctrl.signal });
    ctrl.abort();
    expect(await promise).toBe('aborted');
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('streamChat mock mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function runMock(message: string, execute = true) {
    const events: ChatEvent[] = [];
    const promise = streamChat(
      { ...REQUEST, message, execute },
      { onEvent: (e) => events.push(e) },
      { mock: true },
    );
    await vi.runAllTimersAsync();
    return { outcome: await promise, events, names: events.map((e) => e.event) };
  }

  it('replays a full generate turn ending with done', async () => {
    const { outcome, names, events } = await runMock('Show all employees hired after January 2024');
    expect(outcome).toBe('done');
    expect(mockedFES).not.toHaveBeenCalled();
    expect(names.indexOf('intent')).toBeLessThan(names.indexOf('sql'));
    expect(names.indexOf('sql')).toBeLessThan(names.indexOf('result'));
    expect(names.indexOf('result')).toBeLessThan(names.indexOf('token'));
    expect(names.indexOf('token')).toBeLessThan(names.indexOf('explanation'));
    expect(names.at(-1)).toBe('done');
    expect(events.find((e) => e.event === 'intent')?.data).toEqual({ intent: 'generate' });
  });

  it.each([
    ['Who won the FIFA World Cup?', 'out_of_scope', 'refusal'],
    ['Delete all cancelled orders', 'destructive', 'refusal'],
    ['Show me the important ones', 'clarify', 'clarify'],
    ['Only those from California', 'modify', 'sql'],
    ['Fix this: SELECT name FROM Employee WHERE salary > AVG(salary)', 'debug', 'sql'],
    [
      'Optimize: SELECT * FROM Orders o JOIN Customers c ON c.CustomerID = o.CustomerID',
      'optimize',
      'sql',
    ],
    ['Explain SELECT FirstName FROM Employees', 'explain', 'sql'],
  ])('"%s" replays the %s script', async (message, intent, expected) => {
    const { names, events } = await runMock(message);
    expect(events.find((e) => e.event === 'intent')?.data).toEqual({ intent });
    expect(names).toContain(expected);
    expect(names.at(-1)).toBe('done');
  });

  it('skips the result event when execution is off', async () => {
    const { names } = await runMock('Top 5 customers by total order value', false);
    expect(names).toContain('sql');
    expect(names).not.toContain('result');
  });

  it('replays a retry step for the top-customers script', async () => {
    const { events } = await runMock('Top 5 customers by total order value');
    expect(events.some((e) => e.event === 'step' && e.data.status === 'retry')).toBe(true);
  });
});
