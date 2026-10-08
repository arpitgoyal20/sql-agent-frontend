// Layout state: thread drawer (< 768 px), schema panel (≥ 1280 px) or drawer (below), and the
// ⌘K search palette.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** Matches Tailwind's `xl` breakpoint, where the schema is a column instead of a drawer. */
export const SCHEMA_COLUMN_QUERY = '(min-width: 1280px)';

interface UiValue {
  threadsDrawer: boolean;
  setThreadsDrawer: (open: boolean) => void;
  /** Desktop schema column visibility. */
  schemaPanel: boolean;
  /** Schema drawer on tablet / mobile. */
  schemaDrawer: boolean;
  setSchemaDrawer: (open: boolean) => void;
  /** Composer "Schema" button: toggles the column on desktop, the drawer elsewhere. */
  toggleSchema: () => void;
  schemaVisible: boolean;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  closeDrawers: () => void;
}

const UiContext = createContext<UiValue | null>(null);

function isDesktop(): boolean {
  return window.matchMedia?.(SCHEMA_COLUMN_QUERY).matches ?? true;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [threadsDrawer, setThreadsDrawer] = useState(false);
  const [schemaPanel, setSchemaPanel] = useState(true);
  const [schemaDrawer, setSchemaDrawer] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [desktop, setDesktop] = useState(isDesktop);

  useEffect(() => {
    const media = window.matchMedia?.(SCHEMA_COLUMN_QUERY);
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => {
      setDesktop(e.matches);
      if (e.matches) setSchemaDrawer(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // ⌘K / Ctrl+K opens the search palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSchema = useCallback(() => {
    if (isDesktop()) setSchemaPanel((v) => !v);
    else setSchemaDrawer((v) => !v);
  }, []);

  const closeDrawers = useCallback(() => {
    setThreadsDrawer(false);
    setSchemaDrawer(false);
  }, []);

  return (
    <UiContext.Provider
      value={{
        threadsDrawer,
        setThreadsDrawer,
        schemaPanel,
        schemaDrawer,
        setSchemaDrawer,
        toggleSchema,
        schemaVisible: desktop ? schemaPanel : schemaDrawer,
        paletteOpen,
        setPaletteOpen,
        closeDrawers,
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
