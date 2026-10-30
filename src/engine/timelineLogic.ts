import {
  ClipAudioSettings,
  ClipTransform,
  ClipTransition,
  ColorAdjustments,
  ExportResolution,
  TimelineClip,
  VideoEffects,
} from '../types/editor';

export function createDefaultTransform(): ClipTransform {
  return {
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    opacity: 100,
    pipPreset: 'none',
  };
}

export function createDefaultColor(): ColorAdjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    exposure: 0,
    hue: 0,
    sharpen: 0,
  };
}

export function createDefaultEffects(): VideoEffects {
  return {
    blur: 0,
    glow: 0,
    shadow: 0,
    vignette: 0,
    filmGrain: 0,
    glitch: 0,
    motionBlur: 0,
    shake: 0,
    fadeIn: 0,
    fadeOut: 0,
    chromaKeyEnabled: false,
  };
}

export function createDefaultTransition(): ClipTransition {
  return {
    inType: 'none',
    inDuration: 0.5,
    outType: 'none',
    outDuration: 0.5,
  };
}

export function createDefaultAudio(): ClipAudioSettings {
  return {
    volume: 100,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    noiseReduction: false,
    voiceEnhance: false,
    ducking: false,
    eq: { low: 0, mid: 0, high: 0 },
  };
}

/**
 * Formats seconds into SMPTE / NLE tabular timecode (MM:SS.FF)
 */
export function formatTimecode(seconds: number, fps: number = 30): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMinutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const frames = Math.floor((clamped - Math.floor(clamped)) * fps);
  const mm = String(totalMinutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const ff = String(Math.min(fps - 1, frames)).padStart(2, '0');
  return `${mm}:${ss}:${ff}`;
}

/**
 * Computes the total project timeline duration based on clips (minimum 10 seconds for canvas ruler)
 */
export function calculateTimelineDuration(clips: TimelineClip[]): number {
  if (!clips.length) return 15;
  let maxEnd = 0;
  for (const clip of clips) {
    const end = clip.startTime + clip.duration;
    if (end > maxEnd) maxEnd = end;
  }
  return Math.max(10, Number(maxEnd.toFixed(2)));
}

/** Adds a playhead marker unless an existing marker is already nearby. */
export function addTimelineMarker(
  markers: number[],
  time: number,
  minimumDistance: number = 0.05
): number[] {
  const safeTime = Math.max(0, Number.isFinite(time) ? Number(time.toFixed(3)) : 0);
  if (markers.some((marker) => Math.abs(marker - safeTime) < minimumDistance)) {
    return [...markers].sort((a, b) => a - b);
  }
  return [...markers, safeTime].sort((a, b) => a - b);
}

/** Removes the marker nearest to the playhead, preserving all other markers. */
export function removeNearestTimelineMarker(markers: number[], time: number): number[] {
  if (markers.length === 0) return [];
  const nearestIndex = markers.reduce(
    (bestIndex, marker, index, allMarkers) =>
      Math.abs(marker - time) < Math.abs(allMarkers[bestIndex] - time) ? index : bestIndex,
    0
  );
  return markers.filter((_, index) => index !== nearestIndex);
}

/** Finds the next marker after the playhead, wrapping to the first marker. */
export function findNextTimelineMarker(markers: number[], time: number): number | null {
  if (markers.length === 0) return null;
  const sortedMarkers = [...markers].sort((a, b) => a - b);
  return sortedMarkers.find((marker) => marker > time + 0.05) ?? sortedMarkers[0];
}

/**
 * Splits a target clip at the specified playhead time into two contiguous clips.
 * If splitTime is outside the clip's interior (within 0.15s margin of edges), returns original clips unchanged.
 */
export function splitClipAtTime(
  clips: TimelineClip[],
  clipId: string,
  splitTime: number,
  idGenerator: () => string = () => `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const minSegment = 0.15;
  const clipEnd = target.startTime + target.duration;
  if (splitTime <= target.startTime + minSegment || splitTime >= clipEnd - minSegment) {
    return clips;
  }

  const firstDuration = Number((splitTime - target.startTime).toFixed(3));
  const secondDuration = Number((clipEnd - splitTime).toFixed(3));
  const secondSourceOffset = Number((target.sourceOffset + firstDuration * target.speed).toFixed(3));

  const firstClip: TimelineClip = {
    ...target,
    duration: firstDuration,
    transition: {
      ...target.transition,
      outType: 'none',
    },
  };

  const secondClip: TimelineClip = {
    ... structuredCloneClip(target),
    id: idGenerator(),
    name: `${target.name} (Part 2)`,
    startTime: Number(splitTime.toFixed(3)),
    duration: secondDuration,
    sourceOffset: secondSourceOffset,
    transition: {
      ...target.transition,
      inType: 'none',
    },
  };

  const result: TimelineClip[] = [];
  for (const c of clips) {
    if (c.id === clipId) {
      result.push(firstClip, secondClip);
    } else {
      result.push(c);
    }
  }
  return result;
}

export function structuredCloneClip(clip: TimelineClip): TimelineClip {
  return JSON.parse(JSON.stringify(clip));
}

/**
 * Trims a clip's start time and/or duration safely with minimum duration enforcement (0.2s).
 */
export function trimClipBounds(
  clip: TimelineClip,
  newStartTime: number,
  newDuration: number
): TimelineClip {
  const safeStart = Math.max(0, Number(newStartTime.toFixed(3)));
  const safeDuration = Math.max(0.2, Number(newDuration.toFixed(3)));
  const deltaStart = safeStart - clip.startTime;
  const newSourceOffset = Math.max(0, Number((clip.sourceOffset + deltaStart * clip.speed).toFixed(3)));

  return {
    ...clip,
    startTime: safeStart,
    duration: safeDuration,
    sourceOffset: newSourceOffset,
  };
}

/**
 * Merges two clips on the same track into one continuous clip spanning both durations.
 */
export function mergeAdjacentClips(
  clips: TimelineClip[],
  clipAId: string,
  clipBId: string
): TimelineClip[] {
  const clipA = clips.find((c) => c.id === clipAId);
  const clipB = clips.find((c) => c.id === clipBId);
  if (!clipA || !clipB || clipA.id === clipB.id || clipA.trackId !== clipB.trackId) {
    return clips;
  }

  const [first, second] =
    clipA.startTime <= clipB.startTime ? [clipA, clipB] : [clipB, clipA];

  const mergedDuration = Number((first.duration + second.duration).toFixed(3));
  const merged: TimelineClip = {
    ...first,
    name: first.name.replace(/\s*\(Part \d+\)$/, ''),
    duration: mergedDuration,
    transition: {
      ...first.transition,
      outType: second.transition.outType,
      outDuration: second.transition.outDuration,
    },
  };

  return clips
    .filter((c) => c.id !== second.id)
    .map((c) => (c.id === first.id ? merged : c));
}

/**
 * Duplicates a clip right after its end on the same track.
 */
export function duplicateClipInTrack(
  clips: TimelineClip[],
  clipId: string,
  idGenerator: () => string = () => `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const copy: TimelineClip = {
    ...structuredCloneClip(target),
    id: idGenerator(),
    name: `${target.name} Copy`,
    startTime: Number((target.startTime + target.duration).toFixed(3)),
  };

  return [...clips, copy];
}

/** Assigns a shared group id to multiple clips without changing their timing or track. */
export function groupClips(
  clips: TimelineClip[],
  clipIds: string[],
  groupIdGenerator: () => string = () => `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
): TimelineClip[] {
  const ids = new Set(clipIds);
  if (ids.size < 2 || clips.filter((clip) => ids.has(clip.id)).length < 2) return clips;
  const groupId = groupIdGenerator();
  return clips.map((clip) => (ids.has(clip.id) ? { ...clip, groupId } : clip));
}

/** Removes grouping from the selected clips and any other clips in their selected groups. */
export function ungroupClips(clips: TimelineClip[], clipIds: string[]): TimelineClip[] {
  const selectedIds = new Set(clipIds);
  const groupIds = new Set(
    clips.filter((clip) => selectedIds.has(clip.id) && clip.groupId).map((clip) => clip.groupId as string)
  );
  if (groupIds.size === 0) return clips;
  return clips.map((clip) => (clip.groupId && groupIds.has(clip.groupId) ? { ...clip, groupId: undefined } : clip));
}

/**
 * Applies Magnetic Timeline ripple on a specific track so clips pack left-to-right with zero gaps.
 */
export function applyMagneticRipple(clips: TimelineClip[], trackId: string): TimelineClip[] {
  const trackClips = clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.startTime - b.startTime);

  let cursor = 0;
  const updatedById = new Map<string, TimelineClip>();
  for (const clip of trackClips) {
    updatedById.set(clip.id, {
      ...clip,
      startTime: Number(cursor.toFixed(3)),
    });
    cursor += clip.duration;
  }

  return clips.map((c) => updatedById.get(c.id) ?? c);
}

/**
 * Calculates snapping to playhead, clip boundaries, or beat markers within a threshold.
 */
export function calculateSnapTime(
  targetTime: number,
  snapPoints: number[],
  thresholdSeconds: number = 0.2
): { time: number; snapped: boolean; snapPoint: number | null } {
  const clampedTarget = Math.max(0, targetTime);
  let closestPoint: number | null = null;
  let minDistance = thresholdSeconds;

  for (const pt of snapPoints) {
    const dist = Math.abs(clampedTarget - pt);
    if (dist <= minDistance) {
      minDistance = dist;
      closestPoint = pt;
    }
  }

  if (closestPoint !== null) {
    return {
      time: Number(closestPoint.toFixed(3)),
      snapped: true,
      snapPoint: closestPoint,
    };
  }

  return {
    time: Number(clampedTarget.toFixed(3)),
    snapped: false,
    snapPoint: null,
  };
}

/**
 * Calculates entry and exit transition progress (0..1) for a clip at playheadTime.
 */
export function computeTransitionProgress(
  clip: TimelineClip,
  playheadTime: number
): { inProgress: number | null; outProgress: number | null } {
  const localTime = playheadTime - clip.startTime;
  if (localTime < 0 || localTime > clip.duration) {
    return { inProgress: null, outProgress: null };
  }

  let inProgress: number | null = null;
  if (clip.transition.inType !== 'none' && clip.transition.inDuration > 0) {
    if (localTime <= clip.transition.inDuration) {
      inProgress = Math.max(0, Math.min(1, localTime / clip.transition.inDuration));
    }
  }

  let outProgress: number | null = null;
  const remaining = clip.duration - localTime;
  if (clip.transition.outType !== 'none' && clip.transition.outDuration > 0) {
    if (remaining <= clip.transition.outDuration) {
      outProgress = Math.max(0, Math.min(1, 1 - remaining / clip.transition.outDuration));
    }
  }

  return { inProgress, outProgress };
}

/**
 * Computes audio ducking multiplier (e.g. 0.28 when a dialogue/voiceover clip is active simultaneously).
 */
export function computeDuckingGain(
  playheadTime: number,
  allClips: TimelineClip[],
  currentClip: TimelineClip
): number {
  if (!currentClip.audio.ducking) return 1;

  const hasActiveVoiceOrVideoDialogue = allClips.some(
    (other) =>
      other.id !== currentClip.id &&
      !other.audio.muted &&
      other.audio.volume > 0 &&
      (other.audioSynthPreset === 'voiceover_demo' ||
        other.name.toLowerCase().includes('voice') ||
        other.name.toLowerCase().includes('interview') ||
        other.name.toLowerCase().includes('dialogue')) &&
      playheadTime >= other.startTime &&
      playheadTime <= other.startTime + other.duration
  );

  return hasActiveVoiceOrVideoDialogue ? 0.25 : 1;
}

/**
 * Generates beat marker timestamps (in seconds) for a given BPM and total duration.
 */
export function detectBeatMarkers(bpm: number, durationSec: number, offsetSec: number = 0): number[] {
  if (bpm <= 0 || durationSec <= 0) return [];
  const interval = 60 / bpm;
  const markers: number[] = [];
  for (let t = Math.max(0, offsetSec); t <= durationSec; t += interval) {
    markers.push(Number(t.toFixed(3)));
  }
  return markers;
}

/**
 * Estimates exported video file size in Megabytes based on duration, resolution, FPS, video & audio bitrates.
 */
export function estimateExportFileSizeMB(
  durationSec: number,
  resolution: ExportResolution,
  fps: number,
  bitrateMbps: number,
  audioKbps: number
): number {
  if (durationSec <= 0) return 0;
  const resMultiplier: Record<ExportResolution, number> = {
    '480p': 0.45,
    '720p': 0.75,
    '1080p': 1.0,
    '4K': 2.4,
  };
  const fpsFactor = fps >= 50 ? 1.25 : 1.0;
  const effectiveVideoMbps = bitrateMbps * resMultiplier[resolution] * fpsFactor;
  const totalMegabits = (effectiveVideoMbps + audioKbps / 1000) * durationSec;
  const megabytes = totalMegabits / 8;
  return Number(Math.max(0.1, megabytes).toFixed(2));
}

export interface HistoryStack<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistoryStack<T>(initial: T): HistoryStack<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushHistoryState<T>(stack: HistoryStack<T>, next: T, maxDepth = 40): HistoryStack<T> {
  const newPast = [...stack.past, stack.present].slice(-maxDepth);
  return {
    past: newPast,
    present: next,
    future: [],
  };
}

export function undoHistoryState<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1];
  const newPast = stack.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [stack.present, ...stack.future],
  };
}

export function redoHistoryState<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0];
  const newFuture = stack.future.slice(1);
  return {
    past: [...stack.past, stack.present],
    present: next,
    future: newFuture,
  };
}
