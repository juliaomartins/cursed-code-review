import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CryptWorkspace } from "../crypt/CryptWorkspace";
import { SiteHeader } from "../layout/SiteHeader";
import { reviewFromSamples } from "@/lib/review/factory";
import { playBanish, resetSoundForTests, setDrone, setSoundEnabled, unlock } from "@/lib/sound";
import { KEYS } from "@/lib/storage";
import { renderApp, seedReview, setSearch } from "./utils";

/** Just enough Web Audio to see what the engine builds. */
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number) {
    this.value = v;
    return this;
  }
  setValueCurveAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  playbackRate = new FakeParam();
  type = "";
  buffer: unknown = null;
  loop = false;
  connect<T>(n: T) {
    return n;
  }
  disconnect() {}
  start() {
    FakeCtx.last!.started++;
  }
  stop() {}
}

class FakeCtx {
  static last: FakeCtx | null = null;
  static made = 0;
  state: AudioContextState = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  started = 0;
  oscillators = 0;
  constructor() {
    FakeCtx.last = this;
    FakeCtx.made++;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createOscillator() {
    this.oscillators++;
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeNode();
  }
  createBuffer(_c: number, len: number) {
    const data = new Float32Array(len);
    return { duration: len / this.sampleRate, sampleRate: this.sampleRate, getChannelData: () => data };
  }
}

const setReduced = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const savedPrefs = () => JSON.parse(window.localStorage.getItem(KEYS.prefs) ?? "{}");

describe("Sound", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    resetSoundForTests();
    FakeCtx.last = null;
    FakeCtx.made = 0;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    setReduced(false);
    setSearch("");
  });
  afterEach(() => {
    resetSoundForTests();
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    window.matchMedia = original;
  });

  it("is off by default and makes no audio context", async () => {
    renderApp(<SiteHeader />);
    const toggle = await screen.findByRole("button", { name: "Sound" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(FakeCtx.made).toBe(0);
  });

  it("turns on with a click, plays the door creak and remembers the choice", async () => {
    const user = userEvent.setup();
    renderApp(<SiteHeader />);
    await user.click(await screen.findByRole("button", { name: "Sound" }));
    expect(screen.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "true");
    expect(savedPrefs().sound).toBe(true);
    expect(FakeCtx.made).toBe(1);
    expect(FakeCtx.last!.oscillators).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Sound" }));
    expect(savedPrefs().sound).toBe(false);
    expect(FakeCtx.last!.state).toBe("suspended");
  });

  it("stays silent and disabled when the system asks for reduced motion", async () => {
    setReduced(true);
    window.localStorage.setItem(KEYS.prefs, JSON.stringify({ sound: true }));
    renderApp(<SiteHeader />);
    const toggle = await screen.findByRole("button", { name: /reduced motion/ });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    act(() => unlock());
    expect(FakeCtx.made).toBe(0);
  });

  it("M toggles sound in the crypt and the drone starts", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.keyboard("m");
    expect(savedPrefs().sound).toBe(true);
    expect(screen.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "true");
    // Creak (1 sawtooth) plus the drone's oscillators.
    expect(FakeCtx.last!.oscillators).toBeGreaterThanOrEqual(5);
  });

  it("plays nothing until a gesture has created the context", () => {
    setSoundEnabled(true);
    playBanish();
    setDrone(1);
    expect(FakeCtx.made).toBe(0);
    unlock();
    expect(FakeCtx.made).toBe(1);
    const before = FakeCtx.last!.started;
    playBanish();
    expect(FakeCtx.last!.started).toBeGreaterThan(before);
  });
});
