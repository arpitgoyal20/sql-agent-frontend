// CodeMirror 6 SQL editor (lazy-loaded by SqlEditor so the main bundle stays small): SQL
// highlighting for the selected dialect, line numbers, bracket matching, history, schema
// autocomplete from /api/tables and a palette theme that follows the app theme. ⌘/Ctrl+Enter
// runs the selection or the whole query.

import { isolateHistory } from '@codemirror/commands';
import { MySQL, PostgreSQL, SQLite, sql, type SQLNamespace } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Prec, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef } from 'react';

import type { Dialect, TableInfo } from '../../api/types';
import type { EditorApi } from '../../context/WorkbenchContext';

const v = (name: string, alpha?: number) =>
  alpha === undefined ? `rgb(var(--${name}))` : `rgb(var(--${name}) / ${alpha})`;

const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Editor chrome from the app palette; CSS variables make it follow light / dark. */
function paletteTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': { height: '100%', backgroundColor: v('bg'), color: v('sql-text'), fontSize: '13px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: MONO, lineHeight: '20px' },
      '.cm-content': {
        caretColor: v('text'),
        padding: '8px 0',
        fontVariantLigatures: 'none',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: v('text') },
      '.cm-selectionBackground': { backgroundColor: `${v('accent', 0.22)} !important` },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: `${v('accent', 0.35)} !important`,
      },
      '.cm-gutters': {
        backgroundColor: v('surface'),
        color: v('muted', 0.8),
        borderRight: `1px solid ${v('border')}`,
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 8px', minWidth: '32px' },
      '.cm-activeLine': { backgroundColor: v('elevated', 0.55) },
      '.cm-activeLineGutter': { backgroundColor: v('elevated'), color: v('text') },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: v('accent', 0.22),
        outline: `1px solid ${v('accent', 0.55)}`,
      },
      '.cm-placeholder': { color: v('muted') },
      '.cm-tooltip': {
        backgroundColor: v('elevated'),
        color: v('text'),
        border: `1px solid ${v('border')}`,
        borderRadius: '6px',
      },
      '.cm-tooltip-autocomplete > ul': { fontFamily: MONO, fontSize: '12.5px' },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: v('accent-strong'),
        color: '#fff',
      },
      '.cm-completionDetail': { color: v('muted'), fontStyle: 'normal', marginLeft: '8px' },
      '.cm-completionInfo': { maxWidth: '320px', fontFamily: 'inherit' },
    },
    { dark },
  );
}

const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: v('sql-keyword'), fontWeight: '500' },
    { tag: [t.standard(t.name), t.typeName, t.function(t.variableName)], color: v('sql-function') },
    { tag: [t.string, t.special(t.string)], color: v('sql-string') },
    { tag: [t.number, t.bool, t.null], color: v('sql-number') },
    {
      tag: [t.lineComment, t.blockComment, t.comment],
      color: v('sql-comment'),
      fontStyle: 'italic',
    },
    { tag: [t.punctuation, t.operator, t.paren, t.separator], color: v('sql-punct') },
  ]),
);

const DIALECTS = { sqlite: SQLite, postgres: PostgreSQL, mysql: MySQL };

/** Table → column completions (with type and doc) for lang-sql's schema option. */
function schemaOf(tables: TableInfo[]): SQLNamespace {
  return Object.fromEntries(
    tables.map((table) => [
      table.name,
      table.columns.map((c) => ({
        label: c.name,
        type: 'property',
        detail: c.type,
        info: c.doc || undefined,
      })),
    ]),
  );
}

interface Props {
  value: string;
  onChange: (sql: string) => void;
  onRun: () => void;
  tables: TableInfo[] | null;
  dialect: Dialect;
  dark: boolean;
  registerApi: (api: EditorApi | null) => void;
}

export default function CodeMirrorEditor({
  value,
  onChange,
  onRun,
  tables,
  dialect,
  dark,
  registerApi,
}: Props) {
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => () => registerApi(null), [registerApi]);

  const extensions = useMemo(
    () => [
      sql({
        dialect: DIALECTS[dialect],
        schema: tables ? schemaOf(tables) : undefined,
        upperCaseKeywords: true,
      }),
      highlight,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              runRef.current();
              return true;
            },
          },
        ]),
      ),
      EditorView.contentAttributes.of({ 'aria-label': 'SQL editor' }),
    ],
    [dialect, tables],
  );

  const theme = useMemo(() => paletteTheme(dark), [dark]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height="100%"
      className="h-full"
      theme={theme}
      extensions={extensions}
      placeholder="Write SQL here, or click a table on the left to start. ⌘/Ctrl+Enter runs it."
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        history: true,
        searchKeymap: false,
      }}
      onCreateEditor={(view) =>
        registerApi({
          getText: () => view.state.doc.toString(),
          getSelection: () => {
            const range = view.state.selection.main;
            return range.empty ? '' : view.state.sliceDoc(range.from, range.to);
          },
          replaceAll: (text) => {
            if (view.state.doc.toString() === text) return;
            // One transaction, isolated in history, so ⌘/Ctrl+Z restores the previous query.
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: text },
              selection: { anchor: text.length },
              annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.replace')],
            });
          },
          insert: (text) => {
            view.dispatch(view.state.replaceSelection(text), {
              annotations: Transaction.userEvent.of('input'),
              scrollIntoView: true,
            });
            view.focus();
          },
          focus: () => view.focus(),
        })
      }
    />
  );
}
