// Accessible modal dialog: focus moves in and is trapped, Escape / backdrop close, focus returns.

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** `full` covers the viewport (mobile SQL view); `md` is a centred card. */
  size?: 'md' | 'lg' | 'full';
  /** Content placed at the top instead of the default header (e.g. the search palette). */
  bare?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, size = 'md', bare }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]');
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const sizing =
    size === 'full'
      ? 'h-full w-full rounded-none'
      : `max-h-[85vh] w-full rounded-xl ${size === 'lg' ? 'max-w-3xl' : 'max-w-lg'}`;

  return createPortal(
    <div
      className={`fade-in fixed inset-0 z-[60] flex justify-center bg-black/60 ${
        size === 'full' ? '' : 'items-start px-4 pt-[10vh]'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex min-w-0 flex-col overflow-hidden border border-line bg-surface shadow-2xl focus:outline-none ${sizing}`}
      >
        {bare ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <h2 id={titleId} className="mr-auto min-w-0 truncate text-[14px] font-semibold">
              {title}
            </h2>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
