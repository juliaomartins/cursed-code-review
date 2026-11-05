"use client";

import { useEffect, useId, useRef } from "react";
import { MONSTERS } from "@/lib/monsters";
import type { MonsterKind } from "@/lib/types";
import { LIVING_ART } from "./living-art";

/** How long the hover reaction ("poke") plays, per monster. */
const POKE_MS: Record<MonsterKind, number> = { wraith: 320, leech: 700, possessor: 600, imp: 650, twins: 1000, zombie: 950, gremlin: 700 };

export interface Proximity {
  /** Where to look, -1…1, weaker when the cursor is right on top of the monster. */
  lx: number;
  ly: number;
  /** Unit direction from the monster to the cursor. */
  ux: number;
  uy: number;
  /** 1 when the cursor touches the monster, falling to 0 at the edge of its reach. */
  near: number;
}

const REST: Proximity = { lx: 0, ly: 0, ux: 0, uy: 0, near: 0 };

/** How a monster at `box` sees a cursor at (mx, my). */
export function proximity(mx: number, my: number, box: { left: number; top: number; width: number; height: number }, radius: number): Proximity {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = mx - cx;
  const dy = my - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > radius || dist === 0) return REST;
  const ux = dx / dist;
  const uy = dy / dist;
  const strength = Math.min(1, dist / Math.max(box.width * 0.75, 1));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { lx: round(ux * strength), ly: round(uy * strength), ux: round(ux), uy: round(uy), near: round(1 - dist / radius) };
}

// One pointer listener for every living monster on the page, batched per animation frame.
type Listener = (x: number, y: number) => void;
const listeners = new Set<Listener>();
let pending: { x: number; y: number } | null = null;
let frame = 0;
function onPointer(e: PointerEvent) {
  if (e.pointerType === "touch") return;
  pending = { x: e.clientX, y: e.clientY };
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const p = pending;
    if (p) listeners.forEach((l) => l(p.x, p.y));
  });
}
function onLeave() {
  listeners.forEach((l) => l(-1e6, -1e6));
}
function subscribe(l: Listener) {
  if (!listeners.size) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface LivingMonsterProps {
  kind: MonsterKind;
  size?: number;
  glow?: boolean;
  label?: string;
  className?: string;
  /** How far away the cursor is noticed, in px. Defaults to about three monster-widths (min 160). */
  reach?: number;
}

/**
 * A monster that reacts to the cursor: it watches it when it's near and plays its own move when hovered.
 * Wraith blinks · Leech gulps · Possessor shakes · Imp hops · Twins race · Zombie wobbles · Gremlin darts away.
 */
export function LivingMonster({ kind, size = 120, glow = true, label, className, reach }: LivingMonsterProps) {
  const ref = useRef<SVGSVGElement>(null);
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = `lm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const svg = ref.current;
    if (!svg || reducedMotion()) return;
    const radius = reach ?? Math.max(160, size * 2.8);
    let last = "";
    const unsubscribe = subscribe((x, y) => {
      const p = proximity(x, y, svg.getBoundingClientRect(), radius);
      const key = `${p.lx},${p.ly},${p.near}`;
      if (key === last) return;
      last = key;
      svg.style.setProperty("--lx", String(p.lx));
      svg.style.setProperty("--ly", String(p.ly));
      svg.style.setProperty("--ux", String(p.ux));
      svg.style.setProperty("--uy", String(p.uy));
      svg.style.setProperty("--near", String(p.near));
    });
    return () => {
      unsubscribe();
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
    };
  }, [size, reach]);

  const poke = () => {
    const svg = ref.current;
    if (!svg || reducedMotion()) return;
    svg.classList.add("lm-hovered");
    svg.classList.remove("lm-poked");
    void svg.getBoundingClientRect(); // restart the move if it's already playing
    svg.classList.add("lm-poked");
    if (pokeTimer.current) clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => svg.classList.remove("lm-poked"), POKE_MS[kind]);
  };

  const blur = Math.max(3, Math.round(size / 14));
  return (
    <svg
      ref={ref}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`lm lm-${kind}${className ? ` ${className}` : ""}`}
      data-monster={kind}
      data-living=""
      onPointerEnter={poke}
      onPointerLeave={() => ref.current?.classList.remove("lm-hovered")}
      style={{ display: "block", flex: "none", overflow: "visible", filter: glow ? `drop-shadow(0 0 ${blur}px ${MONSTERS[kind].glow}80)` : undefined }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {LIVING_ART[kind](uid)}
    </svg>
  );
}
