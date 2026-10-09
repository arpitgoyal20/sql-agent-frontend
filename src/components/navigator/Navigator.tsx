// Left column: every table from GET /api/tables with its row count, a filter over tables and
// columns, expandable columns with PK / FK icons. Click previews a table; double-click a column
// inserts it into the editor.

import { RefreshCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import { askAboutTable } from '../../context/chatModel';
import ColumnNode from './ColumnNode';
import TableNode from './TableNode';

export default function Navigator() {
  const {
    tables,
    tablesError,
    reloadTables,
    selectedTable,
    previewTable,
    runInEditor,
    insertIntoEditor,
  } = useWorkbench();
  const { prefill } = useChat();
  const { showOnMobile } = useUi();
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (tables ?? []).flatMap((table) => {
      if (!q) return [{ table, columns: table.columns, forced: false }];
      const nameMatch = table.name.toLowerCase().includes(q);
      const cols = table.columns.filter((c) => c.name.toLowerCase().includes(q));
      if (nameMatch) return [{ table, columns: table.columns, forced: false }];
      return cols.length ? [{ table, columns: cols, forced: true }] : [];
    });
  }, [tables, filter]);

  const toggle = (name: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const insert = (name: string) => {
    insertIntoEditor(name);
    showOnMobile('editor');
  };

  let body;
  if (tablesError && !tables) {
    body = (
      <div className="flex items-start gap-2 px-3 py-2 text-sm">
        <span className="flex-1 text-muted">{tablesError}</span>
        <button
          type="button"
          className="btn-icon"
          onClick={reloadTables}
          aria-label="Reload tables"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  } else if (!tables) {
    body = (
      <div className="space-y-2 px-3 py-2" role="status" aria-label="Loading tables">
        {[70, 55, 80, 60, 75].map((w, i) => (
          <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  } else if (visible.length === 0) {
    body = <p className="px-3 py-2 text-sm text-muted">No tables or columns match “{filter}”.</p>;
  } else {
    body = (
      <ul aria-label="Tables" className="space-y-px px-1.5 pb-3">
        {visible.map(({ table, columns, forced }) => (
          <TableNode
            key={table.name}
            table={table}
            selected={selectedTable === table.name}
            expanded={forced || expanded.has(table.name)}
            onToggle={() => toggle(table.name)}
            onSelect={() => previewTable(table.name)}
            onCount={() => runInEditor(`SELECT COUNT(*) FROM ${table.name};`)}
            onAsk={() => prefill(askAboutTable(table.name))}
          >
            <ul aria-label={`${table.name} columns`} className="pb-1">
              {columns.map((c) => (
                <ColumnNode key={c.name} table={table.name} column={c} onInsert={insert} />
              ))}
            </ul>
          </TableNode>
        ))}
      </ul>
    );
  }

  return (
    <nav aria-label="Database navigator" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <h2 className="section-label mr-auto">Tables</h2>
        {tables && <span className="text-2xs text-muted">{tables.length}</span>}
      </div>
      <div className="relative px-2 pb-2">
        <Search
          className="pointer-events-none absolute left-4 top-[9px] h-3.5 w-3.5 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables and columns…"
          aria-label="Filter tables and columns"
          className="input h-8 pl-7 pr-7"
        />
        {filter && (
          <button
            type="button"
            className="btn-icon absolute right-3 top-[3px] h-6 w-6"
            onClick={() => setFilter('')}
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </nav>
  );
}
