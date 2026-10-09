# SQL Agent — Frontend (Workbench mode)

A MySQL Workbench-style UI for an AI SQL assistant: a **table navigator** on the left, a
**SQL editor** with a **results grid** in the middle, and the **AI assistant** chat on the right.
Click a table to browse it, edit and run SQL yourself, or ask the assistant — anything it
generates lands in the editor and runs. Every query is validated and read-only on the backend.

**Live demo:** https://sql-agent-frontend-delta.vercel.app — **no login needed**, just open it.
Backend: https://sql-agent-backend-rg9t.onrender.com (free tier, so the first request after idle
can take ~30–60 s; the app shows a "server may be waking up" banner when that happens).

Backend repo: https://github.com/arpitgoyal20/sql-agent-backend-

Specs this UI implements:

- [`CHANGES-v2.md`](CHANGES-v2.md) — **Workbench mode** (layout, components, behaviour,
  acceptance criteria). It supersedes the layout parts of the documents below.
- [`docs/BACKEND-CHANGES-v2.md`](docs/BACKEND-CHANGES-v2.md) — the v2 backend contract
  (`/api/tables`, table preview, `/api/query/run`, pagination, `current_sql`, `X-Client-Id`)
- [`docs/UI_SPEC.md`](docs/UI_SPEC.md) — visual language (dark-first palette, typography, density)
- [`docs/API_ADDITIONS.md`](docs/API_ADDITIONS.md) — v1.1 stream fields (validation, inspection, …)
- [`REQUIREMENTS.md`](REQUIREMENTS.md) — the original brief (§4 API contract, quality bar)

## Screenshots

Dark (default), desktop — Customers clicked, then "only those from California" in the chat
replaced the editor query and re-ran it:

![Dark theme, workbench](docs/screenshot-dark.png)

Light, desktop — Optimize from the editor toolbar: the optimized query is in the editor, the
Notes tab has the optimisation notes, a copyable index suggestion, your original query and the
validation checklist:

![Light theme, notes tab](docs/screenshot-light.png)

Mobile (375 px) — bottom tabs Tables · Editor · Results · Chat:

<img src="docs/screenshot-mobile.png" alt="Mobile layout with the bottom tab bar" width="280" />

## How to use

1. **Click a table** in the navigator (left). The editor shows `SELECT * FROM <table> LIMIT 100;`
   and the grid shows the first page; use ◀ ▶ and the page-size menu (50/100/200) to page
   through all rows. Expand a table (chevron) to see columns with 🔑 primary keys and 🔗 foreign
   keys; double-click a column to insert it at the editor cursor. Right-click (or ⋯) a table for
   **Select top 100**, **Count rows** and **Ask AI about this table**.
2. **Edit and Run.** Change the SQL and press **▶ Run** or **⌘/Ctrl+Enter**. Select part of the
   editor to run only the selection. **Format** pretty-prints for the chosen dialect; **Copy** and
   **Download .sql** save it. If the validator rejects the query you get a red bar with the errors
   and **Fix with AI**.
3. **Or ask the assistant.** Type a question in the chat (right). Follow-ups apply to **whatever is
   in the editor** — e.g. click _Customers_, then ask "only those from California". The assistant's
   SQL replaces the editor content (press **⌘/Ctrl+Z** in the editor to get your query back) and its
   results appear in the grid. **Explain** and **Optimize** in the editor toolbar ask the assistant
   about the current query; the answers fill the **Explanation** and **Notes** tabs.

## Layout

| Width               | Layout                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 1024 px (desktop) | Navigator \| Editor over Results \| AI assistant. All three columns and the editor/results split are resizable (sizes remembered); the chat collapses to a floating **Ask AI** |
| < 1024 px (mobile)  | One section at a time with a bottom tab bar **Tables · Editor · Results · Chat**; tapping a table or receiving SQL from the chat switches to Results                           |

Header: app name · **Dialect** (SQLite / PostgreSQL / MySQL) · **Run on demo database (SQLite)**
toggle (the assistant executes its SQL, for every dialect) · connection status (polls `/api/health`) · **⌘K** chat search ·
theme toggle.

## Features mapped to the brief

| Brief item (REQUIREMENTS.md) | Where in Workbench mode                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat interface               | Right column: "You" cards and agent replies, example chips, Enter / ⌘↵ sends, Shift+Enter newline, pasted SQL turns monospace                                                 |
| SQL panel                    | The **SQL editor** (CodeMirror 6): highlighting, line numbers, bracket matching, schema autocomplete, Run / Format / Explain / Optimize / Copy / Download .sql                |
| Explanation panel            | **Explanation** tab (streams in, plus assumptions); a short "Why this query?" also stays in the chat reply                                                                    |
| Conversation history         | **ThreadSwitcher** dropdown in the chat header: search, switch, delete (with confirm), **+ New**; ⌘K opens it                                                                 |
| Loading indicator            | Agent Activity panel from `step` events (spinner, ✓, ↻ retry with the failing check from `step.errors`, – skipped); spinner in Run; thin progress bar over the grid           |
| Error messages               | Readable error card with Try Again in the chat; red status bar with **Retry** for run errors and **Fix with AI** for validator errors; refusals as a neutral grey shield card |
| Copy SQL                     | Editor **Copy** ("Copied" for 2 s), Copy on every chat SQL card, index suggestions copyable individually                                                                      |
| **Bonus**                    |                                                                                                                                                                               |
| Dark mode                    | Dark by default, persisted; covers editor (custom CodeMirror theme from the palette), grid, navigator and resize handles                                                      |
| Streaming                    | SSE via `@microsoft/fetch-event-source`; 30 s no-event timeout; waking-up banner after 5 s                                                                                    |
| Download SQL / CSV           | **Download .sql** (`query.sql`); **Download page as CSV** (`results-page-N.csv`, RFC 4180, UTF-8 BOM)                                                                         |
| Syntax highlighting          | CodeMirror `@codemirror/lang-sql` in the editor; a tiny tokenizer (same colours) for read-only chat cards                                                                     |
| Multiple dialects            | Dialect select → sent with chat requests and editor runs; editor highlighting, autocomplete and Format follow it                                                              |

Workbench additions (CHANGES-v2.md):

- **Navigator** (§3) — tables from `GET /api/tables` with row-count badges, filter over tables
  _and_ columns (tables that only match by column open to show those columns), PK/FK icons with
  tooltips (`→ Customers.CustomerID`, type, nullable, doc), selected-table highlight.
- **Editor** (§4) — `@uiw/react-codemirror` + `@codemirror/lang-sql`, lazy-loaded in its own chunk.
  Chat SQL replaces the content in **one** CodeMirror transaction isolated in history (one ⌘/Ctrl+Z
  restores your query) and the border flashes. Format uses `sql-formatter` (loaded on first use).
- **Results area** (§5) — tabs Results | Explanation | Notes (with a dot when Notes has
  something). Grid: sticky header, row numbers, monospace, NULL greyed, numbers right-aligned,
  scroll inside the grid only, click a header to sort **this page** ("Sorted on this page only").
  Status bar `500 rows · 4 ms · page 1 of 5`. States: ok, invalid (red bar + previous grid greyed),
  refused (grey shield card, "Nothing was executed"), error (red bar + Retry), running.
- **Notes tab** — warnings, issues found, optimisation notes, index suggestions, removed joins,
  your original query (optimize/debug), the **query validation checklist** and the **Query
  Inspector** (tables, columns, joins, filters, aggregations, grouping, ordering, limit, safety).
- **Chat** (§6) — intent badges and "↳ Modified previous query", refusal / clarify / error cards,
  compact SQL card with **Load in editor** and Copy, "N rows in Results" / "See Notes" shortcuts.
- **Requests** (§7) — `X-Client-Id` on every request except `/api/health`; `current_sql` on every
  chat request; `getTables()`, `previewTable()`, `runQuery()` in `api/client.ts`.

## Local setup

Requires Node 18+ (20 recommended).

```bash
npm install
cp .env.example .env      # set VITE_API_URL to your backend (default http://localhost:8000)
npm run dev               # http://localhost:5173
npm test                  # Vitest + React Testing Library
npm run build             # type-check and build to dist/
npm run lint              # ESLint
npx prettier --check .    # formatting
```

Environment variables:

| Variable       | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| `VITE_API_URL` | Backend base URL, e.g. `https://sql-agent-backend-rg9t.onrender.com` |
| `VITE_MOCK`    | `true` serves everything from the in-memory mock (no backend needed) |

### Mock mode (no backend needed)

`VITE_MOCK=true npm run dev` (or set it in `.env`). Everything works from memory with the same
endpoints, events and payloads as the v2 backend, and resets on reload:

- `/api/tables` with the real row counts (Departments 8, Employees 200, Customers 500,
  Products 50, Orders 2,000, OrderItems 6,035, Payments 1,791) and deterministic generated rows;
  table previews with correct `total` and paging.
- `/api/query/run` with a tiny engine for single-table `SELECT … WHERE … ORDER BY … LIMIT` and
  `COUNT(*)` (fixed results for the scripted multi-table queries), and all four statuses:
  `DELETE`/`DROP`/`PRAGMA`… → **refused**; an unknown column such as `SELECT nope FROM Customers`
  → **invalid** (`UNKNOWN_COLUMN`); any query containing the word `slow` (e.g. a `-- slow`
  comment) → **error** (timeout text); otherwise **ok**.
- Chat replies are scripted SSE sequences: the four example chips, "only those from California"
  (built on the editor's `current_sql`, preview `LIMIT` stripped), Explain / Optimize / Fix with AI
  from the editor, "delete all orders" (refusal), "show me the important ones" (clarify),
  "mock error" (error card with Try Again). Result events carry `total` / `limit` / `offset`.
- Threads (list, load, delete, generated titles). `X-Client-Id` is accepted and ignored.

### Deployment

- **Vercel:** framework preset Vite, set `VITE_API_URL` to the Render backend URL, and add the
  Vercel domain to the backend's `ALLOWED_ORIGINS` (CORS must allow the `X-Client-Id` header).
  `vercel.json` rewrites all paths to `index.html`.
- **Docker (optional):**
  `docker build --build-arg VITE_API_URL=https://sql-agent-backend-rg9t.onrender.com -t sql-agent-frontend .`
  then `docker run -p 8080:80 sql-agent-frontend` (nginx serves `dist/`, see `nginx.conf`).

## Project layout

```
src/
  api/          client.ts (REST: tables, preview, run, threads; X-Client-Id), clientId.ts,
                chatStream.ts (SSE → typed callbacks), types.ts (v1 + v1.1 + v2 contract),
                mock.ts (scripted SSE), mockRest.ts (in-memory REST), mockDb.ts (generated rows,
                mini engine, validator imitation), mockData.ts (schema, fixtures)
  context/      ThemeContext, ToastContext, UiContext (desktop/mobile, chat open, ⌘K),
                WorkbenchContext (tables, editor bridge, results + paging, tabs, chat bridge),
                ChatContext (threads, turns, current_sql), chatModel.ts (pure model + messages)
  components/
    layout/     AppShell (resizable desktop / mobile tabs), TopNav, ResizeHandle, useHealth
    navigator/  Navigator, TableNode, ColumnNode
    editor/     SqlEditor (lazy wrapper + flash), CodeMirrorEditor, EditorToolbar, RunSummary
    results/    ResultsArea, ResultsGrid, Pagination, StatusBar, ExplanationTab, NotesTab,
                ValidationPanel, QueryInspector
    chat/       ChatPanel, ThreadSwitcher, MessageList, UserMessage, AgentMessage,
                AgentActivity, ChatSqlCard, ExampleChips, Composer, RefusalCard, ErrorCard
    common/     ErrorBoundary, SqlHighlight, CopyButton, DownloadButton, Modal, Logo, useDismiss
  utils/        csv.ts, download.ts, format.ts, sqlFormat.ts (sql-formatter wrapper)
```

## Tests

`npm test` runs 119 tests (Vitest + React Testing Library, jsdom):

- `chatStream.test.ts` (30) — SSE handling: event order, `done`, errors, 30 s timeout, slow-start
  banner, abort, mock replay; **`current_sql` in the body** and the **`X-Client-Id` header**
- `client.test.ts` (6) — `X-Client-Id` on REST calls (stable, stored, in-memory fallback, not on
  `/api/health`), preview / run URLs and bodies, 404 `UNKNOWN_TABLE` and 429 mapping
- `mockRest.test.ts` (22) — mock `/api/tables` counts and FKs, preview totals and paging, run
  statuses (ok / invalid / refused / error / too long), `current_sql` follow-up, editor phrasings
- `Navigator.test.tsx` (5) — row counts; click calls `previewTable` and updates editor + results;
  filter; PK/FK icons and double-click insert; Count rows / Ask AI / Select top 100 menus
- `SqlEditor.test.tsx` (8) — real CodeMirror in jsdom: **Run with a selection runs only the
  selection**, for ok, invalid and refused responses (exact SQL sent, no crash, document,
  selection and editor view unchanged); Ctrl+Enter; **chat SQL replacement is undoable** (one transaction) and flashes;
  Format is undoable; disabled when empty
- `ResultsGrid.test.tsx` (6) — **paging calls `runQuery` with the next offset** and page size;
  previews page through `previewTable`; **invalid shows errors and keeps the previous grid**;
  refusal card; error + Retry; page-only sort with hint, NULL, numeric alignment
- `QueryInspector.test.tsx` (3) — Notes tab empty state, warnings + validation checklist,
  Query Inspector open / Escape / focus return
- `ErrorBoundary.test.tsx` (1) — a crashing region shows an inline card with Try again and
  recovers; other regions keep rendering
- `RefusalCard.test.tsx` (4), `csv.test.ts` (10), `chatModel.test.ts` (6, incl. the exact
  Explain / Optimize / Fix message formats)
- `App.test.tsx` (14) — full flows against the mock: click Customers → preview SQL + 100 of 500,
  page to 5; chat "only those from California" replaces the editor SQL (undo restores it) and pages
  via `/api/query/run`; unknown column → error → **Fix with AI** sends the exact message; `DELETE
FROM Orders` → refusal card; Explain / Optimize fill Explanation / Notes; dark default + light
  persisted; chips, refusal and error + Try Again in the chat; Load in editor; thread switcher
  (⌘K, search, switch, delete, new); chat collapse remembered; PostgreSQL turns auto-run off;
  below 1024 px an editor Run stays on the Editor tab with an inline summary while a table tap
  goes to Results; the editor query survives a reload

The browser-only behaviour (real ⌘Z undo after a chat replacement, mouse/keyboard selection +
⌘Enter, drag-resizing and persistence, 375 px layout) was additionally driven in headless Chrome
against the mock app.

## Assumptions

- **No authentication.** Each browser gets an anonymous id: `crypto.randomUUID()` (with a
  Math.random v4 fallback for non-secure contexts), stored in `localStorage` under
  `sqlagent.clientId` and sent as `X-Client-Id` on every `/api` request and the chat stream, except
  `GET /api/health` (Render's health check cannot send it). If storage is blocked, an in-memory id
  is used for the page's lifetime. Threads are therefore private to a browser.
- **Paging source.** A **table preview** pages through `GET /api/tables/{name}/preview` (same table,
  new `offset`/`limit`), not `/api/query/run`, because the preview SQL carries its own `LIMIT` and
  running it through `/api/query/run` would cap `total` at that limit. **Editor runs and chat
  results** page through `POST /api/query/run` with the same SQL, the turn's dialect and a new
  offset. The grid remembers which source produced it. Paging never changes the editor.
- **Page size** (50/100/200, default 100) applies to the next preview / run and re-fetches the
  current result from offset 0. Clicking a table uses the current page size (`LIMIT 100` by
  default). Chat results arrive as the backend's first page of 100. A result event from an older
  backend without `total` is shown as a single page.
- **Run** sends the selection if any text is selected, otherwise the whole editor; the dialect is
  the header's (the backend transpiles non-SQLite SQL). An empty editor disables Run.
- **Running from the editor never leaves the editor.** Below 1024 px (phones, but also a laptop
  window with DevTools docked or a split screen) the app uses the tabbed layout. There, ▶ Run /
  ⌘↵ stays on the Editor tab and shows the outcome in a one-line summary under the editor
  (rows · ms · page, the validator error with **Fix with AI**, the refusal, or the error with
  **Retry**) with a **View results** button. Tapping a table, Count rows and chat results still
  switch to Results, as §1 asks.
- **The editor's query is saved** to `localStorage` (`sqlagent.editorSql`, debounced 400 ms,
  failures ignored) and restored on load, so a reload or a crash never loses it.
- **Error boundaries** wrap the app and each region (navigator, editor, results, chat). A render
  failure shows a compact card with **Try again** in that region only. The editor's content lives
  above the boundaries (and in storage), so it survives.
- **The editor is the current query.** Its trimmed contents go as `current_sql` with every chat
  message (omitted when blank). Chat SQL replaces the editor only when it differs (Explain of the
  same query does not touch it). Switching chats does not change the editor; use **Load in
  editor** on any SQL card to bring an older query back (it loads, it does not run).
- **Fix with AI** sends `Fix this query:\n```sql\n<the SQL that failed>\n```\nError: <errors joined
with "; ">`, verbatim `CATEGORY: message` strings. Explain / Optimize send the formats in §4.
- **Tab switching (results tabs):** a chat `result` switches to Results; a finished explain turn opens
  Explanation and an optimize turn opens Notes (the reason the user clicked). On mobile, chat SQL
  switches to Results when the assistant runs it, otherwise to Editor.
- **Notes dot** appears when there are warnings, issues, optimisation notes, index suggestions or
  removed joins (from the latest chat reply, or warnings from the last editor run). The validation
  checklist and Query Inspector (from the latest chat `sql` event) live at the bottom of Notes.
- **Explanation tab** shows the latest assistant turn that produced SQL; refusals and clarifying
  questions stay in the chat and leave the tab unchanged.
- **Saved queries, thread rename and thread duplicate were dropped** from the UI to keep the
  workbench uncluttered (the editor + chat history cover the same need); the backend endpoints
  still exist. Threads can be searched (⌘K), switched, deleted (inline confirm) and started.
- **Dialects and execution.** PostgreSQL and MySQL are supported for generation and validation;
  execution translates them to SQLite and runs them on the sample database. The header toggle is
  labelled "Run on demo database (SQLite)" for every dialect (tooltip: "Queries are translated to
  SQLite and run on the bundled sample data."), and the editor's Run works the same way. For
  non-SQLite dialects the Notes tab shows the translated SQL under **Executed as (SQLite)**. If a
  query uses a feature SQLite lacks (e.g. regex `~`, `ARRAY_AGG`), the result area and the chat
  reply show "This PostgreSQL feature isn't supported on the SQLite demo database." The generated
  SQL stays in the editor, because it may be valid for a real PostgreSQL / MySQL database.
- **Layout persistence:** column sizes (`react-resizable-panels`, keys
  `react-resizable-panels:sqlagent.layout.*`) and the chat open/closed state
  (`sqlagent.chatOpen`) are stored in `localStorage`. Below 1024 px the mobile tab layout is used;
  all four sections stay mounted so the editor keeps its undo history.
- **Theme:** dark by default (UI_SPEC §28), light opt-in, persisted under `theme`, applied before
  first paint. The palette is CSS variables, so the CodeMirror theme, grid and navigator follow it
  automatically; accent fills use #6E4CF5 and accent text #A08BFF / #5B3FD6 for WCAG AA.
- **Format** uses `sql-formatter` with upper-case keywords and keeps `LIMIT n` on one line;
  unparseable SQL shows a toast and leaves the editor untouched. Formatting is undoable.
- **Client-side sort** only reorders the current page (NULLs last); a full sort needs a new query
  (ask the assistant).
- **CSV** is the current page only ("Download page as CSV"), RFC 4180 with a UTF-8 BOM for Excel.
- **Bundle:** CodeMirror is lazy-loaded (its own chunk), and `sql-formatter` and the mock layer
  load on demand, so the main chunk stays ~270 kB (≈83 kB gzip).
- **Mock mode** is an imitation: the validator and engine are regex-level and handle the demo
  flows (single-table queries are really filtered/paged over generated data; scripted multi-table
  queries return fixed rows).
- **Refusal texts come verbatim from the backend**; the card adds a title ("Read-only operation
  required" / "Outside my scope") and a clickable suggestion.
- **Thread titles** come from `GET /api/threads` (refreshed after every `done` and whenever the
  switcher opens); a new chat shows its first message until the generated title arrives.
