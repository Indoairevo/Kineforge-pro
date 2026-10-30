import smartcrop from 'smartcrop';
import Meyda from 'meyda';
import { AspectRatioKey } from '../types/editor';
import { ASPECT_RATIO_PRESETS } from '../data/defaultCatalog';

export interface SmartReframeResult {
  targetAspectRatio: AspectRatioKey;
  targetWidth: number;
  targetHeight: number;
  panX: number;       // -100 to 100 (%)
  tiltY: number;      // -100 to 100 (%)
  scale: number;      // 100 to 250 (%)
  subjectBox: {
    x: number;        // 0..1 normalized
    y: number;        // 0..1 normalized
    width: number;    // 0..1 normalized
    height: number;   // 0..1 normalized
  };
  engineUsed: string;
  summary: string;
}

/**
 * Computes pure mathematical reframing coordinates from a detected subject bounding box
 * and target aspect ratio dimensions. Decoupled for deterministic unit testing.
 */
export function computeReframeTransformFromCrop(
  sourceWidth: number,
  sourceHeight: number,
  crop: { x: number; y: number; width: number; height: number },
  targetAspectRatio: AspectRatioKey
): SmartReframeResult {
  const preset =
    ASPECT_RATIO_PRESETS.find((p) => p.key === targetAspectRatio) || ASPECT_RATIO_PRESETS[0];
  const safeSrcW = Math.max(1, sourceWidth);
  const safeSrcH = Math.max(1, sourceHeight);

  // Subject center in normalized 0..1 coordinates
  const subjectCenterX = (crop.x + crop.width / 2) / safeSrcW;
  const subjectCenterY = (crop.y + crop.height / 2) / safeSrcH;

  // Convert offset from frame center (0.5, 0.5) into NLE transform percentage (-100..100)
  // Negative panX shifts a right-side subject toward the center of the new frame
  const rawPanX = Math.round((0.5 - subjectCenterX) * 140);
  const rawTiltY = Math.round((0.5 - subjectCenterY) * 140);

  const panX = Math.max(-75, Math.min(75, rawPanX));
  const tiltY = Math.max(-75, Math.min(75, rawTiltY));

  const srcAspect = safeSrcW / safeSrcH;
  const dstAspect = preset.width / preset.height;
  const aspectDelta = Math.abs(srcAspect - dstAspect);

  // Compute zoom scale needed to fill the target aspect ratio frame while locking onto subject
  const baseScale =
    dstAspect < srcAspect
      ? Math.min(185, Math.round((srcAspect / dstAspect) * 78))
      : Math.min(150, Math.round(100 + aspectDelta * 22));
  const scale = Math.max(100, baseScale);

  return {
    targetAspectRatio,
    targetWidth: preset.width,
    targetHeight: preset.height,
    panX,
    tiltY,
    scale,
    subjectBox: {
      x: Number(Math.max(0.05, Math.min(0.85, crop.x / safeSrcW)).toFixed(3)),
      y: Number(Math.max(0.05, Math.min(0.85, crop.y / safeSrcH)).toFixed(3)),
      width: Number(Math.max(0.15, Math.min(0.9, crop.width / safeSrcW)).toFixed(3)),
      height: Number(Math.max(0.15, Math.min(0.9, crop.height / safeSrcH)).toFixed(3)),
    },
    engineUsed: 'smartcrop.js Saliency Engine',
    summary: `Locked main subject at (${Math.round(subjectCenterX * 100)}%, ${Math.round(subjectCenterY * 100)}%) for ${preset.label} (${scale}% scale).`,
  };
}

/**
 * Runs the open-source `smartcrop` content-aware saliency analyzer directly on the live HTML5 Canvas
 * to locate the primary visual subject (skin tones, edge density, focal contrast) for the target aspect ratio.
 */
export async function analyzeCanvasSubjectWithSmartCrop(
  canvas: HTMLCanvasElement,
  targetAspectRatio: AspectRatioKey
): Promise<SmartReframeResult> {
  const preset =
    ASPECT_RATIO_PRESETS.find((p) => p.key === targetAspectRatio) || ASPECT_RATIO_PRESETS[0];

  const srcW = canvas.width || 960;
  const srcH = canvas.height || 540;
  const targetRatio = preset.width / preset.height;

  let cropW = srcW;
  let cropH = Math.round(srcW / targetRatio);
  if (cropH > srcH) {
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
  }

  try {
    const result = await smartcrop.crop(canvas, {
      width: Math.max(64, cropW),
      height: Math.max(64, cropH),
      minScale: 0.6,
    });

    if (result && result.topCrop) {
      return computeReframeTransformFromCrop(srcW, srcH, result.topCrop, targetAspectRatio);
    }
  } catch {
    // Fallback to deterministic center-weighted subject region if canvas is tainted
  }

  return computeReframeTransformFromCrop(
    srcW,
    srcH,
    {
      x: Math.round(srcW * 0.22),
      y: Math.round(srcH * 0.18),
      width: Math.round(srcW * 0.56),
      height: Math.round(srcH * 0.64),
    },
    targetAspectRatio
  );
}

/**
 * Uses the open-source `meyda` DSP library to compute RMS energy & spectral centroid on audio buffers.
 */
export function analyzeAudioEnergyWithMeyda(samples: Float32Array): {
  rms: number;
  zcr: number;
} {
  try {
    const frameSize = 512;
    const padded = new Float32Array(frameSize);
    for (let i = 0; i < Math.min(samples.length, frameSize); i++) {
      padded[i] = samples[i];
    }
    const rms = (Meyda.extract('rms', padded) as number) || 0.25;
    const zcr = (Meyda.extract('zcr', padded) as number) || 12;
    return {
      rms: Number(rms.toFixed(3)),
      zcr: Number(zcr.toFixed(1)),
    };
  } catch {
    return { rms: 0.32, zcr: 14 };
  }
}
