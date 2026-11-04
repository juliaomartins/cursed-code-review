import { MONSTERS, SEVERITY } from "@/lib/monsters";
import type { Finding } from "@/lib/types";
import { Monster } from "../Monster";
import { cx } from "../ui/cx";

export function MonsterChip({
  finding,
  line,
  selected,
  banishing,
  lights,
  delay,
  onPick,
}: {
  finding: Finding;
  line: number;
  selected: boolean;
  banishing: boolean;
  lights: boolean;
  delay: number;
  onPick: () => void;
}) {
  const m = MONSTERS[finding.kind];
  const sev = SEVERITY[finding.severity];
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`Face the ${m.name} on line ${line}: ${finding.bug}, ${finding.severity} severity`}
      data-finding={finding.id}
      className={cx(
        "inline-flex min-h-11 flex-none items-center gap-2.5 rounded-full py-0.5 pr-3 pl-1.5 font-sans text-[13px] font-bold transition-[background,border-color] duration-150",
        selected
          ? cx("border-[1.5px] border-ember", lights ? "bg-[#FFE9D6]" : "bg-[#2b1c1f]")
          : cx("border", lights ? "border-[#D8CCBB] bg-white hover:border-[#bfae96]" : "border-line-strong bg-well hover:border-ink-4"),
        lights ? "shadow-[-14px_0_14px_#FBF7F0]" : "shadow-[-14px_0_14px_#110D18]",
      )}
    >
      <span className={cx("block", banishing ? "animate-banish" : `behave-${finding.kind}`, finding.kind === "gremlin" && !banishing && "gremlin-dart")} style={banishing ? undefined : { animationDelay: `${delay}s` }}>
        <Monster kind={finding.kind} size={sev.size} glow={!lights} />
      </span>
      <span className="hidden sm:inline">{m.name}</span>
      <span className="rounded-full px-2 py-0.5 font-mono text-[11px] tracking-[0.06em]" style={{ background: sev.bg, color: sev.fg }}>
        {finding.severity}
      </span>
    </button>
  );
}
