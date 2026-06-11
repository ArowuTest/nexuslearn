/**
 * Tiny Web Audio synth — soft, child-friendly UI sounds with zero asset
 * downloads. All sounds are short sine/triangle chimes; nothing harsh.
 */
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}

function tone(freq: number, dur: number, delay = 0, type: OscillatorType = "sine", gain = 0.12) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap: () => tone(520, 0.08, 0, "triangle", 0.07),
  correct: () => {
    tone(523, 0.12);
    tone(659, 0.12, 0.09);
    tone(784, 0.22, 0.18);
  },
  gentle: () => {
    tone(330, 0.18, 0, "sine", 0.08);
    tone(294, 0.25, 0.14, "sine", 0.08);
  },
  charge: () => tone(880, 0.1, 0, "triangle", 0.06),
  hatch: () => {
    [523, 587, 659, 784, 880, 1047].forEach((f, i) => tone(f, 0.16, i * 0.09));
  },
};
