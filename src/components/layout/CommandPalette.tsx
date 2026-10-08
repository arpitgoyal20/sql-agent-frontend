// ⌘K search palette: filter threads and saved queries, ↑/↓ to move, Enter to open.

import { FileCode2, MessageSquare, Plus, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { formatRelative } from '../../utils/format';
import Modal from '../common/Modal';

interface Item {
  key: string;
  kind: 'new' | 'thread' | 'saved';
  title: string;
  meta: string;
  run: () => void;
}

export default function CommandPalette() {
  const { paletteOpen, setPaletteOpen, closeDrawers } = useUi();
  const { threads, saved, loadThread, openSaved, newChat } = useChat();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setActive(0);
    }
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (t: string) => !q || t.toLowerCase().includes(q);
    const all: Item[] = [
      ...(q
        ? []
        : [{ key: 'new', kind: 'new' as const, title: 'New thread', meta: '', run: newChat }]),
      ...(threads ?? [])
        .filter((t) => match(t.title))
        .map((t) => ({
          key: `t-${t.thread_id}`,
          kind: 'thread' as const,
          title: t.title || 'Untitled thread',
          meta: formatRelative(t.updated_at),
          run: () => loadThread(t.thread_id),
        })),
      ...(saved ?? [])
        .filter((s) => match(`${s.title} ${s.prompt}`))
        .map((s) => ({
          key: `s-${s.id}`,
          kind: 'saved' as const,
          title: s.title,
          meta: 'Saved query',
          run: () => openSaved(s.id),
        })),
    ];
    return all;
  }, [query, threads, saved, loadThread, openSaved, newChat]);

  const close = () => setPaletteOpen(false);
  const choose = (item: Item | undefined) => {
    if (!item) return;
    close();
    closeDrawers();
    item.run();
  };
  const clamped = Math.min(active, Math.max(items.length - 1, 0));

  return (
    <Modal open={paletteOpen} onClose={close} title="Search threads" bare>
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          data-autofocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items[clamped] ? `${listId}-${clamped}` : undefined}
          aria-label="Search threads and saved queries"
          placeholder="Search threads and saved queries…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(items[clamped]);
            }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-fg placeholder:text-muted focus:outline-none"
        />
        <kbd className="hidden rounded border border-line px-1 text-2xs text-muted sm:inline">
          Esc
        </kbd>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-[50vh] overflow-y-auto p-1"
      >
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>
        )}
        {items.map((item, i) => {
          const Icon =
            item.kind === 'new' ? Plus : item.kind === 'saved' ? FileCode2 : MessageSquare;
          return (
            <li
              key={item.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === clamped}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm ${
                i === clamped ? 'bg-elevated' : ''
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.meta && <span className="shrink-0 text-2xs text-muted">{item.meta}</span>}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
