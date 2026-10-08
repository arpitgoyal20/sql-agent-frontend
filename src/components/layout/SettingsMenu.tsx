// Settings popover: theme and "Run queries automatically" (forced off outside SQLite).

import { Settings } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { useDismiss } from '../common/useDismiss';
import Switch from '../common/Switch';

export const SQLITE_ONLY_TEXT =
  'Queries only run on the SQLite demo database. Choose Demo Database or SQLite to run them.';

export default function SettingsMenu() {
  const { theme, setTheme } = useTheme();
  const { dialect, setAutoRun, autoRun, executionEnabled } = useChat();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [root]);
  const hintId = useId();
  const canRun = dialect === 'sqlite';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-ghost px-2"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">Settings</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="menu absolute right-0 top-full mt-1.5 w-72 space-y-1 p-2"
        >
          <p className="section-label px-1 pb-1">Settings</p>
          <Switch
            label="Dark mode"
            checked={theme === 'dark'}
            onChange={(on) => setTheme(on ? 'dark' : 'light')}
          />
          <Switch
            label="Run queries automatically"
            checked={executionEnabled}
            disabled={!canRun}
            describedBy={canRun ? undefined : hintId}
            onChange={() => setAutoRun(!autoRun)}
          />
          {!canRun && (
            <p id={hintId} className="px-1 pb-1 text-xs text-muted">
              {SQLITE_ONLY_TEXT}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
