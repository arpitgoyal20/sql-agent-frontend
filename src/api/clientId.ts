// Anonymous per-browser id sent as `X-Client-Id` on every /api request (except /api/health) so
// threads and saved queries are private to this browser. Generated once with
// crypto.randomUUID() (with a fallback for non-secure contexts) and kept in localStorage; when
// storage is unavailable an in-memory id is used for the life of the page.

import { newId } from '../utils/format';

export const CLIENT_ID_STORAGE_KEY = 'sqlagent.clientId';
export const CLIENT_ID_HEADER = 'X-Client-Id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

export function isValidClientId(id: string | null | undefined): id is string {
  return !!id && UUID_V4.test(id);
}

export function getClientId(): string {
  try {
    const saved = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (isValidClientId(saved)) return saved;
    const id = memoryId ?? newId();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    memoryId = id;
    return id;
  } catch {
    // Storage blocked (private mode, sandboxed iframe): keep one id for this page load.
    memoryId ??= newId();
    return memoryId;
  }
}

/** Forget the in-memory id (tests). */
export function resetClientIdCache(): void {
  memoryId = null;
}
