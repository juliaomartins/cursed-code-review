/**
 * Crypt sounds, made in the browser with Web Audio: no audio files.
 *
 * Nothing plays until the visitor turns sound on, and the AudioContext is only
 * created inside a click or key press (`unlock`), so browsers never block it.
 */

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = false;
let droneLevel = 0;
let drone: { out: GainNode; nodes: AudioScheduledSourceNode[] } | null = null;
let droneStop: ReturnType<typeof setTimeout> | null = null;
let listening = false;

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

/** Hiss and crackle as a monster burns away, with a falling sigh under it. */
export function playBanish({ big = false }: { big?: boolean } = {}): void {
  const c = live();
  if (!c || !master) return;
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

  // Sigh: the monster's voice falling away.
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
  enabled = false;
  droneLevel = 0;
  ctx = null;
  master = null;
  noiseBuf = null;
}
