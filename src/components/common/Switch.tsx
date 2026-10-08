// Labelled on/off switch (role="switch").

interface Props {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}

export default function Switch({ label, checked, onChange, disabled, describedBy }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left text-sm text-fg hover:bg-bg/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      <span className="flex-1">{label}</span>
      <span
        className={`relative inline-flex h-[18px] w-8 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent-strong' : 'bg-line'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  );
}
