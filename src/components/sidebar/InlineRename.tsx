// Inline title editor: Enter saves, Escape cancels, blur saves.

import { useEffect, useRef, useState } from 'react';

interface Props {
  initial: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
  className?: string;
}

export default function InlineRename({ initial, onSubmit, onCancel, className = '' }: Props) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const clean = value.trim();
    if (save && clean && clean !== initial) onSubmit(clean);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      value={value}
      aria-label="Thread title"
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      className={`input h-7 ${className}`}
    />
  );
}
