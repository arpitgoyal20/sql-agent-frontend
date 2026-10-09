// One column under an expanded table: PK key / FK link icon (tooltip "→ Customers.CustomerID"),
// name, type, doc on hover. Double-click (or Enter) inserts the name at the editor cursor.

import { KeyRound, Link2 } from 'lucide-react';

import type { TableColumn } from '../../api/types';

interface Props {
  table: string;
  column: TableColumn;
  onInsert: (name: string) => void;
}

function fkLabel(column: TableColumn): string | null {
  return column.fk ? `→ ${column.fk.table}.${column.fk.column}` : null;
}

export default function ColumnNode({ table, column, onInsert }: Props) {
  const fk = fkLabel(column);
  const tooltip = [
    `${table}.${column.name} · ${column.type}${column.pk ? ' · primary key' : ''}`,
    fk ? `Foreign key ${fk}` : null,
    column.nullable ? 'Nullable' : null,
    column.doc || null,
    'Double-click to insert into the editor',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <li>
      <button
        type="button"
        onDoubleClick={() => onInsert(column.name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onInsert(column.name);
          }
        }}
        title={tooltip}
        aria-label={`Column ${column.name}, ${column.type}${column.pk ? ', primary key' : ''}${
          fk ? `, foreign key ${fk.replace('→ ', 'to ')}` : ''
        }. Press Enter or double-click to insert into the editor.`}
        className="flex w-full items-center gap-1.5 rounded py-[3px] pl-8 pr-2 text-left text-[12.5px] hover:bg-elevated/70"
      >
        <span className="flex w-3.5 shrink-0 justify-center">
          {column.pk ? (
            <KeyRound className="h-3 w-3 text-warning" aria-hidden="true" data-testid="pk-icon" />
          ) : fk ? (
            <span title={fk} className="inline-flex">
              <Link2 className="h-3 w-3 text-accent-fg" aria-hidden="true" data-testid="fk-icon" />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-fg/90">{column.name}</span>
        <span className="shrink-0 font-mono text-2xs uppercase text-muted">{column.type}</span>
      </button>
    </li>
  );
}
