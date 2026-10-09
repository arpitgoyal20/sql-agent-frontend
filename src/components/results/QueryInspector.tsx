// Query Inspector modal (UI_SPEC §11) from sql.inspection.

import { Check, X } from 'lucide-react';

import type { QueryInspection } from '../../api/types';
import Modal from '../common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  inspection: QueryInspection;
}

function Row({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1 border-b border-line px-4 py-2.5 last:border-0 sm:grid-cols-[120px_1fr]">
      <dt className="section-label pt-0.5">{label}</dt>
      <dd className="min-w-0">
        {items.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
              <li
                key={i}
                className="max-w-full break-all rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[12px]"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted">None</span>
        )}
      </dd>
    </div>
  );
}

function Safety({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <X className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
      )}
      {label}
      <span className="sr-only">{ok ? '(yes)' : '(no)'}</span>
    </li>
  );
}

export default function QueryInspector({ open, onClose, inspection: x }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Query Inspector" size="lg">
      <dl>
        <Row label="Tables" items={x.tables} />
        <Row label="Columns" items={x.columns} />
        {x.joins.length > 0 && <Row label="Joins" items={x.joins} />}
        <Row label="Filters" items={x.filters} />
        <Row label="Aggregations" items={x.aggregations} />
        <Row label="Grouping" items={x.grouping} />
        {x.ordering.length > 0 && <Row label="Ordering" items={x.ordering} />}
        {x.limit !== null && <Row label="Limit" items={[String(x.limit)]} />}
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[120px_1fr]">
          <dt className="section-label pt-0.5">Safety</dt>
          <dd>
            <ul className="space-y-1">
              <Safety ok={x.safety.read_only} label="SELECT only" />
              <Safety ok={x.safety.read_only} label="No destructive operations" />
              <Safety ok={x.safety.single_statement} label="Single statement" />
            </ul>
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
