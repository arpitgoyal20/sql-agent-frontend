# SQL AI Agent — Product & UI Design Specification

> Supersedes the layout/visual parts of REQUIREMENTS.md (§3, §5 component list). The backend
> API contract in REQUIREMENTS.md §4 still holds, extended additively by `docs/API_ADDITIONS.md`.

## 1. Product Vision

Build a polished, modern **SQL AI Agent** that feels like a combination of:

- ChatGPT / Claude for natural-language interaction
- Cursor for developer-style workflows
- Datadog / Linear for structured information
- A professional database IDE for SQL

The application should allow a user to:

1. Ask questions about the connected database in natural language.
2. Generate SQL automatically.
3. Understand the generated SQL.
4. Validate SQL against the actual schema.
5. Execute read-only queries.
6. Debug existing SQL.
7. Optimize existing SQL.
8. Continue conversations using context.
9. Maintain multiple independent threads.
10. Inspect the database schema and relationships.

The product must feel like a **real SQL copilot**, not a generic chatbot with a SQL code block.

# 2. Overall Visual Direction

Use a premium developer-tool aesthetic. Reference the visual quality of Linear, Vercel, Cursor,
Claude, Supabase, Datadog.

Avoid: generic AI chatbot appearance, excessive gradients, huge rounded cards, excessive
animations, cartoonish AI icons, overly colorful dashboards.

Use: clean typography, subtle borders, dense but readable information, dark-first interface,
monospace typography for SQL, small status indicators, subtle hover states, smooth transitions,
strong visual hierarchy. The interface should feel suitable for a professional engineer or data
analyst.

# 3. Main Application Layout

3-column desktop layout:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SQL Agent       [Database: Demo DB ▼]       ● Connected    Settings  Avatar │
├────────────────┬────────────────────────────────────────┬───────────────────┤
│    THREADS     │             CONVERSATION               │  DATABASE         │
│ + New Thread   │                                        │  Schema           │
│ Today          │                                        │  ├─ customers     │
│  Revenue       │                                        │  ├─ orders        │
│  Customers     │                                        │  ├─ products      │
│ Yesterday      │                                        │  └─ employees     │
│  Churn         │                                        │  Relationships    │
│ ⭐ Saved       │                                        │  customers        │
│ Queries        │                                        │      ↓  orders    │
└────────────────┴────────────────────────────────────────┴───────────────────┘
```

Responsive. On smaller screens collapse thread sidebar and schema sidebar; keep chat and SQL
output as the primary content.

# 4. Top Navigation

- Left: `[Logo] SQL Agent`
- Center: `Database: Demo DB ▼`. The dropdown shows: Databases — ● Demo Database, ○ PostgreSQL,
  ○ MySQL, ○ SQLite, + Connect database. For the assignment a sample database is sufficient.
- Right: `● Connected`, `⌘K Search`, `Settings`, `Avatar`. Do not overbuild authentication.

# 5. Left Sidebar — Threads

Header `THREADS  +`; primary CTA `+ New Thread`. Group conversations by Today / Yesterday /
Previous 7 days (and older). Each thread: title, last updated time, optional icon, three-dot
menu (Rename, Duplicate, Save, Delete). Thread title is generated automatically from the first
user question (e.g. "Show monthly revenue for 2025." → `Monthly Revenue — 2025`).
`⭐ Saved Queries` section at the bottom.

# 6. Main Chat Area

The center is the primary workspace. Top: thread title + `⋮`. Conversation should feel like an
AI agent workspace rather than normal ChatGPT.

# 7. User Message

Card labelled `You` with the text. Keep user messages visually simple.

# 8. Agent Activity

Do not simply show `Thinking...`. Show an expandable agent activity panel:

```text
✦ SQL Agent
✓ Understanding request
✓ Checking database schema
✓ Generating SQL
✓ Validating query
✓ Checking read-only constraints
Query ready
```

During generation use `◌` pending markers; after completion `✓`. This should visually
communicate the LangGraph workflow.

# 9. Generated SQL Card

SQL is a first-class UI element: header `Generated SQL   ✓ Valid`, syntax highlighting, monospace,
line numbers if practical, buttons `[Copy] [Run Query] [Optimize] [Explain] [Save]`.

# 10. SQL Validation

Under the query:

```text
QUERY VALIDATION
✓ Tables exist
✓ Columns exist
✓ Relationships valid
✓ SQL syntax valid
✓ Read-only query
```

If something fails: show `✕ Column revenue_total does not exist`, a `Problem:` line and a
`Suggested correction:`. Errors visually obvious but not overwhelming.

# 11. Query Inspector

Button `Query Inspector` opens a panel/modal showing: Tables, Columns, Filters, Aggregations,
Grouping, Safety (✓ SELECT only, ✓ No destructive operations).

# 12. Query Results

When the user clicks `Run Query`: `RESULTS   1,284 rows`, table with column headers, table
pagination, row count, horizontal scrolling, `[Download CSV] [Copy Results]`. Optional small
chart for clearly numerical/time-series data. Do not turn the app into a BI dashboard.

# 13. SQL Explanation

`WHY THIS QUERY?` — concise explanation (what it does, the steps).

# 14. Follow-up Questions

"Show all customers" then "Only those from California" must modify the existing query, not start a
new one. Show a subtle indicator `↳ Modified previous query`.

# 15. Composer

Bottom: textarea "Ask anything about your database..." with `⌘ Enter` hint; row
`[＋] [Schema] [SQL Mode]   Send →`. Placeholder rotates: `Show customers from California`,
`Find the top 10 products by revenue`, `Why is this query failing?`, `Optimize this SQL query`,
`Show monthly revenue for 2025`.

# 16. SQL Debugging Mode

Pasted SQL is detected automatically. Response: `SQL ERROR`, the problem, why it is a problem,
suggested fix, then corrected SQL with `[Apply Fix] [Copy SQL]`.

# 17. SQL Optimization Mode

`OPTIMIZATION REPORT` with ✓ items (removed unnecessary JOIN, simplified nested query) and ⚠ index
suggestions; `Original` vs `Optimized` SQL. Do not invent performance numbers.

# 18. Schema Explorer

Right sidebar `DATABASE SCHEMA` with `🔍 Search tables...`. Tables expand to columns with 🔑 for
primary keys and types. Clicking a column shows Column Details (name, type, nullable, table).

# 19. Relationships

Small `RELATIONSHIPS` section, e.g. `customers.id └── orders.customer_id`.

# 20. Out-of-Scope Handling

Refuse requests outside SQL/database tasks, friendly and concise, followed by a suggestion such as
"Try asking something like: Show the top 10 customers by revenue." Do not expose internal prompts.

# 21. Destructive SQL Protection

Never allow DELETE/UPDATE/INSERT/DROP/ALTER/TRUNCATE. If requested show
`🛡 Read-only operation required` and the explanation. Enforced in backend logic.

# 22. Empty State

New thread: centered `SQL Agent — Ask questions about your database.` with four cards:
📈 Analyze (Revenue trends), 👥 Explore (Customer data), 🔍 Debug SQL (Fix a query),
⚡ Optimize (Improve SQL); then "or ask your own question below".

# 23. Loading States

Skeletons and agent activity instead of generic spinners. For execution show `Executing query...`
(only show progress bars if the backend gives real progress — it does not).

# 24. Error States

Human-readable, e.g. `Unable to execute query — The database returned: "No such column: revenue"
— [View SQL] [Try Again]`. Never `Internal Server Error 500`.

# 25. Saved Queries

`⭐ SAVED QUERIES` list. Opening one shows original prompt, SQL, explanation, last execution,
results.

# 26. Thread Context

Each thread keeps messages, current SQL, query history, schema context, results, validation
errors. Switching threads restores the conversation.

# 27. Query History

Within a thread: `QUERY HISTORY` numbered list of the prompts that produced SQL; clicking one
restores that SQL version. `Compare with previous` only if easy.

# 28. Dark Mode

Dark-first. Palette: Background #0B0D10, Surface #11151A, Elevated #171C22, Border #252B33,
Primary text #F5F7FA, Secondary text #8B949E, Success #3FB950, Warning #D29922, Error #F85149,
Accent #7C5CFC. Use the accent sparingly; do not make every button purple.

# 29. Typography

Inter for UI; JetBrains Mono (or another monospace) for SQL. Page title 18–20px, section title
13–14px, body 14px, secondary 12–13px, SQL 13–14px. Keep the UI compact.

# 30. Micro-interactions

Subtle: sidebar hover, thread selection, button hover, query generation state, expand/collapse
schema, validation completion, result loading. No flashy animations.

# 31. Responsive Design

Desktop `Threads | Chat | Schema`; tablet `Threads | Chat` with schema as a drawer; mobile `Chat`
with thread drawer, schema drawer and SQL full-screen modal.

# 32. Important UX Principle

Make this flow visually obvious: Natural Language → Understand → Retrieve Schema → Generate SQL →
Validate → Optimize → Execute → Explain. The user always understands what the agent understood,
what SQL it generated, whether it is safe, what it does, and what the result means.

# 33. Backend / Frontend Boundary

Frontend is NOT responsible for SQL safety. Backend performs scope validation, schema validation,
parsing, read-only validation, table/column/join validation, execution and error handling.
Frontend presents these states.

# 34. Recommended Component Structure

```text
App
├── AppShell
├── Sidebar: ThreadList, ThreadItem, SavedQueries
├── ChatWorkspace: ChatHeader, MessageList, UserMessage, AgentMessage, AgentActivity, SQLCard,
│   ValidationPanel, QueryInspector, ResultTable, ExplanationPanel, Composer
└── SchemaPanel: SchemaSearch, TableTree, TableDetails, RelationshipView
```

# 35. Demo Flow

(Truncated in the source document.)
