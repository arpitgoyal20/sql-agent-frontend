// App mark: a small database glyph on the accent colour.

export default function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="rgb(var(--accent-strong))" />
      <g fill="none" stroke="#fff" strokeWidth="2.2">
        <ellipse cx="16" cy="9.5" rx="8" ry="3.2" />
        <path d="M8 9.5v13c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-13M8 16c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
      </g>
    </svg>
  );
}
