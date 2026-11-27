import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bluetooth,
  Compass,
  Download,
  Film,
  FlipHorizontal2,
  Flower2,
  FolderUp,
  Grid3X3,
  HardDrive,
  LayoutGrid,
  Mic,
  MicOff,
  Radio,
  Ratio,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Upload,
  Wand2,
  Wifi,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ASPECT_RATIOS,
  AudioAncProcessor,
  CAMERA_FILTERS,
  REELS_FORMATS,
  RESOLUTION_DIMS,
  classifyMicType,
  fireExternalFlashSync,
  type AspectRatioId,
  type BracketingMode,
  type FilterCategory,
  type FlashMode,
  type FlashSyncTransport,
  type FpsOption,
  type MicSourceType,
  type PipAspectId,
  type ResolutionOption,
} from '../lib/cameraEngine';
import { useGimbal, type GimbalMode } from '../lib/gimbalEngine';
import { playShutterSfx } from '../lib/sfx';
import type { GameType, Livestream } from '../types';
import { CollageMakerModal } from './CollageMakerModal';

interface CameraStudioProps {
  onBack: () => void;
  onGoLive: (stream: Livestream) => void;
  onRequireLogin: () => void;
}

type CamMode = 'reels' | 'live_photo' | 'photo' | 'video' | 'dual' | 'pano' | 'timelapse';
type TuningMode = 'auto' | 'custom' | 'pro';
type BeautyProfile = 'off' | 'ladies' | 'gents';
type MacroTune = 'off' | 'closeup' | 'macro';
type DrawerTab =
  | 'none'
  | 'filters'
  | 'beauty'
  | 'tune'
  | 'audio'
  | 'flash'
  | 'gimbal'
  | 'dual_cfg'
  | 'ssd'
  | 'golive';

const SHUTTER_SPEEDS = ['1/30', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/4000'];
const FLASH_POWERS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64', '1/128'];
const REEL_DURATIONS = [15, 30, 60, 90] as const;

export const CameraStudio: React.FC<CameraStudioProps> = ({
  onBack,
  onGoLive,
  onRequireLogin,
}) => {
  const {
    session,
    authFetch,
    refreshStreams,
    pushToast,
    mediaLibrary,
    addMediaAsset,
    removeMediaAsset,
  } = useApp();

  // Core Mode & Compact Drawer State
  const [camMode, setCamMode] = useState<CamMode>('photo');
  const [tuningMode, setTuningMode] = useState<TuningMode>('auto');
  const [drawer, setDrawer] = useState<DrawerTab>('none');
  const [collageOpen, setCollageOpen] = useState(false);

  // Aspect Ratio (Pictures, Videos & Reels)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>('full');
  const [reelDuration, setReelDuration] = useState<15 | 30 | 60 | 90>(30);
  const [reelSpeed, setReelSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);

  // Camera Hardware & Multi-Lens Switching
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeCamIdx, setActiveCamIdx] = useState(0);
  const [mirrored, setMirrored] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [timerSec, setTimerSec] = useState<0 | 3 | 5>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [macroTune, setMacroTune] = useState<MacroTune>('off');

  // Dual Mode (Picture + Video, Tappable Swap, Draggable B-Roll / Cam, Aspect Ratio Auto/Custom)
  const [dualCaptureKind, setDualCaptureKind] = useState<'photo' | 'video'>('photo');
  const [dualLayout, setDualLayout] = useState<'pip' | 'split'>('pip');
  const [dualSwapped, setDualSwapped] = useState(false);
  const [brollMode, setBrollMode] = useState<'cam' | 'broll'>('cam');
  const [brollUrl, setBrollUrl] = useState<string | null>(null);
  const [brollIsVideo, setBrollIsVideo] = useState(false);
  const [pipPosMode, setPipPosMode] = useState<'auto' | 'custom'>('auto');
  const [pipAspect, setPipAspect] = useState<PipAspectId>('auto');
  const [pipRect, setPipRect] = useState({ x: 0.68, y: 0.14, w: 0.27, h: 0.24 }); // normalized 0..1

  // Resolution (480p, 720p, 1080p, 4K, 8K) & FPS
  const [resolution, setResolution] = useState<ResolutionOption>('1080p');
  const [fps, setFps] = useState<FpsOption>(60);

  // Full Pro / Custom Optics & Color Controls
  const [ev, setEv] = useState(0); // -2.0 .. +2.0
  const [brightness, setBrightness] = useState(0); // -50 .. +50
  const [saturation, setSaturation] = useState(0); // -100 .. +100
  const [vibrance, setVibrance] = useState(0); // -50 .. +100
  const [temperature, setTemperature] = useState(0); // -50 .. +50
  const [kelvin, setKelvin] = useState(5200); // 2500 .. 8000
  const [tint, setTint] = useState(0); // -50 green .. +50 magenta
  const [iso, setIso] = useState(200); // 50 .. 6400
  const [shutterIdx, setShutterIdx] = useState(2); // 1/125
  const [bracketing, setBracketing] = useState<BracketingMode>('off');
  const [clarity, setClarity] = useState(0); // 0 .. 100
  const [grain, setGrain] = useState(0); // 0 .. 100
  const [denoise, setDenoise] = useState(0); // 0 .. 100
  const [zoom, setZoom] = useState(1); // 0.5 .. 5

  // Ready-to-Go Categorized Filters (Modern, Vintage, B&W, Nostalgic, Fair-Glow Brighten)
  const [filterCat, setFilterCat] = useState<FilterCategory>('all');
  const [presetId, setPresetId] = useState<string>('pure');

  // Beauty (Ladies / Gents), Face Tuning, Body Slimming & Skin Brightening (Auto / Manual)
  const [beautyProfile, setBeautyProfile] = useState<BeautyProfile>('off');
  const [faceSmooth, setFaceSmooth] = useState(0);
  const [faceGlow, setFaceGlow] = useState(0);
  const [faceSlim, setFaceSlim] = useState(0);
  const [eyeBright, setEyeBright] = useState(0);
  const [skinTone, setSkinTone] = useState(0);
  const [skinBrightAuto, setSkinBrightAuto] = useState(false);
  const [skinBrightManual, setSkinBrightManual] = useState(0); // 0 .. 100 (for dark-tone brightening)
  const [bodySlim, setBodySlim] = useState(0);

  // Audio BNC, ANC & Multi-Source Mic Hub (Auto, Wired, Bluetooth, Wireless, Wi-Fi)
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [bncEnabled, setBncEnabled] = useState(true);
  const [ancEnabled, setAncEnabled] = useState(true);
  const [micGain, setMicGain] = useState(1.1);
  const [micSourceType, setMicSourceType] = useState<MicSourceType>('auto');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('default');
  const [wifiMicUrl, setWifiMicUrl] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [bleMicName, setBleMicName] = useState<string | null>(null);

  // TTL Flash & External Flash Sync (Internal / Wired / Bluetooth / Wi-Fi)
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [flashTransport, setFlashTransport] = useState<FlashSyncTransport>('internal');
  const [flashPower, setFlashPower] = useState<string>('1/4');
  const [flashHss, setFlashHss] = useState(false);
  const [wifiFlashUrl, setWifiFlashUrl] = useState('');
  const [bleFlashName, setBleFlashName] = useState<string | null>(null);

  // App-Wide Gimbal Stabilization Engine
  const gimbal = useGimbal('off');

  // Capture & Live Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [panoActive, setPanoActive] = useState(false);
  const [panoProgress, setPanoProgress] = useState(0);
  const [timelapseInterval, setTimelapseInterval] = useState<500 | 1000 | 2000>(1000);
  const [timelapseFrames, setTimelapseFrames] = useState(0);
  const [livePhotoCapturing, setLivePhotoCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'live' | 'simulated'>('loading');

  // Touch Reticle, Pinch Zoom & PiP Drag Refs
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const draggingPipRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  // Direct Go Live Form State
  const [liveTitle, setLiveTitle] = useState('');
  const [liveCategory, setLiveCategory] = useState<Livestream['category']>('solo');
  const [liveSeats, setLiveSeats] = useState(6);
  const [liveGameType, setLiveGameType] = useState<'' | GameType>('fps');
  const [livePin, setLivePin] = useState('');
  const [liveConsent, setLiveConsent] = useState(true);
  const [launchingLive, setLaunchingLive] = useState(false);
  const [lastLiveRoomId, setLastLiveRoomId] = useState<string | null>(null);

  // Hardware & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const secondVideoRef = useRef<HTMLVideoElement | null>(null);
  const brollVideoRef = useRef<HTMLVideoElement | null>(null);
  const brollImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const secondStreamRef = useRef<MediaStream | null>(null);
  const audioProcRef = useRef<AudioAncProcessor | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const panoFramesRef = useRef<HTMLCanvasElement[]>([]);
  const panoTimerRef = useRef<number | null>(null);
  const timelapseTimerRef = useRef<number | null>(null);
  const timelapseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ssdImportRef = useRef<HTMLInputElement | null>(null);
  const brollInputRef = useRef<HTMLInputElement | null>(null);

  // Build tiny procedural grain tile once for fast real-time film grain overlay
  useEffect(() => {
    const gc = document.createElement('canvas');
    gc.width = 160;
    gc.height = 160;
    const gctx = gc.getContext('2d');
    if (gctx) {
      const img = gctx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gctx.putImageData(img, 0, 0);
    }
    grainCanvasRef.current = gc;
  }, []);

  // Enumerate Cameras & Microphones
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(list.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      // Ignore enumeration errors
    }
  }, []);

  // Sync Audio BNC + ANC DSP processor
  useEffect(() => {
    if (!audioProcRef.current) {
      audioProcRef.current = new AudioAncProcessor();
    }
    if (!audioEnabled) {
      audioProcRef.current.stop();
      setMicLevel(0);
      return;
    }

    let mounted = true;
    const startMic = async () => {
      const res = await audioProcRef.current!.start({
        deviceId: selectedAudioId,
        bnc: bncEnabled,
        anc: ancEnabled,
        gain: micGain,
      });
      if (mounted && res.ok) {
        refreshDevices();
      }
    };
    startMic();

    const meterId = window.setInterval(() => {
      if (audioProcRef.current) {
        setMicLevel(audioProcRef.current.getLevel());
      }
    }, 120);

    return () => {
      mounted = false;
      clearInterval(meterId);
    };
  }, [audioEnabled, selectedAudioId, refreshDevices]);

  // Live-update BNC/ANC/Gain without restarting audio stream
  useEffect(() => {
    audioProcRef.current?.updateSettings(bncEnabled, ancEnabled, micGain);
  }, [bncEnabled, ancEnabled, micGain]);

  // Apply Ladies / Gents Beauty Profile Presets
  const selectBeautyProfile = (profile: BeautyProfile) => {
    setBeautyProfile(profile);
    if (profile === 'off') {
      setFaceSmooth(0);
      setFaceGlow(0);
      setFaceSlim(0);
      setEyeBright(0);
      setSkinTone(0);
      setBodySlim(0);
    } else if (profile === 'ladies') {
      setFaceSmooth(48);
      setFaceGlow(42);
      setFaceSlim(26);
      setEyeBright(34);
      setSkinTone(12);
      setBodySlim(20);
    } else {
      setFaceSmooth(20);
      setFaceGlow(10);
      setFaceSlim(16);
      setEyeBright(24);
      setSkinTone(-4);
      setBodySlim(12);
    }
  };

  // Initialize Primary Camera Stream (Supports 480p, 720p, 1080p, 4K, 8K + Device Switching)
  const initCamera = useCallback(
    async (facingMode: 'user' | 'environment', res: ResolutionOption, deviceId?: string) => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setCameraStatus('loading');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('simulated');
        return;
      }

      const dims = RESOLUTION_DIMS[res];
      const videoConstraint: MediaTrackConstraints = {
        width: { ideal: Math.min(3840, dims.w) },
        height: { ideal: Math.min(2160, dims.h) },
        frameRate: { ideal: Math.min(60, fps) },
        ...(deviceId ? { deviceId: { ideal: deviceId } } : { facingMode }),
      };

      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play().catch(() => {});
        }
        setCameraStatus('live');
        refreshDevices();
      } catch {
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          streamRef.current = fallback;
          if (videoRef.current) {
            videoRef.current.srcObject = fallback;
            await videoRef.current.play().catch(() => {});
          }
          setCameraStatus('live');
          refreshDevices();
        } catch {
          setCameraStatus('simulated');
        }
      }
    },
    [fps, refreshDevices]
  );

  useEffect(() => {
    const devId = videoDevices[activeCamIdx]?.deviceId;
    initCamera(facing, resolution, videoDevices.length > 1 ? devId : undefined);
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      secondStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (panoTimerRef.current) clearInterval(panoTimerRef.current);
      if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current);
    };
  }, [facing, resolution, activeCamIdx, initCamera]);

  // Clean up Audio DSP on unmount
  useEffect(() => {
    return () => {
      audioProcRef.current?.stop();
    };
  }, []);

  // Apply Hardware Torch & Macro Close-Focus Constraints when supported
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    const adv: Record<string, unknown> = {};
    if (flashMode === 'torch') adv.torch = true;
    else adv.torch = false;
    if (macroTune === 'macro') {
      adv.focusMode = 'continuous';
      adv.focusDistance = 0.08;
    } else if (macroTune === 'closeup') {
      adv.focusMode = 'continuous';
      adv.focusDistance = 0.22;
    }
    track.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }).catch(() => {});
  }, [flashMode, macroTune, cameraStatus]);

  // Secondary Hardware Camera in Dual Mode
  useEffect(() => {
    if (camMode !== 'dual' || brollMode === 'broll') {
      secondStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      secondStreamRef.current = null;
      return;
    }
    let active = true;
    (async () => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices();
        const cams = (devices || []).filter((d) => d.kind === 'videoinput');
        const other = cams.find((_, idx) => idx !== activeCamIdx);
        if (other && active) {
          const second = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: other.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
          if (!active) {
            second.getTracks().forEach((t) => t.stop());
            return;
          }
          secondStreamRef.current = second;
          if (secondVideoRef.current) {
            secondVideoRef.current.srcObject = second;
            await secondVideoRef.current.play().catch(() => {});
          }
        }
      } catch {
        // Gracefully uses dual-angle PiP/split on single-camera hardware
      }
    })();
    return () => {
      active = false;
    };
  }, [camMode, brollMode, activeCamIdx]);

  // Auto-select 9:16 social format when entering Reels mode
  useEffect(() => {
    if (camMode === 'reels' && aspectRatio === 'full') {
      setAspectRatio('9:16');
    }
  }, [camMode, aspectRatio]);

  // Recording Timer + Auto-stop at Reels Duration Limit
  useEffect(() => {
    if (!isRecording) {
      setRecordSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordSeconds((s) => {
        const next = s + 1;
        if (camMode === 'reels' && next >= reelDuration) {
          recorderRef.current?.stop();
          setIsRecording(false);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording, camMode, reelDuration]);

  // Helper: compute active aspect-ratio crop frame inside canvas
  const getFrameRect = useCallback(
    (cw: number, ch: number) => {
      const spec = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
      if (!spec || spec.ratio === null) {
        return { x: 0, y: 0, w: cw, h: ch };
      }
      const targetRatio = spec.ratio;
      const curRatio = cw / Math.max(1, ch);
      let fw = cw;
      let fh = ch;
      if (curRatio > targetRatio) {
        fw = Math.round(ch * targetRatio);
      } else {
        fh = Math.round(cw / targetRatio);
      }
      return {
        x: Math.round((cw - fw) / 2),
        y: Math.round((ch - fh) / 2),
        w: fw,
        h: fh,
      };
    },
    [aspectRatio]
  );

  // Helper: compute PiP B-Roll / Secondary Cam rectangle inside frame
  const getPipCanvasRect = useCallback(
    (frame: { x: number; y: number; w: number; h: number }) => {
      const baseW = Math.round(frame.w * (pipPosMode === 'custom' ? pipRect.w : 0.28));
      let pipW = baseW;
      let pipH = Math.round(frame.h * (pipPosMode === 'custom' ? pipRect.h : 0.24));

      if (pipAspect === '16:9') pipH = Math.round((pipW * 9) / 16);
      else if (pipAspect === '9:16') pipH = Math.round((pipW * 16) / 9);
      else if (pipAspect === '4:3') pipH = Math.round((pipW * 3) / 4);
      else if (pipAspect === '1:1' || pipAspect === 'circle') pipH = pipW;

      pipW = Math.max(72, Math.min(Math.round(frame.w * 0.65), pipW));
      pipH = Math.max(72, Math.min(Math.round(frame.h * 0.58), pipH));

      const px =
        pipPosMode === 'auto'
          ? frame.x + frame.w - pipW - 14
          : Math.max(frame.x + 8, Math.min(frame.x + frame.w - pipW - 8, frame.x + Math.round(pipRect.x * frame.w)));
      const py =
        pipPosMode === 'auto'
          ? frame.y + 58
          : Math.max(frame.y + 44, Math.min(frame.y + frame.h - pipH - 96, frame.y + Math.round(pipRect.y * frame.h)));

      return { px, py, pipW, pipH };
    },
    [pipPosMode, pipRect, pipAspect]
  );

  // =========================================================================
  // REAL-TIME FULL-BLEED CAMERA ENGINE COMPOSITOR
  // =========================================================================
  useEffect(() => {
    let running = true;
    const render = (time: number) => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(1.35, window.devicePixelRatio || 1);
        const targetW = Math.max(540, Math.min(1920, Math.round(window.innerWidth * dpr)));
        const targetH = Math.max(480, Math.min(1440, Math.round(window.innerHeight * dpr)));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const preset = CAMERA_FILTERS.find((p) => p.id === presetId);
          const macroZoom = macroTune === 'macro' ? 2.0 : macroTune === 'closeup' ? 1.45 : 1.0;
          const macroClarity = macroTune === 'macro' ? 18 : macroTune === 'closeup' ? 10 : 0;

          // Compute complete color / optics / beauty / fair-glow filter chain
          const evBoost = 100 + ev * 24;
          const brightBoost = tuningMode !== 'auto' ? brightness * 0.7 : 0;
          const isoBoost = tuningMode === 'pro' ? Math.round(((iso - 200) / 6200) * 32) : 0;
          const glowBoost = Math.round(faceGlow * 0.22 + eyeBright * 0.1);
          const fairLevel =
            (skinBrightAuto ? 34 : 0) + skinBrightManual * 0.42 + (preset?.fairBoost ? preset.fairBoost * 0.2 : 0);
          const totalBrightness = Math.max(40, Math.min(205, evBoost + brightBoost + isoBoost + glowBoost + fairLevel * 0.55));

          const gentsCrisp = beautyProfile === 'gents' ? 108 : 100;
          const totalContrast = Math.max(
            62,
            Math.min(
              175,
              gentsCrisp +
                Math.round((clarity + macroClarity) * 0.34) +
                Math.round(eyeBright * 0.12) -
                Math.round(faceSmooth * 0.1) -
                Math.round(fairLevel * 0.12)
            )
          );

          const satDelta = (tuningMode !== 'auto' ? saturation + vibrance * 0.65 : 0) + skinTone * 0.55;
          const totalSat = Math.max(0, Math.min(220, 102 + Math.round(satDelta) - Math.round(fairLevel * 0.12)));

          const wbDelta = (tuningMode !== 'auto' ? (kelvin - 5200) / 2800 : 0) + (tuningMode !== 'auto' ? temperature / 60 : 0);
          const warmSepia = wbDelta > 0 ? Math.min(48, Math.round(wbDelta * 32)) : 0;
          const coolHue = wbDelta < 0 ? Math.max(-22, Math.round(wbDelta * 18)) : 0;
          const tintHue = tuningMode !== 'auto' ? Math.round(tint * 0.42) : 0;
          const totalHue = coolHue + tintHue;

          const smoothBlur = Math.max(
            faceSmooth > 5 ? (faceSmooth / 100) * 0.85 : 0,
            denoise > 10 ? (denoise / 100) * 0.75 : 0
          );

          const filterStr = [
            `brightness(${totalBrightness}%)`,
            `contrast(${totalContrast}%)`,
            `saturate(${totalSat}%)`,
            warmSepia > 0 ? `sepia(${warmSepia}%)` : '',
            totalHue !== 0 ? `hue-rotate(${totalHue}deg)` : '',
            smoothBlur > 0.08 ? `blur(${smoothBlur.toFixed(2)}px)` : '',
            preset?.filter || '',
          ]
            .filter(Boolean)
            .join(' ');

          const slimFactor = 1 - faceSlim * 0.0008 - bodySlim * 0.0014;
          const effectiveZoom = Math.max(0.7, zoom * macroZoom);
          const stab = gimbal.getStabilization();

          const frame = getFrameRect(canvas.width, canvas.height);

          const drawVisualSource = (
            src: HTMLVideoElement | HTMLImageElement | null,
            dx: number,
            dy: number,
            dw: number,
            dh: number,
            flipX: boolean,
            customZoom: number,
            applyBodyMesh: boolean,
            applyGimbal: boolean
          ) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(dx, dy, dw, dh);
            ctx.clip();
            ctx.filter = filterStr || 'none';

            const isVideo = src instanceof HTMLVideoElement;
            const isImg = src instanceof HTMLImageElement;
            const ready = isVideo
              ? src.readyState >= 2 && src.videoWidth > 0
              : isImg
                ? src.complete && src.naturalWidth > 0
                : false;

            if (ready && src) {
              const srcW = isVideo ? src.videoWidth : src.naturalWidth;
              const srcH = isVideo ? src.videoHeight : src.naturalHeight;
              const vRatio = srcW / Math.max(1, srcH);
              const dRatio = dw / Math.max(1, dh);
              let drawW = dw;
              let drawH = dh;
              if (vRatio > dRatio) drawW = dh * vRatio;
              else drawH = dw / vRatio;

              if (applyBodyMesh && bodySlim > 8 && isVideo && !applyGimbal) {
                const slices = 22;
                const sliceH = dh / slices;
                const srcSliceH = srcH / slices;
                for (let s = 0; s < slices; s++) {
                  const normY = s / slices;
                  const waist = Math.exp(-Math.pow((normY - 0.58) / 0.22, 2));
                  const cinch = 1 - (bodySlim / 100) * 0.14 * waist;
                  const sw = drawW * customZoom * slimFactor * cinch;
                  const sx = dx + (dw - sw) / 2;
                  ctx.save();
                  if (flipX) {
                    ctx.translate(dx + dw / 2, 0);
                    ctx.scale(-1, 1);
                    ctx.translate(-(dx + dw / 2), 0);
                  }
                  ctx.drawImage(src, 0, s * srcSliceH, srcW, srcSliceH + 1, sx, dy + s * sliceH, sw, sliceH + 1);
                  ctx.restore();
                }
              } else {
                ctx.translate(dx + dw / 2, dy + dh / 2);
                if (applyGimbal) {
                  ctx.translate(stab.tx * dw, stab.ty * dh);
                  ctx.rotate(stab.rollRad);
                  ctx.scale(stab.scale, stab.scale);
                }
                ctx.scale((flipX ? -1 : 1) * customZoom * slimFactor, customZoom);
                ctx.drawImage(src, -drawW / 2, -drawH / 2, drawW, drawH);
              }
            } else {
              // Simulated optical studio background when hardware camera is unavailable
              const grad = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
              grad.addColorStop(0, '#0d0e15');
              grad.addColorStop(0.5, '#191c28');
              grad.addColorStop(1, '#0c0d13');
              ctx.fillStyle = grad;
              ctx.fillRect(dx, dy, dw, dh);

              const tSec = time * 0.00055;
              const cx1 = dx + dw * (0.34 + Math.sin(tSec) * 0.08);
              const cy1 = dy + dh * (0.38 + Math.cos(tSec * 0.8) * 0.07);
              const g1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, Math.max(dw, dh) * 0.42);
              g1.addColorStop(0, 'rgba(217, 4, 41, 0.34)');
              g1.addColorStop(1, 'rgba(217, 4, 41, 0)');
              ctx.fillStyle = g1;
              ctx.fillRect(dx, dy, dw, dh);

              const cx2 = dx + dw * (0.68 + Math.cos(tSec * 0.9) * 0.08);
              const cy2 = dy + dh * (0.62 + Math.sin(tSec * 0.7) * 0.08);
              const g2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, Math.max(dw, dh) * 0.36);
              g2.addColorStop(0, 'rgba(163, 230, 53, 0.24)');
              g2.addColorStop(1, 'rgba(163, 230, 53, 0)');
              ctx.fillStyle = g2;
              ctx.fillRect(dx, dy, dw, dh);

              ctx.save();
              ctx.translate(dx + dw / 2, dy + dh / 2);
              if (applyGimbal) {
                ctx.translate(stab.tx * dw, stab.ty * dh);
                ctx.rotate(stab.rollRad);
                ctx.scale(stab.scale, stab.scale);
              }
              ctx.scale(customZoom * slimFactor, customZoom);
              ctx.strokeStyle = 'rgba(255,255,255,0.16)';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(0, 0, Math.min(dw, dh) * 0.17, 0, Math.PI * 2);
              ctx.stroke();
              ctx.strokeStyle = 'rgba(163,230,53,0.34)';
              ctx.beginPath();
              ctx.arc(0, 0, Math.min(dw, dh) * 0.07, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }

            // Soft Fair-Glow / Skin Brightening non-clipping luminance veil
            ctx.filter = 'none';
            if (fairLevel > 6) {
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              const alpha = Math.min(0.28, (fairLevel / 100) * 0.24);
              const fg = ctx.createRadialGradient(
                dx + dw / 2,
                dy + dh * 0.44,
                10,
                dx + dw / 2,
                dy + dh * 0.44,
                Math.max(dw, dh) * 0.55
              );
              fg.addColorStop(0, `rgba(255, 245, 238, ${alpha})`);
              fg.addColorStop(1, `rgba(255, 240, 232, ${alpha * 0.4})`);
              ctx.fillStyle = fg;
              ctx.fillRect(dx, dy, dw, dh);
              ctx.restore();
            }

            // Preset tint wash / Ladies rosy glow
            if (preset?.tintOverlay) {
              ctx.fillStyle = preset.tintOverlay;
              ctx.fillRect(dx, dy, dw, dh);
            }
            if (beautyProfile === 'ladies' && faceGlow > 10) {
              const rg = ctx.createRadialGradient(
                dx + dw / 2,
                dy + dh * 0.44,
                10,
                dx + dw / 2,
                dy + dh * 0.44,
                Math.min(dw, dh) * 0.42
              );
              rg.addColorStop(0, `rgba(255, 200, 215, ${(faceGlow / 100) * 0.13})`);
              rg.addColorStop(1, 'rgba(255, 200, 215, 0)');
              ctx.fillStyle = rg;
              ctx.fillRect(dx, dy, dw, dh);
            }

            // Macro / Close-Up depth vignette focus ring
            if (macroTune !== 'off') {
              const mg = ctx.createRadialGradient(
                dx + dw / 2,
                dy + dh / 2,
                Math.min(dw, dh) * (macroTune === 'macro' ? 0.22 : 0.3),
                dx + dw / 2,
                dy + dh / 2,
                Math.max(dw, dh) * 0.6
              );
              mg.addColorStop(0, 'rgba(0,0,0,0)');
              mg.addColorStop(1, macroTune === 'macro' ? 'rgba(0,0,0,0.44)' : 'rgba(0,0,0,0.24)');
              ctx.fillStyle = mg;
              ctx.fillRect(dx, dy, dw, dh);
            }

            // Procedural Film Grain (from manual grain or vintage/B&W preset)
            const totalGrain = Math.min(100, (tuningMode !== 'auto' ? grain : 0) + (preset?.grainBoost || 0));
            if (totalGrain > 4 && grainCanvasRef.current) {
              ctx.save();
              ctx.globalAlpha = (totalGrain / 100) * 0.18;
              ctx.globalCompositeOperation = 'overlay';
              const pat = ctx.createPattern(grainCanvasRef.current, 'repeat');
              if (pat) {
                const ox = Math.floor((time * 0.17) % 160);
                const oy = Math.floor((time * 0.23) % 160);
                ctx.translate(ox, oy);
                ctx.fillStyle = pat;
                ctx.fillRect(dx - ox, dy - oy, dw + 160, dh + 160);
              }
              ctx.restore();
            }

            ctx.restore();
          };

          // Clear full canvas with letterbox black for selected aspect ratio
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Determine Primary & Secondary sources (supports tappable camera swap + custom B-Roll footage!)
          const primaryCamSrc: HTMLVideoElement | HTMLImageElement | null = videoRef.current;
          const secondarySrc: HTMLVideoElement | HTMLImageElement | null =
            brollMode === 'broll' && brollUrl
              ? brollIsVideo
                ? brollVideoRef.current
                : brollImgRef.current
              : secondVideoRef.current && secondVideoRef.current.readyState >= 2
                ? secondVideoRef.current
                : videoRef.current;

          const mainSrc = camMode === 'dual' && dualSwapped ? secondarySrc : primaryCamSrc;
          const subSrc = camMode === 'dual' && dualSwapped ? primaryCamSrc : secondarySrc;
          const mainIsBroll = camMode === 'dual' && dualSwapped && brollMode === 'broll';
          const subIsBroll = camMode === 'dual' && !dualSwapped && brollMode === 'broll';

          if (camMode === 'dual' && dualLayout === 'split') {
            const halfH = Math.floor(frame.h / 2);
            drawVisualSource(mainSrc, frame.x, frame.y, frame.w, halfH, mainIsBroll ? false : mirrored, effectiveZoom, true, true);
            drawVisualSource(
              subSrc,
              frame.x,
              frame.y + halfH,
              frame.w,
              frame.h - halfH,
              subIsBroll ? false : !mirrored,
              subIsBroll ? 1 : Math.max(1.2, effectiveZoom),
              false,
              false
            );
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(frame.x, frame.y + halfH - 1, frame.w, 2);
          } else {
            drawVisualSource(mainSrc, frame.x, frame.y, frame.w, frame.h, mainIsBroll ? false : mirrored, effectiveZoom, true, true);

            if (camMode === 'dual' && dualLayout === 'pip') {
              const { px, py, pipW, pipH } = getPipCanvasRect(frame);
              const rad = pipAspect === 'circle' ? Math.min(pipW, pipH) / 2 : 14;
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(px, py, pipW, pipH, rad);
              ctx.clip();
              drawVisualSource(
                subSrc,
                px,
                py,
                pipW,
                pipH,
                subIsBroll ? false : !mirrored,
                subIsBroll ? 1 : Math.max(1.25, effectiveZoom),
                false,
                false
              );
              ctx.restore();
              ctx.strokeStyle = 'rgba(255,255,255,0.8)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.roundRect(px, py, pipW, pipH, rad);
              ctx.stroke();
            }
          }

          // Subtle aspect ratio crop hairline when not full-screen
          if (aspectRatio !== 'full') {
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);
          }
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    presetId,
    ev,
    brightness,
    saturation,
    vibrance,
    temperature,
    kelvin,
    tint,
    iso,
    clarity,
    grain,
    denoise,
    tuningMode,
    beautyProfile,
    faceSmooth,
    faceGlow,
    faceSlim,
    eyeBright,
    skinTone,
    skinBrightAuto,
    skinBrightManual,
    bodySlim,
    zoom,
    macroTune,
    mirrored,
    cameraStatus,
    camMode,
    dualLayout,
    dualSwapped,
    brollMode,
    brollUrl,
    brollIsVideo,
    aspectRatio,
    pipAspect,
    getFrameRect,
    getPipCanvasRect,
    gimbal,
  ]);

  // Export directly to user's Local SSD
  const exportToLocalSsd = useCallback(
    async (url: string, filename: string) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const win = window as unknown as {
          showSaveFilePicker?: (opts: {
            suggestedName: string;
          }) => Promise<{
            createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
          }>;
        };
        if (typeof win.showSaveFilePicker === 'function') {
          const handle = await win.showSaveFilePicker({ suggestedName: filename });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          pushToast(`Saved: ${filename}`, 'success');
          return;
        }
      } catch {
        // Fallback to direct download
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      pushToast(`Exported ${filename}`, 'success');
    },
    [pushToast]
  );

  // Import Photos/Videos from user's Local SSD
  const handleImportFromSsd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      addMediaAsset({
        id: `ssd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: file.type.startsWith('video/') ? 'video' : 'photo',
        url,
        label: `SSD · ${file.name.slice(0, 22)}`,
        createdAt: new Date().toLocaleTimeString(),
      });
    });
    pushToast(`Imported ${files.length} file${files.length > 1 ? 's' : ''}`, 'success');
    e.target.value = '';
  };

  // Load Custom B-Roll Video/Photo for Dual Mode
  const handleLoadBroll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isVid = file.type.startsWith('video/');
    setBrollUrl(url);
    setBrollIsVideo(isVid);
    setBrollMode('broll');
    if (isVid && brollVideoRef.current) {
      brollVideoRef.current.src = url;
      brollVideoRef.current.play().catch(() => {});
    } else if (!isVid && brollImgRef.current) {
      brollImgRef.current.src = url;
    }
    pushToast('B-Roll loaded', 'success');
    e.target.value = '';
  };

  // Crop canvas cleanly to active Aspect Ratio for Still Capture
  const grabCroppedStillUrl = useCallback(
    (evOffset = 0): string | null => {
      const src = canvasRef.current;
      if (!src) return null;
      const frame = getFrameRect(src.width, src.height);
      const out = document.createElement('canvas');
      out.width = frame.w;
      out.height = frame.h;
      const octx = out.getContext('2d');
      if (!octx) return null;
      if (evOffset !== 0) {
        octx.filter = `brightness(${Math.max(40, Math.min(200, 100 + evOffset * 28))}%)`;
      }
      octx.drawImage(src, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      return out.toDataURL('image/jpeg', 0.94);
    },
    [getFrameRect]
  );

  // Capture Still Photo (Supports TTL Pre-Flash, External Sync, & AEB Bracketing)
  const captureStill = useCallback(
    async (tag = 'Photo') => {
      if (flashMode === 'ttl') {
        // TTL Pre-flash metering pulse
        setFlashActive(true);
        await new Promise((r) => window.setTimeout(r, 65));
        setFlashActive(false);
        await new Promise((r) => window.setTimeout(r, 85));
      }

      if (flashMode !== 'off') {
        fireExternalFlashSync({
          transport: flashTransport,
          mode: flashMode,
          power: flashPower,
          wifiEndpoint: wifiFlashUrl,
        });
      }

      playShutterSfx();
      setFlashActive(true);
      window.setTimeout(() => setFlashActive(false), 110);

      const bracketOffsets =
        bracketing === 'aeb3_1'
          ? [-1, 0, 1]
          : bracketing === 'aeb3_2'
            ? [-2, 0, 2]
            : bracketing === 'aeb5_hdr'
              ? [-2, -1, 0, 1, 2]
              : [0];

      bracketOffsets.forEach((off, idx) => {
        const dataUrl = grabCroppedStillUrl(off);
        if (!dataUrl) return;
        addMediaAsset({
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          type: 'photo',
          url: dataUrl,
          label: `${tag}${bracketOffsets.length > 1 ? ` (${off >= 0 ? `+${off}` : off}EV)` : ''} · ${aspectRatio} · ${resolution}`,
          createdAt: new Date().toLocaleTimeString(),
        });
      });

      pushToast(
        bracketOffsets.length > 1 ? `${bracketOffsets.length}-shot AEB saved` : `${tag} saved`,
        'success'
      );
    },
    [flashMode, flashTransport, flashPower, wifiFlashUrl, bracketing, grabCroppedStillUrl, aspectRatio, resolution, addMediaAsset, pushToast]
  );

  // Live Photo (Still + 1.5s HEVC-style Motion Clip with Audio)
  const captureLivePhoto = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || livePhotoCapturing) return;
    setLivePhotoCapturing(true);
    captureStill('Live Photo');

    if (typeof MediaRecorder !== 'undefined') {
      try {
        const vStream = canvas.captureStream(30);
        const aStream = audioEnabled ? audioProcRef.current?.getProcessedStream() : null;
        const tracks = [...vStream.getVideoTracks(), ...(aStream ? aStream.getAudioTracks() : [])];
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime });
        const parts: Blob[] = [];
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) parts.push(ev.data);
        };
        rec.onstop = () => {
          const blob = new Blob(parts, { type: mime });
          addMediaAsset({
            id: `live-${Date.now()}`,
            type: 'video',
            url: URL.createObjectURL(blob),
            label: `Live Motion · ${aspectRatio} · ${resolution}`,
            createdAt: new Date().toLocaleTimeString(),
          });
          setLivePhotoCapturing(false);
        };
        rec.start();
        window.setTimeout(() => {
          if (rec.state === 'recording') rec.stop();
        }, 1500);
        return;
      } catch {
        // Still already saved
      }
    }
    window.setTimeout(() => setLivePhotoCapturing(false), 350);
  }, [livePhotoCapturing, captureStill, audioEnabled, aspectRatio, resolution, addMediaAsset]);

  // Video / Reels / Dual Video / Time-Lapse Recording (with Real BNC+ANC Audio)
  const toggleVideoRecording = useCallback(() => {
    if (isRecording) {
      if (timelapseTimerRef.current) {
        clearInterval(timelapseTimerRef.current);
        timelapseTimerRef.current = null;
      }
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined') {
      pushToast('Recording unsupported here', 'error');
      return;
    }

    try {
      const bitrate = RESOLUTION_DIMS[resolution].bitrate;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';

      if (camMode === 'timelapse') {
        const frame = getFrameRect(canvas.width, canvas.height);
        const tlCanvas = document.createElement('canvas');
        tlCanvas.width = frame.w;
        tlCanvas.height = frame.h;
        timelapseCanvasRef.current = tlCanvas;
        tlCanvas.getContext('2d')?.drawImage(canvas, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

        const rec = new MediaRecorder(tlCanvas.captureStream(24), { mimeType: mime, videoBitsPerSecond: bitrate });
        chunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mime });
          addMediaAsset({
            id: `tl-${Date.now()}`,
            type: 'video',
            url: URL.createObjectURL(blob),
            label: `Time-Lapse · ${aspectRatio} · ${resolution}`,
            createdAt: new Date().toLocaleTimeString(),
          });
          setTimelapseFrames(0);
          pushToast('Time-Lapse saved', 'success');
        };
        rec.start();
        recorderRef.current = rec;
        setIsRecording(true);
        setTimelapseFrames(1);
        timelapseTimerRef.current = window.setInterval(() => {
          if (canvasRef.current && timelapseCanvasRef.current) {
            const f = getFrameRect(canvasRef.current.width, canvasRef.current.height);
            timelapseCanvasRef.current
              .getContext('2d')
              ?.drawImage(
                canvasRef.current,
                f.x,
                f.y,
                f.w,
                f.h,
                0,
                0,
                timelapseCanvasRef.current.width,
                timelapseCanvasRef.current.height
              );
            setTimelapseFrames((n) => n + 1);
          }
        }, timelapseInterval);
        return;
      }

      const vStream = canvas.captureStream(Math.min(60, fps));
      const aStream = audioEnabled ? audioProcRef.current?.getProcessedStream() : null;
      const combined = new MediaStream([
        ...vStream.getVideoTracks(),
        ...(aStream ? aStream.getAudioTracks() : []),
      ]);
      const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: bitrate });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const modeTag =
          camMode === 'reels'
            ? `Reel ${aspectRatio} (${reelSpeed}x)`
            : camMode === 'dual'
              ? `Dual Video ${aspectRatio}`
              : `Video ${aspectRatio}`;
        addMediaAsset({
          id: `vid-${Date.now()}`,
          type: 'video',
          url: URL.createObjectURL(blob),
          label: `${modeTag} · ${resolution} ${fps}fps${ancEnabled ? ' · ANC' : ''}`,
          createdAt: new Date().toLocaleTimeString(),
        });
        pushToast(`${modeTag} saved`, 'success');
      };
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
    } catch {
      pushToast('Could not start recording', 'error');
    }
  }, [
    isRecording,
    camMode,
    resolution,
    fps,
    aspectRatio,
    reelSpeed,
    audioEnabled,
    ancEnabled,
    timelapseInterval,
    getFrameRect,
    addMediaAsset,
    pushToast,
  ]);

  // Panorama Capture & Stitch
  const finishPanorama = useCallback(() => {
    if (panoTimerRef.current) {
      clearInterval(panoTimerRef.current);
      panoTimerRef.current = null;
    }
    const frames = panoFramesRef.current;
    setPanoActive(false);
    setPanoProgress(0);
    if (frames.length === 0) return;

    const frameW = frames[0].width;
    const frameH = frames[0].height;
    const stripW = Math.max(80, Math.round(frameW * 0.36));
    const out = document.createElement('canvas');
    out.width = frameW + stripW * Math.max(0, frames.length - 1);
    out.height = frameH;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(frames[0], 0, 0);
    for (let i = 1; i < frames.length; i++) {
      ctx.drawImage(frames[i], frameW - stripW, 0, stripW, frameH, frameW + (i - 1) * stripW, 0, stripW, frameH);
    }
    playShutterSfx();
    addMediaAsset({
      id: `pano-${Date.now()}`,
      type: 'photo',
      url: out.toDataURL('image/jpeg', 0.92),
      label: `Panorama · ${frames.length}f`,
      createdAt: new Date().toLocaleTimeString(),
    });
    panoFramesRef.current = [];
    pushToast('Panorama saved', 'success');
  }, [addMediaAsset, pushToast]);

  const togglePanorama = useCallback(() => {
    if (panoActive) {
      finishPanorama();
      return;
    }
    if (!canvasRef.current) return;
    panoFramesRef.current = [];
    setPanoActive(true);
    setPanoProgress(12);
    const grabSlice = () => {
      if (!canvasRef.current) return;
      const snap = document.createElement('canvas');
      snap.width = canvasRef.current.width;
      snap.height = canvasRef.current.height;
      snap.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
      panoFramesRef.current.push(snap);
      setPanoProgress(Math.min(100, Math.round((panoFramesRef.current.length / 8) * 100)));
      if (panoFramesRef.current.length >= 8) finishPanorama();
    };
    grabSlice();
    panoTimerRef.current = window.setInterval(grabSlice, 480);
  }, [panoActive, finishPanorama]);

  const runShutter = useCallback(() => {
    if (camMode === 'video' || camMode === 'reels' || camMode === 'timelapse') {
      toggleVideoRecording();
    } else if (camMode === 'dual') {
      if (dualCaptureKind === 'photo') captureStill('Dual Photo');
      else toggleVideoRecording();
    } else if (camMode === 'pano') {
      togglePanorama();
    } else if (camMode === 'live_photo') {
      captureLivePhoto();
    } else {
      captureStill('Photo');
    }
  }, [camMode, dualCaptureKind, toggleVideoRecording, togglePanorama, captureLivePhoto, captureStill]);

  const handleShutterTap = () => {
    if (isRecording || panoActive) {
      runShutter();
      return;
    }
    if (timerSec === 0) {
      runShutter();
      return;
    }
    setCountdown(timerSec);
    let left = timerSec;
    const id = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(id);
        setCountdown(null);
        runShutter();
      } else {
        setCountdown(left);
      }
    }, 1000);
  };

  // Switch Camera Lens (supports >2 physical lenses or Front/Rear flip)
  const handleFlipCamera = () => {
    if (videoDevices.length > 1) {
      setActiveCamIdx((i) => (i + 1) % videoDevices.length);
      setMirrored((m) => !m);
    } else {
      const next = facing === 'user' ? 'environment' : 'user';
      setFacing(next);
      setMirrored(next === 'user');
    }
  };

  // Direct Share Live Feed Link to Other Apps (WhatsApp / Telegram / Instagram / Copy)
  const handleShareLiveFeed = async () => {
    const shareUrl = lastLiveRoomId
      ? `${window.location.origin}/?room=${encodeURIComponent(lastLiveRoomId)}`
      : `${window.location.origin}/?live=${encodeURIComponent(session?.uid || 'cam')}`;
    const shareTitle = liveTitle.trim() || `${session?.displayName || 'StreamLive'} Live Camera`;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: 'Watch my live camera feed on StreamLive', url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    pushToast('Live feed link copied to share', 'success');
  };

  // Bluetooth Pairing for External Flash or Wireless Mic
  const pairBluetoothDevice = async (kind: 'flash' | 'mic') => {
    const nav = navigator as unknown as {
      bluetooth?: { requestDevice: (opts: { acceptAllDevices: boolean }) => Promise<{ name?: string }> };
    };
    if (!nav.bluetooth?.requestDevice) {
      if (kind === 'flash') {
        setBleFlashName('BLE Sync Trigger');
        setFlashTransport('bluetooth');
      } else {
        setBleMicName('BLE Wireless Mic');
        setMicSourceType('bluetooth');
      }
      pushToast(`Bluetooth ${kind} ready`, 'info');
      return;
    }
    try {
      const dev = await nav.bluetooth.requestDevice({ acceptAllDevices: true });
      const name = dev.name || `BLE ${kind}`;
      if (kind === 'flash') {
        setBleFlashName(name);
        setFlashTransport('bluetooth');
      } else {
        setBleMicName(name);
        setMicSourceType('bluetooth');
      }
      pushToast(`Paired ${name}`, 'success');
    } catch {
      pushToast('Bluetooth pairing cancelled', 'info');
    }
  };

  // Touch Viewfinder: Tap-to-Focus + Dual PiP Drag / Tap-to-Swap + 2-Finger Pinch-to-Zoom
  const handleViewfinderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawer !== 'none') {
      setDrawer('none');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => setFocusPoint(null), 2400);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const next = Math.max(0.5, Math.min(5, pinchStartZoomRef.current * (Math.hypot(dx, dy) / pinchStartDistRef.current)));
      setZoom(Number(next.toFixed(1)));
    }
  };

  // Interactive Overlay Box for Dual PiP Drag & Tap-to-Swap
  const pipOverlayStyle = useMemo(() => {
    if (camMode !== 'dual' || dualLayout !== 'pip') return null;
    const wPct = pipPosMode === 'custom' ? pipRect.w * 100 : 28;
    const hPct = pipPosMode === 'custom' ? pipRect.h * 100 : 24;
    const leftPct = pipPosMode === 'auto' ? 100 - wPct - 3 : pipRect.x * 100;
    const topPct = pipPosMode === 'auto' ? 11 : pipRect.y * 100;
    return {
      left: `${Math.max(2, Math.min(96 - wPct, leftPct))}%`,
      top: `${Math.max(8, Math.min(82 - hPct, topPct))}%`,
      width: `${wPct}%`,
      height: `${hPct}%`,
    };
  }, [camMode, dualLayout, pipPosMode, pipRect]);

  const handlePipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingPipRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pipPosMode === 'auto' ? 0.69 : pipRect.x,
      origY: pipPosMode === 'auto' ? 0.12 : pipRect.y,
      moved: false,
    };
  };

  const handlePipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingPipRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      setPipPosMode('custom');
      setPipRect((prev) => ({
        ...prev,
        x: Math.max(0.02, Math.min(0.95 - prev.w, drag.origX + dx / window.innerWidth)),
        y: Math.max(0.08, Math.min(0.8 - prev.h, drag.origY + dy / window.innerHeight)),
      }));
    }
  };

  const handlePipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const drag = draggingPipRef.current;
    draggingPipRef.current = null;
    if (drag && !drag.moved) {
      // Tap on PiP camera/B-roll swaps primary <-> secondary cleanly!
      setDualSwapped((s) => !s);
      pushToast('Swapped view', 'info');
    }
  };

  // Direct Go Live from Inside Camera
  const handleDirectGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onRequireLogin();
      return;
    }
    if (session.role !== 'host' && session.role !== 'band') {
      pushToast('Sign in as Host or Band to go live', 'error');
      onRequireLogin();
      return;
    }
    if (!liveConsent) {
      pushToast('Please confirm broadcast safety & consent guidelines before going live.', 'error');
      return;
    }
    if (livePin.trim() && !/^\d{6}$/.test(livePin.trim())) {
      pushToast('Room PIN must be exactly 6 digits (or leave blank for public room).', 'error');
      return;
    }
    setLaunchingLive(true);
    try {
      const res = await authFetch('/api/streams', {
        method: 'POST',
        body: JSON.stringify({
          title: liveTitle.trim() || `${session.displayName} Live Cam`,
          category: liveCategory,
          maxSeats: liveSeats,
          gameType: liveGameType || undefined,
          pin: livePin.trim() || undefined,
          consentVerified: liveConsent,
          countryCode: session.countryCode || 'US',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not start live', 'error');
        return;
      }
      await refreshStreams();
      if (data.stream) {
        setLastLiveRoomId(data.stream.id);
        pushToast('You are LIVE!', 'success');
        setDrawer('none');
        onGoLive(data.stream);
      }
    } finally {
      setLaunchingLive(false);
    }
  };

  const cycleResolution = () => {
    const order: ResolutionOption[] = ['480p', '720p', '1080p', '4K', '8K'];
    setResolution((r) => order[(order.indexOf(r) + 1) % order.length]);
  };

  const cycleAspect = () => {
    const ids = ASPECT_RATIOS.map((a) => a.id);
    setAspectRatio((cur) => ids[(ids.indexOf(cur) + 1) % ids.length]);
  };

  const cycleTuningMode = () => {
    setTuningMode((m) => {
      const next = m === 'auto' ? 'custom' : m === 'custom' ? 'pro' : 'auto';
      if (next !== 'auto') setDrawer('tune');
      else setDrawer('none');
      return next;
    });
  };

  const cycleMacro = () => {
    setMacroTune((m) => {
      const next = m === 'off' ? 'closeup' : m === 'closeup' ? 'macro' : 'off';
      pushToast(next === 'off' ? 'Standard Lens' : next === 'macro' ? 'Macro Tune' : 'Close-Up Tune', 'info');
      return next;
    });
  };

  const toggleDrawer = (tab: DrawerTab) => setDrawer((prev) => (prev === tab ? 'none' : tab));

  const filteredPresets = useMemo(
    () => (filterCat === 'all' ? CAMERA_FILTERS : CAMERA_FILTERS.filter((f) => f.category === filterCat)),
    [filterCat]
  );

  const latestAsset = mediaLibrary[0];
  const libraryPhotos = mediaLibrary.filter((m) => m.type === 'photo');
  const isVideoShutter =
    camMode === 'video' || camMode === 'reels' || camMode === 'timelapse' || (camMode === 'dual' && dualCaptureKind === 'video');

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-full overflow-hidden bg-black text-white select-none">
      {/* Hidden hardware & B-roll media elements */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <video ref={secondVideoRef} playsInline muted className="hidden" />
      <video ref={brollVideoRef} playsInline muted loop className="hidden" />
      <img ref={brollImgRef} alt="" className="hidden" />
      <input ref={ssdImportRef} type="file" accept="image/*,video/*" multiple onChange={handleImportFromSsd} className="hidden" />
      <input ref={brollInputRef} type="file" accept="image/*,video/*" onChange={handleLoadBroll} className="hidden" />

      {/* FULL-BLEED CAMERA FEED */}
      <div
        onClick={handleViewfinderClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          pinchStartDistRef.current = null;
        }}
        className="relative h-full w-full touch-none"
      >
        <canvas ref={canvasRef} className="h-full w-full object-cover" />

        {/* Interactive Drag & Tap-to-Swap Hitbox for Dual PiP Camera / B-Roll */}
        {pipOverlayStyle && (
          <div
            style={pipOverlayStyle}
            onPointerDown={handlePipPointerDown}
            onPointerMove={handlePipPointerMove}
            onPointerUp={handlePipPointerUp}
            onClick={(e) => e.stopPropagation()}
            title="Tap to swap · Drag to move"
            className="absolute z-20 cursor-grab active:cursor-grabbing rounded-xl flex items-end justify-end p-1"
          >
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white/90">
              {brollMode === 'broll' ? 'B-ROLL' : 'CAM 2'} ⇄
            </span>
          </div>
        )}

        {/* Rule-of-Thirds Grid */}
        {gridOn && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={idx} className="border border-white/15" />
            ))}
          </div>
        )}

        {/* Gimbal Live Artificial Horizon Level Indicator */}
        {gimbal.mode !== 'off' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              style={{ transform: `rotate(${(-gimbal.telemetry.roll).toFixed(1)}deg)` }}
              className="flex items-center gap-4 transition-transform duration-75"
            >
              <span className="h-[1.5px] w-10 bg-[#A3E635]/80" />
              <span className="h-1.5 w-1.5 rounded-full border border-[#A3E635]" />
              <span className="h-[1.5px] w-10 bg-[#A3E635]/80" />
            </div>
          </div>
        )}

        {/* Reels Top Recording Progress Bar */}
        {camMode === 'reels' && isRecording && (
          <div className="pointer-events-none absolute inset-x-3 top-1 z-40 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-[#D90429] transition-all duration-300"
              style={{ width: `${Math.min(100, (recordSeconds / reelDuration) * 100)}%` }}
            />
          </div>
        )}

        {/* Tap-to-Focus Reticle + Compact Touch EV Slider */}
        {focusPoint && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ left: focusPoint.x, top: focusPoint.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 z-20"
          >
            <div className="h-11 w-11 rounded-lg border-[1.5px] border-[#E8C86A]" />
            <div className="flex flex-col items-center gap-1 rounded-full bg-black/55 px-1 py-1.5">
              <Sun className="h-3 w-3 text-[#E8C86A]" />
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={ev}
                onChange={(e) => setEv(Number(e.target.value))}
                aria-label="Touch Exposure"
                className="h-16 w-1.5 accent-[#E8C86A] cursor-pointer"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
            </div>
          </div>
        )}

        {/* Panorama Live Sweep Guide */}
        {camMode === 'pano' && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-center">
            <div className="h-10 w-full max-w-sm rounded-lg border border-white/25 bg-black/45 overflow-hidden relative flex items-center">
              <div className="h-full bg-[#A3E635]/30 transition-all duration-300" style={{ width: `${panoProgress}%` }} />
              <div className="absolute inset-x-0 h-px bg-[#E8C86A]/70" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono-nums font-bold tracking-wider">
                {panoActive ? `SWEEP ${panoProgress}%` : 'PANO'}
              </span>
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="font-display text-7xl font-bold font-mono-nums">{countdown}</span>
          </div>
        )}

        {/* Shutter Flash */}
        {flashActive && <div className="pointer-events-none absolute inset-0 bg-white/85" />}

        {/* Top & Bottom Soft Vignettes */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      </div>

      {/* =====================================================================
          TOP IN-VIEWFINDER BAR (Compact Mobile/Tablet Sizes)
          ===================================================================== */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-1.5 px-2.5 sm:px-4 pt-safe-cutout mt-2">
        {/* Left: Back + AUTO/CUSTOM/PRO + Aspect Ratio */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/55 border border-white/15 hover:bg-black/75 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <button
            type="button"
            onClick={cycleTuningMode}
            className={`h-7 sm:h-8 rounded-full px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold tracking-wider border cursor-pointer ${
              tuningMode !== 'auto'
                ? 'border-[#E8C86A] bg-[#E8C86A]/20 text-[#E8C86A]'
                : 'border-white/20 bg-black/55 text-white/90'
            }`}
          >
            {tuningMode.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={cycleAspect}
            title="Aspect Ratio"
            className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-full bg-black/55 border border-white/15 px-2 text-[10px] font-mono-nums font-semibold text-white/90 cursor-pointer"
          >
            <Ratio className="h-3 w-3 text-[#A3E635]" />
            <span>{aspectRatio === 'full' ? 'FULL' : aspectRatio}</span>
          </button>
        </div>

        {/* Center: Resolution (480p..8K) / FPS / REC */}
        <div className="flex items-center gap-1">
          {isRecording ? (
            <div className="inline-flex h-7 sm:h-8 items-center gap-1.5 rounded-full bg-[#D90429] px-2.5 text-[10px] sm:text-[11px] font-mono-nums font-bold">
              <span>
                {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                {String(recordSeconds % 60).padStart(2, '0')}
              </span>
              {camMode === 'reels' && <span className="opacity-80">/{reelDuration}s</span>}
              {camMode === 'timelapse' && <span>·{timelapseFrames}f</span>}
            </div>
          ) : (
            <div className="inline-flex h-7 sm:h-8 items-center rounded-full bg-black/55 border border-white/15 overflow-hidden text-[10px] font-mono-nums font-semibold">
              <button
                type="button"
                onClick={cycleResolution}
                className="h-full px-2 hover:bg-white/15 text-[#E8C86A] cursor-pointer"
              >
                {resolution}
              </button>
              <span className="h-3 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => setFps((f) => (f === 24 ? 30 : f === 30 ? 60 : f === 60 ? 120 : 24))}
                className="h-full px-1.5 hover:bg-white/15 text-white cursor-pointer"
              >
                {fps}
              </button>
            </div>
          )}
        </div>

        {/* Right: Flash, Macro, Timer, Grid, Share Link, Go Live */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleDrawer('flash')}
            aria-label="Flash & Sync"
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border cursor-pointer ${
              flashMode !== 'off' || drawer === 'flash'
                ? 'border-[#E8C86A] bg-[#E8C86A]/20 text-[#E8C86A]'
                : 'border-white/15 bg-black/55 text-white/90'
            }`}
          >
            {flashMode === 'off' ? <ZapOff className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={cycleMacro}
            aria-label="Macro / Close-up"
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border cursor-pointer ${
              macroTune !== 'off'
                ? 'border-[#A3E635] bg-[#A3E635]/20 text-[#A3E635]'
                : 'border-white/15 bg-black/55 text-white/90'
            }`}
          >
            <Flower2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTimerSec((s) => (s === 0 ? 3 : s === 3 ? 5 : 0))}
            aria-label="Timer"
            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-full border cursor-pointer ${
              timerSec > 0
                ? 'border-[#E8C86A] bg-[#E8C86A]/20 text-[#E8C86A]'
                : 'border-white/15 bg-black/55 text-white/90'
            }`}
          >
            {timerSec > 0 ? <span className="text-[10px] font-bold font-mono-nums">{timerSec}s</span> : <Timer className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setGridOn((g) => !g)}
            aria-label="Grid"
            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-full border cursor-pointer ${
              gridOn ? 'border-[#A3E635] bg-[#A3E635]/20 text-[#A3E635]' : 'border-white/15 bg-black/55 text-white/90'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleShareLiveFeed}
            aria-label="Share Live Link"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/90 hover:border-[#A3E635] cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('golive')}
            className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-full bg-[#D90429] px-2 sm:px-2.5 text-[10px] font-bold tracking-wide text-white shadow cursor-pointer"
          >
            <Radio className="h-3 w-3" />
            <span>LIVE</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          CONTEXT SUB-STRIP (Dual Pic/Vid + B-Roll OR Reels Format/Duration)
          ===================================================================== */}
      {camMode === 'dual' && (
        <div className="absolute left-2.5 top-14 sm:top-16 z-30 flex items-center gap-1 rounded-full bg-black/60 border border-white/15 px-1.5 py-1 text-[10px] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setDualCaptureKind((k) => (k === 'photo' ? 'video' : 'photo'))}
            className="rounded-full bg-[#D90429] px-2 py-0.5 font-bold cursor-pointer"
          >
            {dualCaptureKind === 'photo' ? 'PIC' : 'VID'}
          </button>
          <button
            type="button"
            onClick={() => setDualLayout((l) => (l === 'pip' ? 'split' : 'pip'))}
            className="rounded-full bg-white/10 px-2 py-0.5 font-semibold cursor-pointer"
          >
            {dualLayout === 'pip' ? 'PiP' : 'Split'}
          </button>
          <button
            type="button"
            onClick={() => setDualSwapped((s) => !s)}
            className="rounded-full bg-white/10 p-1 cursor-pointer"
            title="Swap Cameras"
          >
            <ArrowLeftRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => toggleDrawer('dual_cfg')}
            className={`rounded-full px-2 py-0.5 font-semibold cursor-pointer ${
              drawer === 'dual_cfg' ? 'bg-[#A3E635] text-black' : 'bg-white/10'
            }`}
          >
            B-Roll
          </button>
        </div>
      )}

      {camMode === 'reels' && (
        <div className="absolute inset-x-3 top-14 sm:top-16 z-30 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
          {REELS_FORMATS.map((rf) => (
            <button
              key={rf.id}
              type="button"
              onClick={() => setAspectRatio(rf.id)}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border cursor-pointer ${
                aspectRatio === rf.id
                  ? 'border-[#A3E635] bg-[#A3E635]/20 text-[#A3E635]'
                  : 'border-white/15 bg-black/55 text-white/80'
              }`}
            >
              {rf.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setReelDuration((d) => REEL_DURATIONS[(REEL_DURATIONS.indexOf(d) + 1) % REEL_DURATIONS.length])
            }
            className="shrink-0 rounded-full border border-[#E8C86A]/60 bg-black/55 px-2 py-0.5 text-[10px] font-mono-nums font-bold text-[#E8C86A] cursor-pointer"
          >
            {reelDuration}s
          </button>
          <button
            type="button"
            onClick={() => setReelSpeed((s) => (s === 0.5 ? 1 : s === 1 ? 1.5 : s === 1.5 ? 2 : 0.5))}
            className="shrink-0 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-mono-nums cursor-pointer"
          >
            {reelSpeed}x
          </button>
        </div>
      )}

      {/* =====================================================================
          RIGHT-EDGE COMPACT FLOATING ICON RAIL (Compact Mobile/Tablet Sizes)
          ===================================================================== */}
      <div className="absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5">
        {[
          { id: 'filters' as DrawerTab, icon: Wand2, active: drawer === 'filters' || presetId !== 'pure', label: 'Filters' },
          {
            id: 'beauty' as DrawerTab,
            icon: Sparkles,
            active: drawer === 'beauty' || beautyProfile !== 'off' || skinBrightAuto || skinBrightManual > 0,
            label: 'Beauty & Tone',
          },
          { id: 'tune' as DrawerTab, icon: SlidersHorizontal, active: drawer === 'tune' || tuningMode !== 'auto', label: 'Pro Tune' },
          { id: 'audio' as DrawerTab, icon: audioEnabled ? Mic : MicOff, active: drawer === 'audio' || ancEnabled, label: 'Mic & ANC' },
          { id: 'gimbal' as DrawerTab, icon: Compass, active: drawer === 'gimbal' || gimbal.mode !== 'off', label: 'Gimbal' },
          { id: 'ssd' as DrawerTab, icon: HardDrive, active: drawer === 'ssd', label: 'SSD' },
        ].map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => toggleDrawer(btn.id)}
              aria-label={btn.label}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
                btn.active
                  ? 'border-[#A3E635] bg-[#A3E635]/20 text-[#A3E635]'
                  : 'border-white/15 bg-black/55 text-white/90 hover:bg-black/75'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setCollageOpen(true)}
          aria-label="Collage"
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/90 backdrop-blur-md hover:bg-black/75 cursor-pointer"
        >
          <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        <button
          type="button"
          onClick={() => setMirrored((m) => !m)}
          aria-label="Mirror"
          className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border backdrop-blur-md cursor-pointer ${
            mirrored ? 'border-[#E8C86A]/60 bg-black/55 text-[#E8C86A]' : 'border-white/15 bg-black/55 text-white/80'
          }`}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      {/* =====================================================================
          IN-VIEWFINDER COMPACT DRAWERS (One Active At A Time)
          ===================================================================== */}

      {/* 1. READY-TO-GO CATEGORIZED FILTERS (Modern, Vintage, B&W, Nostalgic, Brighten) */}
      {drawer === 'filters' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-xl rounded-2xl border border-white/15 bg-black/80 p-2.5 backdrop-blur-xl space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'modern', label: 'Modern' },
                  { id: 'vintage', label: 'Vintage' },
                  { id: 'bw', label: 'B&W' },
                  { id: 'nostalgic', label: 'Nostalgic' },
                  { id: 'brighten', label: 'Brighten' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterCat(c.id)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                    filterCat === c.id ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 hover:text-white cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {filteredPresets.map((p) => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className="flex shrink-0 flex-col items-center gap-1 cursor-pointer"
                >
                  <span
                    style={{ background: p.swatch }}
                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-2 transition-transform ${
                      active ? 'border-[#A3E635] scale-105' : 'border-white/25'
                    }`}
                  />
                  <span className={`text-[9px] font-medium ${active ? 'text-[#A3E635]' : 'text-white/75'}`}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. BEAUTY (LADIES / GENTS), FACE TUNING, BODY SLIMMING & SKIN BRIGHTEN (AUTO/MANUAL) */}
      {drawer === 'beauty' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/80 p-3 backdrop-blur-xl space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['off', 'ladies', 'gents'] as BeautyProfile[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectBeautyProfile(p)}
                  className={`h-7 rounded-full px-2.5 text-[10px] font-semibold capitalize cursor-pointer ${
                    beautyProfile === p ? 'bg-[#D90429] text-white' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSkinBrightAuto((v) => !v)}
                className={`h-7 rounded-full px-2.5 text-[10px] font-semibold cursor-pointer ${
                  skinBrightAuto ? 'bg-[#E8C86A] text-black' : 'bg-white/10 text-white/80'
                }`}
              >
                Auto Fair
              </button>
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 hover:text-white cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
            {[
              { label: 'Fair Lift', val: skinBrightManual, min: 0, max: 100, set: setSkinBrightManual },
              { label: 'Smooth', val: faceSmooth, min: 0, max: 100, set: setFaceSmooth },
              { label: 'Glow', val: faceGlow, min: 0, max: 100, set: setFaceGlow },
              { label: 'Face Slim', val: faceSlim, min: 0, max: 100, set: setFaceSlim },
              { label: 'Body Slim', val: bodySlim, min: 0, max: 100, set: setBodySlim },
              { label: 'Eyes', val: eyeBright, min: 0, max: 100, set: setEyeBright },
              { label: 'Skin Tone', val: skinTone, min: -25, max: 25, set: setSkinTone },
            ].map((s) => (
              <label key={s.label} className="space-y-0.5">
                <div className="flex justify-between text-white/80">
                  <span>{s.label}</span>
                  <span className="font-mono-nums text-[#E8C86A]">{s.val}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={s.val}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="w-full h-1 accent-[#A3E635] cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 3. FULL PRO / CUSTOM COLOR, EXPOSURE, OPTICS & BRACKETING */}
      {drawer === 'tune' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-lg rounded-2xl border border-white/15 bg-black/82 p-3 backdrop-blur-xl space-y-2 max-h-[42vh] overflow-y-auto no-scrollbar"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['auto', 'custom', 'pro'] as TuningMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTuningMode(m)}
                  className={`h-6 rounded-full px-2.5 text-[10px] font-bold uppercase cursor-pointer ${
                    tuningMode === m ? 'bg-[#E8C86A] text-black' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {m}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEv(0);
                  setBrightness(0);
                  setSaturation(0);
                  setVibrance(0);
                  setTemperature(0);
                  setKelvin(5200);
                  setTint(0);
                  setIso(200);
                  setClarity(0);
                  setGrain(0);
                  setDenoise(0);
                  setBracketing('off');
                }}
                className="h-6 rounded-full bg-white/10 px-2 text-[10px] text-white/75 cursor-pointer"
              >
                Reset
              </button>
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 hover:text-white cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Resolution & AEB Bracketing Row */}
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            {(['480p', '720p', '1080p', '4K', '8K'] as ResolutionOption[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={`h-6 rounded px-2 font-mono-nums font-bold cursor-pointer ${
                  resolution === r ? 'bg-[#D90429] text-white' : 'bg-white/10 text-white/80'
                }`}
              >
                {r}
              </button>
            ))}
            <span className="mx-0.5 text-white/30">|</span>
            {(
              [
                { id: 'off', label: 'AEB Off' },
                { id: 'aeb3_1', label: '3×±1' },
                { id: 'aeb3_2', label: '3×±2' },
                { id: 'aeb5_hdr', label: '5-HDR' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBracketing(b.id)}
                className={`h-6 rounded px-1.5 font-mono-nums font-semibold cursor-pointer ${
                  bracketing === b.id ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
            {[
              { label: 'EV', val: `${ev > 0 ? '+' : ''}${ev.toFixed(1)}`, raw: ev, min: -2, max: 2, step: 0.1, set: (v: number) => { setEv(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Bright', val: `${brightness}`, raw: brightness, min: -50, max: 50, step: 1, set: (v: number) => { setBrightness(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'WB', val: `${kelvin}K`, raw: kelvin, min: 2500, max: 8000, step: 100, set: (v: number) => { setKelvin(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Temp', val: `${temperature}`, raw: temperature, min: -50, max: 50, step: 1, set: (v: number) => { setTemperature(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Tint', val: `${tint}`, raw: tint, min: -50, max: 50, step: 1, set: (v: number) => { setTint(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Sat', val: `${saturation}`, raw: saturation, min: -100, max: 100, step: 1, set: (v: number) => { setSaturation(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Vibrance', val: `${vibrance}`, raw: vibrance, min: -50, max: 100, step: 1, set: (v: number) => { setVibrance(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'ISO', val: `${iso}`, raw: iso, min: 50, max: 6400, step: 50, set: (v: number) => { setIso(v); setTuningMode('pro'); } },
              { label: 'Shutter', val: SHUTTER_SPEEDS[shutterIdx], raw: shutterIdx, min: 0, max: SHUTTER_SPEEDS.length - 1, step: 1, set: (v: number) => { setShutterIdx(v); setTuningMode('pro'); } },
              { label: 'Clarity', val: `${clarity}`, raw: clarity, min: 0, max: 100, step: 1, set: (v: number) => { setClarity(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Grain', val: `${grain}`, raw: grain, min: 0, max: 100, step: 1, set: (v: number) => { setGrain(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
              { label: 'Denoise', val: `${denoise}`, raw: denoise, min: 0, max: 100, step: 1, set: (v: number) => { setDenoise(v); if (tuningMode === 'auto') setTuningMode('custom'); } },
            ].map((ctl) => (
              <label key={ctl.label} className="space-y-0.5">
                <div className="flex justify-between text-white/80">
                  <span>{ctl.label}</span>
                  <span className="font-mono-nums text-[#E8C86A]">{ctl.val}</span>
                </div>
                <input
                  type="range"
                  min={ctl.min}
                  max={ctl.max}
                  step={ctl.step}
                  value={ctl.raw}
                  onChange={(e) => ctl.set(Number(e.target.value))}
                  className="w-full h-1 accent-[#E8C86A] cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 4. AUDIO: BNC + ANC + WIRED / WIRELESS / BLUETOOTH / WI-FI MIC HUB */}
      {drawer === 'audio' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/82 p-3 backdrop-blur-xl space-y-2.5 text-[11px]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAudioEnabled((a) => !a)}
                className={`h-6 rounded-full px-2.5 text-[10px] font-bold cursor-pointer ${
                  audioEnabled ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/70'
                }`}
              >
                {audioEnabled ? 'MIC ON' : 'MUTED'}
              </button>
              <button
                type="button"
                onClick={() => setBncEnabled((v) => !v)}
                className={`h-6 rounded-full px-2 text-[10px] font-semibold cursor-pointer ${
                  bncEnabled ? 'bg-[#E8C86A] text-black' : 'bg-white/10 text-white/75'
                }`}
              >
                BNC
              </button>
              <button
                type="button"
                onClick={() => setAncEnabled((v) => !v)}
                className={`h-6 rounded-full px-2 text-[10px] font-semibold cursor-pointer ${
                  ancEnabled ? 'bg-[#D90429] text-white' : 'bg-white/10 text-white/75'
                }`}
              >
                ANC
              </button>
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Live dB Meter */}
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#A3E635] via-[#E8C86A] to-[#D90429] transition-all duration-100"
              style={{ width: `${audioEnabled ? micLevel : 0}%` }}
            />
          </div>

          {/* Mic Transport Tabs: Auto / Wired / Bluetooth / Wireless / Wi-Fi */}
          <div className="grid grid-cols-5 gap-1 text-[10px]">
            {(['auto', 'wired', 'bluetooth', 'wireless', 'wifi'] as MicSourceType[]).map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => {
                  setMicSourceType(mt);
                  const match = audioDevices.find((d) => classifyMicType(d.label) === mt);
                  if (match) setSelectedAudioId(match.deviceId);
                }}
                className={`h-7 rounded-lg font-semibold capitalize cursor-pointer ${
                  micSourceType === mt ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                }`}
              >
                {mt === 'bluetooth' ? 'BT' : mt === 'wireless' ? '2.4G' : mt === 'wifi' ? 'Wi-Fi' : mt}
              </button>
            ))}
          </div>

          {/* Hardware Input Selector / BLE Pair / Wi-Fi Stream URL */}
          <div className="flex items-center gap-1.5">
            {micSourceType === 'wifi' ? (
              <input
                type="url"
                value={wifiMicUrl}
                onChange={(e) => setWifiMicUrl(e.target.value)}
                placeholder="ws://192.168.1.20:8080/mic"
                className="h-8 flex-1 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] text-white outline-none"
              />
            ) : (
              <select
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-white/15 bg-black/80 px-2 text-[11px] text-white outline-none"
              >
                <option value="default">System Default Mic</option>
                {audioDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Audio Input ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
            {(micSourceType === 'bluetooth' || micSourceType === 'wireless') && (
              <button
                type="button"
                onClick={() => pairBluetoothDevice('mic')}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/15 px-2.5 text-[10px] font-semibold cursor-pointer"
              >
                <Bluetooth className="h-3 w-3 text-[#38bdf8]" />
                <span>{bleMicName ? 'Paired' : 'Pair'}</span>
              </button>
            )}
          </div>

          <label className="block space-y-0.5 text-[10px]">
            <div className="flex justify-between text-white/75">
              <span>Gain</span>
              <span className="font-mono-nums text-[#E8C86A]">{Math.round(micGain * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={micGain}
              onChange={(e) => setMicGain(Number(e.target.value))}
              className="w-full h-1 accent-[#A3E635] cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* 5. TTL FLASH & EXTERNAL FLASH SYNC (Wired / Bluetooth / Wi-Fi) */}
      {drawer === 'flash' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/82 p-3 backdrop-blur-xl space-y-2.5 text-[10px]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {(['off', 'auto', 'on', 'ttl', 'torch'] as FlashMode[]).map((fm) => (
                <button
                  key={fm}
                  type="button"
                  onClick={() => setFlashMode(fm)}
                  className={`h-6 rounded-full px-2.5 font-bold uppercase cursor-pointer ${
                    flashMode === fm ? 'bg-[#E8C86A] text-black' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {fm}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Sync Link: Internal / Wired / Bluetooth / Wi-Fi */}
          <div className="grid grid-cols-4 gap-1">
            {(['internal', 'wired', 'bluetooth', 'wifi'] as FlashSyncTransport[]).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setFlashTransport(tr)}
                className={`h-7 rounded-lg font-semibold capitalize cursor-pointer ${
                  flashTransport === tr ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                }`}
              >
                {tr === 'bluetooth' ? 'BT Sync' : tr === 'wifi' ? 'Wi-Fi' : tr}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={flashPower}
              onChange={(e) => setFlashPower(e.target.value)}
              className="h-7 rounded-lg border border-white/15 bg-black/80 px-2 font-mono-nums text-white"
            >
              {FLASH_POWERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFlashHss((v) => !v)}
              className={`h-7 rounded-lg px-2.5 font-bold cursor-pointer ${
                flashHss ? 'bg-[#D90429] text-white' : 'bg-white/10 text-white/80'
              }`}
            >
              {flashHss ? 'HSS 1/4000' : 'Sync 1/200'}
            </button>
            {flashTransport === 'bluetooth' && (
              <button
                type="button"
                onClick={() => pairBluetoothDevice('flash')}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 font-semibold cursor-pointer"
              >
                <Bluetooth className="h-3 w-3 text-[#38bdf8]" />
                <span>{bleFlashName || 'Pair'}</span>
              </button>
            )}
            {flashTransport === 'wifi' && (
              <div className="flex flex-1 items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 h-7">
                <Wifi className="h-3 w-3 text-[#A3E635] shrink-0" />
                <input
                  type="url"
                  value={wifiFlashUrl}
                  onChange={(e) => setWifiFlashUrl(e.target.value)}
                  placeholder="http://192.168.1.50/flash"
                  className="w-full bg-transparent text-[10px] text-white outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. APP-WIDE 3-AXIS GIMBAL CONTROLLER (Gyro EIS + Horizon + BLE Hardware + Joystick) */}
      {drawer === 'gimbal' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/82 p-3 backdrop-blur-xl space-y-2.5 text-[10px]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {(['off', 'follow', 'horizon', 'lock', 'fpv'] as GimbalMode[]).map((gm) => (
                <button
                  key={gm}
                  type="button"
                  onClick={async () => {
                    if (gm !== 'off') await gimbal.requestGyroPermission();
                    gimbal.setMode(gm);
                  }}
                  className={`h-6 rounded-full px-2 font-bold uppercase cursor-pointer ${
                    gimbal.mode === gm ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {gm}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Compact Virtual Pan/Tilt Nudge Pad */}
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => gimbal.nudge(-0.2, 0)} className="h-7 w-7 rounded bg-white/10 font-bold cursor-pointer">◀</button>
              <button type="button" onClick={() => gimbal.nudge(0, -0.2)} className="h-7 w-7 rounded bg-white/10 font-bold cursor-pointer">▲</button>
              <button type="button" onClick={() => gimbal.recenter()} className="h-7 px-2 rounded bg-white/15 font-bold cursor-pointer">Center</button>
              <button type="button" onClick={() => gimbal.nudge(0, 0.2)} className="h-7 w-7 rounded bg-white/10 font-bold cursor-pointer">▼</button>
              <button type="button" onClick={() => gimbal.nudge(0.2, 0)} className="h-7 w-7 rounded bg-white/10 font-bold cursor-pointer">▶</button>
            </div>

            <button
              type="button"
              onClick={async () => {
                const res = await gimbal.connectBleGimbal();
                pushToast(res.message, res.ok ? 'success' : 'info');
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 font-semibold cursor-pointer"
            >
              <Bluetooth className="h-3 w-3 text-[#38bdf8]" />
              <span>{gimbal.telemetry.bleConnected ? 'Linked' : 'BLE'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex-1 space-y-0.5">
              <div className="flex justify-between text-white/75">
                <span>Smooth</span>
                <span className="font-mono-nums text-[#E8C86A]">{gimbal.strength}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={gimbal.strength}
                onChange={(e) => gimbal.setStrength(Number(e.target.value))}
                className="w-full h-1 accent-[#A3E635] cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => gimbal.setFaceTrack(!gimbal.faceTrack)}
              className={`h-7 rounded-lg px-2.5 font-semibold cursor-pointer ${
                gimbal.faceTrack ? 'bg-[#E8C86A] text-black' : 'bg-white/10 text-white/80'
              }`}
            >
              Track
            </button>
          </div>
        </div>
      )}

      {/* 7. DUAL B-ROLL & PiP POSITION / ASPECT RATIO (AUTO & CUSTOM) */}
      {drawer === 'dual_cfg' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/82 p-3 backdrop-blur-xl space-y-2.5 text-[10px]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBrollMode('cam')}
                className={`h-6 rounded-full px-2.5 font-semibold cursor-pointer ${
                  brollMode === 'cam' ? 'bg-[#A3E635] text-black' : 'bg-white/10'
                }`}
              >
                Cam 2
              </button>
              <button
                type="button"
                onClick={() => brollInputRef.current?.click()}
                className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 font-semibold cursor-pointer ${
                  brollMode === 'broll' ? 'bg-[#D90429] text-white' : 'bg-white/10'
                }`}
              >
                <Upload className="h-3 w-3" />
                <span>Load B-Roll</span>
              </button>
              <button
                type="button"
                onClick={() => setPipPosMode((m) => (m === 'auto' ? 'custom' : 'auto'))}
                className={`h-6 rounded-full px-2.5 font-semibold cursor-pointer ${
                  pipPosMode === 'custom' ? 'bg-[#E8C86A] text-black' : 'bg-white/10'
                }`}
              >
                {pipPosMode === 'auto' ? 'Auto Pos' : 'Custom Pos'}
              </button>
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['auto', 'custom', '16:9', '9:16', '4:3', '1:1', 'circle'] as PipAspectId[]).map((pa) => (
              <button
                key={pa}
                type="button"
                onClick={() => setPipAspect(pa)}
                className={`shrink-0 h-6 rounded px-2 font-semibold uppercase cursor-pointer ${
                  pipAspect === pa ? 'bg-[#A3E635] text-black' : 'bg-white/10 text-white/80'
                }`}
              >
                {pa}
              </button>
            ))}
          </div>

          {pipPosMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-0.5">
                <div className="flex justify-between text-white/75">
                  <span>Width</span>
                  <span className="font-mono-nums">{Math.round(pipRect.w * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={60}
                  value={Math.round(pipRect.w * 100)}
                  onChange={(e) => setPipRect((r) => ({ ...r, w: Number(e.target.value) / 100 }))}
                  className="w-full h-1 accent-[#E8C86A] cursor-pointer"
                />
              </label>
              <label className="space-y-0.5">
                <div className="flex justify-between text-white/75">
                  <span>Height</span>
                  <span className="font-mono-nums">{Math.round(pipRect.h * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={52}
                  value={Math.round(pipRect.h * 100)}
                  onChange={(e) => setPipRect((r) => ({ ...r, h: Number(e.target.value) / 100 }))}
                  className="w-full h-1 accent-[#E8C86A] cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* 8. LOCAL SSD IMPORT / EXPORT VAULT */}
      {drawer === 'ssd' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-lg rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur-xl space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => ssdImportRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-[#A3E635] px-2.5 text-[10px] font-bold text-black cursor-pointer"
              >
                <FolderUp className="h-3 w-3" />
                <span>Import SSD</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawer('none');
                  setCollageOpen(true);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 text-[10px] font-semibold cursor-pointer"
              >
                <LayoutGrid className="h-3 w-3" />
                <span>Collage</span>
              </button>
            </div>
            <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {mediaLibrary.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-white/55">No media yet</div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {mediaLibrary.slice(0, 14).map((item) => (
                <div key={item.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-black">
                  {item.type === 'photo' ? (
                    <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} muted playsInline className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/75 px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => exportToLocalSsd(item.url, `stlive-${item.id}.${item.type === 'photo' ? 'jpg' : 'webm'}`)}
                      aria-label="Export to SSD"
                      className="p-0.5 text-[#A3E635] cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMediaAsset(item.id)}
                      aria-label="Delete"
                      className="p-0.5 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. DIRECT GO LIVE & DIRECT SHARE LINK SHEET */}
      {drawer === 'golive' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-2.5 sm:inset-x-6 bottom-36 sm:bottom-40 z-30 mx-auto max-w-md rounded-2xl border border-[#D90429]/50 bg-black/88 p-3.5 backdrop-blur-xl space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D90429]">
              <Radio className="h-3.5 w-3.5" />
              GO LIVE
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleShareLiveFeed}
                className="inline-flex h-6 items-center gap-1 rounded-full bg-white/10 px-2 text-[10px] font-semibold cursor-pointer"
              >
                <Share2 className="h-3 w-3 text-[#A3E635]" />
                <span>Share Link</span>
              </button>
              <button type="button" onClick={() => setDrawer('none')} className="p-1 text-white/60 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!session || (session.role !== 'host' && session.role !== 'band') ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/80">Host or Band login required</span>
              <button
                type="button"
                onClick={onRequireLogin}
                className="h-8 rounded-full bg-[#D90429] px-3.5 text-[11px] font-bold text-white cursor-pointer"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleDirectGoLive} className="space-y-2">
              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Live title..."
                className="h-8 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 text-xs text-white placeholder:text-white/50 outline-none focus:border-[#D90429]"
              />
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <select
                  value={liveCategory}
                  onChange={(e) => setLiveCategory(e.target.value as Livestream['category'])}
                  className="h-8 rounded-lg border border-white/15 bg-black/80 px-2 text-white outline-none"
                >
                  <option value="solo">Solo</option>
                  <option value="multi_guest">Multi-Guest</option>
                  <option value="pk">PK</option>
                  <option value="games">Games</option>
                  <option value="music_band">Band</option>
                  <option value="audio">Audio</option>
                </select>
                <select
                  value={liveGameType}
                  onChange={(e) => setLiveGameType(e.target.value as '' | GameType)}
                  className="h-8 rounded-lg border border-white/15 bg-black/80 px-2 text-white outline-none"
                >
                  <option value="">No Game</option>
                  <option value="fps">3D FPS</option>
                  <option value="ludo">Ludo</option>
                  <option value="snakes">Snakes</option>
                </select>
                <select
                  value={liveSeats}
                  onChange={(e) => setLiveSeats(Number(e.target.value))}
                  className="h-8 rounded-lg border border-white/15 bg-black/80 px-2 text-white outline-none"
                >
                  <option value={4}>4 Seats</option>
                  <option value={6}>6 Seats</option>
                  <option value={8}>8 Seats</option>
                  <option value={12}>12 Seats</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5 items-center text-[11px]">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={livePin}
                  onChange={(e) => setLivePin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Optional 6-digit PIN"
                  className="h-8 rounded-lg border border-white/15 bg-white/10 px-2.5 font-mono-nums text-xs text-white placeholder:text-white/45 outline-none focus:border-[#E8C86A]"
                />
                <label className="flex items-center gap-1.5 text-[10px] text-white/85 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={liveConsent}
                    onChange={(e) => setLiveConsent(e.target.checked)}
                    className="accent-[#D90429]"
                  />
                  <span>18+ & Safety Consent</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={launchingLive || !liveConsent}
                className="h-9 w-full rounded-full bg-[#D90429] text-xs font-bold tracking-wide text-white cursor-pointer disabled:opacity-50"
              >
                {launchingLive ? 'Starting...' : livePin.length === 6 ? 'Start PIN-Locked Live' : 'Start Live Now'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* =====================================================================
          BOTTOM NATIVE CAMERA CONTROLS (Compact Mobile/Tablet Ergonomics)
          ===================================================================== */}
      <div className="absolute inset-x-0 bottom-0 z-30 pb-safe-bottom px-3 pb-3 space-y-2">
        {/* Compact Zoom / Timelapse Speed Pills */}
        <div className="flex items-center justify-center gap-1.5">
          {camMode === 'timelapse' ? (
            ([500, 1000, 2000] as const).map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setTimelapseInterval(ms)}
                className={`h-6 rounded-full px-2 text-[10px] font-mono-nums font-bold cursor-pointer ${
                  timelapseInterval === ms ? 'bg-[#E8C86A] text-black' : 'bg-black/55 text-white/80'
                }`}
              >
                {ms / 1000}s
              </button>
            ))
          ) : (
            [0.5, 1, 2, 5].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`flex h-6 min-w-[28px] items-center justify-center rounded-full px-1.5 text-[10px] font-mono-nums font-bold cursor-pointer ${
                  Math.abs(zoom - z) < 0.25 ? 'bg-[#E8C86A] text-black' : 'bg-black/55 text-white/80'
                }`}
              >
                {z}x
              </button>
            ))
          )}
        </div>

        {/* Swipeable Camera Mode Strip (Includes REELS & DUAL) */}
        <div className="flex items-center justify-center gap-3.5 overflow-x-auto no-scrollbar px-2">
          {(
            [
              { id: 'timelapse', label: 'LAPSE' },
              { id: 'pano', label: 'PANO' },
              { id: 'live_photo', label: 'LIVE' },
              { id: 'photo', label: 'PHOTO' },
              { id: 'video', label: 'VIDEO' },
              { id: 'reels', label: 'REELS' },
              { id: 'dual', label: 'DUAL' },
            ] as Array<{ id: CamMode; label: string }>
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (isRecording || panoActive) return;
                setCamMode(m.id);
              }}
              className={`shrink-0 text-[10px] sm:text-[11px] font-bold tracking-wider transition-colors cursor-pointer ${
                camMode === m.id ? 'text-[#E8C86A]' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Native Compact Shutter Row */}
        <div className="mx-auto flex max-w-xs items-center justify-between px-3 pt-0.5">
          {/* Left: Latest Capture / SSD Vault */}
          <button
            type="button"
            onClick={() => toggleDrawer('ssd')}
            aria-label="Library & SSD"
            className="h-9 w-9 sm:h-11 sm:w-11 overflow-hidden rounded-xl border-2 border-white/35 bg-black/60 cursor-pointer flex items-center justify-center"
          >
            {latestAsset ? (
              latestAsset.type === 'photo' ? (
                <img src={latestAsset.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={latestAsset.url} muted playsInline className="h-full w-full object-cover" />
              )
            ) : (
              <Film className="h-4 w-4 text-white/60" />
            )}
          </button>

          {/* Center: Native Tactile Shutter Button (Compact Mobile / Tablet) */}
          <button
            type="button"
            onClick={handleShutterTap}
            aria-label="Shutter"
            className="relative flex h-[58px] w-[58px] sm:h-[66px] sm:w-[66px] items-center justify-center rounded-full border-[3.5px] border-white bg-transparent cursor-pointer active:scale-95 transition-transform"
          >
            <span
              className={`transition-all duration-150 ${
                isRecording || panoActive
                  ? 'h-5 w-5 rounded-md bg-[#D90429]'
                  : isVideoShutter
                    ? 'h-[44px] w-[44px] sm:h-[50px] sm:w-[50px] rounded-full bg-[#D90429]'
                    : camMode === 'live_photo'
                      ? 'h-[44px] w-[44px] sm:h-[50px] sm:w-[50px] rounded-full bg-[#E8C86A]'
                      : 'h-[44px] w-[44px] sm:h-[50px] sm:w-[50px] rounded-full bg-white'
              }`}
            />
          </button>

          {/* Right: Multi-Camera Lens Switch / Flip */}
          <button
            type="button"
            onClick={handleFlipCamera}
            aria-label="Switch Camera"
            className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 hover:bg-black/75 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* INTERACTIVE COLLAGE MAKER MODAL */}
      <CollageMakerModal
        open={collageOpen}
        onClose={() => setCollageOpen(false)}
        libraryPhotos={libraryPhotos}
        onSaveCollage={(dataUrl, label) => {
          addMediaAsset({
            id: `collage-${Date.now()}`,
            type: 'photo',
            url: dataUrl,
            label,
            createdAt: new Date().toLocaleTimeString(),
          });
          pushToast('Collage saved', 'success');
        }}
        onExportLocal={(dataUrl, filename) => exportToLocalSsd(dataUrl, filename)}
      />
    </div>
  );
};
