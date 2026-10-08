// SQL ERROR section for debug turns (UI_SPEC §16): what was wrong with the user's SQL.

import { X } from 'lucide-react';

import CodeBlock from '../common/CodeBlock';

export default function DebugReport({
  issues,
  original,
}: {
  issues: string[];
  original?: string | null;
}) {
  if (!issues.length && !original) return null;
  return (
    <section aria-label="SQL error" className="card min-w-0 overflow-hidden border-danger/40">
      <h4 className="section-label border-b border-line px-3 py-2 !text-danger">SQL error</h4>
      {original && (
        <div className="border-b border-line bg-bg/40">
          <p className="px-3 pt-2 text-xs text-muted">Your query</p>
          <CodeBlock code={original} label="Your SQL" lineNumbers={false} className="pl-3" />
        </div>
      )}
      {issues.length > 0 && (
        <div className="px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted">Problems found</p>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="mt-[3px] h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
                <span className="min-w-0 break-words">{issue}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Suggested fix: the corrected query below. Apply it to edit it in the composer.
          </p>
        </div>
      )}
    </section>
  );
}
