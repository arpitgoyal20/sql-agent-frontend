# Backend API additions (v1.1)

All additions are backward compatible: existing events, fields and endpoints are unchanged.

## `sql` SSE event — new fields

```jsonc
{
  "sql": "...", "dialect": "sqlite", "warnings": [], "optimization_notes": [],
  "index_suggestions": [], "issues": [], "removed_joins": [],      // unchanged
  "validation": [                                                   // NEW: checks that ran
    {"check": "syntax",    "label": "SQL syntax valid",       "status": "pass"},
    {"check": "single",    "label": "Single statement",       "status": "pass"},
    {"check": "read_only", "label": "Read-only query",        "status": "pass"},
    {"check": "tables",    "label": "Tables exist",           "status": "pass"},
    {"check": "columns",   "label": "Columns exist",          "status": "pass"},
    {"check": "joins",     "label": "Relationships valid",    "status": "pass" | "warn", "detail": "..."},
    {"check": "database",  "label": "Database accepts query", "status": "pass" | "skip"}
  ],
  "inspection": {                                                   // NEW: Query Inspector data
    "tables": ["Orders"], "columns": ["Orders.OrderDate", "OrderItems.Quantity"],
    "joins": ["Orders.OrderID = OrderItems.OrderID"],
    "filters": ["Orders.OrderDate >= '2025-01-01'"],
    "aggregations": ["SUM(OrderItems.Quantity * OrderItems.UnitPrice)"],
    "grouping": ["month"], "ordering": ["month ASC"], "limit": null,
    "safety": {"read_only": true, "single_statement": true}
  },
  "modified_previous": false,                                       // NEW: true for follow-ups
  "original_sql": null                                              // NEW: user's SQL (optimize/debug)
}
```

The `sql` event is only ever sent for a query that passed every check, so `status` is `pass`
except `joins` (`warn` for a join not on a declared foreign key) and `database` (`skip` for
non-SQLite dialects).

## `step` SSE event — new optional field

For `validate_sql` / `execute_sql` with `status: "retry"`:

```json
{"node": "validate_sql", "status": "retry", "label": "Validating SQL",
 "errors": ["UNKNOWN_COLUMN: column 'revenue_total' does not exist. Columns available: ..."]}
```

Use it to show which check failed before the agent fixed the query
(`CATEGORY: message`; categories `SYNTAX`, `MULTI`, `DESTRUCTIVE`, `NOT_SELECT`, `UNKNOWN_TABLE`,
`UNKNOWN_COLUMN`, `DB`, `EXECUTION`).

## `GET /api/schema` — new column fields

`columns: [{name, type, doc, pk: bool, nullable: bool}]` (adds `pk`, `nullable`).

## Thread titles

After the first turn, the backend replaces the thread title (first 60 chars of the message) with a
short generated title such as `Monthly Revenue — 2025`. The frontend just refreshes
`GET /api/threads` after `done`, as before.

## New endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/execute` | `{sql, dialect}` | `{ok, sql, errors: [], warnings: [], validation: [...], inspection: {...} \| null, result: {columns, rows, row_count, truncated} \| null}` |
| PATCH | `/api/threads/{id}` | `{title}` | `{thread_id, title, updated_at}` |
| POST | `/api/threads/{id}/duplicate` | — | `{thread_id, title, updated_at}` (new thread with the same messages and last SQL) |
| GET | `/api/saved` | — | `[{id, title, prompt, sql, dialect, explanation, created_at}]`, newest first |
| POST | `/api/saved` | `{title, prompt, sql, dialect, explanation}` | the saved item (201) |
| DELETE | `/api/saved/{id}` | — | 204 |

`POST /api/execute` runs the deterministic validator and, if valid, executes on the read-only
database (200-row cap, 5 s timeout). No LLM is involved, so it is fast and costs no quota. It
never changes thread state. A destructive query returns `ok: false` with a `DESTRUCTIVE: ...`
error; it is never run. Rate-limited like `/api/chat`.
