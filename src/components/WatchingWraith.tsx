"use client";

import { LivingMonster, proximity } from "./LivingMonster";

/** The Void Wraith logo: watches the cursor and blinks on hover. */
export function WatchingWraith({ size = 40, glow = true, className, label }: { size?: number; glow?: boolean; className?: string; label?: string }) {
  return <LivingMonster kind="wraith" size={size} glow={glow} className={className} label={label} />;
}

/** Where the wraith's eyes go (icon units, ±4.5 × ±3.5) for a cursor at (mx, my). */
export function gaze(mx: number, my: number, box: { left: number; top: number; width: number; height: number }, radius: number) {
  const p = proximity(mx, my, box, radius);
  return { x: +(p.lx * 4.5).toFixed(2), y: +(p.ly * 3.5).toFixed(2) };
}
