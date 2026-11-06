/**
 * Crypt sounds, made in the browser with Web Audio: no audio files.
 *
 * Nothing plays until the visitor turns sound on, and the AudioContext is only
 * created inside a click or key press (`unlock`), so browsers never block it.
 */

import type { MonsterKind } from "./types";

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = false;
let droneLevel = 0;
let drone: { out: GainNode; nodes: AudioScheduledSourceNode[] } | null = null;
let droneStop: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let voiceBus: GainNode | null = null;

/** Overall loudness. The drone sits far below the effects. */
const MASTER = 0.7;
const DRONE_MAX = 0.022;

function ctor(): Ctor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext ?? null;
}

export function soundSupported(): boolean {
  return ctor() !== null;
}

export function soundEnabled(): boolean {
  return enabled;
}

/** A context that is ready to play right now, or null. Never creates one. */
function live(): AudioContext | null {
  return enabled && ctx && master && ctx.state === "running" ? ctx : null;
}

/** Call from a click or key press: creates or resumes the context. */
export function unlock(): void {
  if (!enabled) return;
  const C = ctor();
  if (!C) return;
  if (!ctx) {
    try {
      ctx = new C();
    } catch {
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state !== "running") {
    ctx
      .resume()
      .then(applyDrone)
      .catch(() => {});
  } else applyDrone();
}

function onGesture() {
  unlock();
}

function onVisibility() {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend().catch(() => {});
  else if (enabled) unlock();
}

function listen(on: boolean) {
  if (typeof window === "undefined" || on === listening) return;
  listening = on;
  const fn = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
  fn("pointerdown", onGesture, true);
  fn("keydown", onGesture, true);
  if (on) document.addEventListener("visibilitychange", onVisibility);
  else document.removeEventListener("visibilitychange", onVisibility);
}

/** Turns sound on or off. Turning it off silences everything at once. */
export function setSoundEnabled(on: boolean): void {
  if (on === enabled) return;
  enabled = on;
  listen(on);
  if (on) {
    // Only an already-created context is resumed here; a new one waits for a gesture.
    if (ctx) unlock();
    return;
  }
  killDrone();
  if (ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

/** Looping white noise started at `when` from a random point, so no two hisses sound alike. */
function noiseSource(c: AudioContext, when: number, dur?: number): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  src.start(when, Math.random() * 1.8);
  if (dur !== undefined) src.stop(when + dur + 0.05);
  return src;
}

/** Hiss and crackle as a monster burns away, with its own voice (or a falling sigh) under it. */
export function playBanish({ big = false, kind }: { big?: boolean; kind?: MonsterKind } = {}): void {
  const c = live();
  if (!c || !master) return;
  // The monster's last cry: its own voice, deeper and fading.
  if (kind) playVoice(kind, { pitch: 0.8, gain: 0.75 });
  const t = c.currentTime + 0.01;
  const dur = big ? 1.3 : 0.75;

  // Hiss: bright noise whose colour sweeps down as the flame dies.
  const hiss = noiseSource(c, t, dur);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(7000, t);
  bp.frequency.exponentialRampToValueAtTime(1600, t + dur);
  const hg = c.createGain();
  hg.gain.setValueAtTime(0.0001, t);
  hg.gain.exponentialRampToValueAtTime(big ? 0.4 : 0.32, t + 0.04);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  hiss.connect(hp).connect(bp).connect(hg).connect(master);

  // Crackle: short random pops, like embers.
  const pops = big ? 34 : 16;
  const popOut = c.createBiquadFilter();
  popOut.type = "highpass";
  popOut.frequency.value = 2500;
  popOut.connect(master);
  for (let i = 0; i < pops; i++) {
    const at = t + Math.pow(Math.random(), 1.6) * dur * 0.9;
    const len = 0.004 + Math.random() * 0.012;
    const pop = noiseSource(c, at, len);
    const pg = c.createGain();
    const peak = 0.12 + Math.random() * 0.35;
    pg.gain.setValueAtTime(peak, at);
    pg.gain.exponentialRampToValueAtTime(0.0001, at + len);
    pop.connect(pg).connect(popOut);
  }

  if (kind) {
    DEATHS[kind](c, master, t + 0.05, big ? 1.3 : 1);
    return;
  }

  // Sigh: a voice falling away.
  const sigh = c.createOscillator();
  sigh.type = "sine";
  sigh.frequency.setValueAtTime(big ? 150 : 190, t);
  sigh.frequency.exponentialRampToValueAtTime(48, t + dur * 0.8);
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(big ? 0.28 : 0.2, t + 0.05);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
  sigh.connect(sg).connect(master);
  sigh.start(t);
  sigh.stop(t + dur);
}

/* ───────── Monster voices ───────── */

function env(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number) {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(peak, t + attack);
  p.setValueAtTime(peak, t + attack + hold);
  p.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function osc(c: AudioContext, type: OscillatorType, f: number, t: number, dur: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function filt(c: AudioContext, type: BiquadFilterType, f: number, q = 1): BiquadFilterNode {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function gain(c: AudioContext, v = 1): GainNode {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

/** Wobbles `param` by ±depth at `rate` Hz. */
function wobble(c: AudioContext, param: AudioParam, rate: number, depth: number, t: number, dur: number) {
  const lfo = osc(c, "sine", rate, t, dur);
  lfo.connect(gain(c, depth)).connect(param);
}

/** Vowel-like resonances: [frequency, Q, level]. */
function formants(c: AudioContext, input: AudioNode, out: AudioNode, list: readonly (readonly [number, number, number])[]) {
  for (const [f, q, g] of list)
    input
      .connect(filt(c, "bandpass", f, q))
      .connect(gain(c, g))
      .connect(out);
}

function pan(c: AudioContext, input: AudioNode, out: AudioNode, side: number) {
  if (typeof c.createStereoPanner !== "function") {
    input.connect(out);
    return;
  }
  const p = c.createStereoPanner();
  p.pan.value = side;
  input.connect(p).connect(out);
}

type Voice = (c: AudioContext, out: AudioNode, t: number, p: number) => void;

const VOICES: Record<MonsterKind, Voice> = {
  // Void Wraith: a cold breath with a thin whistle inside it.
  wraith(c, out, t, p) {
    const dur = 1.3;
    const bp = filt(c, "bandpass", 1100 * p, 1.4);
    bp.frequency.setValueAtTime(1100 * p, t);
    bp.frequency.exponentialRampToValueAtTime(380 * p, t + dur);
    const g = gain(c);
    env(g.gain, t, 0.55, 0.35, 0.2, 0.75);
    noiseSource(c, t, dur).connect(bp).connect(g).connect(out);
    const w = osc(c, "sine", 1250 * p, t, dur);
    w.frequency.exponentialRampToValueAtTime(900 * p, t + dur);
    wobble(c, w.frequency, 5.5, 16, t, dur);
    const wg = gain(c);
    env(wg.gain, t, 0.05, 0.4, 0.2, 0.6);
    w.connect(wg).connect(out);
  },
  // Leech: wet bubbling gurgle.
  leech(c, out, t, p) {
    const lp = filt(c, "lowpass", 1500, 0.7);
    lp.connect(out);
    for (let i = 0; i < 8; i++) {
      const at = t + i * 0.07 + Math.random() * 0.04;
      const f0 = (140 + Math.random() * 120) * p;
      const o = osc(c, "sine", f0, at, 0.09);
      o.frequency.exponentialRampToValueAtTime(f0 * 3.2, at + 0.05);
      const g = gain(c);
      env(g.gain, at, 0.24, 0.005, 0.01, 0.06);
      o.connect(g).connect(lp);
    }
    const g = gain(c);
    env(g.gain, t, 0.1, 0.05, 0.3, 0.3);
    noiseSource(c, t, 0.7)
      .connect(filt(c, "lowpass", 450))
      .connect(g)
      .connect(out);
  },
  // Possessor: a rough demonic growl that sinks.
  possessor(c, out, t, p) {
    const dur = 1.0;
    const saw = osc(c, "sawtooth", 84 * p, t, dur);
    saw.frequency.exponentialRampToValueAtTime(52 * p, t + dur);
    const rough = gain(c, 0.6);
    wobble(c, rough.gain, 31, 0.4, t, dur);
    const g = gain(c);
    env(g.gain, t, 0.24, 0.12, 0.4, 0.45);
    saw.connect(rough);
    formants(c, rough, g, [
      [420, 6, 1],
      [1100, 8, 0.5],
      [2600, 10, 0.2],
    ]);
    g.connect(out);
    const sub = osc(c, "sine", 42 * p, t, dur);
    const sg = gain(c);
    env(sg.gain, t, 0.16, 0.1, 0.5, 0.35);
    sub.connect(sg).connect(out);
  },
  // Imp: a quick, squeaky giggle.
  imp(c, out, t, p) {
    const steps = [1.0, 1.15, 1.05, 1.22, 1.1, 0.95];
    steps.forEach((m, i) => {
      const at = t + i * 0.085;
      const f = (1050 + Math.random() * 120) * m * p;
      const o = osc(c, "triangle", f, at, 0.08);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, at + 0.06);
      const g = gain(c);
      env(g.gain, at, 0.3, 0.004, 0.02, 0.05);
      o.connect(g).connect(out);
    });
  },
  // Twin Ghosts: two whispers, one in each ear, a beat apart.
  twins(c, out, t, p) {
    (
      [
        [-0.8, 0, 5.5],
        [0.8, 0.14, 6.4],
      ] as const
    ).forEach(([side, off, rate]) => {
      const at = t + off;
      const dur = 1.1;
      const syll = gain(c, 0.6);
      wobble(c, syll.gain, rate, 0.4, at, dur);
      const g = gain(c);
      env(g.gain, at, 1.1, 0.1, 0.6, 0.35);
      noiseSource(c, at, dur).connect(syll);
      formants(c, syll, g, [
        [650 * p, 5, 1],
        [1150 * p, 6, 0.7],
        [2500 * p, 4, 0.4],
      ]);
      pan(c, g, out, side);
      const tone = osc(c, "sine", (side < 0 ? 660 : 667) * p, at, dur);
      const tg = gain(c);
      env(tg.gain, at, 0.05, 0.3, 0.4, 0.35);
      pan(c, tone.connect(tg), out, side);
    });
  },
  // Zombie: a long, hollow groan.
  zombie(c, out, t, p) {
    const dur = 1.2;
    const saw = osc(c, "sawtooth", 108 * p, t, dur);
    saw.frequency.exponentialRampToValueAtTime(72 * p, t + dur);
    wobble(c, saw.frequency, 4.5, 3, t, dur);
    const lp = filt(c, "lowpass", 1800);
    const g = gain(c);
    env(g.gain, t, 0.7, 0.25, 0.45, 0.5);
    formants(c, saw, lp, [
      [520, 5, 1],
      [920, 6, 0.6],
      [2400, 8, 0.15],
    ]);
    lp.connect(g).connect(out);
    const bg = gain(c);
    env(bg.gain, t, 0.08, 0.2, 0.5, 0.4);
    noiseSource(c, t, dur)
      .connect(filt(c, "lowpass", 900))
      .connect(bg)
      .connect(out);
  },
  // Gremlin: "heh-heh-heh-heh".
  gremlin(c, out, t, p) {
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.14;
      const f = (330 + i * 18) * p;
      const o = osc(c, "sawtooth", f, at, 0.1);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, at + 0.09);
      const g = gain(c);
      env(g.gain, at, 0.5, 0.008, 0.04, 0.05);
      formants(c, o, g, [
        [750, 6, 1],
        [1750, 8, 0.6],
        [2800, 10, 0.3],
      ]);
      g.connect(out);
      const h = gain(c);
      env(h.gain, at, 0.12, 0.004, 0.02, 0.04);
      noiseSource(c, at, 0.08)
        .connect(filt(c, "highpass", 1500))
        .connect(h)
        .connect(out);
    }
  },
};

/** The monster speaks. A new voice cuts off the previous one, so stepping quickly never piles them up. */
export function playVoice(kind: MonsterKind, { pitch = 1, gain: level = 1 }: { pitch?: number; gain?: number } = {}): void {
  const c = live();
  if (!c || !master) return;
  const now = c.currentTime;
  if (voiceBus) {
    const old = voiceBus;
    old.gain.cancelScheduledValues(now);
    old.gain.setTargetAtTime(0, now, 0.03);
    setTimeout(() => old.disconnect(), 400);
  }
  const out = gain(c, level);
  out.connect(master);
  voiceBus = out;
  VOICES[kind](c, out, now + 0.01, pitch);
}

/* ───────── Creature deaths: a texture under the hiss, one per monster ───────── */

type Death = (c: AudioContext, out: AudioNode, t: number, size: number) => void;

const DEATHS: Record<MonsterKind, Death> = {
  // Void Wraith: a long breath of air sucked away.
  wraith(c, out, t, size) {
    const bp = filt(c, "bandpass", 600, 0.8);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.7 * size);
    const g = gain(c);
    env(g.gain, t, 0.22, 0.08, 0.2, 0.5 * size);
    noiseSource(c, t, 0.9 * size)
      .connect(bp)
      .connect(g)
      .connect(out);
  },
  // Leech: a wet pop, then the stolen energy fizzing out.
  leech(c, out, t) {
    const o = osc(c, "sine", 180, t + 0.25, 0.15);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.38);
    const g = gain(c);
    env(g.gain, t + 0.25, 0.4, 0.004, 0.02, 0.12);
    o.connect(g).connect(out);
    for (let i = 0; i < 6; i++) {
      const at = t + 0.3 + i * 0.06;
      const z = osc(c, "sine", 1400 + i * 260, at, 0.05);
      const zg = gain(c);
      env(zg.gain, at, 0.05, 0.004, 0.01, 0.04);
      z.connect(zg).connect(out);
    }
  },
  // Possessor: runes cracking, a low burning roar.
  possessor(c, out, t, size) {
    const g = gain(c);
    env(g.gain, t, 0.3, 0.05, 0.3, 0.5 * size);
    noiseSource(c, t, 0.9 * size)
      .connect(filt(c, "lowpass", 700))
      .connect(g)
      .connect(out);
    for (let i = 0; i < 5; i++) {
      const at = t + 0.08 + i * 0.11;
      const k = gain(c);
      env(k.gain, at, 0.35, 0.002, 0.01, 0.05);
      noiseSource(c, at, 0.06)
        .connect(filt(c, "bandpass", 900 + i * 300, 3))
        .connect(k)
        .connect(out);
    }
  },
  // Imp: a bright pop and a whoosh upward.
  imp(c, out, t) {
    const o = osc(c, "triangle", 500, t, 0.25);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.22);
    const g = gain(c);
    env(g.gain, t, 0.2, 0.01, 0.05, 0.18);
    o.connect(g).connect(out);
  },
  // Twin Ghosts: two shimmering tones drifting apart, one in each ear.
  twins(c, out, t, size) {
    ([-0.8, 0.8] as const).forEach((side, i) => {
      const o = osc(c, "sine", 880, t, 0.9 * size);
      o.frequency.exponentialRampToValueAtTime(i ? 1320 : 587, t + 0.8 * size);
      const g = gain(c);
      env(g.gain, t, 0.08, 0.1, 0.3, 0.45 * size);
      pan(c, o.connect(g), out, side);
    });
  },
  // Zombie: bones and dirt crumbling.
  zombie(c, out, t) {
    for (let i = 0; i < 9; i++) {
      const at = t + i * 0.055 + Math.random() * 0.03;
      const k = gain(c);
      env(k.gain, at, 0.28 - i * 0.02, 0.003, 0.02, 0.07);
      noiseSource(c, at, 0.1)
        .connect(filt(c, "lowpass", 500 + Math.random() * 400))
        .connect(k)
        .connect(out);
    }
  },
  // Gremlin: a tinkling shower of sparks.
  gremlin(c, out, t) {
    for (let i = 0; i < 8; i++) {
      const at = t + i * 0.045;
      const f = 2000 + Math.random() * 2600;
      const o = osc(c, "sine", f, at, 0.12);
      const g = gain(c);
      env(g.gain, at, 0.06, 0.003, 0.01, 0.1);
      o.connect(g).connect(out);
    }
  },
};

/* ───────── Small cues ───────── */

let lastHover = 0;

/** A faint breath when the cursor finds a monster. Throttled so sweeping across chips stays quiet. */
export function playHover(kind: MonsterKind): void {
  const c = live();
  if (!c || !master) return;
  const now = c.currentTime;
  if (now - lastHover < 0.35) return;
  lastHover = now;
  const pitch: Record<MonsterKind, number> = { wraith: 520, leech: 300, possessor: 220, imp: 900, twins: 660, zombie: 180, gremlin: 760 };
  const o = osc(c, "sine", pitch[kind], now, 0.18);
  o.frequency.exponentialRampToValueAtTime(pitch[kind] * 0.82, now + 0.16);
  const g = gain(c);
  env(g.gain, now, 0.035, 0.02, 0.03, 0.12);
  o.connect(g).connect(master);
}

/** Monsters climbing out of the code: a low swell and a stinger, heavier when something HIGH lurks. */
export function playEmergence(worst: "LOW" | "MED" | "HIGH" | "CRITICAL"): void {
  const c = live();
  if (!c || !master) return;
  const t = c.currentTime + 0.02;
  const weight = worst === "CRITICAL" ? 1.15 : worst === "HIGH" ? 1 : worst === "MED" ? 0.7 : 0.45;
  const sw = osc(c, "sawtooth", 46, t, 1.4);
  sw.frequency.exponentialRampToValueAtTime(62, t + 1.2);
  const lp = filt(c, "lowpass", 260);
  lp.frequency.exponentialRampToValueAtTime(900, t + 1.1);
  const g = gain(c);
  env(g.gain, t, 0.22 * weight, 0.6, 0.2, 0.55);
  sw.connect(lp).connect(g).connect(master);
  const st = osc(c, "triangle", 233, t + 0.75, 0.6);
  const st2 = osc(c, "triangle", 247, t + 0.75, 0.6);
  const sg = gain(c);
  env(sg.gain, t + 0.75, 0.09 * weight, 0.01, 0.1, 0.45);
  st.connect(sg);
  st2.connect(sg);
  sg.connect(master);
}

/** The spell fizzles: the fix no longer applies. */
export function playResist(): void {
  const c = live();
  if (!c || !master) return;
  const t = c.currentTime + 0.01;
  for (const f of [110, 116.5]) {
    const o = osc(c, "square", f, t, 0.35);
    const g = gain(c);
    env(g.gain, t, 0.06, 0.01, 0.12, 0.2);
    o.connect(filt(c, "lowpass", 600))
      .connect(g)
      .connect(master);
  }
}

/** A bell when the room is clear. `small` is a short chime for one cleared file. */
export function playCleansed({ small = false }: { small?: boolean } = {}): void {
  const c = live();
  if (!c || !master) return;
  const t = c.currentTime + 0.02;
  const bell = (base: number, at: number, level: number, decay: number) => {
    for (const [ratio, g] of [
      [1, 1],
      [2, 0.5],
      [2.76, 0.35],
      [5.4, 0.2],
      [8.93, 0.1],
    ] as const) {
      const o = osc(c, "sine", base * ratio, at, decay);
      const og = gain(c);
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(level * g, at + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0001, at + decay / Math.pow(ratio, 0.35));
      o.connect(og).connect(master!);
    }
  };
  if (small) {
    bell(880, t, 0.16, 1.4);
    return;
  }
  bell(523.25, t, 0.26, 3.2);
  bell(783.99, t + 0.35, 0.17, 2.8);
  // A warm chord swells under the bells: the light coming back.
  const lp = filt(c, "lowpass", 1500, 0.5);
  const pad = gain(c);
  env(pad.gain, t, 0.22, 0.7, 0.8, 1.8);
  lp.connect(pad).connect(master);
  for (const f of [261.63, 329.63, 392, 523.25]) osc(c, "triangle", f, t, 3.4).connect(gain(c, 0.25)).connect(lp);
  // A rising arpeggio: the sun clearing the horizon.
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    const at = t + 0.55 + i * 0.12;
    const o = osc(c, "triangle", f, at, 1.2);
    const g = gain(c);
    env(g.gain, at, 0.07, 0.01, 0.15, 0.9);
    o.connect(g).connect(master!);
  });
  // Daybreak: a few birds wake up, one on each side.
  birdsong(c, t + 1.6);
}

/** Soft dawn chirps: quick rising whistles in short phrases, left and right. */
function birdsong(c: AudioContext, t: number) {
  if (!master) return;
  const phrases: [number, number, number, number][] = [
    // start, side, base pitch, chirps
    [0, -0.6, 3200, 3],
    [0.55, 0.5, 3900, 2],
    [1.25, -0.3, 3500, 4],
    [2.1, 0.7, 4200, 2],
  ];
  for (const [start, side, base, count] of phrases) {
    const out = gain(c, 1);
    pan(c, out, master, side);
    for (let i = 0; i < count; i++) {
      const at = t + start + i * (0.09 + Math.random() * 0.03);
      const f = base * (0.94 + Math.random() * 0.12);
      const o = osc(c, "sine", f, at, 0.08);
      o.frequency.exponentialRampToValueAtTime(f * 1.45, at + 0.05);
      o.frequency.exponentialRampToValueAtTime(f * 1.1, at + 0.075);
      const g = gain(c);
      env(g.gain, at, 0.07, 0.008, 0.03, 0.04);
      o.connect(g).connect(out);
    }
  }
}

/** A heavy door creaking open: a slow "stick-slip" buzz through wooden resonances. */
export function playCreak(): void {
  const c = live();
  if (!c || !master) return;
  const t = c.currentTime + 0.02;
  const dur = 1.5;

  const src = c.createOscillator();
  src.type = "sawtooth";
  // The rate of the slips wanders, which is what makes a hinge sound like a hinge.
  const curve = new Float32Array([16, 24, 34, 28, 21, 30, 42, 36, 26, 20]);
  src.frequency.setValueCurveAtTime(curve, t, dur);

  const body = c.createGain();
  body.gain.setValueAtTime(0.0001, t);
  body.gain.exponentialRampToValueAtTime(0.55, t + 0.18);
  body.gain.setValueAtTime(0.55, t + dur - 0.45);
  body.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const mix = c.createGain();
  mix.gain.value = 3.6;
  for (const [f, q, g] of [
    [480, 14, 1],
    [1120, 16, 0.7],
    [2350, 18, 0.35],
  ] as const) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(f, t);
    bp.frequency.linearRampToValueAtTime(f * 1.12, t + dur);
    bp.Q.value = q;
    const bg = c.createGain();
    bg.gain.value = g;
    body.connect(bp).connect(bg).connect(mix);
  }
  mix.connect(master);
  src.connect(body);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function buildDrone(c: AudioContext, out: AudioNode) {
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  lp.Q.value = 0.5;

  // A slow swell so the drone breathes instead of humming.
  const tremolo = c.createGain();
  tremolo.gain.value = 0.75;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = c.createGain();
  depth.gain.value = 0.25;
  lfo.connect(depth).connect(tremolo.gain);

  const nodes: AudioScheduledSourceNode[] = [lfo];
  const now = c.currentTime;
  for (const [type, f, g] of [
    ["sine", 55, 0.5],
    ["sine", 55.45, 0.5],
    ["triangle", 82.4, 0.18],
    ["sine", 110.3, 0.08],
  ] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start(now);
    nodes.push(o);
  }

  // A faint draught of wind through the crypt.
  const wind = noiseSource(c, c.currentTime);
  const wf = c.createBiquadFilter();
  wf.type = "bandpass";
  wf.frequency.value = 260;
  wf.Q.value = 0.6;
  const wg = c.createGain();
  wg.gain.value = 0.12;
  wind.connect(wf).connect(wg).connect(lp);
  nodes.push(wind);

  lfo.start(now);
  lp.connect(tremolo).connect(out);
  return nodes;
}

function applyDrone() {
  const c = live();
  if (!c || !master) return;
  if (droneLevel <= 0) {
    if (!drone) return;
    drone.out.gain.cancelScheduledValues(c.currentTime);
    drone.out.gain.setTargetAtTime(0, c.currentTime, 0.8);
    if (droneStop) clearTimeout(droneStop);
    droneStop = setTimeout(killDrone, 4000);
    return;
  }
  if (droneStop) {
    clearTimeout(droneStop);
    droneStop = null;
  }
  if (!drone) {
    const out = c.createGain();
    out.gain.value = 0;
    out.connect(master);
    drone = { out, nodes: buildDrone(c, out) };
  }
  drone.out.gain.cancelScheduledValues(c.currentTime);
  drone.out.gain.setTargetAtTime(DRONE_MAX * droneLevel, c.currentTime, 1.2);
}

function killDrone() {
  if (droneStop) {
    clearTimeout(droneStop);
    droneStop = null;
  }
  if (!drone) return;
  for (const n of drone.nodes) {
    try {
      n.stop();
    } catch {
      /* already stopped */
    }
  }
  drone.out.disconnect();
  drone = null;
}

/** 0 silences the drone; 1 is its loudest (still very quiet). */
export function setDrone(level: number): void {
  droneLevel = Math.max(0, Math.min(1, level));
  applyDrone();
}

/** Test helper: forget the context and every setting. */
export function resetSoundForTests(): void {
  killDrone();
  listen(false);
  voiceBus = null;
  lastHover = 0;
  enabled = false;
  droneLevel = 0;
  ctx = null;
  master = null;
  noiseBuf = null;
}
