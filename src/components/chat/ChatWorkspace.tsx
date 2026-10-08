// Centre column: chat header, optional query history, conversation and composer — or a saved
// query when one is open.

import { CloudSun, X } from 'lucide-react';
import { useState } from 'react';

import { useChat } from '../../context/ChatContext';
import ChatHeader from './ChatHeader';
import Composer from './Composer';
import MessageList from './MessageList';
import QueryHistory from './QueryHistory';
import SavedQueryView from './SavedQueryView';

function WakingBanner() {
  const { showWakingBanner, dismissWakingBanner } = useChat();
  if (!showWakingBanner) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-sm sm:px-6"
    >
      <CloudSun className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        The server may be waking up (free hosting), first reply can take ~30 s
      </p>
      <button
        type="button"
        className="btn-icon h-6 w-6"
        onClick={dismissWakingBanner}
        aria-label="Dismiss notice"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ChatWorkspace() {
  const { view } = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <main aria-label="Conversation" className="flex min-w-0 flex-1 flex-col bg-bg">
      <WakingBanner />
      {view.kind === 'saved' ? (
        <SavedQueryView id={view.id} />
      ) : (
        <>
          <ChatHeader historyOpen={historyOpen} onToggleHistory={() => setHistoryOpen((o) => !o)} />
          {historyOpen && <QueryHistory onClose={() => setHistoryOpen(false)} />}
          <MessageList />
        </>
      )}
      <Composer />
    </main>
  );
}
