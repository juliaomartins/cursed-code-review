import type { SVGProps } from "react";

/**
 * The Mateklamar mark: a ghost (mateklamar, Tetum for "ghost") with a softly lobed hem and
 * eye sockets cut as the diamonds of Timorese tais weaving, one holding a crimson glint.
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
      {/* Body: domed head over three soft lobes. Taller than wide, and the hem curves match the
          dome's curvature so the whole silhouette reads as one drawn line. */}
      <path d="M16 42V28A16 16 0 0 1 48 28V42Q42.67 50 37.33 42Q32 50 26.67 42Q21.33 50 16 42Z" fill="var(--color-ink)" />
      {/* Eye sockets as tais diamonds, punched in the background colour. */}
      <path d="M26 23L30 27L26 31L22 27Z" fill="var(--color-crypt)" />
      <path d="M38 23L42 27L38 31L34 27Z" fill="var(--color-crypt)" />
      {/* The one glint that is still watching. */}
      <path className="mk-glint" d="M38 24.8L40.2 27L38 29.2L35.8 27Z" fill="var(--color-crimson)" />
    </svg>
  );
}
