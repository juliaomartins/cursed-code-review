import { cx } from "./cx";

export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-line-strong bg-card-2 py-0 pr-3.5 pl-2.5 text-sm font-medium text-ink hover:border-ink-4",
        className,
      )}
    >
      <span aria-hidden="true" className={cx("relative h-[22px] w-10 rounded-full transition-colors duration-200", checked ? "bg-ember" : "bg-line-strong")}>
        <span className={cx("absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-ink transition-transform duration-200", checked && "translate-x-[18px]")} />
      </span>
      <span>{label}</span>
    </button>
  );
}
