import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { previewTable, runQuery } from '../../api/client';
import { useWorkbench } from '../../context/WorkbenchContext';
import { renderWithProviders, restoreMockTiming, useFastMock } from '../../test/providers';
import ResultsArea from './ResultsArea';
import ResultsGrid from './ResultsGrid';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    previewTable: vi.fn(actual.previewTable),
    runQuery: vi.fn(actual.runQuery),
  };
});

/** Buttons that drive the workbench like the editor / navigator would. */
function Driver() {
  const { runInEditor, previewTable: preview } = useWorkbench();
  return (
    <>
      <button type="button" onClick={() => runInEditor('SELECT * FROM Orders')}>
        run orders
      </button>
      <button type="button" onClick={() => runInEditor('SELECT nope FROM Orders')}>
        run bad
      </button>
      <button type="button" onClick={() => runInEditor('DELETE FROM Orders')}>
        run delete
      </button>
      <button type="button" onClick={() => runInEditor('SELECT * FROM Orders -- slow')}>
        run slow
      </button>
      <button type="button" onClick={() => preview('Customers')}>
        preview customers
      </button>
    </>
  );
}

function renderArea() {
  renderWithProviders(
    <>
      <Driver />
      <ResultsArea />
    </>,
  );
}

const status = () => screen.getByText(/rows · /);
const grid = () => screen.getByRole('region', { name: 'Results grid, scrollable' });
const firstCell = () => within(grid()).getAllByRole('row')[1].querySelectorAll('td')[1];

describe('Results grid and paging', () => {
  beforeEach(() => {
    useFastMock();
    vi.mocked(runQuery).mockClear();
    vi.mocked(previewTable).mockClear();
  });
  afterAll(restoreMockTiming);

  it('pages an editor query through runQuery with the next offset', async () => {
    renderArea();
    fireEvent.click(screen.getByRole('button', { name: 'run orders' }));
    await waitFor(() => expect(status()).toHaveTextContent(/^2,000 rows · \d+ ms · page 1 of 20$/));
    expect(within(grid()).getAllByRole('row')).toHaveLength(101);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(runQuery).toHaveBeenLastCalledWith('SELECT * FROM Orders', 'sqlite', 100, 100);
    await waitFor(() => expect(status()).toHaveTextContent('page 2 of 20'));
    expect(firstCell()).toHaveTextContent('101');

    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
      target: { value: '200' },
    });
    expect(runQuery).toHaveBeenLastCalledWith('SELECT * FROM Orders', 'sqlite', 200, 0);
    await waitFor(() => expect(status()).toHaveTextContent('page 1 of 10'));
  });

  it('pages a table preview through the preview endpoint, not runQuery', async () => {
    renderArea();
    fireEvent.click(screen.getByRole('button', { name: 'preview customers' }));
    await waitFor(() => expect(status()).toHaveTextContent('500 rows'));
    for (let page = 2; page <= 5; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await waitFor(() => expect(status()).toHaveTextContent(`page ${page} of 5`));
    }
    expect(previewTable).toHaveBeenLastCalledWith('Customers', 100, 400);
    expect(runQuery).not.toHaveBeenCalled();
    expect(firstCell()).toHaveTextContent('401');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('shows validator errors and keeps the previous grid greyed out', async () => {
    renderArea();
    fireEvent.click(screen.getByRole('button', { name: 'run orders' }));
    await waitFor(() => expect(status()).toHaveTextContent('2,000 rows'));

    fireEvent.click(screen.getByRole('button', { name: 'run bad' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("UNKNOWN_COLUMN Column 'nope' does not exist");
    expect(screen.getByRole('button', { name: /^Fix with AI/ })).toBeInTheDocument();
    // Previous result still there, but greyed out.
    expect(status()).toHaveTextContent('2,000 rows');
    expect(grid().parentElement).toHaveClass('opacity-40');
  });

  it('shows the refusal card for destructive SQL', async () => {
    renderArea();
    fireEvent.click(screen.getByRole('button', { name: 'run delete' }));
    const card = await screen.findByRole('note', { name: 'Request declined' });
    expect(card).toHaveTextContent('Read-only operation required');
    expect(card.className).not.toMatch(/danger/);
    expect(screen.getByText('Nothing was executed.')).toBeInTheDocument();
  });

  it('shows a run error with Retry', async () => {
    renderArea();
    fireEvent.click(screen.getByRole('button', { name: 'run slow' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Query took longer than 5 seconds and was stopped.');
    vi.mocked(runQuery).mockClear();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry running the query' }));
    expect(runQuery).toHaveBeenCalledWith('SELECT * FROM Orders -- slow', 'sqlite', 100, 0);
  });
});

describe('ResultsGrid', () => {
  const page = {
    columns: ['Name', 'Amount'],
    rows: [
      ['b', 2],
      ['a', null],
      ['c', 10],
    ],
    row_count: 3,
    total: 3,
    limit: 100,
    offset: 0,
    elapsed_ms: 1,
  };

  it('greys NULL, right-aligns numbers and sorts the current page with a hint', () => {
    renderWithProviders(<ResultsGrid page={page} />);
    expect(screen.getByText('NULL')).toHaveClass('italic');
    const amount = screen.getByRole('button', { name: 'Sort this page by Amount' });
    expect(amount).toHaveClass('text-right');
    fireEvent.click(amount);
    expect(screen.getByText(/Sorted on this page only/)).toBeInTheDocument();
    const values = () =>
      within(grid())
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelectorAll('td')[2].textContent);
    expect(values()).toEqual(['2', '10', 'NULL']);
    fireEvent.click(screen.getByRole('button', { name: /Sort this page by Amount, currently/ }));
    expect(values()).toEqual(['10', '2', 'NULL']);
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});
