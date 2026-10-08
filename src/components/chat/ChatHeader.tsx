// Thread title and ⋮ menu (rename / duplicate / delete / query history) above the conversation.

import { useState } from 'react';

import { useChat } from '../../context/ChatContext';
import InlineRename from '../sidebar/InlineRename';
import ThreadActionsMenu from '../sidebar/ThreadActionsMenu';

interface Props {
  historyOpen: boolean;
  onToggleHistory: () => void;
}

export default function ChatHeader({ historyOpen, onToggleHistory }: Props) {
  const {
    threadId,
    currentTitle,
    threadPersisted,
    renameThread,
    duplicateThread,
    removeThread,
    saveThread,
  } = useChat();
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view');

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-6">
      {mode === 'rename' ? (
        <InlineRename
          initial={currentTitle}
          className="max-w-md"
          onCancel={() => setMode('view')}
          onSubmit={(t) => {
            setMode('view');
            void renameThread(threadId, t);
          }}
        />
      ) : (
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={currentTitle}>
          {currentTitle}
        </h2>
      )}
      {mode === 'confirm' ? (
        <div className="ml-auto flex items-center gap-1">
          <span className="text-sm text-muted">Delete this thread?</span>
          <button
            type="button"
            className="btn h-6 bg-danger px-2 text-xs text-white hover:bg-danger/90"
            onClick={async () => {
              const ok = await removeThread(threadId);
              if (!ok) setMode('view');
            }}
            aria-label={`Confirm delete of thread: ${currentTitle}`}
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
        </div>
      ) : (
        <div className="ml-auto">
          <ThreadActionsMenu
            title={currentTitle}
            label="Thread options"
            vertical
            disabled={!threadPersisted}
            historyOpen={historyOpen}
            onToggleHistory={onToggleHistory}
            onRename={() => setMode('rename')}
            onDuplicate={() => void duplicateThread(threadId)}
            onSave={() => void saveThread(threadId)}
            onDelete={() => setMode('confirm')}
          />
        </div>
      )}
    </div>
  );
}
