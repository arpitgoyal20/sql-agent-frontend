import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SQL_EVENT } from '../../test/fixtures';
import SqlCard from './SqlCard';

describe('Query Inspector', () => {
  it('opens from the SQL card, lists the breakdown and closes with Escape', () => {
    render(<SqlCard sql={SQL_EVENT} />);
    const opener = screen.getByRole('button', { name: 'Open Query Inspector' });
    opener.focus(); // a real click focuses the button; fireEvent does not
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Query Inspector' });
    for (const label of ['Tables', 'Columns', 'Filters', 'Aggregations', 'Grouping', 'Safety']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Customers')).toBeInTheDocument();
    expect(within(dialog).getByText("State = 'California'")).toBeInTheDocument();
    expect(within(dialog).getByText('SELECT only')).toBeInTheDocument();
    expect(within(dialog).getByText('No destructive operations')).toBeInTheDocument();
    // Empty sections say so instead of disappearing.
    expect(within(dialog).getAllByText('None').length).toBe(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes with the Close button', () => {
    render(<SqlCard sql={SQL_EVENT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Query Inspector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
