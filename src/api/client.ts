// Base URL and small fetch helpers for every REST endpoint.
// In mock mode (VITE_MOCK=true) the same functions are served from memory by mockRest.ts, which
// is loaded on demand so it never weighs on the production bundle.
// Every request except GET /api/health carries the `X-Client-Id` header (see clientId.ts).

import { CLIENT_ID_HEADER, getClientId } from './clientId';
import type {
  Dialect,
  HealthResponse,
  PreviewResponse,
  RunResponse,
  TablesResponse,
  ThreadDetail,
  ThreadSummary,
} from './types';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  '',
);

export const MOCK_MODE = import.meta.env.VITE_MOCK === 'true';

let mockOverride: boolean | null = null;

/** Whether REST calls and the chat stream are served by the in-memory mock. */
export function isMockMode(): boolean {
  return mockOverride ?? MOCK_MODE;
}

/** Force mock mode on or off (tests); `null` goes back to VITE_MOCK. */
export function setMockMode(on: boolean | null): void {
  mockOverride = on;
}

/** Scales the simulated latency of mock REST calls (tests set 0). */
export const mockRestTiming = { delayMs: 150 };

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// ---- Request helpers --------------------------------------------------------------

export const NETWORK_TEXT = "Can't reach the server. Check your connection and try again.";

function statusText(status: number): string {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 404) return 'That item no longer exists.';
  if (status >= 500) return `The server had a problem (HTTP ${status}). Please try again.`;
  return `The request failed (HTTP ${status}).`;
}

/** Human-readable text from a FastAPI error body (`{detail: string | [{msg}]}`). */
function detailText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  if ('error' in body && (body as { error: unknown }).error === 'UNKNOWN_TABLE') {
    const available = (body as { available?: unknown }).available;
    const list = Array.isArray(available) ? ` Available tables: ${available.join(', ')}.` : '';
    return `That table does not exist.${list}`;
  }
  if (!('detail' in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : null))
      .filter(Boolean);
    if (msgs.length) return msgs.join(' ').replace(/^Value error, /, '');
  }
  return null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send `X-Client-Id` (every endpoint except /api/health). */
  identify?: boolean;
}

async function request<T>(
  path: string,
  { method = 'GET', body, identify = true }: RequestOptions = {},
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (identify) headers[CLIENT_ID_HEADER] = getClientId();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_TEXT);
  }
  const type = response.headers.get('content-type') ?? '';
  const json: unknown =
    response.status !== 204 && type.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
  if (!response.ok) {
    // Only show backend wording for client errors; 5xx bodies may be internal.
    const text = response.status < 500 ? detailText(json) : null;
    throw new HttpError(response.status, text ?? statusText(response.status));
  }
  return json as T;
}

type MockRest = typeof import('./mockRest');

/** Run a mock endpoint with fake latency, mapping its errors like the real client does. */
function viaMock<T>(fn: (mock: MockRest) => T): Promise<T> {
  return import('./mockRest').then(
    (mock) =>
      new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(fn(mock));
          } catch (err) {
            if (err instanceof mock.MockHttpError) reject(new HttpError(err.status, err.message));
            else reject(err);
          }
        }, mockRestTiming.delayMs);
      }),
  );
}

const enc = encodeURIComponent;

// ---- Health -----------------------------------------------------------------------

export function getHealth(): Promise<HealthResponse> {
  if (isMockMode()) return viaMock(() => ({ status: 'ok' as const }));
  return request<HealthResponse>('/api/health', { identify: false });
}

// ---- Threads ------------------------------------------------------------------------

export function getThreads(): Promise<ThreadSummary[]> {
  if (isMockMode()) return viaMock((mock) => mock.mockListThreads());
  return request<ThreadSummary[]>('/api/threads');
}

export function getThread(threadId: string): Promise<ThreadDetail> {
  if (isMockMode()) return viaMock((mock) => mock.mockGetThread(threadId));
  return request<ThreadDetail>(`/api/threads/${enc(threadId)}`);
}

export function deleteThread(threadId: string): Promise<void> {
  if (isMockMode()) return viaMock((mock) => mock.mockDeleteThread(threadId));
  return request<void>(`/api/threads/${enc(threadId)}`, { method: 'DELETE' });
}

// ---- Workbench (v2): tables, preview, run -------------------------------------------

export function getTables(): Promise<TablesResponse> {
  if (isMockMode()) return viaMock((mock) => mock.mockTables());
  return request<TablesResponse>('/api/tables');
}

export function previewTable(
  name: string,
  limit: number,
  offset: number,
): Promise<PreviewResponse> {
  if (isMockMode()) return viaMock((mock) => mock.mockPreview(name, limit, offset));
  return request<PreviewResponse>(
    `/api/tables/${enc(name)}/preview?limit=${limit}&offset=${offset}`,
  );
}

export function runQuery(
  sql: string,
  dialect: Dialect,
  limit: number,
  offset: number,
): Promise<RunResponse> {
  if (isMockMode()) return viaMock((mock) => mock.mockRun({ sql, dialect, limit, offset }));
  return request<RunResponse>('/api/query/run', {
    method: 'POST',
    body: { sql, dialect, limit, offset },
  });
}
