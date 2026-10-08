// The user's message: a simple card labelled "You" (UI_SPEC §7). SQL is shown monospace.

import type { UserMessage as UserMsg } from '../../context/chatModel';
import { looksLikeSql } from '../../utils/format';

export default function UserMessage({ message }: { message: UserMsg }) {
  const sqlish = looksLikeSql(message.content) || message.content.includes('\n');
  return (
    <article
      aria-label="Your message"
      className="rounded-lg border border-line bg-elevated/60 px-3 py-2"
    >
      <p className="section-label mb-0.5">You</p>
      <p
        className={`whitespace-pre-wrap break-words ${
          sqlish ? 'font-mono text-[13px] leading-5' : 'text-[14px] leading-6'
        }`}
      >
        {message.content}
      </p>
    </article>
  );
}
