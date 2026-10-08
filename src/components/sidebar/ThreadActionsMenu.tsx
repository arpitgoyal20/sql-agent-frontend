// "⋮" menu shared by sidebar thread rows and the chat header.

import { Copy, History, MoreHorizontal, MoreVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { useDismiss } from '../common/useDismiss';

export interface ThreadActions {
  onRename: () => void;
  onDuplicate: () => void;
  onSave?: () => void;
  onDelete: () => void;
  onToggleHistory?: () => void;
  historyOpen?: boolean;
}

interface Props extends ThreadActions {
  title: string;
  /** Accessible name of the trigger; defaults to "Thread actions: <title>". */
  label?: string;
  disabled?: boolean;
  vertical?: boolean;
  buttonClass?: string;
}

export default function ThreadActionsMenu({
  title,
  label,
  disabled,
  vertical,
  buttonClass = 'btn-icon',
  onRename,
  onDuplicate,
  onSave,
  onDelete,
  onToggleHistory,
  historyOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [root]);
  const Icon = vertical ? MoreVertical : MoreHorizontal;
  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={buttonClass}
        aria-label={label ?? `Thread actions: ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${title}`}
          className="menu absolute right-0 top-full mt-1 w-48"
        >
          {onToggleHistory && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={run(onToggleHistory)}
            >
              <History className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {historyOpen ? 'Hide query history' : 'Query history'}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={disabled}
            onClick={run(onRename)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={disabled}
            onClick={run(onDuplicate)}
          >
            <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            Duplicate
          </button>
          {onSave && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={disabled}
              onClick={run(onSave)}
            >
              <Star className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              Save
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item text-danger"
            disabled={disabled}
            onClick={run(onDelete)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
