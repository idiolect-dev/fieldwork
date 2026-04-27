// Datetime input with a "Now" affordance.
//
// Idiolect lexicons store datetimes as RFC 3339 strings. Editors
// already accepted free text, but most users just want the current
// instant — this wrapper offers a one-click "Now" button beside
// the input and stamps `new Date().toISOString()`.

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatetimeInput({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "2026-04-27T15:00:00.000Z"}
        className={
          className ??
          "flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded font-mono text-sm"
        }
      />
      <button
        type="button"
        onClick={() => onChange(new Date().toISOString())}
        className="px-2 py-1 text-xs rounded border border-stone-300 hover:bg-stone-50 text-stone-700 shrink-0"
        title="Use the current time"
      >
        Now
      </button>
    </div>
  );
}
