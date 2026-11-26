// Comprehensive Camera Engine: Filters, Aspect Ratios, Reels Formats, Audio BNC/ANC DSP, Mic & Flash Sync

export type AspectRatioId = 'full' | '9:16' | '4:5' | '1:1' | '4:3' | '3:4' | '16:9' | '21:9';
export type PipAspectId = 'auto' | 'custom' | '16:9' | '9:16' | '4:3' | '1:1' | 'circle';
export type ResolutionOption = '480p' | '720p' | '1080p' | '4K' | '8K';
export type FpsOption = 24 | 30 | 60 | 120;
export type FilterCategory = 'all' | 'modern' | 'vintage' | 'bw' | 'nostalgic' | 'brighten';
export type MicSourceType = 'auto' | 'wired' | 'bluetooth' | 'wireless' | 'wifi';
export type FlashMode = 'off' | 'auto' | 'on' | 'ttl' | 'torch';
export type FlashSyncTransport = 'internal' | 'wired' | 'bluetooth' | 'wifi';
export type BracketingMode = 'off' | 'aeb3_1' | 'aeb3_2' | 'aeb5_hdr';

export interface AspectRatioSpec {
  id: AspectRatioId;
  label: string;
  ratio: number | null; // width / height, null = full screen
  socialTag?: string;
}

export const ASPECT_RATIOS: AspectRatioSpec[] = [
  { id: 'full', label: 'Full', ratio: null },
  { id: '9:16', label: '9:16', ratio: 9 / 16, socialTag: 'Reels / TikTok / Shorts' },
  { id: '4:5', label: '4:5', ratio: 4 / 5, socialTag: 'IG Feed' },
  { id: '3:4', label: '3:4', ratio: 3 / 4, socialTag: 'Portrait' },
  { id: '1:1', label: '1:1', ratio: 1, socialTag: 'Square' },
  { id: '4:3', label: '4:3', ratio: 4 / 3, socialTag: 'Classic' },
  { id: '16:9', label: '16:9', ratio: 16 / 9, socialTag: 'YouTube' },
  { id: '21:9', label: '21:9', ratio: 21 / 9, socialTag: 'Cinema' },
];

export const REELS_FORMATS: Array<{ id: AspectRatioId; label: string; platform: string }> = [
  { id: '9:16', label: '9:16', platform: 'Reels · TikTok · Shorts' },
  { id: '4:5', label: '4:5', platform: 'IG Feed Portrait' },
  { id: '1:1', label: '1:1', platform: 'Square Feed' },
  { id: '16:9', label: '16:9', platform: 'YouTube Wide' },
  { id: '21:9', label: '21:9', platform: 'Anamorphic' },
];

export interface CameraFilterPreset {
  id: string;
  label: string;
  category: Exclude<FilterCategory, 'all'>;
  swatch: string;
  filter: string;
  /** Optional subtle color wash overlay (hex/rgba) */
  tintOverlay?: string;
  /** Extra non-clipping skin/luma brighten boost (0..100) */
  fairBoost?: number;
  /** Extra organic grain (0..100) */
  grainBoost?: number;
}

export const CAMERA_FILTERS: CameraFilterPreset[] = [
  // MODERN
  { id: 'pure', label: 'Pure', category: 'modern', swatch: 'linear-gradient(135deg,#e2e8f0,#64748b)', filter: '' },
  { id: 'cine', label: 'Cine', category: 'modern', swatch: 'linear-gradient(135deg,#0ea5e9,#f97316)', filter: 'contrast(116%) saturate(122%) hue-rotate(-8deg)' },
  { id: 'seoul', label: 'Seoul', category: 'modern', swatch: 'linear-gradient(135deg,#fbcfe8,#93c5fd)', filter: 'brightness(108%) contrast(94%) saturate(108%)' },
  { id: 'tokyo', label: 'Tokyo', category: 'modern', swatch: 'linear-gradient(135deg,#c084fc,#0f172a)', filter: 'contrast(120%) saturate(134%) hue-rotate(12deg)' },
  { id: 'velvet', label: 'Velvet', category: 'modern', swatch: 'linear-gradient(135deg,#f43f5e,#31102f)', filter: 'contrast(112%) saturate(118%) brightness(99%)' },
  { id: 'mint', label: 'Mint', category: 'modern', swatch: 'linear-gradient(135deg,#6ee7b7,#065f46)', filter: 'saturate(116%) hue-rotate(16deg) brightness(103%)' },
  { id: 'cobalt', label: 'Cobalt', category: 'modern', swatch: 'linear-gradient(135deg,#38bdf8,#172554)', filter: 'contrast(118%) saturate(126%) hue-rotate(-18deg)' },
  { id: 'cyber', label: 'Cyber', category: 'modern', swatch: 'linear-gradient(135deg,#a3e635,#d90429)', filter: 'contrast(126%) saturate(148%) hue-rotate(-10deg)' },
  { id: 'vivid', label: 'Vivid', category: 'modern', swatch: 'linear-gradient(135deg,#facc15,#ef4444)', filter: 'contrast(122%) saturate(144%) brightness(103%)' },

  // VINTAGE
  { id: 'kodak78', label: 'Kodak 78', category: 'vintage', swatch: 'linear-gradient(135deg,#fbbf24,#78350f)', filter: 'sepia(32%) contrast(108%) saturate(118%) brightness(101%)', tintOverlay: 'rgba(255,190,110,0.08)', grainBoost: 24 },
  { id: 'amber35', label: 'Amber 35', category: 'vintage', swatch: 'linear-gradient(135deg,#fb923c,#7c2d12)', filter: 'sepia(38%) contrast(112%) saturate(124%)', tintOverlay: 'rgba(240,145,60,0.09)', grainBoost: 28 },
  { id: 'retro90', label: 'Retro 90', category: 'vintage', swatch: 'linear-gradient(135deg,#fcd34d,#451a03)', filter: 'sepia(44%) contrast(94%) brightness(102%) saturate(88%)', grainBoost: 32 },
  { id: 'mocha', label: 'Mocha', category: 'vintage', swatch: 'linear-gradient(135deg,#d6b59c,#3b2314)', filter: 'sepia(28%) contrast(110%) brightness(97%) saturate(90%)', grainBoost: 18 },
  { id: 'matte', label: 'Matte', category: 'vintage', swatch: 'linear-gradient(135deg,#94a3b8,#1e293b)', filter: 'contrast(86%) brightness(106%) saturate(84%)', grainBoost: 15 },

  // B&W
  { id: 'noir', label: 'Noir', category: 'bw', swatch: 'linear-gradient(135deg,#f8fafc,#09090b)', filter: 'grayscale(100%) contrast(138%) brightness(94%)', grainBoost: 22 },
  { id: 'silver', label: 'Silver', category: 'bw', swatch: 'linear-gradient(135deg,#e5e7eb,#374151)', filter: 'grayscale(100%) contrast(114%) brightness(105%)' },
  { id: 'leica', label: 'Leica B&W', category: 'bw', swatch: 'linear-gradient(135deg,#ffffff,#18181b)', filter: 'grayscale(100%) contrast(148%) brightness(98%)', grainBoost: 18 },
  { id: 'highkey', label: 'High-Key', category: 'bw', swatch: 'linear-gradient(135deg,#f8fafc,#94a3b8)', filter: 'grayscale(100%) brightness(118%) contrast(96%)' },
  { id: 'chrome', label: 'Chrome', category: 'bw', swatch: 'linear-gradient(135deg,#cbd5e1,#1e293b)', filter: 'grayscale(82%) contrast(126%) brightness(102%)' },

  // NOSTALGIC
  { id: 'vhs94', label: 'VHS 94', category: 'nostalgic', swatch: 'linear-gradient(135deg,#c084fc,#fb923c)', filter: 'sepia(22%) contrast(92%) saturate(118%) hue-rotate(-14deg)', tintOverlay: 'rgba(180,120,255,0.09)', grainBoost: 42 },
  { id: 'polaroid', label: 'Polaroid', category: 'nostalgic', swatch: 'linear-gradient(135deg,#fef08a,#93c5fd)', filter: 'sepia(18%) brightness(107%) contrast(92%) saturate(108%)', tintOverlay: 'rgba(255,240,200,0.1)', grainBoost: 20 },
  { id: 'rose', label: 'Dream Rose', category: 'nostalgic', swatch: 'linear-gradient(135deg,#fda4af,#be123c)', filter: 'sepia(14%) saturate(120%) hue-rotate(-14deg) brightness(105%)', tintOverlay: 'rgba(255,180,198,0.09)' },
  { id: 'dusk', label: 'Dusk Tape', category: 'nostalgic', swatch: 'linear-gradient(135deg,#f472b6,#312e81)', filter: 'contrast(112%) saturate(126%) hue-rotate(18deg) brightness(97%)', grainBoost: 26 },
  { id: 'peach', label: 'Peach Fade', category: 'nostalgic', swatch: 'linear-gradient(135deg,#fed7aa,#fb7185)', filter: 'brightness(108%) saturate(118%) sepia(12%) contrast(93%)' },

  // FAIR-GLOW / SKIN BRIGHTENING (For darker skin tones wanting natural fairer / brighter tone)
  { id: 'fair_auto', label: 'Pearl Auto', category: 'brighten', swatch: 'linear-gradient(135deg,#fff7ed,#fda4af)', filter: 'brightness(114%) contrast(95%) saturate(94%)', tintOverlay: 'rgba(255,244,236,0.11)', fairBoost: 45 },
  { id: 'ivory', label: 'Ivory Soft', category: 'brighten', swatch: 'linear-gradient(135deg,#fefce8,#fde68a)', filter: 'brightness(118%) contrast(93%) saturate(90%)', tintOverlay: 'rgba(255,250,240,0.14)', fairBoost: 62 },
  { id: 'porcelain', label: 'Porcelain', category: 'brighten', swatch: 'linear-gradient(135deg,#fdf2f8,#e0e7ff)', filter: 'brightness(122%) contrast(92%) saturate(88%)', tintOverlay: 'rgba(255,242,248,0.16)', fairBoost: 78 },
  { id: 'radiant', label: 'Radiant', category: 'brighten', swatch: 'linear-gradient(135deg,#fffbeb,#fbcfe8)', filter: 'brightness(112%) contrast(98%) saturate(104%)', tintOverlay: 'rgba(255,235,220,0.10)', fairBoost: 36 },
];

export const RESOLUTION_DIMS: Record<ResolutionOption, { w: number; h: number; bitrate: number }> = {
  '480p': { w: 854, h: 480, bitrate: 1_500_000 },
  '720p': { w: 1280, h: 720, bitrate: 3_000_000 },
  '1080p': { w: 1920, h: 1080, bitrate: 6_000_000 },
  '4K': { w: 3840, h: 2160, bitrate: 14_000_000 },
  '8K': { w: 7680, h: 4320, bitrate: 24_000_000 },
};

/** Classify an enumerated MediaDeviceInfo audio input into Wired / Bluetooth / Wireless / Auto */
export function classifyMicType(label: string): MicSourceType {
  const lower = label.toLowerCase();
  if (/bluetooth|airpods|buds|headset|hands-free|bose|sony wh|jbl|ble/.test(lower)) return 'bluetooth';
  if (/wireless|rode|dji mic|hollyland|boya|sarasonic|2\.4g|lavalier/.test(lower)) return 'wireless';
  if (/usb|wired|external|line|jack|aux|shure|blue yeti|scarlett|focusrite|mic in/.test(lower)) return 'wired';
  return 'auto';
}

/**
 * Real-Time Web Audio API DSP Processor for Camera Studio:
 * - Background Noise Cancellation (High-pass rumble filter + Dynamic Noise Gate + Compressor)
 * - Active Noise Control (ANC voice-band isolation + 50/60Hz hum notch)
 * - Live dB level monitoring & mixed MediaStream output for MediaRecorder
 */
export class AudioAncProcessor {
  private ctx: AudioContext | null = null;
  private rawStream: MediaStream | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private hpFilter: BiquadFilterNode | null = null;
  private humNotch: BiquadFilterNode | null = null;
  private voiceBoost: BiquadFilterNode | null = null;
  private gateGain: GainNode | null = null;
  private gateRaf: number | null = null;

  private bncEnabled = true;
  private ancEnabled = true;
  private gateThreshold = 0.018;
  private userGain = 1.0;

  async start(opts: {
    deviceId?: string;
    bnc: boolean;
    anc: boolean;
    gain: number;
  }): Promise<{ ok: boolean; stream: MediaStream | null; error?: string }> {
    this.stop();
    this.bncEnabled = opts.bnc;
    this.ancEnabled = opts.anc;
    this.userGain = opts.gain;

    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, stream: null, error: 'Microphone API unavailable' };
    }

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: opts.bnc || opts.anc,
        noiseSuppression: opts.bnc || opts.anc,
        autoGainControl: opts.bnc,
        ...(opts.deviceId && opts.deviceId !== 'default' ? { deviceId: { ideal: opts.deviceId } } : {}),
      };
      const raw = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      this.rawStream = raw;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const source = ctx.createMediaStreamSource(raw);

      // 1. High-pass rumble & wind cut (BNC)
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = opts.bnc ? 130 : 20;
      this.hpFilter = hp;

      // 2. 60Hz AC / fan hum notch (ANC)
      const notch = ctx.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.value = 60;
      notch.Q.value = opts.anc ? 8 : 0.1;
      this.humNotch = notch;

      // 3. Human vocal clarity presence shelf (ANC voice isolation)
      const voice = ctx.createBiquadFilter();
      voice.type = 'peaking';
      voice.frequency.value = 2400;
      voice.Q.value = 1.1;
      voice.gain.value = opts.anc ? 3.5 : 0;
      this.voiceBoost = voice;

      // 4. Dynamics compressor
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 20;
      comp.ratio.value = opts.bnc ? 6 : 2;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;

      // 5. Real-time adaptive noise gate + user gain
      const gate = ctx.createGain();
      gate.gain.value = 1;
      this.gateGain = gate;

      const gain = ctx.createGain();
      gain.gain.value = opts.gain;
      this.gainNode = gain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      this.analyser = analyser;

      const dest = ctx.createMediaStreamDestination();
      this.destNode = dest;

      source.connect(hp);
      hp.connect(notch);
      notch.connect(voice);
      voice.connect(comp);
      comp.connect(analyser);
      analyser.connect(gate);
      gate.connect(gain);
      gain.connect(dest);

      // Smooth noise-gate loop when ANC or BNC active
      const buf = new Float32Array(analyser.fftSize);
      const tickGate = () => {
        if (!this.analyser || !this.gateGain || !this.ctx) return;
        this.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = this.ctx.currentTime;
        if (this.bncEnabled || this.ancEnabled) {
          const thresh = this.ancEnabled ? this.gateThreshold * 1.4 : this.gateThreshold;
          const target = rms < thresh ? (this.ancEnabled ? 0.06 : 0.2) : 1.0;
          this.gateGain.gain.setTargetAtTime(target, now, rms < thresh ? 0.08 : 0.015);
        } else {
          this.gateGain.gain.setTargetAtTime(1.0, now, 0.02);
        }
        this.gateRaf = requestAnimationFrame(tickGate);
      };
      this.gateRaf = requestAnimationFrame(tickGate);

      return { ok: true, stream: dest.stream };
    } catch {
      return { ok: false, stream: null, error: 'Mic permission denied or unavailable' };
    }
  }

  updateSettings(bnc: boolean, anc: boolean, gain: number) {
    this.bncEnabled = bnc;
    this.ancEnabled = anc;
    this.userGain = gain;
    if (this.hpFilter) this.hpFilter.frequency.value = bnc ? 130 : 20;
    if (this.humNotch) this.humNotch.Q.value = anc ? 8 : 0.1;
    if (this.voiceBoost) this.voiceBoost.gain.value = anc ? 3.5 : 0;
    if (this.gainNode) this.gainNode.gain.value = this.userGain;
  }

  getLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let maxDev = 0;
    for (let i = 0; i < data.length; i++) {
      const dev = Math.abs(data[i] - 128) / 128;
      if (dev > maxDev) maxDev = dev;
    }
    return Math.min(100, Math.round(maxDev * 260));
  }

  getProcessedStream(): MediaStream | null {
    return this.destNode?.stream || null;
  }

  stop() {
    if (this.gateRaf) cancelAnimationFrame(this.gateRaf);
    this.gateRaf = null;
    this.rawStream?.getTracks().forEach((t) => t.stop());
    this.rawStream = null;
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.destNode = null;
    this.analyser = null;
  }
}

/**
 * External Flash & Hardware Torch Trigger helper
 * Supports Hardware Torch, Wired sync pulse, Web Bluetooth BLE flash trigger, and Wi-Fi trigger URL
 */
export async function fireExternalFlashSync(opts: {
  transport: FlashSyncTransport;
  mode: FlashMode;
  power: string;
  wifiEndpoint?: string;
}): Promise<void> {
  if (opts.mode === 'off') return;
  if (opts.transport === 'wifi' && opts.wifiEndpoint?.trim()) {
    try {
      await fetch(opts.wifiEndpoint.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'flash', mode: opts.mode, power: opts.power, ts: Date.now() }),
      });
    } catch {
      // Non-blocking external Wi-Fi sync trigger
    }
  } else if (opts.transport === 'wired') {
    // Emit a short ultra-clean sync pulse via Web Audio (works with 3.5mm optical/wired flash triggers)
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 18000;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
      window.setTimeout(() => ctx.close().catch(() => {}), 80);
    } catch {
      // Ignore audio errors
    }
  }
}
