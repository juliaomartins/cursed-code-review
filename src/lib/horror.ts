/**
 * Presentation only: how each creature emerges, reacts, dies and how loud severity makes it.
 * Nothing here touches review state; the reducer and fix engine stay the single source of truth.
 */
import type { MonsterKind, Severity } from "./types";

export type Particle = "smoke" | "energy" | "runes" | "embers" | "waves" | "ash" | "sparks";

export interface CreatureFx {
  /** What the creature leaves behind when banished. */
  particle: Particle;
  /** Particle colours, picked in turn. */
  colors: string[];
  /** One line for the screen-reader announcement and the toast. */
  death: string;
}

export const CREATURE_FX: Record<MonsterKind, CreatureFx> = {
  wraith: { particle: "smoke", colors: ["#7a66b8", "#8ac7d1", "#4b3a7a"], death: "dissolves into violet smoke" },
  leech: { particle: "energy", colors: ["#9cbf69", "#b5d06e", "#6e1f2c"], death: "bursts, and the energy it stole drifts away" },
  possessor: { particle: "runes", colors: ["#c8243c", "#d9c9a6", "#e0566a"], death: "breaks apart into burning runes" },
  imp: { particle: "embers", colors: ["#e8913f", "#c2602f", "#f0b070"], death: "vanishes in a burst of embers" },
  twins: { particle: "waves", colors: ["#9fc3de", "#e6eef3"], death: "fade together in two spectral waves" },
  zombie: { particle: "ash", colors: ["#9a958c", "#c8c2b6", "#6e6a63"], death: "crumbles into ash" },
  gremlin: { particle: "sparks", colors: ["#d8b86a", "#e3cb91", "#9cbf69"], death: "explodes into tiny golden sparks" },
};

/** Runes the Possessor breaks into: Elder Futhark letters, never emoji. */
export const RUNES = ["ᚠ", "ᚱ", "ᛟ", "ᛞ", "ᛉ", "ᚦ", "ᛗ", "ᛒ", "ᚹ", "ᛃ"];

export interface Intensity {
  /** Particles in a banishment burst. */
  particles: number;
  /** Multiplier on the burn-away duration. */
  duration: number;
  /** How far particles fly, in px at chip size. */
  spread: number;
}

export const INTENSITY: Record<Severity, Intensity> = {
  CRITICAL: { particles: 28, duration: 1.5, spread: 70 },
  LOW: { particles: 8, duration: 1, spread: 34 },
  MED: { particles: 14, duration: 1.15, spread: 46 },
  HIGH: { particles: 22, duration: 1.35, spread: 60 },
};

/** How long the banishment plays before the (already verified) fix lands, for a base duration. */
export const banishDuration = (base: number, severity: Severity) => Math.round(base * INTENSITY[severity].duration);

/** Deterministic pseudo-random in [0, 1) so particle layouts are stable between renders. */
export function seeded(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface ParticleSpec {
  /** Direction in degrees. */
  angle: number;
  distance: number;
  size: number;
  delay: number;
  color: string;
  glyph?: string;
}

/** The particle layout for one banishment. `scale` grows it for the big monster in the side panel. */
export function burst(kind: MonsterKind, severity: Severity, seed: number, scale = 1): ParticleSpec[] {
  const fx = CREATURE_FX[kind];
  const { particles, spread } = INTENSITY[severity];
  const count = fx.particle === "waves" ? Math.max(2, Math.round(particles / 6)) : particles;
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => seeded(seed + i, n);
    const base = (360 / count) * i;
    return {
      angle: Math.round(base + (r(1) - 0.5) * (360 / count)),
      distance: Math.round(spread * scale * (0.55 + r(2) * 0.6)),
      size: Math.round(
        (fx.particle === "smoke"
          ? 10 + r(3) * 12
          : fx.particle === "runes"
            ? 11 + r(3) * 6
            : fx.particle === "sparks"
              ? 6 + r(3) * 5
              : fx.particle === "energy"
                ? 4 + r(3) * 4
                : 3 + r(3) * 4) * Math.sqrt(scale),
      ),
      delay: Math.round(r(4) * (fx.particle === "waves" ? 0 : 160)) + (fx.particle === "waves" ? i * 140 : 0),
      color: fx.colors[i % fx.colors.length],
      glyph: fx.particle === "runes" ? RUNES[Math.floor(r(5) * RUNES.length)] : undefined,
    };
  });
}

/** Staggered entrance: monsters climb out of their lines in reading order. */
export const emergeDelay = (index: number) => Math.min(index * 0.12, 1.2);
