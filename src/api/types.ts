// Types for the backend API contract (REQUIREMENTS.md §4). Field names match the wire format.

export type Dialect = 'sqlite' | 'postgres' | 'mysql';

export type Intent =
  | 'generate'
  | 'modify'
  | 'optimize'
  | 'debug'
  | 'explain'
  | 'destructive'
  | 'out_of_scope'
  | 'clarify';

// ---- REST ---------------------------------------------------------------

export interface ChatRequest {
  thread_id: string;
  message: string;
  dialect: Dialect;
  execute: boolean;
}

export interface ThreadSummary {
  thread_id: string;
  title: string;
  updated_at: string; // ISO timestamp
}

/**
 * One persisted message. The contract only says `messages: [...]`; we assume each item has
 * at least `role` and `content` (see README → Assumptions). Extra fields are optional.
 */
export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: Intent | null;
  sql?: string | null;
  /** Assistant only. For refusals, `intent` holds the refusal reason. */
  kind?: 'answer' | 'clarify' | 'refusal' | null;
  created_at?: string | null;
}

export interface ThreadDetail {
  messages: ThreadMessage[];
  last_sql: string | null;
}

export interface SchemaColumn {
  name: string;
  type: string;
  doc: string;
  /** API additions v1.1; absent on older backends. */
  pk?: boolean;
  nullable?: boolean;
}

export interface SchemaForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  foreign_keys: SchemaForeignKey[];
}

export interface SchemaResponse {
  tables: SchemaTable[];
}

export interface HealthResponse {
  status: 'ok';
}

// ---- v1.1 REST additions (docs/API_ADDITIONS.md) ---------------------------

export interface ExecuteRequest {
  sql: string;
  dialect: Dialect;
}

export interface ExecuteResponse {
  ok: boolean;
  sql: string;
  /** `CATEGORY: message` strings when `ok` is false. */
  errors: string[];
  warnings: string[];
  validation: ValidationCheck[];
  inspection: QueryInspection | null;
  result: ResultEvent | null;
}

export interface SavedQueryInput {
  title: string;
  prompt: string;
  sql: string;
  dialect: Dialect;
  explanation: string;
}

export interface SavedQuery extends SavedQueryInput {
  id: string;
  created_at: string;
}

// ---- SSE events -----------------------------------------------------------

export type StepStatus = 'start' | 'ok' | 'retry' | 'skip';

export interface StepEvent {
  node: string;
  status: StepStatus;
  label: string;
  /** v1.1: for `retry` on validate_sql / execute_sql, the checks that failed (`CATEGORY: message`). */
  errors?: string[];
}

export interface IntentEvent {
  intent: Intent;
}

export type ValidationStatus = 'pass' | 'warn' | 'fail' | 'skip';

/** One check the backend validator ran (v1.1). */
export interface ValidationCheck {
  check: string;
  label: string;
  status: ValidationStatus;
  detail?: string | null;
}

/** Structured breakdown of a query for the Query Inspector (v1.1). */
export interface QueryInspection {
  tables: string[];
  columns: string[];
  joins: string[];
  filters: string[];
  aggregations: string[];
  grouping: string[];
  ordering: string[];
  limit: number | null;
  safety: { read_only: boolean; single_statement: boolean };
}

export interface SqlEvent {
  sql: string;
  dialect: Dialect;
  warnings: string[];
  optimization_notes: string[];
  index_suggestions: string[];
  issues: string[];
  removed_joins: string[];
  // v1.1 additions: optional so an older backend still renders (the UI hides what is missing).
  validation?: ValidationCheck[];
  inspection?: QueryInspection | null;
  modified_previous?: boolean;
  /** The user's own SQL for optimize / debug turns. */
  original_sql?: string | null;
}

export type CellValue = string | number | boolean | null;

export interface ResultEvent {
  columns: string[];
  rows: CellValue[][];
  row_count: number;
  truncated: boolean;
}

export interface TokenEvent {
  text: string;
}

export interface ExplanationEvent {
  text: string;
  assumptions: string[];
}

export interface ClarifyEvent {
  text: string;
}

export type RefusalReason = 'out_of_scope' | 'destructive';

export interface RefusalEvent {
  text: string;
  reason: RefusalReason;
}

export interface ErrorEvent {
  text: string;
}

export interface DoneEvent {
  thread_id: string;
  intent: Intent | null;
}

export interface ChatEventMap {
  step: StepEvent;
  intent: IntentEvent;
  sql: SqlEvent;
  result: ResultEvent;
  token: TokenEvent;
  explanation: ExplanationEvent;
  clarify: ClarifyEvent;
  refusal: RefusalEvent;
  error: ErrorEvent;
  done: DoneEvent;
}

export type ChatEventName = keyof ChatEventMap;

/** Discriminated union of every SSE event: `{ event: 'sql', data: SqlEvent }` etc. */
export type ChatEvent = {
  [K in ChatEventName]: { event: K; data: ChatEventMap[K] };
}[ChatEventName];

export const CHAT_EVENT_NAMES: readonly ChatEventName[] = [
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
];
