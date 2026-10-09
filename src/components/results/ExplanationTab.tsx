// Explanation tab: the latest chat turn's plain-English explanation (streams in) and assumptions.

import { useWorkbench } from '../../context/WorkbenchContext';

export const EXPLANATION_EMPTY =
  'Ask the assistant or click Explain to get a plain-English explanation.';

export default function ExplanationTab() {
  const { explanation } = useWorkbench();
  const { text, assumptions, streaming } = explanation;

  if (!text && !streaming) {
    return <p className="p-4 text-sm text-muted">{EXPLANATION_EMPTY}</p>;
  }
  return (
    <section aria-label="Explanation" className="max-w-3xl space-y-3 p-4">
      {text ? (
        <p className="whitespace-pre-wrap break-words text-[14px] leading-6 text-fg/90">
          {text}
          {streaming && (
            <span
              className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-muted align-text-bottom"
              aria-hidden="true"
            />
          )}
        </p>
      ) : (
        <div className="space-y-1.5" role="status" aria-label="Writing explanation">
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-3/4" />
        </div>
      )}
      {assumptions.length > 0 && (
        <div>
          <h3 className="section-label mb-1">Assumptions</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-fg/85">
            {assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
