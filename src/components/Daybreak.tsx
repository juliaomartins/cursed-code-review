import type { CSSProperties } from "react";

/** Golden motes drifting up through the morning light. Fixed positions, so server and client agree. */
const MOTES = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return {
    left: `${Math.round(r(1) * 100)}%`,
    "--s": `${3 + Math.round(r(2) * 5)}px`,
    "--d": `${11 + Math.round(r(3) * 10)}s`,
    "--delay": `${-Math.round(r(4) * 20)}s`,
    "--sway": `${Math.round((r(5) - 0.5) * 90)}px`,
  } as CSSProperties;
});

/** The sky behind a cleansed crypt: sunrise, slow light rays and drifting motes. */
export function DaybreakSky() {
  return (
    <div className="daybreak-sky" aria-hidden="true" data-daybreak-sky="">
      <div className="daybreak-rays" />
      <div className="daybreak-sun" />
      {MOTES.map((style, i) => (
        <span key={i} className="daybreak-mote" style={style} />
      ))}
    </div>
  );
}

/** A small sun that replaces the lantern once daylight is back. */
export function Sun({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" className={className}>
      <g stroke="#E8901D" strokeWidth="2.2" strokeLinecap="round" className="origin-center animate-spin-slow">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M16 2.5V6.5" transform={`rotate(${i * 45} 16 16)`} />
        ))}
      </g>
      <circle cx="16" cy="16" r="7" fill="#FFC24D" stroke="#E8901D" strokeWidth="1.5" />
    </svg>
  );
}
