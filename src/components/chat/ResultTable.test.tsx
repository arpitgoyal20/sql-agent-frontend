import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResultEvent } from '../../api/types';
import { mockClipboard } from '../../test/fixtures';
import ResultTable, { PAGE_SIZE } from './ResultTable';

const BIG: ResultEvent = {
  columns: ['id', 'name'],
  rows: Array.from({ length: 200 }, (_, i) => [i + 1, i === 0 ? null : `Row ${i + 1}`]),
  row_count: 200,
  truncated: true,
};

const bodyRows = () => document.querySelectorAll('tbody tr');

describe('ResultTable', () => {
  it('paginates 25 rows per page with a row count and truncation note', () => {
    render(<ResultTable result={BIG} />);
    expect(PAGE_SIZE).toBe(25);
    expect(screen.getByText('200 rows')).toBeInTheDocument();
    expect(screen.getByText('Showing first 200 rows')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByText('Rows 1–25 of 200')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(within(bodyRows()[0] as HTMLElement).getByText('NULL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Rows 26–50 of 200')).toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent('26');
    expect(screen.getByText('Page 2 of 8')).toBeInTheDocument();

    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Rows 176–200 of 200')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('has no pager for a single page', () => {
    render(
      <ResultTable result={{ columns: ['n'], rows: [[1], [2]], row_count: 2, truncated: false }} />,
    );
    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Results pages' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing first/)).not.toBeInTheDocument();
  });

  it('copies all rows as tab-separated text', async () => {
    const writeText = mockClipboard();
    render(<ResultTable result={{ ...BIG, rows: BIG.rows.slice(0, 2) }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy results as tab-separated text' }));
    });
    expect(writeText).toHaveBeenCalledWith('id\tname\n1\t\n2\tRow 2');
    expect(
      screen.getByRole('button', { name: 'Download results as results.csv' }),
    ).toBeInTheDocument();
  });
});
