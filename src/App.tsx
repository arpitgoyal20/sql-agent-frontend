// Providers and the app shell. Order matters: the workbench switches mobile tabs (Ui) and the
// chat hands SQL / results / explanations to the workbench.

import ErrorBoundary from './components/common/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { UiProvider } from './context/UiContext';
import { WorkbenchProvider } from './context/WorkbenchContext';

export default function App() {
  return (
    <ErrorBoundary name="app">
      <ThemeProvider>
        <ToastProvider>
          <UiProvider>
            <WorkbenchProvider>
              <ChatProvider>
                <AppShell />
              </ChatProvider>
            </WorkbenchProvider>
          </UiProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
