// Slide-over panel for tablet / mobile. On `staticFrom` and up it renders as a normal column.

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  /** Tailwind classes that turn the drawer into a static column at a breakpoint. */
  staticClasses: string;
  /** Classes for the backdrop that hide it where the column is static. */
  backdropHiddenClass: string;
  widthClass: string;
  children: ReactNode;
}

export default function Drawer({
  id,
  label,
  side,
  open,
  onClose,
  staticClasses,
  backdropHiddenClass,
  widthClass,
  children,
}: Props) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const hidden = side === 'left' ? '-translate-x-full' : 'translate-x-full';
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ${backdropHiddenClass} ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panel}
        id={id}
        aria-label={label}
        className={`fixed inset-y-0 z-40 flex max-w-[88vw] flex-col bg-surface shadow-2xl transition-[transform,visibility] duration-200 ${widthClass} ${
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l'
        } border-line ${open ? 'visible translate-x-0' : `invisible ${hidden}`} ${staticClasses}`}
      >
        {children}
      </aside>
    </>
  );
}
