import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MONSTER_ORDER } from "@/lib/monsters";
import { MateklamarMark } from "../brand/MateklamarMark";
import { LivingMonster, proximity } from "../LivingMonster";
import { gaze, WatchingWraith } from "../WatchingWraith";

const box = { left: 0, top: 0, width: 40, height: 40 }; // centre (20, 20)
const move = (x: number, y: number) =>
  act(() => {
    window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: x, clientY: y, pointerType: "mouse" }));
  });

describe("how a monster sees the cursor", () => {
  it("looks toward a nearby cursor and knows how close it is", () => {
    expect(proximity(-200, 20, box, 300)).toMatchObject({ lx: -1, ly: 0, ux: -1, uy: 0 });
    expect(proximity(-200, 20, box, 300).near).toBeCloseTo(0.267, 2);
    expect(proximity(25, 20, box, 300)).toMatchObject({ ux: 1, lx: expect.any(Number) });
    expect(proximity(25, 20, box, 300).lx).toBeLessThan(0.5);
    expect(proximity(25, 20, box, 300).near).toBeGreaterThan(0.95);
  });

  it("rests when the cursor is far away or exactly on its centre", () => {
    expect(proximity(1000, 20, box, 160)).toEqual({ lx: 0, ly: 0, ux: 0, uy: 0, near: 0 });
    expect(proximity(20, 20, box, 160)).toEqual({ lx: 0, ly: 0, ux: 0, uy: 0, near: 0 });
  });

  it("keeps the wraith's eyes inside its face", () => {
    expect(gaze(-200, 20, box, 300)).toEqual({ x: -4.5, y: 0 });
    expect(gaze(20, 300, box, 300)).toEqual({ x: 0, y: 3.5 });
  });
});

describe("LivingMonster", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(MONSTER_ORDER)("%s plays its move on hover, then settles", (kind) => {
    vi.useFakeTimers();
    const { container } = render(<LivingMonster kind={kind} size={96} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass(`lm-${kind}`);
    expect(svg.querySelector(".lm-look")).not.toBeNull();
    fireEvent.pointerEnter(svg);
    expect(svg).toHaveClass("lm-poked");
    expect(svg).toHaveClass("lm-hovered");
    act(() => vi.advanceTimersByTime(1100));
    expect(svg).not.toHaveClass("lm-poked");
    fireEvent.pointerLeave(svg);
    expect(svg).not.toHaveClass("lm-hovered");
  });

  it("tells every monster on the page where the cursor is, with one listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { container } = render(
      <>
        <WatchingWraith size={40} />
        <LivingMonster kind="gremlin" size={40} />
        {/* The brand mark joins the same feed, so it must not add a second listener. */}
        <MateklamarMark size={40} />
      </>,
    );
    expect(add.mock.calls.filter(([t]) => t === "pointermove")).toHaveLength(1);
    const all = container.querySelectorAll("svg");
    all.forEach((s) => (s.getBoundingClientRect = () => ({ ...box, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect));
    move(150, 20);
    const svgs = container.querySelectorAll<SVGSVGElement>("svg[data-living]");
    for (const s of svgs) {
      expect(s.style.getPropertyValue("--lx")).toBe("1");
      expect(s.style.getPropertyValue("--ux")).toBe("1");
      expect(Number(s.style.getPropertyValue("--near"))).toBeGreaterThan(0);
    }
    move(5000, 20);
    expect(svgs[1].style.getPropertyValue("--near")).toBe("0");
  });

  it("points the brand mark's eyes at the cursor off the same feed", () => {
    const { container } = render(<MateklamarMark size={40} reach={300} />);
    const svg = container.querySelector("svg.mk-mark")! as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ ...box, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    move(-200, 20);
    expect(svg.style.getPropertyValue("--lx")).toBe("-1");
    expect(svg.style.getPropertyValue("--ly")).toBe("0");
    move(20, 300);
    expect(svg.style.getPropertyValue("--ly")).toBe("1");
    expect(svg.style.getPropertyValue("--lx")).toBe("0");
    // Out of reach: the eyes return to centre rather than staring at the last position.
    move(5000, 20);
    expect(svg.style.getPropertyValue("--lx")).toBe("0");
    expect(svg.style.getPropertyValue("--ly")).toBe("0");
  });

  it("stays still for people who prefer reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    const { container } = render(<LivingMonster kind="imp" size={40} />);
    const svg = container.querySelector("svg")!;
    fireEvent.pointerEnter(svg);
    expect(svg).not.toHaveClass("lm-poked");
    window.matchMedia = original;
  });
});
