// Compact SQL card inside a chat reply: highlighted SQL, "✓ Valid", Load in editor and Copy.

import { ArrowUpLeft, Check, Code2 } from 'lucide-react';

import type { SqlEvent } from '../../api/types';
import { DIALECT_LABELS } from '../../utils/format';
import CopyButton from '../common/CopyButton';
import SqlHighlight from '../common/SqlHighlight';

interface Props {
  sql: SqlEvent;
  title: string;
  onLoad: () => void;
}

export default function ChatSqlCard({ sql, title, onLoad }: Props) {
  const checks = sql.validation ?? [];
  const valid = checks.length > 0 && checks.every((c) => c.status !== 'fail');
  return (
    <section aria-label={title} className="card min-w-0 overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
        <Code2 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <h3 className="text-xs font-semibold">{title}</h3>
        {valid && (
          <span className="flex items-center gap-1 text-2xs font-medium text-success">
            <Check className="h-3 w-3" aria-hidden="true" />
            Valid
          </span>
        )}
        <span className="ml-auto rounded border border-line px-1.5 text-2xs text-muted">
          {DIALECT_LABELS[sql.dialect] ?? sql.dialect}
        </span>
      </header>
      <SqlHighlight code={sql.sql} label={`${title} code`} className="max-h-48 bg-bg/40" />
      <div className="flex items-center gap-0.5 border-t border-line px-1 py-0.5">
        <button
          type="button"
          className="btn-ghost h-6 text-xs"
          onClick={onLoad}
          aria-label="Load this SQL in the editor"
          title="Replace the editor content with this SQL (undo with ⌘/Ctrl+Z)"
        >
          <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Load in editor
        </button>
        <CopyButton
          text={sql.sql}
          label="Copy"
          ariaLabel="Copy SQL"
          className="btn-ghost h-6 text-xs"
        />
      </div>
    </section>
  );
}
