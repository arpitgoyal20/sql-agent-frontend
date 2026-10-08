// Read-only SQL with Prism highlighting (light build, only `sql` registered) and line numbers.
// Token colours are CSS variables, so one style works in both themes.

import type { CSSProperties } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

SyntaxHighlighter.registerLanguage('sql', sql);

const c = (name: string): CSSProperties => ({ color: `rgb(var(--sql-${name}))` });

const SQL_THEME: Record<string, CSSProperties> = {
  'code[class*="language-"]': { ...c('text'), background: 'transparent' },
  'pre[class*="language-"]': { ...c('text'), background: 'transparent' },
  keyword: { ...c('keyword'), fontWeight: 500 },
  boolean: c('number'),
  number: c('number'),
  string: c('string'),
  char: c('string'),
  function: c('function'),
  comment: { ...c('comment'), fontStyle: 'italic' },
  punctuation: c('punct'),
  operator: c('punct'),
  variable: c('function'),
  'attr-value': c('string'),
};

interface Props {
  code: string;
  lineNumbers?: boolean;
  className?: string;
  /** Accessible name for the scrollable region. */
  label?: string;
}

export default function CodeBlock({ code, lineNumbers = true, className = '', label }: Props) {
  return (
    <div
      className={`overflow-x-auto font-mono text-[13px] leading-5 ${className}`}
      // Scrollable regions must be keyboard reachable.
      tabIndex={0}
      role="region"
      aria-label={label ?? 'SQL'}
    >
      <SyntaxHighlighter
        language="sql"
        style={SQL_THEME}
        customStyle={{
          margin: 0,
          padding: '10px 12px 10px 0',
          background: 'transparent',
          fontSize: '13px',
          lineHeight: '20px',
        }}
        codeTagProps={{ style: { fontFamily: 'inherit', background: 'transparent' } }}
        showLineNumbers={lineNumbers}
        lineNumberStyle={{
          minWidth: '2.75em',
          paddingRight: '12px',
          textAlign: 'right',
          color: 'rgb(var(--muted) / 0.7)',
          userSelect: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
