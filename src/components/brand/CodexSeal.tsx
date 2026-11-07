import type { SVGProps } from "react";

/**
 * The Codex Seal: an antique-gold seal ring around a bone skull whose face is code.
 * The eye sockets are "<" and ">", the nose is "/" — the skull reads </>. One cursed eye glints crimson.
 * Drawn on a 64-unit grid with thick strokes so it survives 16 px (favicon) as well as a title screen.
 */
export function CodexSeal({ size = 40, title, ...rest }: { size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...rest}>
      {title && <title>{title}</title>}
      <circle cx="32" cy="32" r="30" fill="#101116" />
      <circle cx="32" cy="32" r="28.5" fill="none" stroke="#B69A63" strokeWidth="3" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#B69A63" strokeWidth="1" strokeDasharray="1.5 3" opacity="0.7" />
      <path
        d="M32 12c-9.4 0-16 6.6-16 15.2 0 5.3 2.4 8.9 5.6 11v5.3c0 1.3 1 2.3 2.3 2.3h16.2c1.3 0 2.3-1 2.3-2.3v-5.3c3.2-2.1 5.6-5.7 5.6-11C48 18.6 41.4 12 32 12Z"
        fill="#E8E0D0"
      />
      <path d="M27 23.5l-5 4.5 5 4.5M37 23.5l5 4.5-5 4.5" fill="none" stroke="#08090D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33.4 30.5l-2.8 6.5" stroke="#08090D" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M27.5 41.5v4M32 41.5v4M36.5 41.5v4" stroke="#08090D" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="39.6" cy="28" r="3.6" fill="#E0566A" opacity="0.25" />
      <circle cx="39.6" cy="28" r="1.7" fill="#E0566A" />
    </svg>
  );
}
