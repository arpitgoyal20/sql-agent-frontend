// Left sidebar: THREADS header, + New Thread, threads grouped by day, Saved Queries.

import { Plus, RefreshCw, X } from 'lucide-react';
import { useCallback } from 'react';

import { useChat } from '../../context/ChatContext';
import { useUi } from '../../context/UiContext';
import { DATE_GROUPS, dateGroup } from '../../utils/format';
import Drawer from '../common/Drawer';
import SavedQueries from './SavedQueries';
import ThreadItem from './ThreadItem';

function ThreadGroups({ onNavigate }: { onNavigate: () => void }) {
  const { threads, threadsError, refreshThreads, threadId, view } = useChat();

  if (threadsError && !threads) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <span className="flex-1 text-muted">{threadsError}</span>
        <button
          type="button"
          className="btn-icon"
          onClick={refreshThreads}
          aria-label="Reload threads"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }
  if (!threads) {
    return (
      <div className="space-y-3 px-3 py-2" aria-label="Loading threads" role="status">
        {[70, 55, 80].map((w) => (
          <div key={w} className="space-y-1.5">
            <div className="skeleton h-3" style={{ width: `${w}%` }} />
            <div className="skeleton h-2 w-1/4" />
          </div>
        ))}
      </div>
    );
  }
  if (threads.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted">No threads yet. Ask a question to start one.</p>
    );
  }

  const now = new Date();
  return (
    <div className="space-y-3">
      {DATE_GROUPS.map((group) => {
        const items = threads.filter((t) => dateGroup(t.updated_at, now) === group);
        if (!items.length) return null;
        return (
          <section key={group} aria-label={group}>
            <h3 className="px-3 pb-1 text-2xs font-medium text-muted">{group}</h3>
            <ul className="space-y-px px-1.5">
              {items.map((t) => (
                <ThreadItem
                  key={t.thread_id}
                  thread={t}
                  current={view.kind === 'thread' && t.thread_id === threadId}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function ThreadSidebar() {
  const { newChat } = useChat();
  const { threadsDrawer, setThreadsDrawer } = useUi();
  const close = useCallback(() => setThreadsDrawer(false), [setThreadsDrawer]);

  return (
    <Drawer
      id="threads-sidebar"
      label="Threads"
      side="left"
      open={threadsDrawer}
      onClose={close}
      widthClass="w-[272px] md:w-[240px] xl:w-[260px]"
      staticClasses="md:visible md:static md:z-auto md:max-w-none md:translate-x-0 md:shadow-none md:transition-none"
      backdropHiddenClass="md:hidden"
    >
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <h2 className="section-label mr-auto">Threads</h2>
        <button
          type="button"
          className="btn-icon h-6 w-6"
          onClick={() => {
            newChat();
            close();
          }}
          aria-label="New thread"
          title="New thread"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon h-6 w-6 md:hidden"
          onClick={close}
          aria-label="Close threads"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          className="btn-secondary h-8 w-full justify-start"
          onClick={() => {
            newChat();
            close();
          }}
          aria-label="Start a new thread"
        >
          <Plus className="h-4 w-4 text-muted" aria-hidden="true" />
          New Thread
        </button>
      </div>
      <nav aria-label="Thread list" className="min-h-0 flex-1 overflow-y-auto pb-3">
        <ThreadGroups onNavigate={close} />
      </nav>
      <SavedQueries onNavigate={close} />
    </Drawer>
  );
}
