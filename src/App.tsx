// Providers and the app shell.

import AppShell from './components/layout/AppShell';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { UiProvider } from './context/UiContext';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ChatProvider>
          <UiProvider>
            <AppShell />
          </UiProvider>
        </ChatProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
