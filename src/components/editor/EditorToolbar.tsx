// Editor toolbar: ▶ Run (⌘/Ctrl+Enter), Format (sql-formatter, selected dialect), Explain and
// Optimize (routed through the chat), Copy and Download .sql.

import { Loader2, MessageSquareText, Play, WandSparkles, Zap } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { explainMessage, optimizeMessage } from '../../context/chatModel';
import { useToast } from '../../context/ToastContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import { DIALECT_LABELS } from '../../utils/format';
import CopyButton from '../common/CopyButton';
import DownloadButton from '../common/DownloadButton';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const RUN_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+↵';

export default function EditorToolbar() {
  const { editorSql, setEditorText, runEditor, results, dialect } = useWorkbench();
  const { send, streaming } = useChat();
  const notify = useToast();
  const empty = !editorSql.trim();
  const icon = 'h-3.5 w-3.5';

  const format = async () => {
    try {
      // sql-formatter is only needed here (and in mock mode), so it loads on first use.
      const { formatSql } = await import('../../utils/sqlFormat');
      setEditorText(formatSql(editorSql, dialect));
    } catch {
      notify(`Couldn't format this as ${DIALECT_LABELS[dialect]} SQL.`, 'error');
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="SQL editor actions"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-surface px-1.5 py-1"
    >
      <button
        type="button"
        className="btn-primary mr-1"
        onClick={runEditor}
        disabled={empty || results.running}
        aria-label={`Run query (${RUN_SHORTCUT}); runs the selection if text is selected`}
        title={`Run (${RUN_SHORTCUT}) — runs the selection if any`}
        aria-keyshortcuts="Meta+Enter Control+Enter"
      >
        {results.running ? (
          <Loader2 className={`${icon} animate-spin`} aria-hidden="true" />
        ) : (
          <Play className={icon} aria-hidden="true" />
        )}
        Run
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => void format()}
        disabled={empty}
        aria-label={`Format SQL (${DIALECT_LABELS[dialect]})`}
        title={`Format as ${DIALECT_LABELS[dialect]}`}
      >
        <WandSparkles className={icon} aria-hidden="true" />
        Format
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => send(explainMessage(editorSql))}
        disabled={empty || streaming}
        aria-label="Explain this query with the assistant"
        title="Explain this query (asks the assistant)"
      >
        <MessageSquareText className={icon} aria-hidden="true" />
        Explain
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => send(optimizeMessage(editorSql))}
        disabled={empty || streaming}
        aria-label="Optimize this query with the assistant"
        title="Optimize this query (asks the assistant)"
      >
        <Zap className={icon} aria-hidden="true" />
        Optimize
      </button>
      <span className="ml-auto flex items-center">
        <CopyButton
          text={() => editorSql}
          label="Copy"
          ariaLabel="Copy SQL"
          labelClassName="hidden sm:inline"
        />
        <DownloadButton
          filename="query.sql"
          getContent={() => `${editorSql.trimEnd()}\n`}
          mime="application/sql"
          label=".sql"
          ariaLabel="Download SQL as query.sql"
          labelClassName="hidden sm:inline"
        />
      </span>
    </div>
  );
}
