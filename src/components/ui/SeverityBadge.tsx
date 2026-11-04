import { SEVERITY } from "@/lib/monsters";
import type { Severity } from "@/lib/types";
import { cx } from "./cx";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity];
  return (
    <span
      className={cx("inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.08em]", className)}
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="sr-only">Severity </span>
      {s.label}
    </span>
  );
}
