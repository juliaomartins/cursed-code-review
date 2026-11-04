import type { CSSProperties } from "react";
import { MONSTERS } from "@/lib/monsters";
import type { MonsterKind } from "@/lib/types";
import { MONSTER_ART } from "./monster-art";

export interface MonsterProps {
  kind: MonsterKind;
  size?: number;
  glow?: boolean;
  /** When set, the icon is announced with this label. Otherwise it is decorative. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function Monster({ kind, size = 120, glow = true, label, className, style }: MonsterProps) {
  const blur = Math.max(3, Math.round(size / 14));
  const info = MONSTERS[kind];
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      data-monster={kind}
      style={{ display: "block", flex: "none", filter: glow ? `drop-shadow(0 0 ${blur}px ${info.glow}80)` : undefined, ...style }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {MONSTER_ART[kind]}
    </svg>
  );
}
