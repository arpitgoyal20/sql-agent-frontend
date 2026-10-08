// Base URL and small fetch helpers for every REST endpoint.
// In mock mode (VITE_MOCK=true) the same functions are served from memory by mockRest.ts.

import * as mock from './mockRest';
import type {
  ExecuteRequest,
  ExecuteResponse,
  HealthResponse,
  SavedQuery,
  SavedQueryInput,
  SchemaResponse,
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
  if (!body || typeof body !== 'object' || !('detail' in body)) return null;
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
}

async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
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

/** Run a mock endpoint with fake latency, mapping its errors like the real client does. */
function viaMock<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (err) {
        if (err instanceof mock.MockHttpError) reject(new HttpError(err.status, err.message));
        else reject(err);
      }
    }, mockRestTiming.delayMs);
  });
}

const enc = encodeURIComponent;

// ---- Health -----------------------------------------------------------------------

export function getHealth(): Promise<HealthResponse> {
  if (isMockMode()) return viaMock(() => ({ status: 'ok' as const }));
  return request<HealthResponse>('/api/health');
}

// ---- Threads ------------------------------------------------------------------------

export function getThreads(): Promise<ThreadSummary[]> {
  if (isMockMode()) return viaMock(() => mock.mockListThreads());
  return request<ThreadSummary[]>('/api/threads');
}

export function getThread(threadId: string): Promise<ThreadDetail> {
  if (isMockMode()) return viaMock(() => mock.mockGetThread(threadId));
  return request<ThreadDetail>(`/api/threads/${enc(threadId)}`);
}

export function deleteThread(threadId: string): Promise<void> {
  if (isMockMode()) return viaMock(() => mock.mockDeleteThread(threadId));
  return request<void>(`/api/threads/${enc(threadId)}`, { method: 'DELETE' });
}

export function renameThread(threadId: string, title: string): Promise<ThreadSummary> {
  if (isMockMode()) return viaMock(() => mock.mockRenameThread(threadId, title));
  return request<ThreadSummary>(`/api/threads/${enc(threadId)}`, {
    method: 'PATCH',
    body: { title },
  });
}

export function duplicateThread(threadId: string): Promise<ThreadSummary> {
  if (isMockMode()) return viaMock(() => mock.mockDuplicateThread(threadId));
  return request<ThreadSummary>(`/api/threads/${enc(threadId)}/duplicate`, { method: 'POST' });
}

// ---- Schema, execute, saved queries ---------------------------------------------------

export function getSchema(): Promise<SchemaResponse> {
  if (isMockMode()) return viaMock(() => mock.MOCK_SCHEMA);
  return request<SchemaResponse>('/api/schema');
}

export function executeSql(body: ExecuteRequest): Promise<ExecuteResponse> {
  if (isMockMode()) return viaMock(() => mock.mockExecute(body));
  return request<ExecuteResponse>('/api/execute', { method: 'POST', body });
}

export function getSaved(): Promise<SavedQuery[]> {
  if (isMockMode()) return viaMock(() => mock.mockListSaved());
  return request<SavedQuery[]>('/api/saved');
}

export function createSaved(input: SavedQueryInput): Promise<SavedQuery> {
  if (isMockMode()) return viaMock(() => mock.mockCreateSaved(input));
  return request<SavedQuery>('/api/saved', { method: 'POST', body: input });
}

export function deleteSaved(id: string): Promise<void> {
  if (isMockMode()) return viaMock(() => mock.mockDeleteSaved(id));
  return request<void>(`/api/saved/${enc(id)}`, { method: 'DELETE' });
}
