// Close a popover on Escape or on a pointer press outside it.

import { useEffect, type RefObject } from 'react';

export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement>[],
): void {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node;
      if (refs.some((r) => r.current?.contains(target))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // refs are stable objects; listing them would re-subscribe every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
