// Polls GET /api/health every 30 s for the top-nav connection status.

import { useEffect, useState } from 'react';

import { getHealth } from '../../api/client';

export type Health = 'checking' | 'online' | 'offline';

export const HEALTH_POLL_MS = 30_000;

export function useHealth(): Health {
  const [health, setHealth] = useState<Health>('checking');
  useEffect(() => {
    let live = true;
    const check = () =>
      getHealth().then(
        (r) => live && setHealth(r?.status === 'ok' ? 'online' : 'offline'),
        () => live && setHealth('offline'),
      );
    void check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return health;
}
