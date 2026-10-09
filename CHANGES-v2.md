# Frontend Changes v2 — Workbench Mode

> Apply on top of `REQUIREMENTS.md`. Where this file conflicts with it, this file wins.
> Goal: a MySQL Workbench-style layout — database browser on the left, SQL editor + results in the middle, AI chat on the right. Clicking a table runs `SELECT *` on it; anything the chat generates lands in the editor and runs.
> Backend API changes are in the backend repo's `CHANGES-v2.md` (§2–3), copied here as `docs/BACKEND-CHANGES-v2.md`. Follow those contracts exactly.

## 1. New layout (desktop ≥ 1024 px)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Header: app name · dialect ▾ · Run-query toggle · theme toggle            │
├──────────────┬───────────────────────────────────────┬────────────────────┤
│ NAVIGATOR    │ SQL EDITOR                            │ AI ASSISTANT       │
│ 🔍 filter    │ [▶ Run] [Format] [Explain] [Optimize] │ Thread ▾  [+ New]  │
│ ▾ Customers  │ [Copy] [Download .sql]                │                    │
│   CustomerID │                                       │ messages…          │
│   Name …     │ SELECT *                              │                    │
│ ▸ Departments│ FROM Customers                        │                    │
│ ▸ Employees  │ LIMIT 100;                            │                    │
│ ▸ OrderItems │───────────── drag handle ─────────────│                    │
│ ▸ Orders     │ [Results] [Explanation] [Notes]       │                    │
│ ▸ Payments   │ 500 rows · 4 ms · page 1/5  ◀ ▶  CSV  │                    │
│ ▸ Products   │ grid…                                 │ [ ask about data ] │
└──────────────┴───────────────────────────────────────┴────────────────────┘
   ~240 px            flexible                              ~380 px, collapsible
```

- All three columns are resizable (drag handles); sizes persist in `localStorage`.
- The chat panel collapses to a floating "Ask AI" button.
- Editor/results split inside the middle column is a vertical drag handle (default 40/60).

### Mobile (< 1024 px)

Bottom tab bar: **Tables · Editor · Results · Chat**. Tapping a table or receiving SQL from chat switches to Results automatically.

## 2. New and changed components

```
src/components/
  navigator/
    Navigator.tsx          # replaces sidebar/SchemaBrowser.tsx
    TableNode.tsx          # table row: name, row count badge, expand chevron
    ColumnNode.tsx         # column: name, type, PK/FK icon, doc tooltip
  editor/
    SqlEditor.tsx          # CodeMirror 6
    EditorToolbar.tsx
  results/
    ResultsArea.tsx        # tabs: Results | Explanation | Notes
    ResultsGrid.tsx
    Pagination.tsx
    StatusBar.tsx          # rows, elapsed ms, errors
  chat/
    ChatPanel.tsx          # existing chat pieces move in here
    ThreadSwitcher.tsx     # replaces sidebar/ThreadList.tsx (dropdown)
```

Remove `panels/SqlPanel.tsx` (the editor replaces it). `ExplanationPanel` becomes the Explanation tab; optimisation notes, index suggestions, issues, warnings and removed joins move to the **Notes** tab.

### New dependencies

- `@uiw/react-codemirror`, `@codemirror/lang-sql` (with `schema` config for table/column autocomplete) — replaces `react-syntax-highlighter`
- `react-resizable-panels` for the split layout

## 3. Navigator (left)

- Data from `GET /api/tables` (fetched once on load).
- Search box filters tables and columns.
- Each table shows its row count badge (e.g. `Orders 2,000`).
- **Single click on a table** → call `GET /api/tables/{name}/preview?limit=100&offset=0`, put the returned `sql` in the editor, show results in the grid, switch to the Results tab. Highlight the selected table.
- Chevron expands columns. Column shows type, a key icon for PK, a link icon for FK (tooltip: "→ Customers.CustomerID"), doc on hover.
- Double-click a column → insert its name at the editor cursor.
- Right-click (or ⋯ menu) on a table: "Select top 100", "Count rows" (puts `SELECT COUNT(*) FROM <t>;` in the editor and runs it), "Ask AI about this table" (prefills chat input with "Describe the <t> table and what I can ask about it").

## 4. SQL editor (centre top)

- CodeMirror with SQL highlighting, line numbers, bracket matching, dark/light themes matched to the app, and **autocomplete** from the `/api/tables` schema.
- Toolbar:
  - **▶ Run** (also Ctrl/⌘+Enter) → `POST /api/query/run` with editor contents, `dialect`, `limit=100`, `offset=0`. If text is selected, run only the selection.
  - **Format** — client-side with `sql-formatter` (add dependency) for the selected dialect.
  - **Explain** → sends "Explain this query:\n```sql\n<editor sql>\n```" to the chat.
  - **Optimize** → sends "Optimize this query:\n```sql\n<editor sql>\n```" to the chat.
  - **Copy**, **Download .sql**.
- When a Run returns `status: "invalid"`, show a **Fix with AI** button in the status bar that sends "Fix this query:\n```sql\n<sql>\n```\nError: <errors joined>" to the chat.
- Editor content is the single source of truth for "the current query". Every chat request sends it as `current_sql`.
- When the chat produces SQL, **replace** the editor content with it in one CodeMirror transaction so Ctrl/⌘+Z restores the user's previous query. Briefly flash the editor border to show it changed.
- Unsaved manual edits are fine; nothing is persisted except via chat threads.

## 5. Results area (centre bottom)

Tabs:
- **Results** — the grid.
- **Explanation** — explanation text + assumptions from the latest chat turn (empty state: "Ask the assistant or click Explain to get a plain-English explanation.").
- **Notes** — warnings, issues found, optimisation notes, index suggestions (each with a copy button), removed joins. Show a dot on the tab when it has content.

Grid:
- Sticky header, monospace cells, NULL greyed, numbers right-aligned, horizontal + vertical scroll inside the grid only.
- Click a header to sort the **current page** client-side (indicate this with a small "sorted on this page" hint). For a full sort, the user asks the chat.
- Status bar: `500 rows · 4 ms · page 1 of 5`, previous/next buttons, page size 50/100/200, **Download CSV** (current page; label it "Download page as CSV").
- Pagination calls `POST /api/query/run` with the same SQL and new `offset` — for table previews and chat results alike. No LLM call.

States:
- `status: "ok"` → grid.
- `status: "invalid"` → red status bar listing validator errors, grid keeps the previous result greyed out.
- `status: "refused"` → the same grey shield refusal card used in chat, shown in the results area.
- `status: "error"` / network → red status bar with Retry.
- Running → spinner in the Run button and a thin progress bar on top of the grid.

## 6. Chat panel (right)

- Same chat behaviour as before (SSE, progress steps, intent badges, refusal/clarify/error cards, example chips), now inside the right column.
- Thread list becomes a **ThreadSwitcher** dropdown in the panel header with "+ New chat" and delete.
- When an `sql` event arrives: put it in the editor (§4). When a `result` event arrives: show it in the grid with pagination info and switch to the Results tab. When `explanation` arrives: fill the Explanation tab.
- The SQL card inside the chat bubble keeps a **"Load in editor"** button, so the user can bring back an older turn's query and re-run it.
- Send `current_sql` (editor contents) with every chat request.
- Example chips change to workbench-style prompts:
  - "Top 5 customers by total order value"
  - "Employees hired after January 2024 with their department"
  - "Monthly revenue for 2025"
  - "Who won the FIFA World Cup?"
- Placeholder: "Ask about your data — or click a table to start".

## 7. Requests

- Every request includes header `X-Client-Id` (UUID generated once, stored in `localStorage`) if not already implemented.
- New API helpers in `api/client.ts`: `getTables()`, `previewTable(name, limit, offset)`, `runQuery(sql, dialect, limit, offset)`.
- Types for the new responses in `api/types.ts` (see backend `CHANGES-v2.md` §2).

## 8. Dark mode

- CodeMirror theme switches with the app theme (`@uiw/codemirror-theme-github` light/dark or equivalent).
- Grid, navigator and resize handles have dark styles.

## 9. Tests

- `Navigator.test.tsx`: renders tables with row counts; clicking a table calls `previewTable` and dispatches editor + results updates.
- `SqlEditor.test.tsx`: Run with selection runs only the selection; chat SQL replacement is undoable.
- `ResultsGrid.test.tsx`: pagination calls `runQuery` with the next offset; invalid status shows errors and keeps the previous grid.
- `chatStream.test.ts`: `current_sql` is included in the request body.

## 10. README updates

- New screenshot/GIF of workbench mode (light + dark).
- "How to use": click a table to browse, edit and Run, or ask the assistant; follow-ups apply to whatever is in the editor.

## 11. Acceptance criteria

- [ ] Left navigator lists all tables with row counts; filter works; columns expand with PK/FK icons
- [ ] Clicking **Customers** shows `SELECT * FROM Customers LIMIT 100;` in the editor and 100 rows of 500, with paging to page 5
- [ ] Then typing "only those from California" in chat replaces the editor SQL with a filtered query and shows new results
- [ ] Editing SQL by hand and pressing ⌘/Ctrl+Enter runs it; an unknown column shows the validator error and a working **Fix with AI** button
- [ ] Typing `DELETE FROM Orders` in the editor and running shows the refusal card, nothing executes
- [ ] Explain / Optimize buttons route through the chat and fill the Explanation / Notes tabs
- [ ] Ctrl/⌘+Z in the editor restores the query that was there before the chat replaced it
- [ ] Panels resize and remember sizes; layout is usable on a 375 px phone via the bottom tabs
- [ ] Dark mode covers editor, grid and navigator
