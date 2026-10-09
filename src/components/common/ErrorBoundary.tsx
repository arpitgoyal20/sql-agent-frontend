// Contains a render failure to one region (navigator, editor, results, chat, or the whole app)
// and shows a compact card with "Try again" instead of a blank page. State that lives above the
// boundary — notably the editor's query, which is also saved to localStorage — survives.

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Region name for the message, e.g. "SQL editor". */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the details for debugging; the UI shows a short message.
    console.error(`[${this.props.name}] crashed:`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full min-h-0 items-start justify-center overflow-auto bg-bg p-4">
        <div
          role="alert"
          className="flex w-full max-w-md gap-3 rounded-lg border border-danger/40 bg-danger/5 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[14px] font-semibold">The {this.props.name} hit a problem</p>
            <p className="break-words text-sm text-fg/80">
              {error.message || 'Something went wrong while showing this part of the page.'}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={this.reset}
              aria-label={`Try again: reload the ${this.props.name}`}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
