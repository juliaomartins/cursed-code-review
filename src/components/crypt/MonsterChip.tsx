"use client";

import { useState } from "react";
import { MONSTERS, SEVERITY } from "@/lib/monsters";
import { playHover } from "@/lib/sound";
import type { Finding } from "@/lib/types";
import { Creature } from "../fx/Creature";
import { Monster } from "../Monster";
import { cx } from "../ui/cx";

export function MonsterChip({
  finding,
  line,
  selected,
  banishing,
  lights,
  delay,
  emergeAfter,
  banishMs,
  resisting = false,
  onPick,
}: {
  finding: Finding;
  line: number;
  selected: boolean;
  banishing: boolean;
  lights: boolean;
  delay: number;
  /** Seconds before this monster climbs out of its line. */
  emergeAfter?: number;
  banishMs?: number;
  resisting?: boolean;
  onPick: () => void;
}) {
  const m = MONSTERS[finding.kind];
  const sev = SEVERITY[finding.severity];
  // Count selections so the creature reacts each time it is picked (not when it is let go).
  const [picks, setPicks] = useState(0);
  const [wasSelected, setWasSelected] = useState(selected);
  if (selected !== wasSelected) {
    setWasSelected(selected);
    if (selected) setPicks((n) => n + 1);
  }
  return (
    <button
      type="button"
      onClick={onPick}
      onPointerEnter={() => playHover(finding.kind)}
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
      <Creature
        kind={finding.kind}
        severity={finding.severity}
        emergeAfter={emergeAfter}
        reactKey={picks}
        banishing={banishing}
        banishMs={banishMs}
        resisting={resisting}
        idleDelay={delay}
        seed={line}
      >
        <Monster kind={finding.kind} size={sev.size} glow={!lights} />
      </Creature>
      <span className="hidden sm:inline">{m.name}</span>
      <span className="rounded-full px-2 py-0.5 font-mono text-[11px] tracking-[0.06em]" style={{ background: sev.bg, color: sev.fg }}>
        {finding.severity}
      </span>
    </button>
  );
}
