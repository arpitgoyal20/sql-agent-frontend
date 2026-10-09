// Small display helpers: timestamps, relative times, ids, SQL detection, counts.

import type { Dialect, Intent } from '../api/types';

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (e.g. plain-http LAN dev) where randomUUID is missing.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Heuristic for pasted text: starts with a SQL keyword, or reads like SELECT … FROM. */
export function looksLikeSql(text: string): boolean {
  return (
    /^\s*(select|with|insert|update|delete|create|alter|drop|explain)\b/i.test(text) ||
    /\bselect\b[\s\S]+\bfrom\b/i.test(text)
  );
}

export const DIALECT_LABELS: Record<Dialect, string> = {
  sqlite: 'SQLite',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
};

/** Small mode badges; generate has none and modify shows "↳ Modified previous query". */
export const INTENT_BADGES: Partial<Record<Intent, string>> = {
  optimize: 'Optimize',
  debug: 'Debug',
  explain: 'Explain',
};

/** Dialects offered in the header; sent with chat requests and editor runs. */
export const DIALECTS: Dialect[] = ['sqlite', 'postgres', 'mysql'];

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** "1 row" / "2,000 rows". */
export function rowsLabel(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'row' : 'rows'}`;
}

/** A validator error without its category and the long "Columns available" list. */
export function errorText(raw: string): string {
  const text = raw
    .replace(/^[A-Z_]+:\s*/, '')
    .replace(/\s*(Columns|Tables) available:[\s\S]*$/, '')
    .trim();
  return text ? text[0].toUpperCase() + text.slice(1) : raw;
}

/** Page summary, e.g. `500 rows · 4 ms · page 1 of 5`. */
export function pageSummary(total: number, ms: number | null, page: number, pages: number) {
  return [
    rowsLabel(total),
    ms === null ? null : `${formatCount(ms)} ms`,
    `page ${page} of ${pages}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
