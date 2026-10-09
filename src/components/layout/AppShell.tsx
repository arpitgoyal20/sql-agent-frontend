// Workbench layout (CHANGES-v2.md §1).
// Desktop (≥ 1024 px): Navigator | Editor over Results | AI assistant, all resizable with sizes
// persisted in localStorage; the chat collapses to a floating "Ask AI" button.
// Mobile (< 1024 px): one section at a time with a bottom tab bar Tables · Editor · Results · Chat.
// Sections stay mounted on mobile so the editor keeps its content and undo history.

import { Code2, Database, MessageSquare, Sparkles, Table2 } from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';

import { useChat } from '../../context/ChatContext';
import { useUi, type MobileTab } from '../../context/UiContext';
import { useWorkbench } from '../../context/WorkbenchContext';
import ChatPanel from '../chat/ChatPanel';
import ErrorBoundary from '../common/ErrorBoundary';
import EditorToolbar from '../editor/EditorToolbar';
import RunSummary from '../editor/RunSummary';
import SqlEditor from '../editor/SqlEditor';
import Navigator from '../navigator/Navigator';
import ResultsArea from '../results/ResultsArea';
import ResizeHandle from './ResizeHandle';
import TopNav from './TopNav';

const LAYOUT_KEYS = {
  columns: 'sqlagent.layout.columns',
  center: 'sqlagent.layout.center',
};

function EditorPane() {
  const { desktop } = useUi();
  return (
    <ErrorBoundary name="SQL editor">
      <section aria-label="SQL editor" className="flex h-full min-h-0 flex-col bg-bg">
        <EditorToolbar />
        <SqlEditor />
        {!desktop && <RunSummary />}
      </section>
    </ErrorBoundary>
  );
}

function NavigatorRegion() {
  return (
    <ErrorBoundary name="table navigator">
      <Navigator />
    </ErrorBoundary>
  );
}

function ResultsRegion() {
  return (
    <ErrorBoundary name="results area">
      <ResultsArea />
    </ErrorBoundary>
  );
}

function ChatRegion() {
  return (
    <ErrorBoundary name="assistant panel">
      <ChatPanel />
    </ErrorBoundary>
  );
}

function DesktopLayout() {
  const { chatOpen, setChatOpen } = useUi();
  return (
    <div className="relative flex min-h-0 flex-1">
      <PanelGroup direction="horizontal" autoSaveId={LAYOUT_KEYS.columns} className="min-h-0">
        <Panel id="navigator" order={1} defaultSize={17} minSize={12} maxSize={35}>
          <NavigatorRegion />
        </Panel>
        <ResizeHandle label="Resize navigator" />
        <Panel id="center" order={2} defaultSize={chatOpen ? 57 : 83} minSize={30}>
          <PanelGroup direction="vertical" autoSaveId={LAYOUT_KEYS.center}>
            <Panel id="editor" order={1} defaultSize={40} minSize={15}>
              <EditorPane />
            </Panel>
            <ResizeHandle label="Resize editor and results" vertical />
            <Panel id="results" order={2} defaultSize={60} minSize={20}>
              <ResultsRegion />
            </Panel>
          </PanelGroup>
        </Panel>
        {chatOpen && (
          <>
            <ResizeHandle label="Resize chat panel" />
            <Panel id="chat" order={3} defaultSize={26} minSize={18} maxSize={45}>
              <ChatRegion />
            </Panel>
          </>
        )}
      </PanelGroup>
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="btn-primary absolute bottom-4 right-4 z-30 h-9 rounded-full px-4 shadow-lg shadow-black/30"
          aria-label="Ask AI: open the assistant panel"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ask AI
        </button>
      )}
    </div>
  );
}

const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof Database }[] = [
  { id: 'tables', label: 'Tables', icon: Database },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'results', label: 'Results', icon: Table2 },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
];

function MobileLayout() {
  const { mobileTab, setMobileTab } = useUi();
  const { results } = useWorkbench();
  const { streaming } = useChat();
  const pane = (tab: MobileTab) => (mobileTab === tab ? 'flex min-h-0 flex-1 flex-col' : 'hidden');

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={pane('tables')}>
          <NavigatorRegion />
        </div>
        <div className={pane('editor')}>
          <EditorPane />
        </div>
        <div className={pane('results')}>
          <ResultsRegion />
        </div>
        <div className={pane('chat')}>
          <ChatRegion />
        </div>
      </div>
      <nav
        aria-label="Workbench sections"
        className="grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = mobileTab === id;
          const busy = (id === 'results' && results.running) || (id === 'chat' && streaming);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`relative flex h-12 flex-col items-center justify-center gap-0.5 text-2xs font-medium transition-colors ${
                active ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {active && (
                <span
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {busy && (
                <span
                  className="absolute right-[calc(50%-14px)] top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function AppShell() {
  const { desktop } = useUi();
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopNav />
      {desktop ? <DesktopLayout /> : <MobileLayout />}
    </div>
  );
}
