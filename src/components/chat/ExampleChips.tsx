// Empty-chat example prompts (CHANGES-v2.md §6); clicking one sends it.

import { Sparkles } from 'lucide-react';

export const EXAMPLES = [
  'Top 5 customers by total order value',
  'Employees hired after January 2024 with their department',
  'Monthly revenue for 2025',
  'Who won the FIFA World Cup?',
] as const;

export default function ExampleChips({
  onPick,
  disabled,
}: {
  onPick: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-1 py-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Sparkles className="h-4 w-4 text-accent-fg" aria-hidden="true" />
        Ask about your data. Follow-ups build on the query in the editor.
      </div>
      <ul aria-label="Example questions" className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(example)}
              aria-label={`Ask: ${example}`}
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-fg/90 transition-colors hover:border-accent/50 hover:bg-elevated disabled:opacity-50"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
