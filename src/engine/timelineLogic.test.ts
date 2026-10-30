import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMagneticRipple,
  calculateSnapTime,
  calculateTimelineDuration,
  computeDuckingGain,
  computeTransitionProgress,
  createDefaultAudio,
  createDefaultColor,
  createDefaultEffects,
  createDefaultTransform,
  createDefaultTransition,
  createHistoryStack,
  detectBeatMarkers,
  duplicateClipInTrack,
  estimateExportFileSizeMB,
  formatTimecode,
  mergeAdjacentClips,
  pushHistoryState,
  redoHistoryState,
  splitClipAtTime,
  trimClipBounds,
  undoHistoryState,
} from './timelineLogic';
import { TimelineClip } from '../types/editor';
import { OPEN_SOURCE_LUT_PRESETS } from './openSourceMediaPipeline';
import { OPEN_SOURCE_TEMPLATE_LIBRARY } from '../openSource/templateCatalog';
import { computeReframeTransformFromCrop } from '../openSource/smartReframeEngine';

function makeMockClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-v1',
    name: 'Tokyo Night Drive',
    type: 'video',
    startTime: 0,
    duration: 6,
    sourceOffset: 0,
    speed: 1,
    reversed: false,
    freezeFrame: false,
    transform: createDefaultTransform(),
    color: createDefaultColor(),
    effects: createDefaultEffects(),
    transition: createDefaultTransition(),
    audio: createDefaultAudio(),
    ...overrides,
  };
}

test('formatTimecode renders tabular MM:SS:FF accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00');
  assert.equal(formatTimecode(65.5, 30), '01:05:15');
  assert.equal(formatTimecode(-4, 24), '00:00:00');
});

test('splitClipAtTime splits a clip into two contiguous parts at playhead', () => {
  const initial = [makeMockClip({ id: 'c1', startTime: 2, duration: 8, sourceOffset: 1 })];
  const afterSplit = splitClipAtTime(initial, 'c1', 5, () => 'c1-part2');

  assert.equal(afterSplit.length, 2);
  assert.equal(afterSplit[0].id, 'c1');
  assert.equal(afterSplit[0].startTime, 2);
  assert.equal(afterSplit[0].duration, 3);

  assert.equal(afterSplit[1].id, 'c1-part2');
  assert.equal(afterSplit[1].startTime, 5);
  assert.equal(afterSplit[1].duration, 5);
  assert.equal(afterSplit[1].sourceOffset, 4);
});

test('splitClipAtTime ignores splits outside clip bounds', () => {
  const initial = [makeMockClip({ id: 'c1', startTime: 2, duration: 6 })];
  const unchanged = splitClipAtTime(initial, 'c1', 1.0);
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].duration, 6);
});

test('trimClipBounds enforces minimum duration and updates sourceOffset', () => {
  const clip = makeMockClip({ startTime: 2, duration: 5, sourceOffset: 0.5, speed: 1 });
  const trimmed = trimClipBounds(clip, 3, 4);
  assert.equal(trimmed.startTime, 3);
  assert.equal(trimmed.duration, 4);
  assert.equal(trimmed.sourceOffset, 1.5);

  const tinyTrim = trimClipBounds(clip, 2, 0.01);
  assert.equal(tinyTrim.duration, 0.2);
});

test('mergeAdjacentClips combines two clips on the same track', () => {
  const c1 = makeMockClip({ id: 'c1', startTime: 0, duration: 3, name: 'Scene (Part 1)' });
  const c2 = makeMockClip({ id: 'c2', startTime: 3, duration: 4.5, name: 'Scene (Part 2)' });
  const merged = mergeAdjacentClips([c1, c2], 'c1', 'c2');

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'c1');
  assert.equal(merged[0].duration, 7.5);
  assert.equal(merged[0].name, 'Scene');
});

test('duplicateClipInTrack appends a copy immediately after the clip', () => {
  const c1 = makeMockClip({ id: 'c1', startTime: 1.5, duration: 4 });
  const result = duplicateClipInTrack([c1], 'c1', () => 'c1-copy');
  assert.equal(result.length, 2);
  assert.equal(result[1].id, 'c1-copy');
  assert.equal(result[1].startTime, 5.5);
  assert.equal(result[1].duration, 4);
});

test('applyMagneticRipple closes gaps between clips on target track', () => {
  const c1 = makeMockClip({ id: 'c1', trackId: 'v1', startTime: 2, duration: 3 });
  const c2 = makeMockClip({ id: 'c2', trackId: 'v1', startTime: 8, duration: 4 });
  const rippled = applyMagneticRipple([c1, c2], 'v1');
  assert.equal(rippled[0].startTime, 0);
  assert.equal(rippled[1].startTime, 3);
  assert.equal(calculateTimelineDuration(rippled), 10);
});

test('calculateSnapTime snaps within threshold and leaves distant times untouched', () => {
  const snapPoints = [0, 3.5, 7.0, 10.5];
  const hit = calculateSnapTime(3.62, snapPoints, 0.2);
  assert.equal(hit.snapped, true);
  assert.equal(hit.time, 3.5);

  const miss = calculateSnapTime(5.1, snapPoints, 0.2);
  assert.equal(miss.snapped, false);
  assert.equal(miss.time, 5.1);
});

test('computeTransitionProgress returns accurate normalized progress', () => {
  const clip = makeMockClip({
    startTime: 0,
    duration: 10,
    transition: { inType: 'fade', inDuration: 2, outType: 'zoom', outDuration: 2 },
  });
  const atStart = computeTransitionProgress(clip, 1);
  assert.equal(atStart.inProgress, 0.5);
  assert.equal(atStart.outProgress, null);

  const atEnd = computeTransitionProgress(clip, 9);
  assert.equal(atEnd.inProgress, null);
  assert.equal(atEnd.outProgress, 0.5);
});

test('computeDuckingGain ducks background music when dialogue clip is active', () => {
  const dialogue = makeMockClip({
    id: 'voice-1',
    trackId: 'a1',
    name: 'Studio Director Interview',
    startTime: 2,
    duration: 4,
  });
  const music = makeMockClip({
    id: 'music-1',
    trackId: 'a2',
    name: 'Cyber Synth Soundtrack',
    startTime: 0,
    duration: 12,
    audio: { ...createDefaultAudio(), ducking: true },
  });

  assert.equal(computeDuckingGain(3.0, [dialogue, music], music), 0.25);
  assert.equal(computeDuckingGain(8.0, [dialogue, music], music), 1);
});

test('detectBeatMarkers and estimateExportFileSizeMB compute valid metrics', () => {
  const beats = detectBeatMarkers(120, 3, 0);
  assert.deepEqual(beats, [0, 0.5, 1, 1.5, 2, 2.5, 3]);

  const size1080 = estimateExportFileSizeMB(16, '1080p', 30, 12, 192);
  const size4k = estimateExportFileSizeMB(16, '4K', 60, 12, 192);
  assert.ok(size1080 > 20);
  assert.ok(size4k > size1080);
});

test('history stack supports undo and redo cleanly', () => {
  let stack = createHistoryStack<number>(1);
  stack = pushHistoryState(stack, 2);
  stack = pushHistoryState(stack, 3);
  assert.equal(stack.present, 3);

  stack = undoHistoryState(stack);
  assert.equal(stack.present, 2);

  stack = redoHistoryState(stack);
  assert.equal(stack.present, 3);
});

test('OPEN_SOURCE_LUT_PRESETS provides valid film emulation matrices', () => {
  assert.ok(OPEN_SOURCE_LUT_PRESETS.length >= 5);
  for (const lut of OPEN_SOURCE_LUT_PRESETS) {
    assert.ok(lut.name.length > 0);
    assert.ok(lut.sourceProject.length > 0);
    assert.equal(typeof lut.color.contrast, 'number');
  }
});

test('OPEN_SOURCE_TEMPLATE_LIBRARY covers intros, outros, animated-titles, lower-thirds, and social-media', () => {
  const categories = new Set(OPEN_SOURCE_TEMPLATE_LIBRARY.map((t) => t.category));
  assert.ok(categories.has('intros'));
  assert.ok(categories.has('outros'));
  assert.ok(categories.has('animated-titles'));
  assert.ok(categories.has('lower-thirds'));
  assert.ok(categories.has('social-media'));
  assert.ok(OPEN_SOURCE_TEMPLATE_LIBRARY.length >= 10);
});

test('computeReframeTransformFromCrop computes subject-centered pan and zoom for target aspect ratio', () => {
  const res916 = computeReframeTransformFromCrop(
    1920,
    1080,
    { x: 650, y: 0, width: 608, height: 1080 },
    '9:16'
  );
  assert.ok(res916.scale >= 120);
  assert.equal(typeof res916.panX, 'number');
  assert.equal(typeof res916.tiltY, 'number');
  assert.ok(res916.engineUsed.includes('smartcrop.js'));
});


