// One sidebar thread: title + time, active marker, ⋮ menu, inline rename and delete confirm.

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';

import type { ThreadSummary } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { formatRelative } from '../../utils/format';
import InlineRename from './InlineRename';
import ThreadActionsMenu from './ThreadActionsMenu';

interface Props {
  thread: ThreadSummary;
  current: boolean;
  onNavigate: () => void;
}

export default function ThreadItem({ thread, current, onNavigate }: Props) {
  const { loadThread, renameThread, duplicateThread, removeThread, saveThread } = useChat();
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view');
  const [busy, setBusy] = useState(false);
  const title = thread.title || 'Untitled thread';

  if (mode === 'rename') {
    return (
      <li className="px-1 py-0.5">
        <InlineRename
          initial={title}
          onCancel={() => setMode('view')}
          onSubmit={(t) => {
            setMode('view');
            void renameThread(thread.thread_id, t);
          }}
        />
      </li>
    );
  }

  if (mode === 'confirm') {
    return (
      <li className="flex items-center gap-1 rounded-md bg-elevated py-1 pl-2.5 pr-1">
        <span className="mr-auto truncate text-sm">Delete thread?</span>
        <button
          type="button"
          className="btn h-6 bg-danger px-2 text-xs text-white hover:bg-danger/90"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await removeThread(thread.thread_id);
            setBusy(false);
            if (!ok) setMode('view');
          }}
          aria-label={`Confirm delete of thread: ${title}`}
        >
          Delete
        </button>
        <button
          type="button"
          className="btn-ghost h-6 px-2 text-xs"
          onClick={() => setMode('view')}
          aria-label="Cancel delete"
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li
      className={`group relative flex items-center rounded-md transition-colors ${
        current ? 'bg-elevated' : 'hover:bg-elevated/60'
      }`}
    >
      {current && (
        <span
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={() => {
          if (!current) loadThread(thread.thread_id);
          onNavigate();
        }}
        aria-current={current ? 'true' : undefined}
        aria-label={`Open thread: ${title}`}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-1.5 pl-2.5 pr-1 text-left"
      >
        <MessageSquare
          className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${current ? 'text-accent-fg' : 'text-muted'}`}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span
            className={`block truncate text-sm ${current ? 'font-medium text-fg' : 'text-fg/90'}`}
          >
            {title}
          </span>
          <span className="block text-2xs text-muted">{formatRelative(thread.updated_at)}</span>
        </span>
      </button>
      <div className="shrink-0 pr-1 opacity-100 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0">
        <ThreadActionsMenu
          title={title}
          buttonClass="btn-icon h-6 w-6"
          onRename={() => setMode('rename')}
          onDuplicate={() => {
            void duplicateThread(thread.thread_id).then((ok) => ok && onNavigate());
          }}
          onSave={() => void saveThread(thread.thread_id)}
          onDelete={() => setMode('confirm')}
        />
      </div>
    </li>
  );
}
