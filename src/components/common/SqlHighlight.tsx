// Read-only SQL with light syntax colouring for chat cards. A tiny tokenizer keeps CodeMirror
// out of the chat bubbles; colours are the same CSS variables the editor theme uses.

import { Fragment } from 'react';

const KEYWORDS = new Set(
  `select from where and or not null is in like between group by order having limit offset as on
  join inner left right full outer cross using union all distinct case when then else end asc desc
  exists with recursive true false cast over partition insert update delete drop alter create
  truncate into values set table index`.split(/\s+/),
);

const TOKEN =
  /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w$]*)(?=\s*\()|([A-Za-z_][\w$]*)|([(),;.*=<>!+\-/%|]+)/g;

type Kind = 'comment' | 'string' | 'number' | 'function' | 'keyword' | 'punct' | 'text';

function tokenizeSql(sql: string): { text: string; kind: Kind }[] {
  const out: { text: string; kind: Kind }[] = [];
  let last = 0;
  for (const m of sql.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ text: sql.slice(last, m.index), kind: 'text' });
    const [text, comment, string, number, fn, word] = m;
    let kind: Kind = 'punct';
    if (comment) kind = 'comment';
    else if (string) kind = 'string';
    else if (number) kind = 'number';
    else if (fn) kind = KEYWORDS.has(fn.toLowerCase()) ? 'keyword' : 'function';
    else if (word) kind = KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'text';
    out.push({ text, kind });
    last = m.index! + text.length;
  }
  if (last < sql.length) out.push({ text: sql.slice(last), kind: 'text' });
  return out;
}

const CLASS: Record<Kind, string> = {
  comment: 'italic text-sql-comment',
  string: 'text-sql-string',
  number: 'text-sql-number',
  function: 'text-sql-function',
  keyword: 'font-medium text-sql-keyword',
  punct: 'text-sql-punct',
  text: '',
};

interface Props {
  code: string;
  className?: string;
  label?: string;
}

export default function SqlHighlight({ code, className = '', label = 'SQL' }: Props) {
  return (
    <pre
      className={`overflow-x-auto whitespace-pre px-3 py-2 font-mono text-[12.5px] leading-5 text-sql-text ${className}`}
      // Scrollable regions must be keyboard reachable.
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <code>
        {tokenizeSql(code).map((t, i) =>
          t.kind === 'text' ? (
            <Fragment key={i}>{t.text}</Fragment>
          ) : (
            <span key={i} className={CLASS[t.kind]}>
              {t.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
