// Generated SQL card (UI_SPEC §9–§11): header with "✓ Valid", highlighted SQL with line numbers,
// Copy / Run Query / Optimize / Explain / Save, warnings, QUERY VALIDATION and Query Inspector.
// Optimize turns show Original vs Optimized side by side (stacked on mobile). On phones the SQL
// is clipped with a button that opens it full screen.

import {
  AlertTriangle,
  Check,
  Code2,
  Loader2,
  Maximize2,
  MessageSquareText,
  Play,
  ScanSearch,
  Star,
  Wand2,
  Zap,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import type { SqlEvent } from '../../api/types';
import { DIALECT_LABELS } from '../../utils/format';
import CodeBlock from '../common/CodeBlock';
import CopyButton from '../common/CopyButton';
import Modal from '../common/Modal';
import QueryInspector from './QueryInspector';
import ValidationPanel from './ValidationPanel';

export const RUN_SQLITE_ONLY = 'Queries run on the SQLite demo database only';

interface Props {
  sql: SqlEvent;
  /** DOM id so Query History can scroll to the card. */
  id?: string;
  title?: string;
  highlighted?: boolean;
  running?: boolean;
  /** When set, Run Query is disabled with this reason as its tooltip. */
  runDisabledReason?: string | null;
  /** Disables actions that send a message (a turn is streaming). */
  busy?: boolean;
  /** Show the user's SQL next to this one (optimize). */
  original?: string | null;
  onRun?: () => void;
  onOptimize?: () => void;
  onExplain?: () => void;
  onSave?: () => Promise<boolean>;
  onApplyFix?: () => void;
}

function ActionButton({
  label,
  aria,
  icon,
  onClick,
  disabled,
  title,
  primary,
}: {
  label: string;
  aria: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? 'btn-primary' : 'btn-ghost'}
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      title={title ?? aria}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function SqlCard({
  sql,
  id,
  title = 'Generated SQL',
  highlighted,
  running,
  runDisabledReason,
  busy,
  original,
  onRun,
  onOptimize,
  onExplain,
  onSave,
  onApplyFix,
}: Props) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const validation = sql.validation ?? [];
  const valid = validation.length > 0 && validation.every((v) => v.status !== 'fail');
  const lineCount = sql.sql.split('\n').length;
  const compare = !!original && original.trim() !== sql.sql.trim();
  const icon = 'h-3.5 w-3.5';

  const save = async () => {
    if (!onSave || saveState !== 'idle') return;
    setSaveState('saving');
    setSaveState((await onSave()) ? 'saved' : 'idle');
  };

  return (
    <section
      id={id}
      aria-label={title}
      className={`card min-w-0 overflow-hidden transition-shadow duration-300 ${
        highlighted ? 'ring-2 ring-accent' : ''
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-3 py-2">
        <Code2 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {valid && (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Valid
          </span>
        )}
        <span className="ml-auto rounded border border-line px-1.5 text-2xs text-muted">
          {DIALECT_LABELS[sql.dialect] ?? sql.dialect}
        </span>
      </header>

      {compare ? (
        <div className="grid min-w-0 md:grid-cols-2">
          <div className="min-w-0 border-b border-line md:border-b-0 md:border-r">
            <p className="section-label px-3 pt-2">Original</p>
            <CodeBlock code={original!} label="Original SQL code" className="max-h-[320px]" />
          </div>
          <div className="min-w-0">
            <p className="section-label px-3 pt-2">Optimized</p>
            <CodeBlock code={sql.sql} label="Optimized SQL code" className="max-h-[320px]" />
          </div>
        </div>
      ) : (
        <div className="relative bg-bg/40">
          <CodeBlock
            code={sql.sql}
            label={`${title} code`}
            className={lineCount > 8 ? 'max-h-[184px] md:max-h-none' : ''}
          />
          {lineCount > 8 && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface md:hidden"
              aria-hidden="true"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-0.5 border-t border-line px-1.5 py-1">
        <CopyButton text={sql.sql} label="Copy" ariaLabel="Copy SQL" />
        {onApplyFix && (
          <ActionButton
            label="Apply Fix"
            aria="Apply fix: put the corrected SQL in the composer"
            icon={<Wand2 className={icon} aria-hidden="true" />}
            onClick={onApplyFix}
          />
        )}
        {onRun && (
          <ActionButton
            label={running ? 'Running…' : 'Run Query'}
            aria="Run query"
            title={runDisabledReason ?? 'Run query'}
            icon={
              running ? (
                <Loader2 className={`${icon} animate-spin`} aria-hidden="true" />
              ) : (
                <Play className={icon} aria-hidden="true" />
              )
            }
            onClick={onRun}
            disabled={running || !!runDisabledReason}
          />
        )}
        {onOptimize && (
          <ActionButton
            label="Optimize"
            aria="Optimize this query"
            icon={<Zap className={icon} aria-hidden="true" />}
            onClick={onOptimize}
            disabled={busy}
          />
        )}
        {onExplain && (
          <ActionButton
            label="Explain"
            aria="Explain this query"
            icon={<MessageSquareText className={icon} aria-hidden="true" />}
            onClick={onExplain}
            disabled={busy}
          />
        )}
        {onSave && (
          <ActionButton
            label={saveState === 'saved' ? 'Saved' : 'Save'}
            aria={saveState === 'saved' ? 'Saved to Saved Queries' : 'Save query'}
            icon={
              <Star
                className={`${icon} ${saveState === 'saved' ? 'fill-warning text-warning' : ''}`}
                aria-hidden="true"
              />
            }
            onClick={save}
            disabled={saveState !== 'idle'}
          />
        )}
        <span className="ml-auto flex items-center">
          {sql.inspection && (
            <ActionButton
              label="Query Inspector"
              aria="Open Query Inspector"
              icon={<ScanSearch className={icon} aria-hidden="true" />}
              onClick={() => setInspectorOpen(true)}
            />
          )}
          <button
            type="button"
            className="btn-icon md:hidden"
            onClick={() => setFullscreen(true)}
            aria-label="Open SQL full screen"
          >
            <Maximize2 className={icon} aria-hidden="true" />
          </button>
        </span>
      </div>

      {sql.warnings.length > 0 && (
        <ul aria-label="Warnings" className="space-y-1 border-t border-line px-3 py-2">
          {sql.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{w}</span>
            </li>
          ))}
        </ul>
      )}

      {validation.length > 0 && (
        <div className="border-t border-line">
          <ValidationPanel checks={validation} />
        </div>
      )}

      {sql.inspection && (
        <QueryInspector
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          inspection={sql.inspection}
        />
      )}
      <Modal open={fullscreen} onClose={() => setFullscreen(false)} title={title} size="full">
        <div className="flex items-center gap-1 border-b border-line px-2 py-1">
          <CopyButton text={sql.sql} label="Copy" ariaLabel="Copy SQL" />
        </div>
        <CodeBlock code={sql.sql} label={`${title} code`} />
      </Modal>
    </section>
  );
}
