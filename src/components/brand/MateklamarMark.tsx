import type { SVGProps } from "react";

/**
 * The Mateklamar mark: a small round ghost (mateklamar, Tetum for "ghost") with a softly
 * lobed hem, big eyes, and one crimson catchlight that is still watching.
 *
 * Drawn on a 64-unit grid as one closed silhouette so the shape itself is recognisable at
 * 16 px, where fine detail would disappear. Only three fills, all design tokens:
 * `--color-ink` and `--color-crypt` invert between the night theme and Daybreak, so the body
 * and the sockets stay opposite each other in both. The crimson pupil sits inside a socket
 * rather than on the body, so it keeps its contrast in either theme.
 *
 * Hovering wakes it: see `.mk-mark` in globals.css, which is disabled under reduced motion.
 */
export function MateklamarMark({
  size = 40,
  title,
  className = "",
  ...rest
}: { size?: number; title?: string; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
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
      {/* Catchlights, both static. The right one is the crimson glint that is still watching. */}
      <circle cx="23" cy="29" r="1.8" fill="var(--color-ink)" />
      <circle cx="37" cy="29" r="1.8" fill="var(--color-crimson)" />
    </svg>
  );
}
