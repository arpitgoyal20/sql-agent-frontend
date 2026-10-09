// Scrollable conversation; sticks to the bottom while new content streams in.

import { useEffect, useRef } from 'react';

import { useChat } from '../../context/ChatContext';
import AgentMessage from './AgentMessage';
import ExampleChips from './ExampleChips';
import UserMessage from './UserMessage';

function LoadingThread() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading chat">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function MessageList() {
  const { messages, streaming, threadLoading, threadError, send } = useChat();
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  let body;
  if (threadLoading) body = <LoadingThread />;
  else if (threadError) {
    body = (
      <p
        role="alert"
        className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-center text-sm"
      >
        {threadError}
      </p>
    );
  } else if (messages.length === 0) {
    body = <ExampleChips onPick={send} disabled={streaming} />;
  } else {
    body = (
      <ol className="flex flex-col gap-4" aria-label="Conversation">
        {messages.map((m) => (
          <li key={m.id} className="min-w-0">
            {m.role === 'user' ? <UserMessage message={m} /> : <AgentMessage turn={m} />}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div
      ref={scroller}
      data-scroller
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3"
    >
      {body}
    </div>
  );
}
