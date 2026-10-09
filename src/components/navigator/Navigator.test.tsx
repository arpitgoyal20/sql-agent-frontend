import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { previewTable, runQuery } from '../../api/client';
import { Probe, renderWithProviders, restoreMockTiming, useFastMock } from '../../test/providers';
import { askAboutTable } from '../../context/chatModel';
import Navigator from './Navigator';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    previewTable: vi.fn(actual.previewTable),
    runQuery: vi.fn(actual.runQuery),
  };
});

const tableList = () => screen.findByRole('list', { name: 'Tables' });
const probe = (id: string) => screen.getByTestId(`probe-${id}`);

describe('Navigator', () => {
  beforeEach(() => {
    useFastMock();
    vi.mocked(previewTable).mockClear();
    vi.mocked(runQuery).mockClear();
  });
  afterAll(restoreMockTiming);

  it('lists every table with its row count', async () => {
    renderWithProviders(<Navigator />);
    const list = await tableList();
    const expected = {
      Departments: '8',
      Employees: '200',
      Customers: '500',
      Products: '50',
      Orders: '2,000',
      OrderItems: '6,035',
      Payments: '1,791',
    };
    for (const [name, count] of Object.entries(expected)) {
      const button = within(list).getByRole('button', { name: `Preview ${name} (${count} rows)` });
      expect(within(button).getByTestId('row-count')).toHaveTextContent(count);
    }
  });

  it('previews a table on click: editor gets the SQL, the grid gets the rows', async () => {
    renderWithProviders(
      <>
        <Navigator />
        <Probe />
      </>,
    );
    const list = await tableList();
    fireEvent.click(within(list).getByRole('button', { name: /^Preview Customers/ }));
    expect(previewTable).toHaveBeenCalledWith('Customers', 100, 0);
    await waitFor(() =>
      expect(probe('sql')).toHaveTextContent('SELECT * FROM Customers LIMIT 100;'),
    );
    expect(probe('results')).toHaveTextContent('ok total=500 offset=0 rows=100');
    expect(probe('tab')).toHaveTextContent('results');
    expect(within(list).getByRole('button', { name: /^Preview Customers/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('filters tables and columns', async () => {
    renderWithProviders(<Navigator />);
    const list = await tableList();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter tables and columns' }), {
      target: { value: 'signup' },
    });
    // Only Customers has a matching column; it opens to show just that column.
    expect(within(list).getAllByRole('button', { name: /^Preview / })).toHaveLength(1);
    expect(within(list).getByRole('button', { name: /^Column SignupDate/ })).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: /^Column Email/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'order' } });
    expect(
      within(list)
        .getAllByRole('button', { name: /^Preview / })
        .map((b) => b.textContent?.replace(/[\d,]+$/, '')),
    ).toEqual(['Orders', 'OrderItems', 'Payments']); // Payments matches on its OrderID column
  });

  it('expands columns with PK and FK icons and inserts a column on double-click', async () => {
    renderWithProviders(
      <>
        <Navigator />
        <Probe />
      </>,
    );
    const list = await tableList();
    fireEvent.click(within(list).getByRole('button', { name: 'Expand Orders columns' }));
    const columns = within(list).getByRole('list', { name: 'Orders columns' });
    const pk = within(columns).getByRole('button', {
      name: /^Column OrderID, INTEGER, primary key/,
    });
    expect(within(pk).getByTestId('pk-icon')).toBeInTheDocument();
    const fk = within(columns).getByRole('button', {
      name: /^Column CustomerID, INTEGER, foreign key to Customers\.CustomerID/,
    });
    expect(within(fk).getByTestId('fk-icon').parentElement).toHaveAttribute(
      'title',
      '→ Customers.CustomerID',
    );
    expect(fk.getAttribute('title')).toContain('Customer who placed the order.');
    fireEvent.doubleClick(fk);
    expect(probe('sql')).toHaveTextContent('CustomerID');
  });

  it('offers Count rows and Ask AI from the ⋯ and right-click menus', async () => {
    renderWithProviders(
      <>
        <Navigator />
        <Probe />
      </>,
    );
    const list = await tableList();
    fireEvent.click(within(list).getByRole('button', { name: 'More actions for Orders' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Count rows' }));
    expect(runQuery).toHaveBeenCalledWith('SELECT COUNT(*) FROM Orders;', 'sqlite', 100, 0);
    await waitFor(() => expect(probe('results')).toHaveTextContent('ok total=1 offset=0 rows=1'));
    expect(probe('sql')).toHaveTextContent('SELECT COUNT(*) FROM Orders;');

    fireEvent.contextMenu(within(list).getByRole('button', { name: /^Preview Payments/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ask AI about this table' }));
    expect(probe('draft')).toHaveTextContent(askAboutTable('Payments'));

    fireEvent.click(within(list).getByRole('button', { name: 'More actions for Products' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Select top 100' }));
    expect(previewTable).toHaveBeenCalledWith('Products', 100, 0);
  });
});
