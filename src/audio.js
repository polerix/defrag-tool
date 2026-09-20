// ─── Procedural HDD audio ──────────────────────────────────────────────────
// defrag98.com's standout feature is real recorded HDD click/grind samples.
// We get the same payoff — audible seeks, a grinding sweep, explosions,
// chomps — without shipping audio assets, by synthesizing everything with
// the Web Audio API. Browsers block audio until a user gesture, so the
// AudioContext is created lazily on first click/keypress (see unlock()).

let ctx = null;
let muted = false;
let unlocked = false;

// iOS Safari's autoplay gate is stricter than "call resume() somewhere
// inside a gesture handler": resume() returns a promise that often
// resolves *after* the gesture has ended, which iOS treats as never
// having unlocked at all. The reliable fix is to synchronously start a
// zero-length buffer source from inside the gesture handler itself —
// that's what actually wakes the hardware audio pipeline.
function primeSilentBuffer() {
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  primeSilentBuffer();
  unlocked = true;
}

export function initAudio() {
  // touchend is Apple's documented reliable target (touchstart can be
  // absorbed by a scroll/cancel gesture); the rest cover mouse/keyboard
  // and non-iOS mobile browsers. Keep listening — and re-priming — on
  // every one of these events until we've actually unlocked, since a
  // single missed/ignored gesture on iOS is common.
  const events = ['touchend', 'pointerdown', 'mousedown', 'keydown'];
  const handler = () => {
    unlock();
    if (unlocked) events.forEach(ev => document.removeEventListener(ev, handler));
  };
  events.forEach(ev => document.addEventListener(ev, handler, { passive: true }));
}

export function isMuted() { return muted; }
export function setMuted(v) { muted = v; }
export function toggleMuted() { muted = !muted; return muted; }

function ready() {
  if (!ctx || muted) return false;
  if (ctx.state === 'suspended') {
    // mobile OSes can re-suspend an unlocked context (e.g. on
    // backgrounding) — try to self-heal rather than staying silent.
    ctx.resume().catch(() => {});
    return false;
  }
  return ctx.state === 'running';
}

// short filtered noise burst — the "click" of a head seek
function noiseBurst({ dur = 0.03, freq = 2200, q = 6, gain = 0.12 } = {}) {
  if (!ready()) return;
  const now = ctx.currentTime;
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur + 0.02);
}

function tone({ freq = 440, dur = 0.09, type = 'square', gain = 0.06, slideTo = null } = {}) {
  if (!ready()) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

// ── Public sound events ─────────────────────────────────────────────────

// HDD seek/write click — fired once per defrag tick
export function playSeek() {
  const freq = 1800 + Math.random() * 1400;
  noiseBurst({ dur: 0.02 + Math.random() * 0.015, freq, q: 8, gain: 0.09 });
}

// Bomb detonation
export function playExplosion() {
  noiseBurst({ dur: 0.35, freq: 300, q: 0.6, gain: 0.22 });
  tone({ freq: 180, dur: 0.4, type: 'sawtooth', gain: 0.14, slideTo: 40 });
}

// ? cell releasing anomalies — whoosh
export function playRelease() {
  noiseBurst({ dur: 0.18, freq: 900, q: 1.2, gain: 0.1 });
}

// Chomper (flag) deployed
export function playDeploy() {
  tone({ freq: 220, dur: 0.08, type: 'square', gain: 0.07, slideTo: 440 });
}

// Pac-Man eats an emoji
export function playChomp() {
  tone({ freq: 520, dur: 0.06, type: 'square', gain: 0.06, slideTo: 220 });
}

// Defrag complete chime
export function playComplete() {
  if (!ready()) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => tone({ freq, dur: 0.22, type: 'triangle', gain: 0.08 }), i * 110);
  });
}

// UI toggle / drive switch click
export function playClick() {
  tone({ freq: 700, dur: 0.03, type: 'square', gain: 0.05 });
}

// Disruption event (rearrange / fall / corrupt / vanish / reappear) —
// a short warble, distinct from the mechanical seek/explosion sounds.
export function playGlitch() {
  if (!ready()) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.linearRampToValueAtTime(140, now + 0.22);
  osc.frequency.linearRampToValueAtTime(500, now + 0.3);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.09, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.34);

  noiseBurst({ dur: 0.05, freq: 3000, q: 4, gain: 0.04 });
}
