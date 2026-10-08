// Small display helpers: timestamps, relative times, date groups, ids, SQL detection.

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

/** Entries of the top-nav "Database" menu; each maps to the dialect sent with requests. */
export type DatabaseId = 'demo' | 'postgres' | 'mysql' | 'sqlite';

export const DATABASES: { id: DatabaseId; label: string; short: string; dialect: Dialect }[] = [
  { id: 'demo', label: 'Demo Database', short: 'Demo DB', dialect: 'sqlite' },
  { id: 'postgres', label: 'PostgreSQL', short: 'PostgreSQL', dialect: 'postgres' },
  { id: 'mysql', label: 'MySQL', short: 'MySQL', dialect: 'mysql' },
  { id: 'sqlite', label: 'SQLite', short: 'SQLite', dialect: 'sqlite' },
];

export type DateGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

export const DATE_GROUPS: DateGroup[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];

/** Sidebar group for a timestamp, by local calendar day. */
export function dateGroup(iso: string, now = new Date()): DateGroup {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Older';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 days';
  return 'Older';
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
