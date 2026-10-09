// Notes tab: warnings, issues found, optimisation notes, index suggestions (each copyable),
// removed joins — from the latest chat reply — plus warnings from the last editor run, the
// validation checklist and the Query Inspector.

import { AlertTriangle, Check, ScanSearch, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useWorkbench } from '../../context/WorkbenchContext';
import CopyButton from '../common/CopyButton';
import SqlHighlight from '../common/SqlHighlight';
import QueryInspector from './QueryInspector';
import ValidationPanel from './ValidationPanel';

export const NOTES_EMPTY =
  'Warnings, issues, optimisation notes and index suggestions from the assistant appear here.';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="section-label mb-1.5">{title}</h3>
      {children}
    </section>
  );
}

function Items({ items, tone }: { items: string[]; tone: 'warn' | 'ok' | 'bad' }) {
  const Icon = tone === 'ok' ? Check : tone === 'bad' ? X : AlertTriangle;
  const color = tone === 'ok' ? 'text-success' : tone === 'bad' ? 'text-danger' : 'text-warning';
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Icon className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${color}`} aria-hidden="true" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function NotesTab() {
  const { notesSql: sql, results } = useWorkbench();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const warnings = [...(sql?.warnings ?? []), ...results.warnings];
  // Editor runs report what they executed; otherwise use the latest assistant reply's.
  const executedSql = results.executedSql ?? sql?.executed_sql ?? null;
  const hasAny =
    warnings.length > 0 ||
    !!sql?.issues.length ||
    !!sql?.optimization_notes.length ||
    !!sql?.index_suggestions.length ||
    !!sql?.removed_joins.length;

  if (!sql && !hasAny && !executedSql) {
    return <p className="p-4 text-sm text-muted">{NOTES_EMPTY}</p>;
  }

  return (
    <div className="max-w-4xl space-y-4 p-4">
      {!hasAny && <p className="text-sm text-muted">No warnings or suggestions for this query.</p>}
      {executedSql && (
        <Section title="Executed as (SQLite)">
          <div className="card overflow-hidden">
            <SqlHighlight code={executedSql} label="SQL executed on the SQLite demo database" />
          </div>
          <p className="mt-1 text-xs text-muted">
            Queries in other dialects are translated to SQLite and run on the bundled sample data.
          </p>
        </Section>
      )}
      {warnings.length > 0 && (
        <Section title="Warnings">
          <Items items={warnings} tone="warn" />
        </Section>
      )}
      {sql && sql.issues.length > 0 && (
        <Section title="Issues found">
          <Items items={sql.issues} tone="bad" />
        </Section>
      )}
      {sql && sql.optimization_notes.length > 0 && (
        <Section title="Optimisation notes">
          <Items items={sql.optimization_notes} tone="ok" />
        </Section>
      )}
      {sql && sql.index_suggestions.length > 0 && (
        <Section title="Index suggestions">
          <ul className="space-y-1">
            {sql.index_suggestions.map((stmt, i) => (
              <li
                key={i}
                className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-bg/50 py-0.5 pl-2.5 pr-0.5"
              >
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px]">
                  {stmt}
                </code>
                <CopyButton text={stmt} ariaLabel={`Copy index suggestion ${i + 1}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {sql && sql.removed_joins.length > 0 && (
        <Section title="Removed joins">
          <Items items={sql.removed_joins} tone="ok" />
        </Section>
      )}
      {sql?.original_sql && sql.original_sql.trim() !== sql.sql.trim() && (
        <Section title="Your original query">
          <div className="card overflow-hidden">
            <SqlHighlight code={sql.original_sql} label="Original SQL" />
          </div>
          <p className="mt-1 text-xs text-muted">
            The editor now holds the assistant&apos;s version; press ⌘/Ctrl+Z in the editor to go
            back.
          </p>
        </Section>
      )}
      {sql && (sql.validation?.length || sql.inspection) && (
        <div className="card min-w-0">
          {sql.validation && sql.validation.length > 0 && (
            <ValidationPanel checks={sql.validation} />
          )}
          {sql.inspection && (
            <div className="border-t border-line px-1.5 py-1">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setInspectorOpen(true)}
                aria-label="Open Query Inspector"
              >
                <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
                Query Inspector
              </button>
              <QueryInspector
                open={inspectorOpen}
                onClose={() => setInspectorOpen(false)}
                inspection={sql.inspection}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
