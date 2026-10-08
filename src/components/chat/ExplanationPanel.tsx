// WHY THIS QUERY? (UI_SPEC §13): streams tokens, then the final text and assumptions.

interface Props {
  text: string;
  assumptions: string[];
  streaming?: boolean;
}

export default function ExplanationPanel({ text, assumptions, streaming = false }: Props) {
  if (!text && !streaming) return null;
  return (
    <section aria-label="Why this query" className="min-w-0">
      <h4 className="section-label mb-1">Why this query?</h4>
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
        <div className="space-y-1.5 pt-1" aria-label="Writing explanation" role="status">
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-3/4" />
        </div>
      )}
      {assumptions.length > 0 && (
        <div className="mt-2">
          <h5 className="text-xs font-medium text-muted">Assumptions</h5>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-sm text-fg/85">
            {assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
