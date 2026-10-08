# SQL Query AI Agent — Frontend Requirements

> Hand this file to Claude Code in an empty repo named `sql-agent-frontend`.
> The backend lives in a separate repo (`sql-agent-backend`) and exposes the API in §4. Build exactly what is specified. Record anything you decide yourself in `README.md` under **Assumptions**.

## 1. What we are building

A clean, responsive web UI for an AI SQL assistant. Users type natural-language questions (or paste SQL), and the app shows the generated SQL, a plain-English explanation, optimisation notes, and query results. It talks to the backend over HTTP + Server-Sent Events.

The frontend is 10% of the grade. Priorities, in order: it works reliably against the API, it is clear and uncluttered, and then the bonus features.

## 2. Tech stack (fixed)

- Vite + React 18 + TypeScript
- Tailwind CSS (class-based dark mode: `darkMode: 'class'`)
- `@microsoft/fetch-event-source` for POST + SSE
- `react-syntax-highlighter` (Prism, `sql` language) for SQL highlighting
- `lucide-react` icons
- `sql-formatter` is **not** needed; the backend sends pretty-printed SQL
- No global state library; React state + context is enough
- Vitest + React Testing Library for a few component tests

## 3. Layout

### Desktop (≥ 1024 px): three columns

| Area         | Width                    | Contents                                                                                                                                                  |
| ------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left sidebar | 260 px, collapsible      | "New chat" button; thread list (title, relative time, delete icon); collapsible **Schema browser** (tables → columns with type and doc tooltip, FK hints) |
| Centre       | flexible                 | Header (app name, dialect dropdown, "Run query" toggle, dark mode toggle); message list; input box                                                        |
| Right panel  | ~40%, resizable optional | Tabs or stacked cards: **SQL**, **Explanation**, **Results**                                                                                              |

### Mobile (< 1024 px)

- Sidebar becomes a slide-over drawer (hamburger in header).
- Right panel collapses into tabs under the chat: Chat | SQL | Explanation | Results. Switch to the SQL tab automatically when SQL arrives.

### Visual style

- Neutral, professional, data-tool look. One accent colour for primary actions.
- Monospace for SQL and result cells. Generous spacing, 8 px grid.
- Light and dark themes both polished; persist choice in `localStorage` (allowed — this is a normal Vite app) and default to system preference.

## 4. Backend API contract

Base URL from env `VITE_API_URL` (e.g. `https://sql-agent-backend.onrender.com`).

| Method | Path                       | Use                                                                                                 |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/api/chat`                | Send a message; SSE response                                                                        |
| GET    | `/api/threads`             | `[{thread_id, title, updated_at}]` for sidebar                                                      |
| GET    | `/api/threads/{thread_id}` | `{messages: [...], last_sql}` to reload a chat                                                      |
| DELETE | `/api/threads/{thread_id}` | Delete a chat                                                                                       |
| GET    | `/api/schema`              | `{tables: [{name, columns: [{name, type, doc}], foreign_keys: [{column, ref_table, ref_column}]}]}` |
| GET    | `/api/health`              | `{status: "ok"}`                                                                                    |

### `POST /api/chat` body

```json
{
  "thread_id": "uuid",
  "message": "Only those from California",
  "dialect": "sqlite",
  "execute": true
}
```

`thread_id` is generated client-side with `crypto.randomUUID()` on "New chat".

### SSE events

| event         | data                                                                                     | UI behaviour                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `step`        | `{node, status, label}`                                                                  | Update the progress indicator in the pending assistant bubble ("Understanding request → Reading schema → Writing SQL → Validating → Running → Explaining"). `status: "retry"` shows a small "Fixing an issue, retrying…" note. |
| `intent`      | `{intent}`                                                                               | Small badge on the assistant message: Generate, Follow-up, Optimize, Debug, Explain                                                                                                                                            |
| `sql`         | `{sql, dialect, warnings, optimization_notes, index_suggestions, issues, removed_joins}` | Fill the SQL panel; show a compact SQL preview card in the chat bubble with "View" that focuses the panel                                                                                                                      |
| `result`      | `{columns, rows, row_count, truncated}`                                                  | Fill Results panel                                                                                                                                                                                                             |
| `token`       | `{text}`                                                                                 | Stream into the assistant bubble and Explanation panel                                                                                                                                                                         |
| `explanation` | `{text, assumptions}`                                                                    | Final explanation text; list assumptions under it                                                                                                                                                                              |
| `clarify`     | `{text}`                                                                                 | Render as a question bubble with a "?" icon                                                                                                                                                                                    |
| `refusal`     | `{text, reason}`                                                                         | Render as a neutral grey card with a shield icon — **not** red; a refusal is correct behaviour, not an error                                                                                                                   |
| `error`       | `{text}`                                                                                 | Red inline error in the bubble with a Retry button that resends the same message                                                                                                                                               |
| `done`        | `{thread_id, intent}`                                                                    | Stop loading state; refresh thread list                                                                                                                                                                                        |

Handle network failure, non-200 responses, and a 30 s no-event timeout as `error`. Show a one-time banner "The server may be waking up (free hosting), first reply can take ~30 s" if the first request takes longer than 5 s.

## 5. Components

```
src/
  main.tsx
  App.tsx
  api/
    client.ts            # fetch helpers, VITE_API_URL
    chatStream.ts        # fetchEventSource wrapper -> typed callbacks
    types.ts             # all API + event types
  context/
    ThemeContext.tsx
    ChatContext.tsx      # current thread, messages, panel state
  components/
    layout/Header.tsx
    layout/Sidebar.tsx
    sidebar/ThreadList.tsx
    sidebar/SchemaBrowser.tsx
    chat/MessageList.tsx
    chat/MessageBubble.tsx
    chat/ProgressSteps.tsx
    chat/ChatInput.tsx
    chat/ExampleChips.tsx
    chat/RefusalCard.tsx
    panels/SqlPanel.tsx
    panels/ExplanationPanel.tsx
    panels/ResultsPanel.tsx
    common/CopyButton.tsx
    common/DownloadButton.tsx
  utils/
    csv.ts
    download.ts
```

### Component requirements

- **ChatInput**: auto-growing textarea; Enter sends, Shift+Enter newline; disabled while a turn is streaming; detects pasted SQL and switches to monospace font.
- **ExampleChips** (shown on empty chat):
  - "Show all employees hired after January 2024"
  - "Top 5 customers by total order value"
  - "Fix this: SELECT name FROM Employee WHERE salary > AVG(salary)"
  - "Who won the FIFA World Cup?"
- **MessageBubble**: user vs assistant styling, intent badge, progress steps while pending, streamed text, timestamp.
- **SqlPanel**: syntax-highlighted SQL with line numbers; **Copy** (shows "Copied" for 2 s); **Download .sql** (`query.sql`); dialect label; sections below for Warnings, Issues found (debug), Optimisation notes, Index suggestions (each in its own code line with copy), Removed joins. Empty state: "SQL will appear here."
- **ExplanationPanel**: explanation text, assumptions list. Empty state.
- **ResultsPanel**: sticky-header table, horizontal scroll, monospace cells, NULL shown greyed, row count, "Showing first 200 rows" note when `truncated`; **Download CSV** (`results.csv`, proper escaping of quotes/commas/newlines). When "Run query" toggle is off, show "Execution disabled."
- **SchemaBrowser**: fetched once from `/api/schema`; clicking a column name inserts it into the input at the cursor.
- **ThreadList**: from `/api/threads`; clicking loads `/api/threads/{id}` and rebuilds messages; current thread highlighted; delete with confirm.
- **Header**: dialect dropdown (SQLite, PostgreSQL, MySQL) — sent with each request; "Run query" toggle (default on, disabled automatically when dialect is not SQLite, with a tooltip explaining execution runs on SQLite only); theme toggle.

## 6. State rules

- One active thread at a time. Panels always show the **latest** assistant turn's SQL/explanation/results; clicking an older assistant message's SQL card loads that turn's data into the panels.
- Store per-message payloads (sql event, result, explanation) on the message object so older turns can be re-shown.
- Reloading a thread from the API shows messages and `last_sql` in the SQL panel (results are not persisted; show "Re-run to see results" with a button that sends "Run the last query again").

## 7. Accessibility and quality

- All buttons have `aria-label`; focus visible; keyboard reachable.
- Colour contrast AA in both themes.
- No console errors. TypeScript strict mode. ESLint + Prettier configured.
- Lighthouse performance and accessibility ≥ 90 on the deployed build (nice to have).

## 8. Tests (Vitest + RTL)

- `csv.test.ts`: escaping of commas, quotes, newlines, nulls.
- `chatStream.test.ts`: given a mocked event sequence, callbacks fire in order and `done` ends loading.
- `RefusalCard.test.tsx` and `SqlPanel.test.tsx`: render and copy button behaviour.

## 9. Config and deployment

`.env.example`

```
VITE_API_URL=http://localhost:8000
```

- Deploy on Vercel (framework preset Vite). Set `VITE_API_URL` to the Render backend URL.
- Add the Vercel domain to the backend's `ALLOWED_ORIGINS`.
- Optional `Dockerfile` (nginx serving `dist/`) for the Docker bonus.

## 10. README must include

- Live URL and a note that no login is needed
- Screenshot or GIF (light + dark)
- Local setup: `npm install`, `.env`, `npm run dev`, `npm test`, `npm run build`
- Feature list mapped to the brief: chat interface, SQL panel, explanation panel, conversation history, loading indicator, error messages, copy SQL; bonus: dark mode, streaming, download SQL, download CSV, syntax highlighting, multiple dialects
- Link to the backend repo
- Assumptions

## 11. Acceptance criteria

- [ ] Sending a question shows live progress steps, then SQL, results and a streamed explanation
- [ ] Follow-up in the same chat modifies the previous query
- [ ] Refusals show as a grey shield card with the backend's text
- [ ] Clarifying questions render distinctly
- [ ] Copy SQL, Download .sql, Download CSV work
- [ ] Dark mode toggles and persists
- [ ] New chat, switch chat, delete chat work; list refreshes after each turn
- [ ] Schema browser lists all tables and columns
- [ ] Usable on a 375 px wide phone
- [ ] Backend down → clear error with Retry; slow first request → waking-up banner
- [ ] `npm run build` and `npm test` pass
