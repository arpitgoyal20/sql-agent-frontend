import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RefusalCard, { REFUSAL_SUGGESTION } from './RefusalCard';

const TEXT =
  "I'm designed to assist only with SQL and database-related tasks. Please ask a question related to the provided database schema.";

describe('RefusalCard', () => {
  it("renders the backend's text verbatim with a shield icon", () => {
    render(<RefusalCard text={TEXT} reason="out_of_scope" />);
    const card = screen.getByRole('note', { name: 'Request declined' });
    expect(card).toHaveTextContent(TEXT);
    expect(screen.getByTestId('refusal-shield')).toBeInTheDocument();
    expect(screen.getByText('Outside my scope')).toBeInTheDocument();
  });

  it('is a neutral grey card, not an error', () => {
    render(<RefusalCard text={TEXT} reason="destructive" />);
    const card = screen.getByTestId('refusal-card');
    expect(card.className).toMatch(/bg-elevated/);
    expect(card.className).not.toMatch(/danger|red/);
    expect(card).not.toHaveAttribute('role', 'alert');
    expect(screen.getByText('Read-only operation required')).toBeInTheDocument();
  });

  it('offers a clickable example question', () => {
    const onSuggest = vi.fn();
    render(<RefusalCard text={TEXT} reason="out_of_scope" onSuggest={onSuggest} />);
    expect(screen.getByRole('note')).toHaveTextContent(
      `Try asking something like: “${REFUSAL_SUGGESTION}.”`,
    );
    fireEvent.click(screen.getByRole('button', { name: `Ask: ${REFUSAL_SUGGESTION}` }));
    expect(onSuggest).toHaveBeenCalledWith(REFUSAL_SUGGESTION);
  });

  it('works without a reason', () => {
    render(<RefusalCard text="Not something I can do." />);
    expect(screen.getByRole('note')).toHaveTextContent('Not something I can do.');
  });
});
