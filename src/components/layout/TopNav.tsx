// Top navigation: logo, database menu, connection status, ⌘K search, settings, avatar.

import { Menu, Search, User } from 'lucide-react';

import { useUi } from '../../context/UiContext';
import Logo from '../common/Logo';
import DatabaseMenu from './DatabaseMenu';
import SettingsMenu from './SettingsMenu';
import { useHealth } from './useHealth';

function Status() {
  const health = useHealth();
  const text = health === 'online' ? 'Connected' : health === 'offline' ? 'Offline' : 'Connecting…';
  const dot =
    health === 'online' ? 'bg-success' : health === 'offline' ? 'bg-danger' : 'bg-warning';
  return (
    <span
      role="status"
      aria-label={`Backend ${text.toLowerCase()}`}
      title={health === 'offline' ? 'The backend is not responding' : undefined}
      className={`flex items-center gap-1.5 text-xs ${health === 'offline' ? 'text-danger' : 'text-muted'}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <span className="hidden sm:inline">{text}</span>
    </span>
  );
}

export default function TopNav() {
  const { setThreadsDrawer, setPaletteOpen } = useUi();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
      <button
        type="button"
        className="btn-icon md:hidden"
        onClick={() => setThreadsDrawer(true)}
        aria-label="Open threads"
        aria-controls="threads-sidebar"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Logo className="h-6 w-6" />
        <h1 className="hidden text-[15px] font-semibold tracking-tight min-[420px]:block">
          SQL Agent
        </h1>
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <DatabaseMenu />
      </div>
      <Status />
      <button
        type="button"
        className="btn-ghost px-2"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search threads (⌘K)"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <kbd className="hidden rounded border border-line px-1 font-sans text-2xs text-muted lg:inline">
          ⌘K
        </kbd>
      </button>
      <SettingsMenu />
      <span
        role="img"
        aria-label="Guest user (no sign-in required)"
        title="Guest — no sign-in required"
        className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-muted sm:flex"
      >
        <User className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </header>
  );
}
