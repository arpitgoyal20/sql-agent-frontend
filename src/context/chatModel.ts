// Pure chat model: message types, activity-step merging and rebuilding turns from a saved thread.

import type {
  Dialect,
  ExplanationEvent,
  Intent,
  RefusalEvent,
  ResultEvent,
  SqlEvent,
  StepEvent,
  StepStatus,
  ThreadDetail,
} from '../api/types';
import { newId } from '../utils/format';

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  createdAt: string | null;
}

export type TurnStatus = 'pending' | 'done' | 'error' | 'aborted';

/** One pipeline node in the Agent Activity panel, with its latest status. */
export interface ActivityStep {
  node: string;
  label: string;
  status: StepStatus;
  /** Every failing check reported by `retry` events for this node, in order. */
  errors: string[];
  retried: boolean;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  createdAt: string | null;
  status: TurnStatus;
  /** The user message this turn answers; Try Again resends it. */
  request: string;
  /** Whether the request asked the backend to execute the SQL. */
  executed: boolean;
  /** One entry per pipeline node, in first-seen order. */
  steps: ActivityStep[];
  intent: Intent | null;
  sql: SqlEvent | null;
  /** From the stream's `result` event (shown in the Results grid; the bubble only summarises). */
  result: ResultEvent | null;
  tokens: string;
  explanation: ExplanationEvent | null;
  clarify: string | null;
  refusal: RefusalEvent | null;
  error: string | null;
  /** Rebuilt from GET /api/threads/{id}; results are not persisted. */
  fromHistory: boolean;
}

export type ChatMessage = UserMessage | AssistantMessage;

/** Merge one `step` event into the activity list (first-seen order, latest status). */
export function applyStep(steps: ActivityStep[], step: StepEvent): ActivityStep[] {
  const i = steps.findIndex((s) => s.node === step.node);
  const prev = i === -1 ? null : steps[i];
  const isRetry = step.status === 'retry';
  const next: ActivityStep = {
    node: step.node,
    label: step.label || prev?.label || step.node,
    status: step.status,
    errors: [...(prev?.errors ?? []), ...(isRetry ? (step.errors ?? []) : [])],
    retried: (prev?.retried ?? false) || isRetry,
  };
  if (i === -1) return [...steps, next];
  const out = steps.slice();
  out[i] = next;
  return out;
}

/**
 * Turn a validator message such as
 * "UNKNOWN_COLUMN: column 'revenue_total' does not exist. Columns available: …"
 * into "Column 'revenue_total' does not exist".
 */
export function humanizeCheckError(raw: string): string {
  const text = raw.replace(/^[A-Z_]+:\s*/, '').trim();
  const first = text.split(/(?<=[a-z0-9'")\]])\.\s+/i)[0].replace(/\.$/, '');
  return first ? first[0].toUpperCase() + first.slice(1) : raw;
}

export function emptyTurn(request: string, executed: boolean): AssistantMessage {
  return {
    id: newId(),
    role: 'assistant',
    createdAt: new Date().toISOString(),
    status: 'pending',
    request,
    executed,
    steps: [],
    intent: null,
    sql: null,
    result: null,
    tokens: '',
    explanation: null,
    clarify: null,
    refusal: null,
    error: null,
    fromHistory: false,
  };
}

export const sqlOnly = (sql: string, dialect: Dialect): SqlEvent => ({
  sql,
  dialect,
  warnings: [],
  optimization_notes: [],
  index_suggestions: [],
  issues: [],
  removed_joins: [],
});

/** Rebuild UI messages from a persisted thread (see README → Assumptions). */
export function messagesFromThread(detail: ThreadDetail, dialect: Dialect): ChatMessage[] {
  const out: ChatMessage[] = [];
  let lastUser = '';
  for (const m of detail.messages) {
    const createdAt = m.created_at ?? null;
    if (m.role === 'user') {
      lastUser = m.content;
      out.push({ id: newId(), role: 'user', content: m.content, createdAt });
      continue;
    }
    const intent = m.intent ?? null;
    const turn: AssistantMessage = {
      ...emptyTurn(lastUser, false),
      createdAt,
      status: 'done',
      intent,
      fromHistory: true,
      sql: m.sql ? sqlOnly(m.sql, dialect) : null,
    };
    const isRefusal = m.kind === 'refusal' || intent === 'out_of_scope' || intent === 'destructive';
    if (isRefusal) {
      turn.refusal = {
        text: m.content,
        reason: intent === 'destructive' ? intent : 'out_of_scope',
      };
    } else if (m.kind === 'clarify' || intent === 'clarify') {
      turn.clarify = m.content;
    } else {
      turn.explanation = { text: m.content, assumptions: [] };
    }
    out.push(turn);
  }
  // Make sure last_sql is shown even if no message carried it.
  if (detail.last_sql && !out.some((m) => m.role === 'assistant' && m.sql)) {
    const last = [...out].reverse().find((m): m is AssistantMessage => m.role === 'assistant');
    if (last) last.sql = sqlOnly(detail.last_sql, dialect);
  }
  return out;
}

// Editor actions routed through the chat (CHANGES-v2.md §4). The backend classifies these
// phrasings as explain / optimize / debug.
const fence = (sql: string) => `\`\`\`sql\n${sql.trim()}\n\`\`\``;

export const explainMessage = (sql: string) => `Explain this query:\n${fence(sql)}`;
export const optimizeMessage = (sql: string) => `Optimize this query:\n${fence(sql)}`;
export const fixMessage = (sql: string, errors: string[]) =>
  `Fix this query:\n${fence(sql)}\nError: ${errors.join('; ')}`;

/** Navigator "Ask AI about this table" prefill (CHANGES-v2.md §3). */
export const askAboutTable = (table: string) =>
  `Describe the ${table} table and what I can ask about it`;

/** Whether the Notes tab has anything worth a dot: warnings, issues, optimisation output. */
export function hasNotes(sql: SqlEvent | null, runWarnings: string[] = []): boolean {
  if (runWarnings.length) return true;
  if (!sql) return false;
  return (
    sql.warnings.length +
      sql.issues.length +
      sql.optimization_notes.length +
      sql.index_suggestions.length +
      sql.removed_joins.length >
    0
  );
}
