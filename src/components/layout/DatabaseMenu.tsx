// "Database: Demo DB ▼" — picks the SQL dialect sent with each request (README → Assumptions).

import { Check, ChevronDown, Plus } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import { DATABASES } from '../../utils/format';
import { useDismiss } from '../common/useDismiss';

export default function DatabaseMenu() {
  const { database, setDatabase } = useChat();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [root]);
  const current = DATABASES.find((d) => d.id === database) ?? DATABASES[0];

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-sm text-fg transition-colors hover:bg-elevated"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Database: ${current.short}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hidden text-muted sm:inline">Database:</span>
        <span className="truncate font-medium">{current.short}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Databases"
          className="menu absolute left-1/2 top-full mt-1.5 w-60 -translate-x-1/2"
        >
          <p className="section-label px-2 pb-1 pt-1.5" aria-hidden="true">
            Databases
          </p>
          {DATABASES.map((d) => {
            const selected = d.id === database;
            return (
              <button
                key={d.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-label={d.label}
                className="menu-item"
                onClick={() => {
                  setDatabase(d.id);
                  setOpen(false);
                }}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    selected ? 'bg-success' : 'border border-muted'
                  }`}
                  aria-hidden="true"
                />
                <span className="flex-1">{d.label}</span>
                {d.id === 'demo' && <span className="text-2xs text-muted">SQLite</span>}
                {selected && <Check className="h-3.5 w-3.5 text-accent-fg" aria-hidden="true" />}
              </button>
            );
          })}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled
            aria-disabled="true"
            aria-label="Connect database (coming soon)"
          >
            <Plus className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="flex-1">Connect database</span>
            <span className="rounded border border-line px-1.5 text-2xs text-muted">
              Coming soon
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
