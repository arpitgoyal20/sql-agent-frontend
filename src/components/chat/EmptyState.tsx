// New-thread empty state (UI_SPEC §22): four starter cards that send concrete questions.

import { Gauge, LineChart, Users, Wrench } from 'lucide-react';

import Logo from '../common/Logo';

export const STARTERS = [
  {
    icon: LineChart,
    title: 'Analyze',
    subtitle: 'Revenue trends',
    prompt: 'Show monthly revenue for 2025',
  },
  {
    icon: Users,
    title: 'Explore',
    subtitle: 'Customer data',
    prompt: 'Show all customers from California',
  },
  {
    icon: Wrench,
    title: 'Debug SQL',
    subtitle: 'Fix a query',
    prompt: 'Fix this: SELECT name FROM Employee WHERE salary > AVG(salary)',
  },
  {
    icon: Gauge,
    title: 'Optimize',
    subtitle: 'Improve SQL',
    prompt:
      "Optimize this query: SELECT * FROM Orders o JOIN Customers c ON c.CustomerID = o.CustomerID WHERE o.Status = 'pending'",
  },
] as const;

export default function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-2 py-10 text-center sm:py-16">
      <Logo className="mb-4 h-9 w-9" />
      <h2 className="text-xl font-semibold tracking-tight">SQL Agent</h2>
      <p className="mt-1 text-[14px] text-muted">Ask questions about your database.</p>
      <ul className="mt-8 grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        {STARTERS.map(({ icon: Icon, title, subtitle, prompt }) => (
          <li key={title}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              aria-label={`${title}: ${subtitle}. Ask: ${prompt}`}
              className="group flex h-full w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent/50 hover:bg-elevated disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-elevated text-muted transition-colors group-hover:text-accent-fg">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{title}</span>
                <span className="block text-sm text-muted">{subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">or ask your own question below</p>
    </div>
  );
}
