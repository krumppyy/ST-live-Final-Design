import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  FolderUp,
  ImagePlus,
  LayoutGrid,
  Move,
  RotateCcw,
  X,
  ZoomIn,
} from 'lucide-react';
import type { CapturedAsset } from '../types';

interface CollageSlotDef {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
}

interface CollagePreset {
  id: string;
  label: string;
  slots: CollageSlotDef[];
}

const COLLAGE_PRESETS: CollagePreset[] = [
  {
    id: 'split-v',
    label: '2 V',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'split-h',
    label: '2 H',
    slots: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: 'hero-3',
    label: '3 Hero',
    slots: [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.5 },
      { x: 0.58, y: 0.5, w: 0.42, h: 0.5 },
    ],
  },
  {
    id: 'strip-3',
    label: '3 Strip',
    slots: [
      { x: 0, y: 0, w: 0.333, h: 1 },
      { x: 0.333, y: 0, w: 0.334, h: 1 },
      { x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    id: 'grid-4',
    label: '4 Grid',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'pip-frame',
    label: 'PiP',
    slots: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.62, y: 0.62, w: 0.34, h: 0.34 },
    ],
  },
  {
    id: 'mosaic-6',
    label: '6 Mix',
    slots: [
      { x: 0, y: 0, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0, w: 0.334, h: 0.5 },
      { x: 0.667, y: 0, w: 0.333, h: 0.5 },
      { x: 0, y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.334, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
];

interface SlotPhoto {
  url: string;
  offsetX: number; // -100..100 %
  offsetY: number; // -100..100 %
  scale: number; // 1..2.6
}

interface CollageMakerModalProps {
  open: boolean;
  onClose: () => void;
  libraryPhotos: CapturedAsset[];
  onSaveCollage: (dataUrl: string, presetLabel: string) => void;
  onExportLocal: (dataUrl: string, filename: string) => void;
}

export const CollageMakerModal: React.FC<CollageMakerModalProps> = ({
  open,
  onClose,
  libraryPhotos,
  onSaveCollage,
  onExportLocal,
}) => {
  const [presetId, setPresetId] = useState<string>('hero-3');
  const [slotsData, setSlotsData] = useState<Record<number, SlotPhoto>>({});
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [gapPx, setGapPx] = useState<number>(8);
  const [bgColor, setBgColor] = useState<string>('#0d0d10');
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{
    slotIdx: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  if (!open) return null;

  const preset = COLLAGE_PRESETS.find((p) => p.id === presetId) || COLLAGE_PRESETS[0];
  const activePhoto = slotsData[activeSlot];

  const assignPhotoToSlot = (slotIdx: number, url: string) => {
    setSlotsData((prev) => ({
      ...prev,
      [slotIdx]: { url, offsetX: 0, offsetY: 0, scale: 1 },
    }));
    setActiveSlot(slotIdx);
  };

  const handleImportFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    files.forEach((file, idx) => {
      const targetSlot = (activeSlot + idx) % preset.slots.length;
      const url = URL.createObjectURL(file);
      assignPhotoToSlot(targetSlot, url);
    });
    e.target.value = '';
  };

  const handlePointerDown = (slotIdx: number, e: React.PointerEvent<HTMLDivElement>) => {
    setActiveSlot(slotIdx);
    const current = slotsData[slotIdx];
    if (!current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      slotIdx,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.offsetX,
      origY: current.offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { slotIdx, startX, startY, origX, origY } = dragRef.current;
    const dx = ((e.clientX - startX) / 140) * 50;
    const dy = ((e.clientY - startY) / 140) * 50;
    setSlotsData((prev) => {
      const cur = prev[slotIdx];
      if (!cur) return prev;
      return {
        ...prev,
        [slotIdx]: {
          ...cur,
          offsetX: Math.max(-60, Math.min(60, origX + dx)),
          offsetY: Math.max(-60, Math.min(60, origY + dy)),
        },
      };
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const renderCollageToDataUrl = async (): Promise<string> => {
    const size = 1440;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    const pad = gapPx * 2;
    for (let i = 0; i < preset.slots.length; i++) {
      const slot = preset.slots[i];
      const photo = slotsData[i];
      const sx = slot.x * size + pad / 2;
      const sy = slot.y * size + pad / 2;
      const sw = slot.w * size - pad;
      const sh = slot.h * size - pad;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 18);
      ctx.clip();

      if (photo?.url) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = photo.url;
          });

          const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
          const slotRatio = sw / Math.max(1, sh);
          let drawW = sw;
          let drawH = sh;
          if (imgRatio > slotRatio) {
            drawW = sh * imgRatio;
          } else {
            drawH = sw / imgRatio;
          }
          drawW *= photo.scale;
          drawH *= photo.scale;

          const cx = sx + sw / 2 + (photo.offsetX / 100) * sw;
          const cy = sy + sh / 2 + (photo.offsetY / 100) * sh;
          ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        } catch {
          ctx.fillStyle = '#18181e';
          ctx.fillRect(sx, sy, sw, sh);
        }
      } else {
        ctx.fillStyle = '#18181e';
        ctx.fillRect(sx, sy, sw, sh);
      }

      if (preset.id === 'pip-frame' && i === 1) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.strokeRect(sx, sy, sw, sh);
      }
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  };

  const handleSave = async (toDisk: boolean) => {
    setExporting(true);
    try {
      const url = await renderCollageToDataUrl();
      if (toDisk) {
        onExportLocal(url, `streamlive-collage-${Date.now()}.png`);
      } else {
        onSaveCollage(url, preset.label);
        onClose();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white px-safe-curved pt-safe-top pb-safe-bottom">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImportFiles}
        className="hidden"
      />

      {/* Minimal Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Collage"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
          <LayoutGrid className="h-4 w-4 text-[#A3E635]" />
          <span>COLLAGE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleSave(true)}
            title="Export to SSD"
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">SSD</span>
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleSave(false)}
            className="flex h-10 items-center gap-1.5 rounded-full bg-[#D90429] px-4 text-xs font-bold text-white hover:opacity-90 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Interactive Collage Stage (Drag inside any cell to select visible crop area) */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div
          className="relative w-full max-w-[420px] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/15"
          style={{ backgroundColor: bgColor }}
        >
          {preset.slots.map((slot, idx) => {
            const photo = slotsData[idx];
            const isSelected = activeSlot === idx;
            return (
              <div
                key={`${preset.id}-${idx}`}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  left: `calc(${slot.x * 100}% + ${gapPx / 2}px)`,
                  top: `calc(${slot.y * 100}% + ${gapPx / 2}px)`,
                  width: `calc(${slot.w * 100}% - ${gapPx}px)`,
                  height: `calc(${slot.h * 100}% - ${gapPx}px)`,
                  zIndex: preset.id === 'pip-frame' && idx === 1 ? 10 : 1,
                }}
                className={`absolute overflow-hidden rounded-xl touch-none select-none cursor-grab active:cursor-grabbing transition-shadow ${
                  isSelected
                    ? 'ring-2 ring-[#A3E635]'
                    : 'ring-1 ring-white/20'
                } bg-[#18181e]`}
              >
                {photo?.url ? (
                  <img
                    src={photo.url}
                    alt={`Slot ${idx + 1}`}
                    draggable={false}
                    style={{
                      transform: `translate(${photo.offsetX}%, ${photo.offsetY}%) scale(${photo.scale})`,
                    }}
                    className="h-full w-full object-cover pointer-events-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlot(idx);
                      fileInputRef.current?.click();
                    }}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/50 hover:text-white cursor-pointer"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[10px] font-mono-nums">{idx + 1}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Cell Area Crop Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3.5 font-medium hover:bg-white/25 cursor-pointer"
          >
            <FolderUp className="h-3.5 w-3.5 text-[#A3E635]" />
            <span>Add SSD Photo</span>
          </button>

          {activePhoto && (
            <>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 h-9">
                <ZoomIn className="h-3.5 w-3.5 text-[#E8C86A]" />
                <input
                  type="range"
                  min={1}
                  max={2.6}
                  step={0.05}
                  value={activePhoto.scale}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSlotsData((prev) => ({
                      ...prev,
                      [activeSlot]: { ...prev[activeSlot], scale: val },
                    }));
                  }}
                  className="w-24 accent-[#A3E635] cursor-pointer"
                />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-white/60">
                <Move className="h-3 w-3" /> Drag photo
              </span>
              <button
                type="button"
                onClick={() =>
                  setSlotsData((prev) => ({
                    ...prev,
                    [activeSlot]: { ...prev[activeSlot], offsetX: 0, offsetY: 0, scale: 1 },
                  }))
                }
                aria-label="Reset cell position"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom Dock: Layout Presets + In-App Library Picker + Frame Gap/Bg */}
      <div className="border-t border-white/10 bg-[#0d0d10]/95 px-4 py-3 space-y-3">
        {/* Ready-to-go Layout Preset Icons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {COLLAGE_PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPresetId(p.id);
                  setActiveSlot(0);
                }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#A3E635] bg-white/15'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="relative h-8 w-8 rounded bg-black/70 overflow-hidden">
                  {p.slots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        left: `${s.x * 100}%`,
                        top: `${s.y * 100}%`,
                        width: `${s.w * 100}%`,
                        height: `${s.h * 100}%`,
                      }}
                      className="absolute border border-white/50 bg-white/15"
                    />
                  ))}
                </div>
                <span className="text-[10px] font-medium">{p.label}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-1.5 pl-2">
            {['#0d0d10', '#ffffff', '#D90429', '#1e293b'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBgColor(c)}
                aria-label={`Background ${c}`}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                  bgColor === c ? 'border-[#A3E635]' : 'border-white/30'
                }`}
              />
            ))}
            <button
              type="button"
              onClick={() => setGapPx((g) => (g === 0 ? 8 : g === 8 ? 16 : 0))}
              className="h-7 rounded-lg bg-white/10 px-2 text-[10px] font-mono-nums cursor-pointer"
            >
              Gap {gapPx}
            </button>
          </div>
        </div>

        {/* Camera Library Photos Quick-Tap Strip */}
        {libraryPhotos.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {libraryPhotos.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => assignPhotoToSlot(activeSlot, asset.url)}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/20 hover:border-[#A3E635] cursor-pointer"
              >
                <img src={asset.url} alt={asset.label} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
