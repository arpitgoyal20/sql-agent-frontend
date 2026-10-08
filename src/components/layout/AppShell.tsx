// Desktop: Threads | Chat | Schema. Tablet (< 1280 px): Threads | Chat, schema in a drawer.
// Mobile (< 768 px): Chat only, with thread and schema drawers.

import ChatWorkspace from '../chat/ChatWorkspace';
import SchemaPanel from '../schema/SchemaPanel';
import ThreadSidebar from '../sidebar/ThreadSidebar';
import CommandPalette from './CommandPalette';
import TopNav from './TopNav';

export default function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ThreadSidebar />
        <ChatWorkspace />
        <SchemaPanel />
      </div>
      <CommandPalette />
    </div>
  );
}
