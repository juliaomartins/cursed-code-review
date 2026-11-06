import { describe, expect, it } from "vitest";
import { banishDuration, burst, CREATURE_FX, emergeDelay, INTENSITY, RUNES } from "../horror";
import { MONSTER_ORDER } from "../monsters";

describe("horror presentation config", () => {
  it("gives every creature its own death", () => {
    const particles = MONSTER_ORDER.map((k) => CREATURE_FX[k].particle);
    expect(new Set(particles).size).toBe(7);
  });

  it("scales bursts and duration with severity", () => {
    expect(burst("imp", "LOW", 1)).toHaveLength(INTENSITY.LOW.particles);
    expect(burst("imp", "HIGH", 1)).toHaveLength(INTENSITY.HIGH.particles);
    expect(burst("twins", "HIGH", 1).length).toBeLessThan(6);
    expect(banishDuration(700, "LOW")).toBe(700);
    expect(banishDuration(700, "HIGH")).toBeGreaterThan(banishDuration(700, "MED"));
    const far = (s: "LOW" | "HIGH") => Math.max(...burst("leech", s, 3).map((p) => p.distance));
    expect(far("HIGH")).toBeGreaterThan(far("LOW"));
  });

  it("breaks the Possessor into runes, never emoji, and is stable between renders", () => {
    const a = burst("possessor", "MED", 7);
    expect(a.every((p) => p.glyph && RUNES.includes(p.glyph))).toBe(true);
    expect(burst("possessor", "MED", 7)).toEqual(a);
    expect(burst("wraith", "MED", 7).every((p) => p.glyph === undefined)).toBe(true);
  });

  it("staggers emergence in reading order, capped", () => {
    expect(emergeDelay(0)).toBe(0);
    expect(emergeDelay(3)).toBeGreaterThan(emergeDelay(1));
    expect(emergeDelay(100)).toBe(1.2);
  });
});
