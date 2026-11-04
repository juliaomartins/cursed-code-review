import { cx } from "../ui/cx";

export function Lantern({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="22" height="32" viewBox="0 0 22 32" className={className}>
      <rect x="5" y="12" width="12" height="18" rx="2" fill="#F2E3C9" />
      <path d="M11 12V9" stroke="#140F1C" strokeWidth="1.5" />
      <path d="M11 1C14 5 15 7 11 10C7 7 8 5 11 1Z" fill="#FF8A3D" className="origin-[11px_10px] animate-flicker" />
    </svg>
  );
}

export function RoomLight({ value, className, wide = false }: { value: number; className?: string; wide?: boolean }) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <Lantern />
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3" id="room-light-label">
          ROOM LIGHT · {value}%
        </span>
        <div
          role="progressbar"
          aria-labelledby="room-light-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          className={cx("h-2 overflow-hidden rounded-full bg-track", wide ? "w-[260px]" : "w-[180px] sm:w-[220px]")}
        >
          <div
            className="h-full bg-gradient-to-r from-ember to-ember-gold shadow-[0_0_12px_#FF8A3D] transition-[width] duration-[600ms] ease-out"
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}
