import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ErrorBoundary from './ErrorBoundary';

let broken = true;
function Flaky() {
  if (broken) throw new Error('Cannot read properties of undefined (reading "rows")');
  return <p>Region content</p>;
}

describe('ErrorBoundary', () => {
  it('shows a compact error card instead of a blank page and recovers with Try again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <p>Other region</p>
        <ErrorBoundary name="results area">
          <Flaky />
        </ErrorBoundary>
      </>,
    );
    const card = screen.getByRole('alert');
    expect(card).toHaveTextContent('The results area hit a problem');
    expect(card).toHaveTextContent('reading "rows"');
    expect(screen.getByText('Other region')).toBeInTheDocument();

    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again: reload the results area' }));
    expect(screen.getByText('Region content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
