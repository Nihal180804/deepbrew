interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
}

export function Toggle({ on, onChange, label }: Props) {
  return (
    <button
      className={`switch ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <span className="knob" />
    </button>
  );
}
