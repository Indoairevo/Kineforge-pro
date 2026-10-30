import React, { useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Merge,
  Plus,
  Scissors,
  Snowflake,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import { TimelineClip, Track, TrackType } from '../types/editor';
import { calculateSnapTime, formatTimecode } from '../engine/timelineLogic';

interface TimelinePanelProps {
  tracks: Track[];
  clips: TimelineClip[];
  playheadTime: number;
  timelineDuration: number;
  selectedClipId: string | null;
  magneticTimeline: boolean;
  snappingEnabled: boolean;
  beatMarkers: number[];
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onSplitAtPlayhead: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onMergeAdjacent: () => void;
  onToggleFreezeSelected: () => void;
  onToggleReverseSelected: () => void;
  onToggleMagnetic: () => void;
  onToggleSnapping: () => void;
  onUpdateTrack: (trackId: string, updater: (t: Track) => Track) => void;
  onReorderTrack: (trackId: string, direction: 'up' | 'down') => void;
  onAddTrack: (type: TrackType) => void;
  onMoveOrTrimClip: (clipId: string, newStartTime: number, newDuration: number, newTrackId?: string) => void;
  onDropAssetOnTrack: (assetId: string, trackId: string, dropTime: number) => void;
  onCycleClipTransition?: (clipId: string) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  tracks,
  clips,
  playheadTime,
  timelineDuration,
  selectedClipId,
  magneticTimeline,
  snappingEnabled,
  beatMarkers,
  onSeek,
  onSelectClip,
  onSplitAtPlayhead,
  onDuplicateSelected,
  onDeleteSelected,
  onMergeAdjacent,
  onToggleFreezeSelected,
  onToggleReverseSelected,
  onToggleMagnetic,
  onToggleSnapping,
  onUpdateTrack,
  onReorderTrack,
  onAddTrack,
  onMoveOrTrimClip,
  onDropAssetOnTrack,
  onCycleClipTransition,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(64);
  const [activeSnapGuide, setActiveSnapGuide] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order);
  const totalWidthPx = Math.max(920, Math.ceil((timelineDuration + 4) * pixelsPerSecond));

  const collectSnapPoints = (excludeClipId?: string): number[] => {
    const pts: number[] = [0, playheadTime, ...beatMarkers];
    for (const c of clips) {
      if (c.id !== excludeClipId) {
        pts.push(c.startTime, c.startTime + c.duration);
      }
    }
    return pts;
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetSec = Math.max(0, clickX / pixelsPerSecond);
    onSeek(Number(targetSec.toFixed(3)));
  };

  const handleClipPointerDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: 'move' | 'trim-left' | 'trim-right'
  ) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    const track = tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;

    const startX = e.clientX;
    const origStart = clip.startTime;
    const origDur = clip.duration;

    const handleWindowMove = (moveEv: MouseEvent) => {
      const deltaSec = (moveEv.clientX - startX) / pixelsPerSecond;
      const snapPoints = collectSnapPoints(clip.id);

      if (mode === 'move') {
        let candidateStart = Math.max(0, origStart + deltaSec);
        if (snappingEnabled) {
          const snapRes = calculateSnapTime(candidateStart, snapPoints, 0.18);
          candidateStart = snapRes.time;
          setActiveSnapGuide(snapRes.snapPoint);
        }
        onMoveOrTrimClip(clip.id, candidateStart, origDur);
      } else if (mode === 'trim-left') {
        const maxTrim = origDur - 0.25;
        const clampedDelta = Math.max(-origStart, Math.min(maxTrim, deltaSec));
        const newStart = origStart + clampedDelta;
        const newDur = origDur - clampedDelta;
        onMoveOrTrimClip(clip.id, newStart, newDur);
      } else if (mode === 'trim-right') {
        let candidateEnd = Math.max(origStart + 0.25, origStart + origDur + deltaSec);
        if (snappingEnabled) {
          const snapRes = calculateSnapTime(candidateEnd, snapPoints, 0.18);
          candidateEnd = Math.max(origStart + 0.25, snapRes.time);
          setActiveSnapGuide(snapRes.snapPoint);
        }
        onMoveOrTrimClip(clip.id, origStart, candidateEnd - origStart);
      }
    };

    const handleWindowUp = () => {
      setActiveSnapGuide(null);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
  };

  // Visual filmstrip gradient swatch based on procedural scene
  const getSceneFilmstripGradient = (scene?: string) => {
    switch (scene) {
      case 'cyber_city_drive':
        return 'linear-gradient(135deg, #082F49 0%, #0E7490 50%, #1E1B4B 100%)';
      case 'alpine_drone_sunrise':
        return 'linear-gradient(135deg, #0C4A6E 0%, #D97706 55%, #0F172A 100%)';
      case 'studio_director_interview':
        return 'linear-gradient(135deg, #1E293B 0%, #334155 50%, #0F172A 100%)';
      case 'roastery_vertical_reel':
        return 'linear-gradient(135deg, #451A03 0%, #9A3412 55%, #1C1917 100%)';
      default:
        return 'linear-gradient(135deg, #0F172A 0%, #0891B2 60%, #1E293B 100%)';
    }
  };

  return (
    <section
      aria-label="Multi-Track Editing Timeline"
      className="flex flex-col h-64 md:h-72 shrink-0 bg-white dark:bg-[#11131A] border-t border-slate-200 dark:border-[#232734] select-none overflow-hidden"
    >
      {/* CapCut Timeline Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-[#161922] border-b border-slate-200 dark:border-[#232734] text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split clip at playhead (Shortcut: S)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-slate-800 dark:text-slate-100 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span>Split Clip</span>
          </button>

          <button
            type="button"
            onClick={onMergeAdjacent}
            disabled={!selectedClipId}
            title="Merge selected clip with adjacent clip on same track (Shortcut: M)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-slate-800 dark:text-slate-100 disabled:opacity-40 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Merge className="w-3.5 h-3.5" />
            <span>Merge</span>
          </button>

          <button
            type="button"
            onClick={onDuplicateSelected}
            disabled={!selectedClipId}
            title="Duplicate selected clip (Shortcut: D)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-slate-800 dark:text-slate-100 disabled:opacity-40 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={onToggleFreezeSelected}
            disabled={!selectedClipId}
            title="Freeze frame on selected clip"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-slate-800 dark:text-slate-100 disabled:opacity-40 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            <span>Freeze</span>
          </button>

          <button
            type="button"
            onClick={onToggleReverseSelected}
            disabled={!selectedClipId}
            title="Reverse playback on selected clip"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-slate-800 dark:text-slate-100 disabled:opacity-40 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reverse</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedClipId}
            title="Delete selected clip (Delete / Backspace)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-rose-600 dark:text-rose-400 disabled:opacity-40 hover:border-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>

        {/* Right Timeline Controls: Magnetic, Snapping, Add Track, Zoom */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={onToggleMagnetic}
            aria-pressed={magneticTimeline}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              magneticTimeline
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-500 dark:text-cyan-300'
                : 'border-slate-200 dark:border-[#2D3348] bg-white dark:bg-[#1E2230] text-slate-600 dark:text-slate-300'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Magnetic</span>
          </button>

          <button
            type="button"
            onClick={onToggleSnapping}
            aria-pressed={snappingEnabled}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              snappingEnabled
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-500 dark:text-cyan-300'
                : 'border-slate-200 dark:border-[#2D3348] bg-white dark:bg-[#1E2230] text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>Snap Guides</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAddTrack('video')}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-[11px] text-slate-700 dark:text-slate-200 hover:border-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-cyan-400" />
              <span>Video Track</span>
            </button>
            <button
              type="button"
              onClick={() => onAddTrack('audio')}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] text-[11px] text-slate-700 dark:text-slate-200 hover:border-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              <span>Audio Track</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#1E2230] border border-slate-200 dark:border-[#2D3348] rounded px-2 py-0.5">
            <button
              type="button"
              onClick={() => setPixelsPerSecond((z) => Math.max(28, z - 12))}
              aria-label="Zoom out timeline"
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              aria-label="Timeline Zoom Scale"
              min={28}
              max={140}
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
              className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
            />
            <button
              type="button"
              onClick={() => setPixelsPerSecond((z) => Math.min(140, z + 12))}
              aria-label="Zoom in timeline"
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Body: Left Track Headers + Right Scrollable Timecode Lanes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Control Headers */}
        <div className="w-40 sm:w-52 shrink-0 bg-slate-50 dark:bg-[#141720] border-r border-slate-200 dark:border-[#232734] flex flex-col">
          {/* Top corner matching ruler height */}
          <div className="h-7 px-3 border-b border-slate-200 dark:border-[#232734] flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
              {formatTimecode(playheadTime)}
            </span>
            <span>{clips.length} clips</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-[#232734]">
            {sortedTracks.map((track, idx) => (
              <div
                key={track.id}
                className="h-11 px-2.5 flex items-center justify-between gap-1 text-xs bg-white dark:bg-[#141720]"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">
                  {track.name}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReorderTrack(track.id, 'up')}
                    disabled={idx === 0}
                    aria-label={`Move ${track.name} up`}
                    title="Move track up"
                    className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorderTrack(track.id, 'down')}
                    disabled={idx === sortedTracks.length - 1}
                    aria-label={`Move ${track.name} down`}
                    title="Move track down"
                    className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateTrack(track.id, (t) => ({ ...t, locked: !t.locked }))}
                    aria-label={`${track.locked ? 'Unlock' : 'Lock'} ${track.name}`}
                    title={track.locked ? 'Unlock track' : 'Lock track'}
                    className={`p-1 rounded cursor-pointer ${
                      track.locked ? 'text-amber-400' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  {track.type !== 'audio' && (
                    <button
                      type="button"
                      onClick={() => onUpdateTrack(track.id, (t) => ({ ...t, hidden: !t.hidden }))}
                      aria-label={`${track.hidden ? 'Show' : 'Hide'} ${track.name}`}
                      title={track.hidden ? 'Show track' : 'Hide track'}
                      className={`p-1 rounded cursor-pointer ${
                        track.hidden ? 'text-rose-500' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateTrack(track.id, (t) => ({ ...t, muted: !t.muted }))}
                    aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`}
                    title={track.muted ? 'Unmute track' : 'Mute track'}
                    className={`p-1 rounded cursor-pointer ${
                      track.muted ? 'text-rose-500' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateTrack(track.id, (t) => ({ ...t, solo: !t.solo }))}
                    aria-label={`Solo ${track.name}`}
                    title="Solo track"
                    className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                      track.solo
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Multi-Track Canvas Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-100/70 dark:bg-[#0D0F15]"
          onClick={() => onSelectClip(null)}
        >
          <div className="relative" style={{ width: `${totalWidthPx}px` }}>
            {/* Timecode Ruler & Beat Markers */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-7 border-b border-slate-200 dark:border-[#232734] bg-slate-50 dark:bg-[#141720] relative cursor-pointer"
            >
              {Array.from({ length: Math.ceil(timelineDuration + 4) }).map((_, sec) => (
                <div
                  key={sec}
                  className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-[#262B3A] pl-1 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 flex items-center"
                  style={{ left: `${sec * pixelsPerSecond}px` }}
                >
                  {formatTimecode(sec).slice(0, 5)}
                </div>
              ))}
              {/* Beat Sync Markers */}
              {beatMarkers.map((bm, i) => (
                <div
                  key={i}
                  title={`Beat marker ${bm}s`}
                  className="absolute bottom-0 w-1 h-2 bg-cyan-400/70 rounded-t"
                  style={{ left: `${bm * pixelsPerSecond}px` }}
                />
              ))}
            </div>

            {/* Track Lanes */}
            <div className="divide-y divide-slate-200 dark:divide-[#1D212E]">
              {sortedTracks.map((track) => {
                const trackClips = clips
                  .filter((c) => c.trackId === track.id)
                  .sort((a, b) => a.startTime - b.startTime);

                return (
                  <div
                    key={track.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (track.locked) return;
                      const assetId = e.dataTransfer.getData('application/kineforge-asset-id');
                      if (assetId) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const dropSec = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
                        onDropAssetOnTrack(assetId, track.id, Number(dropSec.toFixed(2)));
                      }
                    }}
                    className={`h-11 relative ${
                      track.locked ? 'opacity-60 bg-slate-200/40 dark:bg-slate-900/40' : ''
                    }`}
                  >
                    {trackClips.map((clip, clipIdx) => {
                      const leftPx = clip.startTime * pixelsPerSecond;
                      const widthPx = Math.max(28, clip.duration * pixelsPerSecond);
                      const isSelected = clip.id === selectedClipId;
                      const frameTileCount = Math.max(2, Math.min(10, Math.floor(widthPx / 52)));

                      const colorClasses =
                        clip.type === 'video'
                          ? 'bg-[#0E4F68] border-cyan-400/80 text-white'
                          : clip.type === 'overlay'
                            ? 'bg-indigo-700/90 border-indigo-400/80 text-white'
                            : clip.type === 'text'
                              ? 'bg-[#C2410C] border-orange-400/80 text-white'
                              : 'bg-[#065F46] border-emerald-400/80 text-white';

                      const nextClip = trackClips[clipIdx + 1];
                      const hasAdjacentCut =
                        clip.type === 'video' &&
                        nextClip &&
                        Math.abs(nextClip.startTime - (clip.startTime + clip.duration)) < 0.35;

                      return (
                        <React.Fragment key={clip.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Timeline clip ${clip.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                            }}
                            onMouseDown={(e) => handleClipPointerDown(e, clip, 'move')}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                            }}
                            className={`group absolute top-1 bottom-1 rounded-md border ${colorClasses} ${
                              isSelected
                                ? 'ring-2 ring-white shadow-lg z-10'
                                : 'opacity-92 hover:opacity-100'
                            } flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing`}
                          >
                            {/* CapCut Filmstrip Thumbnail Tiles for Video & Overlay Clips */}
                            {(clip.type === 'video' || clip.type === 'overlay') && (
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 flex opacity-45 pointer-events-none"
                              >
                                {Array.from({ length: frameTileCount }).map((_, fIdx) => (
                                  <div
                                    key={fIdx}
                                    className="flex-1 h-full border-r border-white/15 relative overflow-hidden"
                                    style={{
                                      background: getSceneFilmstripGradient(clip.proceduralScene),
                                    }}
                                  >
                                    <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-cyan-300/30" />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CapCut White Bracket Left Trim Handle */}
                            <div
                              onMouseDown={(e) => handleClipPointerDown(e, clip, 'trim-left')}
                              title="Drag to trim clip start"
                              className={`absolute left-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize z-10 ${
                                isSelected ? 'bg-white text-slate-950' : 'bg-black/30 hover:bg-white/70'
                              }`}
                            >
                              <div className="w-0.5 h-4 bg-current rounded-full" />
                            </div>

                            {/* Clip Label & Waveform Metadata */}
                            <div className="relative z-10 min-w-0 flex-1 pl-1.5 pr-1.5 pointer-events-none">
                              <div className="flex items-center justify-between gap-1 text-[11px] font-semibold truncate drop-shadow-xs">
                                <span className="truncate">{clip.name}</span>
                                <span className="font-mono text-[10px] opacity-85 shrink-0">
                                  {clip.speed !== 1 ? `${clip.speed}x · ` : ''}
                                  {clip.duration.toFixed(1)}s
                                </span>
                              </div>

                              {/* CapCut Mirrored Waveform visualization for audio/video clips */}
                              {clip.waveform && clip.waveform.length > 0 && (
                                <div className="flex items-center gap-0.5 h-3 mt-0.5 opacity-80">
                                  {Array.from({ length: Math.min(24, clip.waveform.length * 2) }).map(
                                    (_, idx) => {
                                      const w = clip.waveform![idx % clip.waveform!.length];
                                      return (
                                        <div
                                          key={idx}
                                          className="flex-1 bg-emerald-200/90 rounded-full"
                                          style={{ height: `${Math.max(22, Math.round(w * 100))}%` }}
                                        />
                                      );
                                    }
                                  )}
                                </div>
                              )}
                            </div>

                            {/* CapCut White Bracket Right Trim Handle */}
                            <div
                              onMouseDown={(e) => handleClipPointerDown(e, clip, 'trim-right')}
                              title="Drag to trim clip duration"
                              className={`absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize z-10 ${
                                isSelected ? 'bg-white text-slate-950' : 'bg-black/30 hover:bg-white/70'
                              }`}
                            >
                              <div className="w-0.5 h-4 bg-current rounded-full" />
                            </div>
                          </div>

                          {/* CapCut Transition Square Button Between Adjacent Video Clips */}
                          {hasAdjacentCut && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectClip(nextClip.id);
                                onCycleClipTransition?.(nextClip.id);
                              }}
                              title={`Transition: ${nextClip.transition.inType} (Click to cycle transition)`}
                              style={{
                                left: `${(clip.startTime + clip.duration) * pixelsPerSecond - 10}px`,
                              }}
                              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-white dark:bg-[#1E2230] border border-cyan-400 text-cyan-500 dark:text-cyan-300 flex items-center justify-center shadow-md z-20 hover:scale-110 transition-transform cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Active Alignment Snap Guide Line */}
            {activeSnapGuide !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none z-20"
                style={{ left: `${activeSnapGuide * pixelsPerSecond}px` }}
              />
            )}

            {/* CapCut Signature White Playhead Scrubber with Pentagon Head */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,229,255,0.9)] pointer-events-none z-30"
              style={{ left: `${playheadTime * pixelsPerSecond}px` }}
            >
              <div className="w-3.5 h-3.5 -ml-1.5 bg-white border border-cyan-400 rotate-45 -mt-1 rounded-xs shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
