import { ImageResponse } from "next/og";

export const alt = "Mateklamar Code Review — every bug is a monster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social card: the Mateklamar ghost on obsidian, gold hairlines, the title and the promise. */
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
        {/* Literal colours: Satori resolves no CSS variables, so the tokens cannot be used here. */}
        <svg width="300" height="300" viewBox="0 0 64 64">
          <path d="M12 40V28A20 20 0 0 1 52 28V40L45.3 50 38.7 40 32 50 25.3 40 18.7 50Z" fill="#E8E0D0" />
          <path d="M24 22.5L29 27.5L24 32.5L19 27.5Z" fill="#08090D" />
          <path d="M40 22.5L45 27.5L40 32.5L35 27.5Z" fill="#08090D" />
          <path d="M40 24.9L42.6 27.5L40 30.1L37.4 27.5Z" fill="#A51F32" />
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
