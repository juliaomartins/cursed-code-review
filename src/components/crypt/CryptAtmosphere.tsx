import type { CSSProperties } from "react";

const MOTES = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 51.3 + n * 17.17) * 43758.5453) % 1 + 1) % 1;
  return { left: `${10 + r(1) * 80}%`, top: `${10 + r(2) * 80}%`, "--md": `${9 + r(3) * 9}s`, "--mdl": `${-r(4) * 12}s` } as CSSProperties;
});

/**
 * The crypt around the code: a gothic window with moonlight falling across the room, drifting fog,
 * dust in the beam and two candles. Decorative and behind everything. It answers the hunt:
 * `tension` (0–1, how much HIGH danger still lurks) thickens and reddens the fog, `alarm` (a HIGH monster
 * is selected) makes the candles gutter.
 */
export function CryptAtmosphere({ tension, alarm }: { tension: number; alarm: boolean }) {
  return (
    <div className="crypt-atmos" aria-hidden="true" data-alarm={alarm || undefined} style={{ "--tension": tension.toFixed(2) } as CSSProperties}>
      <div className="crypt-beam">
        {MOTES.map((style, i) => (
          <span key={i} className="crypt-mote" style={style} />
        ))}
      </div>
      <svg className="crypt-window" viewBox="0 0 120 180">
        <defs>
          <radialGradient id="cw-moon" cx="50%" cy="38%" r="60%">
            <stop offset="0" stopColor="#e9e4ff" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#8f9bff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3b3470" stopOpacity="0.15" />
          </radialGradient>
        </defs>
        <path d="M10 178V70a50 50 0 0 1 100 0v108z" fill="url(#cw-moon)" />
        <circle cx="74" cy="52" r="14" fill="#f4f0ff" opacity="0.85" />
        <g stroke="#0b0812" strokeWidth="5" fill="none">
          <path d="M10 178V70a50 50 0 0 1 100 0v108z" strokeWidth="8" />
          <path d="M60 22v156M10 100h100M10 140h100" />
          <path d="M60 60a26 26 0 0 0-26 26M60 60a26 26 0 0 1 26 26" strokeWidth="3" />
        </g>
      </svg>
      <span className="crypt-candle crypt-candle-l">
        <span className="crypt-flame" />
      </span>
      <span className="crypt-candle crypt-candle-r">
        <span className="crypt-flame" />
      </span>
      <div className="crypt-fog crypt-fog-1" />
      <div className="crypt-fog crypt-fog-2" />
    </div>
  );
}
