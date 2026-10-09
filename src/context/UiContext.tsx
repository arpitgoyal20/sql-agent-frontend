// Layout state: desktop vs mobile, the mobile bottom tab, whether the chat column is open
// (persisted), and the thread switcher menu (⌘K opens it).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** Desktop three-column layout from Tailwind's `lg` breakpoint (CHANGES-v2.md §1). */
export const DESKTOP_QUERY = '(min-width: 1024px)';
export const CHAT_OPEN_STORAGE_KEY = 'sqlagent.chatOpen';

export type MobileTab = 'tables' | 'editor' | 'results' | 'chat';

interface UiValue {
  desktop: boolean;
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  /** Desktop: chat column visible (otherwise a floating "Ask AI" button). */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** Bring the chat into view: expand the column on desktop, switch tab on mobile. */
  showChat: () => void;
  /** Mobile only: switch to a tab (no-op on desktop where everything is visible). */
  showOnMobile: (tab: MobileTab) => void;
  threadMenuOpen: boolean;
  setThreadMenuOpen: (open: boolean) => void;
}

const UiContext = createContext<UiValue | null>(null);

function matches(query: string): boolean {
  return window.matchMedia?.(query).matches ?? true;
}

function readChatOpen(): boolean {
  try {
    return localStorage.getItem(CHAT_OPEN_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(() => matches(DESKTOP_QUERY));
  const [mobileTab, setMobileTab] = useState<MobileTab>('tables');
  const [chatOpen, setChatOpenState] = useState(readChatOpen);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY);
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatOpenState(open);
    try {
      localStorage.setItem(CHAT_OPEN_STORAGE_KEY, String(open));
    } catch {
      // Storage unavailable; the choice just won't persist.
    }
  }, []);

  const showChat = useCallback(() => {
    if (matches(DESKTOP_QUERY)) setChatOpen(true);
    else setMobileTab('chat');
  }, [setChatOpen]);

  const showOnMobile = useCallback((tab: MobileTab) => {
    if (!matches(DESKTOP_QUERY)) setMobileTab(tab);
  }, []);

  // ⌘K / Ctrl+K opens the thread switcher (with its search box) from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        showChat();
        setThreadMenuOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showChat]);

  return (
    <UiContext.Provider
      value={{
        desktop,
        mobileTab,
        setMobileTab,
        chatOpen,
        setChatOpen,
        showChat,
        showOnMobile,
        threadMenuOpen,
        setThreadMenuOpen,
      }}
    >
      {children}
    </UiContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUi(): UiValue {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi must be used inside <UiProvider>');
  return value;
}
