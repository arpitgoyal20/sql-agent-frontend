/* eslint-disable react-refresh/only-export-components -- test helpers, never hot-reloaded */
// Test helpers: the app's providers against the in-memory mock backend, a probe that exposes
// workbench / chat state, and access to the real CodeMirror view.

import { EditorView } from '@codemirror/view';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect } from 'vitest';

import { mockRestTiming, setMockMode } from '../api/client';
import { resetClientIdCache } from '../api/clientId';
import { mockTiming } from '../api/mock';
import { resetMockStore } from '../api/mockRest';
import { ChatProvider, useChat } from '../context/ChatContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { UiProvider } from '../context/UiContext';
import { WorkbenchProvider, useWorkbench } from '../context/WorkbenchContext';

/** Mock mode with no artificial latency and fast scripted chat. */
export function useFastMock() {
  setMockMode(true);
  mockRestTiming.delayMs = 0;
  mockTiming.scale = 0.01;
  resetMockStore();
  localStorage.clear();
  resetClientIdCache();
  document.documentElement.className = '';
}

export function restoreMockTiming() {
  setMockMode(null);
  mockRestTiming.delayMs = 150;
  mockTiming.scale = 1;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <UiProvider>
          <WorkbenchProvider>
            <ChatProvider>{children}</ChatProvider>
          </WorkbenchProvider>
        </UiProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

/** Renders workbench / chat state as text so tests can assert on it without CodeMirror. */
export function Probe() {
  const { editorSql, results, resultsTab } = useWorkbench();
  const { draft, streaming } = useChat();
  const page = results.page;
  return (
    <div>
      <pre data-testid="probe-sql">{editorSql}</pre>
      <p data-testid="probe-results">
        {results.status}
        {page ? ` total=${page.total} offset=${page.offset} rows=${page.rows.length}` : ''}
        {results.running ? ' running' : ''}
      </p>
      <p data-testid="probe-tab">{resultsTab}</p>
      <p data-testid="probe-draft">{draft}</p>
      <p data-testid="probe-streaming">{String(streaming)}</p>
    </div>
  );
}

export function renderWithProviders(ui: ReactNode) {
  return render(<Providers>{ui}</Providers>);
}

/** The real CodeMirror view once the lazy editor has mounted. */
export async function editorView(): Promise<EditorView> {
  let view: EditorView | null = null;
  await waitFor(
    () => {
      const el = document.querySelector<HTMLElement>('.cm-editor');
      view = el ? EditorView.findFromDOM(el) : null;
      expect(view).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  return view!;
}

/** Type-free replacement of the editor content as if the user had typed it. */
export function typeInEditor(view: EditorView, text: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    userEvent: 'input.type',
  });
}
