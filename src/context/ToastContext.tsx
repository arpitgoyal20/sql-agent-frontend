// Small transient notices ("Saved to Saved Queries", "Could not rename") in a polite live region.

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error';

interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

type Notify = (text: string, tone?: Tone) => void;

const ToastContext = createContext<Notify>(() => {});

const TOAST_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback<Notify>((text, tone = 'success') => {
    const id = ++nextId.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            className="toast-in flex max-w-full items-center gap-2 rounded-md border border-line bg-elevated px-3 py-2 text-[13px] text-fg shadow-lg"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): Notify {
  return useContext(ToastContext);
}
