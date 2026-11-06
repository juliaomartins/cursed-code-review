import type { CSSProperties } from "react";

/** Fixed star positions so server and client render the same sky. */
const STARS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 91.17 + n * 12.9898) * 43758.5453) % 1) + 1) % 1;
  return {
    left: `${r(1) * 100}%`,
    top: `${r(2) * 62}%`,
    "--tw": `${2.5 + r(3) * 4}s`,
    "--td": `${-r(4) * 6}s`,
    "--ts": `${1 + Math.round(r(5) * 1.6)}px`,
  } as CSSProperties;
});

function Bat({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 28" className={className} style={style} aria-hidden="true">
      <path
        className="map-bat-wings"
        d="M32 12c-2-4-6-6-9-5-3-5-10-7-17-5 4 1 6 4 6 7-3-1-7 0-9 2 5 0 9 2 11 6 3-2 7-3 10-2 2 1 4 3 5 5 1-2 3-4 5-5 3-1 7 0 10 2 2-4 6-6 11-6-2-2-6-3-9-2 0-3 2-6 6-7-7-2-14 0-17 5-3-1-7 1-9 5z"
        fill="#05030a"
      />
      <circle cx="30" cy="12" r="0.9" fill="#ff8a3d" />
      <circle cx="34" cy="12" r="0.9" fill="#ff8a3d" />
    </svg>
  );
}

/** The night over the Haunted Map: a moon, twinkling stars, two bats and drifting fog. Decoration only. */
export function MapSky() {
  return (
    <div className="map-sky" aria-hidden="true">
      {STARS.map((style, i) => (
        <span key={i} className="map-star" style={style} />
      ))}
      <div className="map-moon">
        <span className="map-crater" style={{ left: "26%", top: "30%", width: 22, height: 22 }} />
        <span className="map-crater" style={{ left: "58%", top: "52%", width: 14, height: 14 }} />
        <span className="map-crater" style={{ left: "40%", top: "66%", width: 10, height: 10 }} />
      </div>
      <Bat className="map-bat map-bat-1" />
      <Bat className="map-bat map-bat-2" />
      <div className="map-fog map-fog-1" />
      <div className="map-fog map-fog-2" />
    </div>
  );
}
