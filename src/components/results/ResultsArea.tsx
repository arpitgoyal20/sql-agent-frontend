// Centre-bottom pane: Results | Explanation | Notes tabs. The Results tab shows the status bar,
// the grid (greyed behind an invalid / error state), the refusal card for destructive SQL, and a
// thin progress bar while a query runs.

import { Table2 } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

import { useChat } from '../../context/ChatContext';
import { useWorkbench, type ResultsTab } from '../../context/WorkbenchContext';
import RefusalCard from '../chat/RefusalCard';
import ExplanationTab from './ExplanationTab';
import NotesTab from './NotesTab';
import ResultsGrid from './ResultsGrid';
import StatusBar from './StatusBar';

const TABS: { id: ResultsTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'explanation', label: 'Explanation' },
  { id: 'notes', label: 'Notes' },
];

function ResultsBody() {
  const { results } = useWorkbench();
  const { send, streaming } = useChat();
  const { status, page, running } = results;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {running && (
        <div
          className="progress-bar absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-accent/20"
          role="progressbar"
          aria-label="Running query"
        />
      )}
      {status === 'refused' ? (
        <div className="overflow-y-auto p-4">
          <div className="mx-auto max-w-xl">
            <RefusalCard
              text={results.message ?? ''}
              reason="destructive"
              onSuggest={send}
              disabled={streaming}
            />
            <p className="mt-2 text-xs text-muted">Nothing was executed.</p>
          </div>
        </div>
      ) : page ? (
        <ResultsGrid page={page} stale={status === 'invalid' || status === 'error'} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Table2 className="h-6 w-6 text-muted/70" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted">
            {running
              ? 'Running query…'
              : 'Click a table to browse it, write a query and press Run, or ask the assistant.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ResultsArea() {
  const { resultsTab, setResultsTab, notesHaveContent } = useWorkbench();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (i + TABS.length - 1) % TABS.length
          : -1;
    if (next < 0) return;
    e.preventDefault();
    setResultsTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-label="Results area" className="flex h-full min-h-0 flex-col bg-bg">
      <div
        role="tablist"
        aria-label="Results views"
        className="flex shrink-0 items-end gap-1 border-b border-line bg-surface px-2"
      >
        {TABS.map((tab, i) => {
          const selected = tab.id === resultsTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`results-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`results-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              aria-label={tab.id === 'notes' && notesHaveContent ? 'Notes (has notes)' : tab.label}
              onClick={() => setResultsTab(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`relative flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[13px] transition-colors ${
                selected
                  ? 'border-accent font-medium text-fg'
                  : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {tab.label}
              {tab.id === 'notes' && notesHaveContent && (
                <span
                  data-testid="notes-dot"
                  className="h-1.5 w-1.5 rounded-full bg-warning"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`results-panel-${resultsTab}`}
        aria-labelledby={`results-tab-${resultsTab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {resultsTab === 'results' ? (
          <>
            <StatusBar />
            <ResultsBody />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {resultsTab === 'explanation' ? <ExplanationTab /> : <NotesTab />}
          </div>
        )}
      </div>
    </section>
  );
}
