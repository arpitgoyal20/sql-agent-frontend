// Schema Explorer (UI_SPEC §18/§19): search, expandable tables, 🔑 primary keys, Column Details
// with "Insert into query", and a RELATIONSHIPS list of every foreign key.
// A column on ≥ 1280 px, a right-hand drawer below.

import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  KeyRound,
  Link2,
  RefreshCw,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSchema } from '../../api/client';
import type { SchemaColumn, SchemaResponse, SchemaTable } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import Drawer from '../common/Drawer';

// Cached for the page lifetime so remounts never refetch.
let schemaRequest: Promise<SchemaResponse> | null = null;

function loadSchema(): Promise<SchemaResponse> {
  schemaRequest ??= getSchema().catch((err: unknown) => {
    schemaRequest = null;
    throw err;
  });
  return schemaRequest;
}

/** Forget the cached schema (tests). */
// eslint-disable-next-line react-refresh/only-export-components
export function resetSchemaCache(): void {
  schemaRequest = null;
}

interface Selected {
  table: SchemaTable;
  column: SchemaColumn;
}

function ColumnDetails({ sel, onClose }: { sel: Selected; onClose: () => void }) {
  const { insertAtCursor } = useChat();
  const { setSchemaDrawer } = useUi();
  const { table, column } = sel;
  const fk = table.foreign_keys.find((f) => f.column === column.name);
  const rows: [string, string][] = [
    ['Name', column.name],
    ['Type', column.type || '—'],
    ['Nullable', column.nullable === undefined ? '—' : column.nullable ? 'Yes' : 'No'],
    ['Table', table.name],
  ];
  if (column.pk) rows.push(['Key', 'Primary key']);
  if (fk) rows.push(['References', `${fk.ref_table}.${fk.ref_column}`]);

  return (
    <section
      aria-labelledby="column-details-heading"
      className="fade-in mx-3 mb-3 rounded-lg border border-line bg-elevated p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 id="column-details-heading" className="section-label mr-auto">
          Column details
        </h3>
        <button
          type="button"
          className="btn-icon h-6 w-6"
          onClick={onClose}
          aria-label="Close column details"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words font-mono text-[12.5px]">{v}</dd>
          </div>
        ))}
      </dl>
      {column.doc && <p className="mt-2 text-sm text-muted">{column.doc}</p>}
      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        onClick={() => {
          insertAtCursor(column.name);
          setSchemaDrawer(false);
        }}
        aria-label={`Insert ${column.name} into query`}
      >
        <CornerDownRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        Insert into query
      </button>
    </section>
  );
}

function SchemaBody() {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    let live = true;
    loadSchema().then(
      (s) => live && setSchema(s),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!schema) return [];
    return schema.tables
      .map((t) => {
        if (!q || t.name.toLowerCase().includes(q)) return { table: t, columns: t.columns };
        const columns = t.columns.filter((c) => c.name.toLowerCase().includes(q));
        return columns.length ? { table: t, columns } : null;
      })
      .filter((x): x is { table: SchemaTable; columns: SchemaColumn[] } => !!x);
  }, [schema, q]);

  const relationships = useMemo(
    () =>
      schema?.tables.flatMap((t) =>
        t.foreign_keys.map((f) => ({
          parent: `${f.ref_table}.${f.ref_column}`,
          child: `${t.name}.${f.column}`,
        })),
      ) ?? [],
    [schema],
  );

  const toggle = useCallback(
    (name: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }),
    [],
  );

  return (
    <>
      <div className="px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Search tables and columns</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables..."
            className="input pl-8"
          />
        </label>
      </div>

      {selected && <ColumnDetails sel={selected} onClose={() => setSelected(null)} />}

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {error && !schema && (
          <div className="flex items-center gap-2 px-2 py-1 text-sm">
            <span className="flex-1 text-muted">Could not load the schema.</span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setError(false);
                setAttempt((n) => n + 1);
              }}
              aria-label="Retry loading the schema"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {!schema && !error && (
          <div className="space-y-2 px-2 py-1" role="status" aria-label="Loading schema">
            {[60, 75, 50, 70].map((w) => (
              <div key={w} className="skeleton h-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {schema && (
          <>
            {visible.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted">No tables or columns match “{query}”.</p>
            ) : (
              <ul aria-label="Tables" className="space-y-px">
                {visible.map(({ table, columns }) => {
                  const open = !!q || expanded.has(table.name);
                  const fks = new Map(table.foreign_keys.map((f) => [f.column, f]));
                  return (
                    <li key={table.name}>
                      <button
                        type="button"
                        onClick={() => toggle(table.name)}
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} columns of ${table.name}`}
                        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-elevated"
                      >
                        {open ? (
                          <ChevronDown
                            className="h-3.5 w-3.5 shrink-0 text-muted"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 text-muted"
                            aria-hidden="true"
                          />
                        )}
                        <Table2 className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate font-mono text-[13px]">{table.name}</span>
                        <span className="ml-auto text-2xs text-muted">{table.columns.length}</span>
                      </button>
                      {open && (
                        <ul className="mb-1 ml-[18px] border-l border-line pl-1.5">
                          {columns.map((c) => {
                            const fk = fks.get(c.name);
                            const isSel =
                              selected?.table.name === table.name &&
                              selected.column.name === c.name;
                            return (
                              <li key={c.name}>
                                <button
                                  type="button"
                                  onClick={() => setSelected({ table, column: c })}
                                  aria-pressed={isSel}
                                  aria-label={`Column ${table.name}.${c.name}, ${c.type}${
                                    c.pk ? ', primary key' : ''
                                  }${fk ? `, references ${fk.ref_table}.${fk.ref_column}` : ''}`}
                                  title={c.doc || undefined}
                                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] text-left transition-colors ${
                                    isSel ? 'bg-elevated' : 'hover:bg-elevated/70'
                                  }`}
                                >
                                  {c.pk ? (
                                    <KeyRound
                                      className="h-3 w-3 shrink-0 text-warning"
                                      aria-hidden="true"
                                      data-testid="pk-icon"
                                    />
                                  ) : fk ? (
                                    <Link2
                                      className="h-3 w-3 shrink-0 text-accent-fg"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <span className="w-3 shrink-0" aria-hidden="true" />
                                  )}
                                  <span className="min-w-0 truncate font-mono text-[12.5px]">
                                    {c.name}
                                  </span>
                                  <span className="ml-auto shrink-0 font-mono text-2xs uppercase text-muted">
                                    {c.type}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <section aria-labelledby="relationships-heading" className="mt-4 px-1.5">
              <h3 id="relationships-heading" className="section-label mb-1.5">
                Relationships
              </h3>
              <ul className="space-y-1.5 font-mono text-[12px] leading-4">
                {relationships.map((r) => (
                  <li
                    key={`${r.parent}-${r.child}`}
                    aria-label={`${r.parent} is referenced by ${r.child}`}
                  >
                    <span className="block truncate text-fg">{r.parent}</span>
                    <span className="block truncate pl-2 text-muted">└── {r.child}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default function SchemaPanel() {
  const { schemaDrawer, setSchemaDrawer, schemaPanel, toggleSchema } = useUi();
  const close = useCallback(() => setSchemaDrawer(false), [setSchemaDrawer]);
  return (
    <Drawer
      id="schema-panel"
      label="Database schema"
      side="right"
      open={schemaDrawer}
      onClose={close}
      widthClass="w-[300px]"
      staticClasses={`xl:visible xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:shadow-none xl:transition-none ${
        schemaPanel ? '' : 'xl:hidden'
      }`}
      backdropHiddenClass="xl:hidden"
    >
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <h2 className="section-label mr-auto">Database schema</h2>
        <button
          type="button"
          className="btn-icon h-6 w-6 xl:hidden"
          onClick={close}
          aria-label="Close schema"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon hidden h-6 w-6 xl:inline-flex"
          onClick={toggleSchema}
          aria-label="Hide schema panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <SchemaBody />
    </Drawer>
  );
}
