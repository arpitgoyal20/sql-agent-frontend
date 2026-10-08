// Copies text to the clipboard and shows "Copied" for 2 s.

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const COPIED_MS = 2000;

interface Props {
  text: string | (() => string);
  /** Visible label; omit for an icon-only button. */
  label?: string;
  ariaLabel: string;
  className?: string;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts without the async clipboard API.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export default function CopyButton({ text, label, ariaLabel, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    try {
      await writeClipboard(typeof text === 'function' ? text() : text);
    } catch {
      return; // Permission denied; leave the label unchanged.
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? 'Copied' : ariaLabel}
      title={copied ? 'Copied' : ariaLabel}
      className={className ?? (label ? 'btn-ghost' : 'btn-icon')}
    >
      <Icon className={`h-3.5 w-3.5 ${copied ? 'text-success' : ''}`} aria-hidden="true" />
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
