import { ImageResponse } from "next/og";

export const alt = "Mateklamar Code Review — every bug is a monster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social card: the Codex Seal on obsidian, gold hairlines, the title and the promise. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 90px",
          background: "radial-gradient(ellipse at 30% 20%, #1c1d25 0%, #08090d 70%)",
          border: "2px solid #3a3c48",
          color: "#E8E0D0",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#101116" />
          <circle cx="32" cy="32" r="28.5" fill="none" stroke="#B69A63" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="24" fill="none" stroke="#B69A63" strokeWidth="0.8" strokeDasharray="1.5 3" />
          <path
            d="M32 12c-9.4 0-16 6.6-16 15.2 0 5.3 2.4 8.9 5.6 11v5.3c0 1.3 1 2.3 2.3 2.3h16.2c1.3 0 2.3-1 2.3-2.3v-5.3c3.2-2.1 5.6-5.7 5.6-11C48 18.6 41.4 12 32 12Z"
            fill="#E8E0D0"
          />
          <path d="M27 23.5l-5 4.5 5 4.5M37 23.5l5 4.5-5 4.5" fill="none" stroke="#08090D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M33.4 30.5l-2.8 6.5" stroke="#08090D" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M27.5 41.5v4M32 41.5v4M36.5 41.5v4" stroke="#08090D" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="39.6" cy="28" r="1.8" fill="#E0566A" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: "#B69A63", textTransform: "uppercase" }}>The Haunted Codex</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -1 }}>Mateklamar Code Review</div>
          <div style={{ display: "flex", height: 2, width: 460, background: "linear-gradient(90deg, #B69A63, transparent)" }} />
          <div style={{ display: "flex", fontSize: 34, color: "#CFC7B8" }}>
            Every bug is a <span style={{ color: "#E0566A", marginLeft: 10 }}>monster.</span>
          </div>
          <div style={{ fontSize: 24, color: "#92909A" }}>Fix it to banish it. Every fix verified.</div>
        </div>
      </div>
    ),
    size,
  );
}
