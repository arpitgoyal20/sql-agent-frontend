// The SQL editor pane body: lazy-loads CodeMirror (its own chunk) and flashes the border when
// the chat replaces the query.

import { Suspense, lazy, useEffect, useState } from 'react';

import { useTheme } from '../../context/ThemeContext';
import { useWorkbench } from '../../context/WorkbenchContext';

const CodeMirrorEditor = lazy(() => import('./CodeMirrorEditor'));

const FLASH_MS = 900;

function EditorFallback() {
  return (
    <div className="h-full bg-bg p-3" role="status" aria-label="Loading editor">
      <div className="space-y-2" aria-hidden="true">
        {[60, 35, 45].map((w) => (
          <div key={w} className="skeleton h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function SqlEditor() {
  const { theme } = useTheme();
  const { editorSql, setEditorSql, runEditor, tables, dialect, registerEditor, flashKey } =
    useWorkbench();
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!flashKey) return;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashKey]);

  return (
    <div
      data-testid="sql-editor"
      data-flashing={flashing || undefined}
      className={`relative min-h-0 flex-1 overflow-hidden border transition-colors duration-300 ${
        flashing ? 'border-accent' : 'border-transparent'
      }`}
    >
      <Suspense fallback={<EditorFallback />}>
        <CodeMirrorEditor
          value={editorSql}
          onChange={setEditorSql}
          onRun={runEditor}
          tables={tables}
          dialect={dialect}
          dark={theme === 'dark'}
          registerApi={registerEditor}
        />
      </Suspense>
    </div>
  );
}
