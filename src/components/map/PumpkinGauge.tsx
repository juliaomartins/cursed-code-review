import { cx } from "../ui/cx";

/**
 * Room light as a ring around a jack-o'-lantern. The pumpkin glows and flickers while monsters roam,
 * and smiles calmly once the rooms are clear.
 */
export function PumpkinGauge({ light, lurking }: { light: number; lurking: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const calm = lurking === 0;
  return (
    <div className="relative mx-auto grid h-[150px] w-[150px] flex-none place-items-center sm:mx-0 sm:h-[190px] sm:w-[190px]">
      <svg viewBox="0 0 170 170" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="pg-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FF8A3D" />
            <stop offset="1" stopColor="#FFD27A" />
          </linearGradient>
        </defs>
        <circle cx="85" cy="85" r={r} fill="none" stroke="var(--color-track)" strokeWidth="9" />
        <circle
          cx="85"
          cy="85"
          r={r}
          fill="none"
          stroke="url(#pg-ring)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(light / 100) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700 [filter:drop-shadow(0_0_6px_rgba(255,138,61,0.7))]"
        />
      </svg>
      <svg viewBox="0 0 100 100" className={cx("relative h-[80px] w-[80px] sm:h-[104px] sm:w-[104px]", !calm && "map-pumpkin-angry")} aria-hidden="true">
        <defs>
          <radialGradient id="pg-glow" cx="50%" cy="55%" r="50%">
            <stop offset="0" stopColor="#FFF8C8" />
            <stop offset="0.7" stopColor="#FFD84D" />
            <stop offset="1" stopColor="#FFB52E" />
          </radialGradient>
        </defs>
        <path d="M50 22c2-8 6-12 12-13-4 4-6 8-6 13" fill="#4f7a2c" stroke="#2f4d18" strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="32" cy="60" rx="22" ry="30" fill="#e8661a" />
        <ellipse cx="68" cy="60" rx="22" ry="30" fill="#e8661a" />
        <ellipse cx="50" cy="60" rx="20" ry="32" fill="#ff7f24" />
        <path d="M50 29v62M34 33c-6 16-6 38 0 54M66 33c6 16 6 38 0 54" stroke="#c4500f" strokeWidth="1.5" fill="none" opacity="0.6" />
        <g className="map-pumpkin-face" fill="url(#pg-glow)" stroke="#6b2200" strokeWidth="1.2" strokeLinejoin="round">
          {calm ? (
            <>
              <path d="M30 52q6-6 12 0" stroke="url(#pg-glow)" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M58 52q6-6 12 0" stroke="url(#pg-glow)" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M32 66q18 16 36 0q-18 8-36 0z" />
            </>
          ) : (
            <>
              <path d="M28 46l14 4-10 8z" />
              <path d="M72 46l-14 4 10 8z" />
              <path d="M47 60l3-6 3 6z" />
              <path d="M28 68l6 4 4-4 6 5 6-5 6 5 6-5 4 4 6-4c-4 12-14 16-22 16s-18-4-22-16z" />
            </>
          )}
        </g>
      </svg>
      <span className="absolute bottom-1 font-mono text-[11px] tracking-[0.14em] text-ember-gold">LIGHT {light}%</span>
    </div>
  );
}
