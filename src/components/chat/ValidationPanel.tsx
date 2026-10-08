// QUERY VALIDATION checklist from sql.validation (UI_SPEC §10). Hidden when the backend sent none.

import { AlertTriangle, Check, Minus, X } from 'lucide-react';

import type { ValidationCheck } from '../../api/types';

const ICON = {
  pass: <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
  fail: <X className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
  skip: <Minus className="h-3.5 w-3.5 text-muted" aria-hidden="true" />,
};

const STATUS = { pass: 'passed', warn: 'warning', fail: 'failed', skip: 'skipped' };

export default function ValidationPanel({ checks }: { checks: ValidationCheck[] }) {
  if (!checks.length) return null;
  return (
    <section aria-label="Query validation" className="px-3 py-2.5">
      <h4 className="section-label mb-1.5">Query validation</h4>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.check} className="min-w-0 text-sm">
            <span className="flex items-center gap-2">
              {ICON[c.status] ?? ICON.pass}
              <span className={c.status === 'skip' ? 'text-muted' : ''}>{c.label}</span>
              <span className="sr-only">({STATUS[c.status] ?? c.status})</span>
            </span>
            {c.detail && (c.status === 'warn' || c.status === 'fail') && (
              <span
                className={`ml-[22px] block break-words text-xs ${
                  c.status === 'fail' ? 'text-danger' : 'text-warning'
                }`}
              >
                {c.detail}
              </span>
            )}
            {c.detail && c.status === 'skip' && (
              <span className="ml-[22px] block text-xs text-muted">{c.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
