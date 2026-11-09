import type { SVGProps } from "react";

/**
 * The Mateklamar mark: a ghost (mateklamar, Tetum for "ghost") whose hem is cut in the sharp
 * diamond sawtooth of Timorese tais weaving, with one crimson glint in the right socket.
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
      {/* Body: domed head, straight shoulders, tais sawtooth hem. */}
      <path d="M12 40V28A20 20 0 0 1 52 28V40L45.3 50 38.7 40 32 50 25.3 40 18.7 50Z" fill="var(--color-ink)" />
      {/* Eye sockets as tais diamonds, punched in the background colour. */}
      <path d="M24 22.5L29 27.5L24 32.5L19 27.5Z" fill="var(--color-crypt)" />
      <path d="M40 22.5L45 27.5L40 32.5L35 27.5Z" fill="var(--color-crypt)" />
      {/* The one glint that is still watching. */}
      <path className="mk-glint" d="M40 24.9L42.6 27.5L40 30.1L37.4 27.5Z" fill="var(--color-crimson)" />
    </svg>
  );
}
