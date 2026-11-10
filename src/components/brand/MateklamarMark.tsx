"use client";

import { useEffect, useRef, type SVGProps } from "react";
import { proximity, reducedMotion, subscribe } from "../LivingMonster";

/**
 * The Mateklamar mark: a small round ghost (mateklamar, Tetum for "ghost") with a softly
 * lobed hem, big eyes, and one crimson pupil that is still watching.
 *
 * Drawn on a 64-unit grid as one closed silhouette so the shape itself is recognisable at
 * 16 px, where fine detail would disappear. Only three fills, all design tokens:
 * `--color-ink` and `--color-crypt` invert between the night theme and Daybreak, so the body
 * and the sockets stay opposite each other in both. The crimson pupil sits inside a socket
 * rather than on the body, so it keeps its contrast in either theme.
 *
 * The eyes follow the cursor. It joins the same shared pointer feed as the creatures
 * (`subscribe` in LivingMonster), so the page still has exactly one `pointermove` listener,
 * as MON-7 requires, and the reaction is batched per animation frame. Tracking is skipped
 * entirely under reduced motion; hovering also sends it flying, via `.mk-mark` in globals.css.
 */
export function MateklamarMark({
  size = 40,
  title,
  className = "",
  reach,
  ...rest
}: { size?: number; title?: string; className?: string; reach?: number } & SVGProps<SVGSVGElement>) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || reducedMotion()) return;
    // Noticed from about three mark-widths away, but never less than a comfortable 220px, so
    // the logo in the header starts looking before the pointer is on top of it.
    const radius = reach ?? Math.max(220, size * 3);
    let last = "";
    return subscribe((x, y) => {
      const p = proximity(x, y, svg.getBoundingClientRect(), radius);
      const key = `${p.lx},${p.ly}`;
      if (key === last) return;
      last = key;
      svg.style.setProperty("--lx", String(p.lx));
      svg.style.setProperty("--ly", String(p.ly));
    });
  }, [size, reach]);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`mk-mark ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{title}</title>}
      {/* Body: a big domed head over a short, softly lobed hem. Head-heavy on purpose — the
          wide dome and short body are what make it read as cute rather than menacing. */}
      <path d="M14 40V32A18 18 0 0 1 50 32V40Q44 48 38 40Q32 48 26 40Q20 48 14 40Z" fill="var(--color-ink)" />
      {/* Big round eyes, punched in the background colour. */}
      <circle cx="25" cy="31" r="5.5" fill="var(--color-crypt)" />
      <circle cx="39" cy="31" r="5.5" fill="var(--color-crypt)" />
      {/* Pupils, moved as one group so both eyes look the same way. The right one is crimson:
          the glint that is still watching. */}
      <g className="mk-pupils">
        <circle cx="25" cy="31" r="2.2" fill="var(--color-ink)" />
        <circle cx="39" cy="31" r="2.2" fill="var(--color-crimson)" />
      </g>
    </svg>
  );
}
