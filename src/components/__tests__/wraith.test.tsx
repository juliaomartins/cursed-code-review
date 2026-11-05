import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gaze, WatchingWraith } from "../WatchingWraith";

const box = { left: 0, top: 0, width: 40, height: 40 }; // centre (20, 20)

describe("where the wraith looks", () => {
  it("looks toward a nearby cursor, within the dark face", () => {
    expect(gaze(-200, 20, box, 300)).toEqual({ x: -4.5, y: 0 });
    expect(gaze(20, 300, box, 300)).toEqual({ x: 0, y: 3.5 });
    const diag = gaze(120, 120, box, 300);
    expect(diag.x).toBeGreaterThan(0);
    expect(diag.y).toBeGreaterThan(0);
    expect(Math.abs(diag.x)).toBeLessThanOrEqual(4.5);
  });

  it("looks ahead when the cursor is far away or right on its nose", () => {
    expect(gaze(1000, 20, box, 160)).toEqual({ x: 0, y: 0 });
    expect(gaze(20, 20, box, 160)).toEqual({ x: 0, y: 0 });
  });

  it("moves gently when the cursor is very close", () => {
    expect(gaze(30, 20, box, 160).x).toBeLessThan(4.5);
  });
});

describe("WatchingWraith", () => {
  afterEach(() => vi.useRealTimers());

  it("blinks when hovered, then opens its eyes again", () => {
    vi.useFakeTimers();
    const { container } = render(<WatchingWraith size={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    fireEvent.pointerEnter(svg);
    expect(svg).toHaveClass("wraith-blinking");
    act(() => vi.advanceTimersByTime(400));
    expect(svg).not.toHaveClass("wraith-blinking");
  });

  it("follows the cursor", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const { container } = render(<WatchingWraith size={40} />);
    const svg = container.querySelector("svg")!;
    svg.getBoundingClientRect = () => ({ ...box, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    act(() => {
      window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 150, clientY: 20, pointerType: "mouse" }));
    });
    expect((container.querySelector("[data-eyes]") as SVGGElement).style.transform).toBe("translate(4.5px, 0px)");
  });
});
