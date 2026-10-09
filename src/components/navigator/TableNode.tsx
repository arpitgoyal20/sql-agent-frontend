// One table in the navigator: expand chevron, name, row-count badge and a ⋯ / right-click menu
// (Select top 100, Count rows, Ask AI about this table). A single click previews the table.

import { ChevronDown, ChevronRight, MoreHorizontal, Table2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { TableInfo } from '../../api/types';
import { formatCount } from '../../utils/format';
import { useDismiss } from '../common/useDismiss';

interface Props {
  table: TableInfo;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onCount: () => void;
  onAsk: () => void;
  children?: ReactNode;
}

export default function TableNode({
  table,
  selected,
  expanded,
  onToggle,
  onSelect,
  onCount,
  onAsk,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLLIElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuOpen, close, [root]);

  useEffect(() => {
    if (menuOpen) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  const choose = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <li ref={root} className="relative">
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={`group flex items-center rounded-md pr-1 transition-colors ${
          selected ? 'bg-elevated' : 'hover:bg-elevated/60'
        }`}
      >
        {selected && (
          <span
            className="absolute left-0 top-1 h-5 w-[2px] rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          className="btn-icon h-6 w-6 shrink-0"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${table.name} columns`}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? 'true' : undefined}
          aria-label={`Preview ${table.name} (${formatCount(table.row_count)} rows)`}
          title={`Preview ${table.name}: SELECT * … LIMIT`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 pr-1 text-left text-[13px]"
        >
          <Table2
            className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-accent-fg' : 'text-muted'}`}
            aria-hidden="true"
          />
          <span className={`min-w-0 flex-1 truncate ${selected ? 'font-medium text-fg' : ''}`}>
            {table.name}
          </span>
          <span
            className="shrink-0 rounded border border-line px-1 font-mono text-2xs tabular-nums text-muted"
            data-testid="row-count"
          >
            {formatCount(table.row_count)}
          </span>
        </button>
        <button
          type="button"
          className="btn-icon h-6 w-6 shrink-0 opacity-100 focus:opacity-100 group-hover:opacity-100 lg:opacity-0"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`More actions for ${table.name}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {menuOpen && (
        <div
          ref={menu}
          role="menu"
          aria-label={`${table.name} actions`}
          className="menu absolute right-1 top-full z-40 mt-0.5 w-56"
        >
          <button type="button" role="menuitem" className="menu-item" onClick={choose(onSelect)}>
            Select top 100
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={choose(onCount)}>
            Count rows
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={choose(onAsk)}>
            Ask AI about this table
          </button>
        </div>
      )}
      {expanded && children}
    </li>
  );
}
