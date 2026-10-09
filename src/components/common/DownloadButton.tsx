// Button that saves generated text as a file.

import { Download } from 'lucide-react';

import { downloadText } from '../../utils/download';

interface Props {
  filename: string;
  /** Called on click so large payloads are only built when needed. */
  getContent: () => string;
  mime?: string;
  label: string;
  ariaLabel: string;
  /** Extra classes for the visible label (e.g. hide it on phones). */
  labelClassName?: string;
}

export default function DownloadButton({
  filename,
  getContent,
  mime,
  label,
  ariaLabel,
  labelClassName,
}: Props) {
  return (
    <button
      type="button"
      className="btn-ghost"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={() => downloadText(filename, getContent(), mime)}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
