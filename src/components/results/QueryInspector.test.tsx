import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { useWorkbench } from '../../context/WorkbenchContext';
import { SQL_EVENT } from '../../test/fixtures';
import { renderWithProviders, restoreMockTiming, useFastMock } from '../../test/providers';
import NotesTab, { NOTES_EMPTY } from './NotesTab';

/** Feeds a chat `sql` event (with validation + inspection) into the workbench. */
function Feed() {
  const { chatSql } = useWorkbench();
  return (
    <button type="button" onClick={() => chatSql(SQL_EVENT, false)}>
      feed
    </button>
  );
}

describe('Notes tab: validation checklist and Query Inspector', () => {
  beforeEach(useFastMock);
  afterAll(restoreMockTiming);

  it('shows an empty state before the assistant has replied', () => {
    renderWithProviders(<NotesTab />);
    expect(screen.getByText(NOTES_EMPTY)).toBeInTheDocument();
  });

  it('lists warnings and the validation checklist with warnings and skips', () => {
    renderWithProviders(
      <>
        <Feed />
        <NotesTab />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'feed' }));
    expect(screen.getByRole('region', { name: 'Warnings' })).toHaveTextContent(
      'No LIMIT; large result sets are capped at 200 rows.',
    );
    const checks = screen.getByRole('region', { name: 'Query validation' });
    expect(checks).toHaveTextContent('Tables exist');
    expect(checks).toHaveTextContent('not a declared foreign key');
  });

  it('opens the Query Inspector, lists the breakdown and closes with Escape', () => {
    renderWithProviders(
      <>
        <Feed />
        <NotesTab />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'feed' }));
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
    expect(within(dialog).getAllByText('None').length).toBe(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
