/**
 * Web-Audio synth engine for StudyQuest's gameplay sounds.
 *
 * Design principles:
 *   - Lazy AudioContext (must be created from a user gesture per browser
 *     autoplay policy). All public play* functions are safe to call from a
 *     React handler — they'll quietly no-op if the context can't start.
 *   - Single shared AudioContext + master gain. Master gain is the mute
 *     switch (0 vs target volume). Volume capped at MAX_VOLUME.
 *   - All sounds are short (< 500ms, fanfares ≤ 1.5s) and self-disconnect.
 *   - No looping. No ambient music. No harsh frequencies.
 *   - Synthesized via primitive oscillators — no asset files to ship.
 *
 * The mute state lives in localStorage under STORAGE_KEY. Components read
 * and toggle it via the `useSound` hook.
 */

const STORAGE_KEY = "sq:sound-muted";
const MAX_VOLUME = 0.28; // Cap so sounds are present but never blaring.
const DEFAULT_MUTED = true; // Visitors start muted; opt-in via toggle.

/** Custom event fired when mute state changes — React hook listens to it. */
const MUTE_CHANGE_EVENT = "sq:sound-mute-change";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function isSSR() {
  return typeof window === "undefined";
}

/** Read mute state from localStorage. Server-safe. */
export function isMuted(): boolean {
  if (isSSR()) return DEFAULT_MUTED;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === null) return DEFAULT_MUTED;
  return v === "1";
}

/** Toggle mute and broadcast the change. */
export function setMuted(next: boolean) {
  if (isSSR()) return;
  window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(next ? 0 : MAX_VOLUME, ctx.currentTime);
  }
  window.dispatchEvent(new CustomEvent(MUTE_CHANGE_EVENT));
}

export function subscribeMute(cb: () => void): () => void {
  if (isSSR()) return () => {};
  window.addEventListener(MUTE_CHANGE_EVENT, cb);
  return () => window.removeEventListener(MUTE_CHANGE_EVENT, cb);
}

/** Lazy-create the AudioContext on first user gesture. */
function getContext(): AudioContext | null {
  if (isSSR()) return null;
  if (ctx) {
    // Some browsers suspend on tab switch — try to resume.
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = isMuted() ? 0 : MAX_VOLUME;
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

interface NoteOpts {
  freq: number;
  duration: number; // seconds
  delay?: number; // seconds from now
  type?: OscillatorType;
  /** Peak gain 0–1, applied AFTER master. Default 1.0 */
  gain?: number;
  /** Frequency to slide TO over the duration. Optional. */
  slideTo?: number;
}

/** Play one tone with an ADSR-ish envelope. Self-disconnects. */
function playNote(opts: NoteOpts) {
  const c = getContext();
  if (!c || !masterGain) return;
  if (isMuted()) return;

  const t0 = c.currentTime + (opts.delay ?? 0);
  const t1 = t0 + opts.duration;
  const peakGain = (opts.gain ?? 1) * 1.0; // master handles overall volume

  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.slideTo),
      t1
    );
  }

  const gainNode = c.createGain();
  // Quick attack, gentle release.
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(peakGain, t0 + 0.005);
  gainNode.gain.setValueAtTime(peakGain, t0 + opts.duration * 0.7);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t1);

  osc.connect(gainNode);
  gainNode.connect(masterGain);
  osc.start(t0);
  osc.stop(t1 + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gainNode.disconnect();
  };
}

// ─── Public sound bank ──────────────────────────────────────────────────────
// Each function is safe to call from any React handler.

/** Short ascending major arpeggio: C5 → E5 → G5. ~180ms. */
export function playCorrect() {
  playNote({ freq: 523.25, duration: 0.07, type: "sine", gain: 0.7 }); // C5
  playNote({ freq: 659.25, duration: 0.07, type: "sine", gain: 0.7, delay: 0.06 }); // E5
  playNote({ freq: 783.99, duration: 0.1, type: "sine", gain: 0.7, delay: 0.12 }); // G5
}

/** Soft descending two-tone: A4 → F4. NOT harsh, no scolding. */
export function playWrong() {
  playNote({ freq: 440, duration: 0.1, type: "triangle", gain: 0.5 });
  playNote({ freq: 349.23, duration: 0.14, type: "triangle", gain: 0.5, delay: 0.08 });
}

/** XP burst ping. Higher pitch tier = higher reward tier. */
export function playXp(tier: "normal" | "big" | "critical" = "normal") {
  const freq = tier === "critical" ? 1175 : tier === "big" ? 988 : 784;
  playNote({ freq, duration: 0.12, type: "sine", gain: 0.55, slideTo: freq * 1.4 });
  if (tier === "critical") {
    // Add a sparkle harmonic on top.
    playNote({ freq: freq * 2, duration: 0.18, type: "sine", gain: 0.3, delay: 0.04 });
  }
}

/** Combo escalation. Pitch climbs with combo count; clamps at high range. */
export function playCombo(count: number) {
  const base = 600;
  const freq = Math.min(base + count * 80, 1400);
  playNote({ freq, duration: 0.08, type: "square", gain: 0.4 });
  playNote({
    freq: freq * 1.5,
    duration: 0.06,
    type: "sine",
    gain: 0.25,
    delay: 0.02,
  });
}

/** Critical hit — bigger stacked thunk. */
export function playCritical() {
  playNote({ freq: 130.81, duration: 0.18, type: "sawtooth", gain: 0.35 }); // C3
  playNote({ freq: 196, duration: 0.18, type: "sine", gain: 0.45 }); // G3
  playNote({ freq: 261.63, duration: 0.22, type: "sine", gain: 0.55, delay: 0.02 }); // C4
  playNote({ freq: 1046.5, duration: 0.12, type: "sine", gain: 0.3, delay: 0.06 }); // C6 sparkle
}

/** Level-up celebration arpeggio. ~520ms total. */
export function playLevelUp() {
  const notes = [
    { freq: 523.25, t: 0.0 }, // C5
    { freq: 659.25, t: 0.08 }, // E5
    { freq: 783.99, t: 0.16 }, // G5
    { freq: 1046.5, t: 0.24 }, // C6
    { freq: 1318.51, t: 0.36 }, // E6
  ];
  notes.forEach((n) =>
    playNote({ freq: n.freq, duration: 0.18, type: "sine", gain: 0.65, delay: n.t })
  );
  // Triad sustain at the end
  playNote({ freq: 523.25, duration: 0.4, type: "sine", gain: 0.4, delay: 0.42 });
  playNote({ freq: 659.25, duration: 0.4, type: "sine", gain: 0.4, delay: 0.42 });
  playNote({ freq: 783.99, duration: 0.4, type: "sine", gain: 0.4, delay: 0.42 });
}

/** Achievement unlock fanfare. ~400ms. */
export function playAchievement() {
  // Stacked major triad with a sparkle ping
  playNote({ freq: 523.25, duration: 0.3, type: "sine", gain: 0.5 });
  playNote({ freq: 659.25, duration: 0.3, type: "sine", gain: 0.5 });
  playNote({ freq: 783.99, duration: 0.3, type: "sine", gain: 0.5 });
  playNote({ freq: 1568, duration: 0.18, type: "sine", gain: 0.35, delay: 0.18 });
}

/** Boss combat hit (you took damage). Sharp percussive. */
export function playBossHit() {
  playNote({ freq: 110, duration: 0.08, type: "sawtooth", gain: 0.5, slideTo: 70 });
  playNote({ freq: 220, duration: 0.05, type: "square", gain: 0.3 });
}

/** Boss combat miss (you dealt damage). Soft thud. */
export function playBossMiss() {
  playNote({ freq: 165, duration: 0.1, type: "triangle", gain: 0.45 });
}

/** Boss defeat — dramatic descending. */
export function playBossDefeat() {
  playNote({ freq: 349.23, duration: 0.2, type: "sine", gain: 0.55 }); // F4
  playNote({ freq: 261.63, duration: 0.25, type: "sine", gain: 0.55, delay: 0.18 }); // C4
  playNote({ freq: 130.81, duration: 0.5, type: "sine", gain: 0.5, delay: 0.4 }); // C3
}

/** Review session complete — satisfying soft up-tone. */
export function playReviewComplete() {
  playNote({ freq: 587.33, duration: 0.12, type: "sine", gain: 0.55 }); // D5
  playNote({ freq: 880, duration: 0.18, type: "sine", gain: 0.5, delay: 0.1 }); // A5
}
