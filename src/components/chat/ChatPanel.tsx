// Right column: AI assistant. Header with the thread switcher, + New chat and collapse; the
// waking-up banner; the conversation; the composer.

import { CloudSun, PanelRightClose, Plus, X } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import Composer from './Composer';
import MessageList from './MessageList';
import ThreadSwitcher from './ThreadSwitcher';

function WakingBanner() {
  const { showWakingBanner, dismissWakingBanner } = useChat();
  if (!showWakingBanner) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-xs"
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

export default function ChatPanel() {
  const { newChat } = useChat();
  const { desktop, setChatOpen } = useUi();
  return (
    <aside aria-label="AI assistant" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-1.5">
        <ThreadSwitcher />
        <button
          type="button"
          className="btn-ghost h-7 px-2"
          onClick={newChat}
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden min-[400px]:inline">New</span>
        </button>
        {desktop && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => setChatOpen(false)}
            aria-label="Collapse chat panel"
            title="Collapse chat"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </header>
      <WakingBanner />
      <MessageList />
      <Composer />
    </aside>
  );
}
