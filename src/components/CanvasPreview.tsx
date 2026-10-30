import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  FlipHorizontal,
  Gauge,
  Grid,
  Layers,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Snowflake,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AspectRatioKey,
  MediaAsset,
  TimelineClip,
  Track,
} from '../types/editor';
import { ASPECT_RATIO_PRESETS } from '../data/defaultCatalog';
import { renderCompositeFrame } from '../engine/canvasRenderer';
import { formatTimecode } from '../engine/timelineLogic';
import { audioEngine } from '../engine/audioEngine';

interface CanvasPreviewProps {
  aspectRatio: AspectRatioKey;
  customWidth: number;
  customHeight: number;
  playheadTime: number;
  timelineDuration: number;
  isPlaying: boolean;
  loopPlayback: boolean;
  tracks: Track[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  selectedClipId: string | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (deltaFrames: number) => void;
  onToggleLoop: () => void;
  onUpdateClipPosition: (clipId: string, newX: number, newY: number) => void;
  onQuickSplit?: () => void;
  onQuickCycleSpeed?: () => void;
  onQuickCycleRatio?: () => void;
  onQuickFlipH?: () => void;
  onQuickFreeze?: () => void;
  onQuickReverse?: () => void;
  onQuickDuplicate?: () => void;
  onQuickDelete?: () => void;
  onQuickOpenTemplates?: () => void;
  onQuickOpenAiReframe?: () => void;
  canvasRefExternal?: React.MutableRefObject<HTMLCanvasElement | null>;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  aspectRatio,
  customWidth,
  customHeight,
  playheadTime,
  timelineDuration,
  isPlaying,
  loopPlayback,
  tracks,
  clips,
  assets,
  selectedClipId,
  onTogglePlay,
  onSeek,
  onStepFrame,
  onToggleLoop,
  onUpdateClipPosition,
  onQuickSplit,
  onQuickCycleSpeed,
  onQuickCycleRatio,
  onQuickFlipH,
  onQuickFreeze,
  onQuickReverse,
  onQuickDuplicate,
  onQuickDelete,
  onQuickOpenTemplates,
  onQuickOpenAiReframe,
  canvasRefExternal,
}) => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaCacheRef = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>(new Map());
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const [proxyResolutionScale, setProxyResolutionScale] = useState<1 | 0.5 | 0.25>(0.5);
  const [meterLevels, setMeterLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  const preset = ASPECT_RATIO_PRESETS.find((p) => p.key === aspectRatio) || ASPECT_RATIO_PRESETS[0];
  const baseW = aspectRatio === 'custom' ? customWidth : preset.width;
  const baseH = aspectRatio === 'custom' ? customHeight : preset.height;

  const renderW = Math.max(320, Math.round(baseW * proxyResolutionScale));
  const renderH = Math.max(180, Math.round(baseH * proxyResolutionScale));
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  // Preload any local blob video/image assets into HTML elements for real-time drawing
  useEffect(() => {
    const cache = mediaCacheRef.current;
    for (const asset of assets) {
      if (asset.blobUrl && !cache.has(asset.id)) {
        if (asset.category === 'video') {
          const vid = document.createElement('video');
          vid.src = asset.blobUrl;
          vid.muted = true;
          vid.playsInline = true;
          vid.crossOrigin = 'anonymous';
          vid.load();
          cache.set(asset.id, vid);
        } else if (asset.category === 'image') {
          const img = new Image();
          img.src = asset.blobUrl;
          img.crossOrigin = 'anonymous';
          cache.set(asset.id, img);
        }
      }
    }
  }, [assets]);

  // Render composite frame whenever playheadTime, tracks, clips, or resolution changes
  useEffect(() => {
    const canvas = internalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sync any HTMLVideoElement currentTime
    for (const clip of clips) {
      const el = mediaCacheRef.current.get(clip.assetId);
      if (el && el instanceof HTMLVideoElement) {
        if (playheadTime >= clip.startTime && playheadTime <= clip.startTime + clip.duration) {
          const mediaTime = Math.max(0, clip.sourceOffset + (playheadTime - clip.startTime) * clip.speed);
          if (Math.abs(el.currentTime - mediaTime) > 0.25) {
            el.currentTime = mediaTime;
          }
        }
      }
    }

    renderCompositeFrame(
      ctx,
      renderW,
      renderH,
      playheadTime,
      tracks,
      clips,
      mediaCacheRef.current,
      selectedClipId,
      showSafeGuides
    );

    if (isPlaying) {
      setMeterLevels(audioEngine.getMasterMeterLevels());
    } else {
      setMeterLevels({ left: 0, right: 0 });
    }
  }, [playheadTime, renderW, renderH, tracks, clips, selectedClipId, showSafeGuides, isPlaying]);

  // Direct Canvas Drag-to-Position for Selected Clip
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClipId) return;
    const selected = clips.find((c) => c.id === selectedClipId);
    if (!selected) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = selected.transform.x;
    const origY = selected.transform.y;

    const handleMove = (moveEv: MouseEvent) => {
      const dxPct = ((moveEv.clientX - startX) / (rect.width / 2)) * 100;
      const dyPct = ((moveEv.clientY - startY) / (rect.height / 2)) * 100;
      onUpdateClipPosition(
        selectedClipId,
        Math.max(-100, Math.min(100, Math.round(origX + dxPct))),
        Math.max(-100, Math.min(100, Math.round(origY + dyPct)))
      );
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <main
      aria-label="Video Compositor Preview"
      className="flex-1 flex flex-col bg-slate-100 dark:bg-[#0B0D12] min-w-0 overflow-hidden select-none"
    >
      {/* CapCut Player Viewport Header Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-white dark:bg-[#12141C] border-b border-slate-200 dark:border-[#232734] text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white">Player</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400 font-medium">
            {baseW}×{baseH} ({aspectRatio})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="proxy-quality-select" className="text-[11px] text-slate-500 hidden sm:inline">
            Quality:
          </label>
          <select
            id="proxy-quality-select"
            aria-label="Preview Proxy Quality"
            value={proxyResolutionScale}
            onChange={(e) => setProxyResolutionScale(Number(e.target.value) as 1 | 0.5 | 0.25)}
            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1C202C] text-slate-800 dark:text-slate-200 text-[11px] font-medium cursor-pointer border border-transparent dark:border-[#2A3042]"
          >
            <option value={1}>Full (1:1 Native)</option>
            <option value={0.5}>1/2 Proxy (Smooth)</option>
            <option value={0.25}>1/4 Fast Proxy</option>
          </select>

          <button
            type="button"
            onClick={() => setShowSafeGuides((s) => !s)}
            aria-pressed={showSafeGuides}
            title="Toggle Title & Action Safe Guides"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium cursor-pointer ${
              showSafeGuides
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-400'
                : 'border-slate-200 dark:border-[#2A3042] text-slate-600 dark:text-slate-400'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span className="hidden sm:inline">Safe Guides</span>
          </button>
        </div>
      </div>

      {/* Center Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-2.5 sm:p-4 relative overflow-hidden">
        <div
          className="relative flex items-center justify-center max-w-full max-h-full shadow-2xl rounded-md overflow-hidden border border-slate-300 dark:border-[#282E40] bg-black"
          style={{
            aspectRatio: `${baseW} / ${baseH}`,
            height: baseH > baseW ? '100%' : 'auto',
            width: baseW >= baseH ? '100%' : 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          <canvas
            ref={(el) => {
              internalCanvasRef.current = el;
              if (canvasRefExternal) {
                canvasRefExternal.current = el;
              }
            }}
            data-testid="video-preview-canvas"
            width={renderW}
            height={renderH}
            onMouseDown={handleCanvasMouseDown}
            className="w-full h-full object-contain cursor-move"
          />
        </div>

        {/* Stereo Master Audio Level Meter on Right Edge of Monitor */}
        <div
          aria-label="Master Audio Meter"
          className="hidden sm:flex flex-col items-center justify-end gap-1 ml-3 h-36 w-5 p-1 rounded bg-[#141720] border border-[#262B3B]"
        >
          <div className="flex-1 w-full flex gap-0.5 items-end">
            <div className="flex-1 bg-slate-800 h-full rounded-xs flex items-end overflow-hidden">
              <div
                className="w-full bg-cyan-400 transition-all duration-75"
                style={{ height: `${meterLevels.left}%` }}
              />
            </div>
            <div className="flex-1 bg-slate-800 h-full rounded-xs flex items-end overflow-hidden">
              <div
                className="w-full bg-emerald-400 transition-all duration-75"
                style={{ height: `${meterLevels.right}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] font-mono text-slate-400">dB</span>
        </div>
      </div>

      {/* Transport & Frame-by-Frame Playback Controls Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-white dark:bg-[#12141C] border-t border-slate-200 dark:border-[#232734] text-xs">
        {/* Timecode Readout */}
        <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs">
          <span data-testid="playhead-timecode" className="text-cyan-600 dark:text-cyan-400 font-bold">
            {formatTimecode(playheadTime)}
          </span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500 dark:text-slate-400">
            {formatTimecode(timelineDuration)}
          </span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Jump to Start"
            title="Jump to Start (Home)"
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#1E2230] text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStepFrame(-1)}
            aria-label="Previous Frame"
            title="Step Back 1 Frame (Left Arrow)"
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#1E2230] text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause Playback' : 'Play Video'}
            title="Play / Pause (Space)"
            className="inline-flex items-center justify-center w-9 h-7 rounded-md bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition-colors cursor-pointer shadow-xs"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => onStepFrame(1)}
            aria-label="Next Frame"
            title="Step Forward 1 Frame (Right Arrow)"
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#1E2230] text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(timelineDuration)}
            aria-label="Jump to End"
            title="Jump to End"
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#1E2230] text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Loop Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLoop}
            aria-pressed={loopPlayback}
            title="Toggle Loop Playback"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer ${
              loopPlayback
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-400'
                : 'border-slate-200 dark:border-[#2A3042] text-slate-600 dark:text-slate-400'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop</span>
          </button>
        </div>
      </div>

      {/* InShot / CapCut Style Quick Action Tool Ribbon right below the Player */}
      <div
        aria-label="InShot and CapCut Quick Edit Bar"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-[#151822] border-t border-slate-200 dark:border-[#232734] overflow-x-auto text-[11px]"
      >
        <button
          type="button"
          onClick={onQuickCycleRatio}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Cycle Canvas Aspect Ratio (16:9 / 9:16 / 1:1 / 4:5)"
        >
          <Crop className="w-3.5 h-3.5 text-cyan-400" />
          <span>Canvas {aspectRatio}</span>
        </button>

        <button
          type="button"
          onClick={onQuickSplit}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Split clip at playhead (S)"
        >
          <Scissors className="w-3.5 h-3.5 text-cyan-400" />
          <span>Split</span>
        </button>

        <button
          type="button"
          onClick={onQuickCycleSpeed}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Cycle Clip Playback Speed (0.5x / 1x / 1.5x / 2x)"
        >
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span>Speed {selectedClip ? `${selectedClip.speed}x` : '1x'}</span>
        </button>

        <button
          type="button"
          onClick={onQuickFlipH}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Flip Clip Horizontally"
        >
          <FlipHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Flip</span>
        </button>

        <button
          type="button"
          onClick={onQuickFreeze}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Freeze Frame"
        >
          <Snowflake className="w-3.5 h-3.5 text-sky-400" />
          <span>Freeze</span>
        </button>

        <button
          type="button"
          onClick={onQuickReverse}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Reverse Clip Playback"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Reverse</span>
        </button>

        <button
          type="button"
          onClick={onQuickDuplicate}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Duplicate Clip (D)"
        >
          <Copy className="w-3.5 h-3.5 text-slate-400" />
          <span>Copy</span>
        </button>

        <button
          type="button"
          onClick={onQuickOpenTemplates}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Open CapCut & Remotion Template Library"
        >
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          <span>Templates</span>
        </button>

        <button
          type="button"
          onClick={onQuickOpenAiReframe}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-cyan-400 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Open AI Auto-Reframe & Magic Tools"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>AI Reframe</span>
        </button>

        <button
          type="button"
          onClick={onQuickDelete}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2C3246] hover:border-rose-500 text-rose-500 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          title="Delete Selected Clip"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </main>
  );
};
