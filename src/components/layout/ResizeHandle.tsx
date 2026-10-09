// Thin drag handle between panels (keyboard-resizable with the arrow keys when focused).

import { PanelResizeHandle } from 'react-resizable-panels';

export default function ResizeHandle({
  label,
  vertical = false,
}: {
  label: string;
  vertical?: boolean;
}) {
  return (
    <PanelResizeHandle
      aria-label={label}
      title={label}
      className={`group relative shrink-0 bg-line outline-none transition-colors data-[resize-handle-state=drag]:bg-accent data-[resize-handle-state=hover]:bg-accent/70 focus-visible:bg-accent ${
        vertical ? 'h-px w-full' : 'h-full w-px'
      }`}
    >
      {/* Wider invisible hit area. */}
      <span
        className={`absolute ${vertical ? 'inset-x-0 -inset-y-1' : '-inset-x-1 inset-y-0'}`}
        aria-hidden="true"
      />
    </PanelResizeHandle>
  );
}
