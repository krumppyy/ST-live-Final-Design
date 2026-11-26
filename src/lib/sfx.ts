// Lightweight synthesized Web Audio SFX for Camera shutter and Multiplayer Games
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playShutterSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.055);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

export function playDiceSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [0, 0.05, 0.11].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340 + i * 95, now + offset);
    gain.gain.setValueAtTime(0.09, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.05);
  });
}

export function playStepSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.085);
}

export function playVictorySfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.1);
    gain.gain.setValueAtTime(0.11, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.26);
  });
}

export function playFpsShotSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Punchy plasma-ballistic pulse
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  // Crisp transient crack
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.11, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
}

export function playFpsHitSfx(headshot = false) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(headshot ? 1680 : 1080, now);
  osc.frequency.exponentialRampToValueAtTime(headshot ? 2200 : 720, now + 0.055);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

export function playFpsKillSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [660, 990].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.065);
    gain.gain.setValueAtTime(0.13, now + idx * 0.065);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.065);
    osc.stop(now + idx * 0.065 + 0.17);
  });
}

export function playFpsReloadSfx() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [280, 460].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);
    gain.gain.setValueAtTime(0.06, now + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.06);
  });
}

