"use client";

import { useEffect, useRef } from "react";
import { MONSTERS } from "@/lib/monsters";

/** How far the eyes may move, in the icon's 120×120 grid, so they stay inside the dark face. */
const MAX_X = 4.5;
const MAX_Y = 3.5;
const BLINK_MS = 320;

/**
 * Where the eyes should look for a cursor at (mx, my), given the icon's box.
 * Returns {x, y} in icon units: (0, 0) when the cursor is too far away.
 */
export function gaze(mx: number, my: number, box: { left: number; top: number; width: number; height: number }, radius: number) {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = mx - cx;
  const dy = my - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > radius || dist === 0) return { x: 0, y: 0 };
  // Full strength once the cursor is about one icon-width away; softer right on top of it.
  const strength = Math.min(1, dist / Math.max(box.width * 0.75, 1));
  return { x: +((dx / dist) * MAX_X * strength).toFixed(2), y: +((dy / dist) * MAX_Y * strength).toFixed(2) };
}

/**
 * The Void Wraith logo, alive: its eyes blink when you hover it and follow the cursor while it's near.
 * Decorative only; respects prefers-reduced-motion.
 */
export function WatchingWraith({ size = 40, glow = true, className, label }: { size?: number; glow?: boolean; className?: string; label?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const eyes = eyesRef.current;
    if (!svg || !eyes) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const radius = Math.max(160, size * 2.8);
    let frame = 0;
    let last = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = svg.getBoundingClientRect();
        const next = gaze(e.clientX, e.clientY, r, radius);
        if (next.x === last.x && next.y === last.y) return;
        last = next;
        eyes.style.transform = `translate(${next.x}px, ${next.y}px)`;
      });
    };
    const onLeaveWindow = () => {
      last = { x: 0, y: 0 };
      eyes.style.transform = "translate(0px, 0px)";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [size]);

  const blink = () => {
    const svg = svgRef.current;
    if (!svg || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    svg.classList.remove("wraith-blinking");
    void svg.getBoundingClientRect(); // restart the animation if it's already running
    svg.classList.add("wraith-blinking");
    if (blinkTimer.current) clearTimeout(blinkTimer.current);
    blinkTimer.current = setTimeout(() => svg.classList.remove("wraith-blinking"), BLINK_MS);
  };

  const blur = Math.max(3, Math.round(size / 14));
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      data-monster="wraith"
      data-watching=""
      onPointerEnter={blink}
      style={{ display: "block", flex: "none", filter: glow ? `drop-shadow(0 0 ${blur}px ${MONSTERS.wraith.glow}80)` : undefined }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <ellipse cx="60" cy="114" rx="28" ry="4" fill="#000000" opacity="0.35" />
      <path d="M60 8C33 8 20 32 20 58V106L30 97L40 108L50 98L60 110L70 98L80 108L90 97L100 106V58C100 32 87 8 60 8Z" fill="#5865E6" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 18C42 18 31 34 31 54C31 74 44 86 60 86C76 86 89 74 89 54C89 34 78 18 60 18Z" fill="#3A40B0" />
      <ellipse cx="60" cy="56" rx="21" ry="25" fill="#0B0812" />
      <g ref={eyesRef} data-eyes="" style={{ transition: "transform 140ms ease-out" }}>
        <g className="wraith-eye">
          <ellipse cx="51" cy="54" rx="5.5" ry="4" fill="#8BF6FF" />
          <circle cx="52.5" cy="53" r="1.4" fill="#FFFFFF" />
        </g>
        <g className="wraith-eye">
          <ellipse cx="69" cy="54" rx="5.5" ry="4" fill="#8BF6FF" />
          <circle cx="70.5" cy="53" r="1.4" fill="#FFFFFF" />
        </g>
      </g>
      <path d="M53 68Q60 64 67 68" stroke="#8BF6FF" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      <circle cx="60" cy="95" r="7" fill="none" stroke="#B9C1FF" strokeWidth="3" />
      <path d="M54 101L66 89" stroke="#B9C1FF" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 44C33 28 44 17 58 15" stroke="#AEB6FF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
