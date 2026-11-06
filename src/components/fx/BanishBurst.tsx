"use client";

import { useMemo, type CSSProperties } from "react";
import { burst, CREATURE_FX } from "@/lib/horror";
import type { MonsterKind, Severity } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * What a creature leaves behind as it is banished: violet smoke, stolen energy, burning runes, embers,
 * spectral waves, ash or golden sparks. Decorative, plays once, and renders nothing under reduced motion.
 */
export function BanishBurst({ kind, severity, seed = 1, scale = 1 }: { kind: MonsterKind; severity: Severity; seed?: number; scale?: number }) {
  const reduced = useReducedMotion();
  const particles = useMemo(() => burst(kind, severity, seed, scale), [kind, severity, seed, scale]);
  if (reduced) return null;
  const type = CREATURE_FX[kind].particle;
  return (
    <span aria-hidden="true" className={`fx-burst fx-${type}`} data-fx={type} data-severity={severity}>
      {particles.map((p, i) => (
        <span
          key={i}
          className="fx-p"
          style={
            {
              "--a": `${p.angle}deg`,
              "--d": `${p.distance}px`,
              "--s": `${p.size}px`,
              "--delay": `${p.delay}ms`,
              "--c": p.color,
            } as CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </span>
  );
}
