// REST helpers against a stubbed fetch: X-Client-Id on every /api call except health, and the
// v2 workbench endpoints' URLs, bodies and error mapping.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HttpError,
  getHealth,
  getTables,
  getThreads,
  previewTable,
  runQuery,
  setMockMode,
} from './client';
import { CLIENT_ID_HEADER, CLIENT_ID_STORAGE_KEY, resetClientIdCache } from './clientId';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const headersOf = (fetchMock: ReturnType<typeof vi.fn>, call = 0) =>
  fetchMock.mock.calls[call][1].headers as Record<string, string>;

describe('REST client', () => {
  beforeEach(() => {
    setMockMode(false);
    localStorage.clear();
    resetClientIdCache();
  });
  afterEach(() => {
    setMockMode(null);
    vi.unstubAllGlobals();
  });

  it('sends the same X-Client-Id on every /api call and stores it', async () => {
    const fetchMock = respond(200, { tables: [] });
    vi.stubGlobal('fetch', fetchMock);
    await getTables();
    await getThreads();
    const id = headersOf(fetchMock)[CLIENT_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(headersOf(fetchMock, 1)[CLIENT_ID_HEADER]).toBe(id);
    expect(localStorage.getItem(CLIENT_ID_STORAGE_KEY)).toBe(id);
  });

  it('reuses a stored id and replaces a malformed one', async () => {
    const stored = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, stored);
    const fetchMock = respond(200, []);
    vi.stubGlobal('fetch', fetchMock);
    await getThreads();
    expect(headersOf(fetchMock)[CLIENT_ID_HEADER]).toBe(stored);

    localStorage.setItem(CLIENT_ID_STORAGE_KEY, 'not-a-uuid');
    await getThreads();
    expect(headersOf(fetchMock, 1)[CLIENT_ID_HEADER]).not.toBe('not-a-uuid');
  });

  it('falls back to an in-memory id when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const fetchMock = respond(200, []);
    vi.stubGlobal('fetch', fetchMock);
    await getThreads();
    await getThreads();
    const id = headersOf(fetchMock)[CLIENT_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(headersOf(fetchMock, 1)[CLIENT_ID_HEADER]).toBe(id);
  });

  it('does not send X-Client-Id to /api/health', async () => {
    const fetchMock = respond(200, { status: 'ok' });
    vi.stubGlobal('fetch', fetchMock);
    await getHealth();
    expect(headersOf(fetchMock)[CLIENT_ID_HEADER]).toBeUndefined();
  });

  it('calls the preview and run endpoints with paging parameters', async () => {
    const fetchMock = respond(200, { status: 'ok' });
    vi.stubGlobal('fetch', fetchMock);
    await previewTable('Order Items', 50, 100);
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/tables\/Order%20Items\/preview\?limit=50&offset=100$/,
    );
    await runQuery('SELECT 1', 'postgres', 200, 400);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/api\/query\/run$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      sql: 'SELECT 1',
      dialect: 'postgres',
      limit: 200,
      offset: 400,
    });
    expect(headersOf(fetchMock, 1)[CLIENT_ID_HEADER]).toBeDefined();
  });

  it('maps an unknown table 404 and a 429 to readable errors', async () => {
    vi.stubGlobal(
      'fetch',
      respond(404, { error: 'UNKNOWN_TABLE', available: ['Customers', 'Orders'] }),
    );
    await expect(previewTable('Nope', 100, 0)).rejects.toThrow(
      'That table does not exist. Available tables: Customers, Orders.',
    );
    vi.stubGlobal('fetch', respond(429, { detail: 'Rate limit exceeded' }));
    const err = await runQuery('SELECT 1', 'sqlite', 100, 0).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(429);
  });
});
