import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SQL_EVENT, mockClipboard } from '../../test/fixtures';
import SqlCard, { RUN_SQLITE_ONLY } from './SqlCard';

describe('SqlCard', () => {
  let writeText: ReturnType<typeof mockClipboard>;

  beforeEach(() => {
    writeText = mockClipboard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders highlighted SQL with line numbers, the Valid badge and the dialect', () => {
    render(<SqlCard sql={SQL_EVENT} onRun={() => {}} />);
    const card = screen.getByRole('region', { name: 'Generated SQL' });
    expect(card.querySelector('pre code')?.textContent).toContain('FROM Customers');
    expect(card.querySelectorAll('.linenumber').length).toBe(6);
    expect(within(card).getByText('Valid')).toBeInTheDocument();
    expect(within(card).getByText('SQLite')).toBeInTheDocument();
    expect(within(card).getByText(SQL_EVENT.warnings[0])).toBeInTheDocument();
  });

  it('shows the validation checklist with warning details', () => {
    render(<SqlCard sql={SQL_EVENT} />);
    const checklist = screen.getByRole('region', { name: 'Query validation' });
    for (const label of ['SQL syntax valid', 'Read-only query', 'Tables exist']) {
      expect(within(checklist).getByText(label)).toBeInTheDocument();
    }
    expect(within(checklist).getByText('(warning)')).toBeInTheDocument();
    expect(within(checklist).getByText(/not a declared foreign key/)).toBeInTheDocument();
  });

  it('hides validation, Valid badge and inspector when the backend sent none', () => {
    render(<SqlCard sql={{ ...SQL_EVENT, validation: undefined, inspection: undefined }} />);
    expect(screen.queryByRole('region', { name: 'Query validation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Query Inspector' })).not.toBeInTheDocument();
  });

  it('copies the SQL and shows "Copied" for 2 seconds', async () => {
    vi.useFakeTimers();
    render(<SqlCard sql={SQL_EVENT} />);
    const button = screen.getByRole('button', { name: 'Copy SQL' });
    expect(button).toHaveTextContent('Copy');

    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(SQL_EVENT.sql);
    expect(button).toHaveTextContent('Copied');

    act(() => vi.advanceTimersByTime(1999));
    expect(button).toHaveTextContent('Copied');

    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveTextContent('Copy');
    expect(button).not.toHaveTextContent('Copied');
  });

  it('keeps the label unchanged when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<SqlCard sql={SQL_EVENT} />);
    const button = screen.getByRole('button', { name: 'Copy SQL' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).not.toHaveTextContent('Copied');
  });

  it('wires Run / Optimize / Explain / Save and shows "Saved" afterwards', async () => {
    const onRun = vi.fn();
    const onOptimize = vi.fn();
    const onExplain = vi.fn();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <SqlCard
        sql={SQL_EVENT}
        onRun={onRun}
        onOptimize={onOptimize}
        onExplain={onExplain}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Optimize this query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explain this query' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    });
    expect([onRun, onOptimize, onExplain, onSave].map((f) => f.mock.calls.length)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(screen.getByRole('button', { name: 'Saved to Saved Queries' })).toBeDisabled();
  });

  it('disables Run Query outside SQLite with the reason as tooltip', () => {
    render(
      <SqlCard
        sql={{ ...SQL_EVENT, dialect: 'postgres' }}
        onRun={() => {}}
        runDisabledReason={RUN_SQLITE_ONLY}
      />,
    );
    const run = screen.getByRole('button', { name: 'Run query' });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute('title', RUN_SQLITE_ONLY);
  });

  it('shows Original vs Optimized side by side for optimize turns', () => {
    render(<SqlCard sql={SQL_EVENT} title="Optimized SQL" original="SELECT * FROM Customers" />);
    expect(screen.getByRole('region', { name: 'Original SQL code' })).toHaveTextContent(
      'SELECT * FROM Customers',
    );
    expect(screen.getByRole('region', { name: 'Optimized SQL code' })).toHaveTextContent(
      'FROM Customers',
    );
  });
});
