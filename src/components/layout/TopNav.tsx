// Header: app name · dialect ▾ · Run-queries toggle · connection status · ⌘K · theme toggle.

import { Moon, Search, Sun } from 'lucide-react';
import { useId } from 'react';

import type { Dialect } from '../../api/types';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { useUi } from '../../context/UiContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import { DIALECTS, DIALECT_LABELS } from '../../utils/format';
import Logo from '../common/Logo';
import { useHealth } from './useHealth';

export const RUN_TOGGLE_LABEL = 'Run on demo database (SQLite)';
export const RUN_TOGGLE_TOOLTIP =
  'Queries are translated to SQLite and run on the bundled sample data.';

function Status() {
  const health = useHealth();
  const text = health === 'online' ? 'Connected' : health === 'offline' ? 'Offline' : 'Connecting…';
  const dot =
    health === 'online' ? 'bg-success' : health === 'offline' ? 'bg-danger' : 'bg-warning';
  return (
    <span
      role="status"
      aria-label={`Backend ${text.toLowerCase()}`}
      title={
        health === 'offline' ? 'The backend is not responding' : `Backend ${text.toLowerCase()}`
      }
      className={`flex items-center gap-1.5 text-xs ${health === 'offline' ? 'text-danger' : 'text-muted'}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <span className="hidden xl:inline">{text}</span>
    </span>
  );
}

function RunToggle() {
  const { autoRun, setAutoRun, executionEnabled } = useChat();
  const hint = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={executionEnabled}
      aria-label={RUN_TOGGLE_LABEL}
      aria-describedby={hint}
      title={RUN_TOGGLE_TOOLTIP}
      onClick={() => setAutoRun(!autoRun)}
      className="flex h-7 shrink-0 items-center gap-2 rounded-md px-1.5 text-xs text-muted hover:bg-elevated hover:text-fg"
    >
      <span className="hidden whitespace-nowrap lg:inline">{RUN_TOGGLE_LABEL}</span>
      <span
        className={`relative inline-flex h-[16px] w-7 shrink-0 rounded-full transition-colors ${
          executionEnabled ? 'bg-accent-strong' : 'bg-line'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-[2px] h-3 w-3 rounded-full bg-white shadow transition-transform ${
            executionEnabled ? 'translate-x-[14px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
      <span id={hint} className="sr-only">
        {RUN_TOGGLE_TOOLTIP}
      </span>
    </button>
  );
}

export default function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { dialect, setDialect } = useWorkbench();
  const { showChat, setThreadMenuOpen } = useUi();
  const dialectId = useId();

  return (
    <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2 sm:gap-2 sm:px-3">
      <div className="flex shrink-0 items-center gap-2">
        <Logo className="h-6 w-6" />
        <h1 className="hidden text-[15px] font-semibold tracking-tight min-[480px]:block">
          SQL Agent
        </h1>
        <span className="hidden rounded border border-line px-1.5 text-2xs uppercase tracking-wide text-muted md:inline">
          Workbench
        </span>
      </div>
      <div className="ml-1 flex min-w-0 items-center gap-1.5 sm:ml-3">
        <label htmlFor={dialectId} className="hidden text-xs text-muted sm:inline">
          Dialect
        </label>
        <select
          id={dialectId}
          value={dialect}
          onChange={(e) => setDialect(e.target.value as Dialect)}
          aria-label="SQL dialect"
          className="h-7 min-w-0 rounded-md border border-line bg-bg px-1.5 text-xs text-fg focus:border-accent focus:outline-none"
        >
          {DIALECTS.map((d) => (
            <option key={d} value={d}>
              {DIALECT_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
      <RunToggle />
      <span className="flex-1" />
      <Status />
      <button
        type="button"
        className="btn-ghost px-2"
        onClick={() => {
          showChat();
          setThreadMenuOpen(true);
        }}
        aria-label="Search chats (⌘K)"
        aria-keyshortcuts="Meta+K Control+K"
        title="Search chats (⌘K)"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <kbd className="hidden rounded border border-line px-1 font-sans text-2xs text-muted lg:inline">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        className="btn-icon"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </header>
  );
}
