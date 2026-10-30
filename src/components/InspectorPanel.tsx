import React, { useState } from 'react';
import {
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Sliders,
  Sun,
  Type as TypeIcon,
  Volume2,
  Move,
  Sparkles,
} from 'lucide-react';
import {
  ClipAudioSettings,
  ClipTransform,
  ClipTransition,
  ColorAdjustments,
  TextAnimationType,
  TextStyleConfig,
  TimelineClip,
  TransitionType,
  VideoEffects,
} from '../types/editor';
import {
  createDefaultAudio,
  createDefaultColor,
  createDefaultEffects,
  createDefaultTransform,
} from '../engine/timelineLogic';

interface InspectorPanelProps {
  selectedClip: TimelineClip | null;
  onResetSelected: () => void;
  onUpdateClip: (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => void;
}

type InspectorTab = 'transform' | 'color' | 'effects' | 'text' | 'audio';

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedClip,
  onResetSelected,
  onUpdateClip,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('transform');

  if (!selectedClip) {
    return (
      <aside
        aria-label="Clip Properties Inspector"
        className="w-full md:w-76 lg:w-80 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-center items-center text-center select-none"
      >
        <Sliders className="w-8 h-8 text-slate-400 mb-2" />
        <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          No Timeline Clip Selected
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Click any video, overlay, title, or audio clip on the timeline to inspect and adjust its transform, color grade, effects, typography, or audio EQ.
        </p>
      </aside>
    );
  }

  const updateTransform = (patch: Partial<ClipTransform>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      transform: { ...c.transform, ...patch },
    }));
  };

  const updateColor = (patch: Partial<ColorAdjustments>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      color: { ...c.color, ...patch },
    }));
  };

  const updateEffects = (patch: Partial<VideoEffects>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      effects: { ...c.effects, ...patch },
    }));
  };

  const updateTransition = (patch: Partial<ClipTransition>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      transition: { ...c.transition, ...patch },
    }));
  };

  const updateAudio = (patch: Partial<ClipAudioSettings>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      audio: { ...c.audio, ...patch },
    }));
  };

  const updateTextStyle = (patch: Partial<TextStyleConfig>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      textStyle: c.textStyle
        ? { ...c.textStyle, ...patch }
        : {
            text: c.name,
            fontFamily: 'Plus Jakarta Sans',
            fontSize: 42,
            color: '#FFFFFF',
            bold: true,
            italic: false,
            align: 'center',
            letterSpacing: 1,
            lineHeight: 1.2,
            outlineColor: '#000000',
            outlineWidth: 0,
            shadowColor: '#000000',
            shadowBlur: 10,
            bgColor: '#0F172A',
            bgOpacity: 60,
            entranceAnim: 'fade-up',
            exitAnim: 'fade-up',
            ...patch,
          },
    }));
  };

  const applyPipPreset = (preset: ClipTransform['pipPreset']) => {
    if (preset === 'top-right') {
      updateTransform({ x: 30, y: -26, scale: 35, pipPreset: preset });
    } else if (preset === 'bottom-right') {
      updateTransform({ x: 30, y: 26, scale: 35, pipPreset: preset });
    } else if (preset === 'bottom-left') {
      updateTransform({ x: -30, y: 26, scale: 35, pipPreset: preset });
    } else if (preset === 'top-left') {
      updateTransform({ x: -30, y: -26, scale: 35, pipPreset: preset });
    } else if (preset === 'split-left') {
      updateTransform({ x: -25, y: 0, scale: 80, cropRight: 30, pipPreset: preset });
    } else if (preset === 'split-right') {
      updateTransform({ x: 25, y: 0, scale: 80, cropLeft: 30, pipPreset: preset });
    } else {
      updateTransform({ ...createDefaultTransform(), pipPreset: 'none' });
    }
  };

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'transform', label: 'Transform', icon: <Move className="w-3.5 h-3.5" /> },
    { id: 'color', label: 'Color', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'effects', label: 'Effects', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text', icon: <TypeIcon className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside
      aria-label="Clip Properties Inspector"
      className="w-full md:w-76 lg:w-80 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col select-none overflow-hidden"
    >
      {/* Selected Clip Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {selectedClip.name}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {selectedClip.type.toUpperCase()} · Start {selectedClip.startTime.toFixed(2)}s · Dur {selectedClip.duration.toFixed(2)}s
          </p>
        </div>
        <button
          type="button"
          onClick={onResetSelected}
          title="Reset selected clip adjustments"
          aria-label="Reset selected clip adjustments"
          className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-sky-500 hover:border-sky-500 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inspector Sub-Navigation Tabs */}
      <div className="grid grid-cols-5 gap-0.5 p-1 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Inspector Scrollable Controls */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* 1. TRANSFORM, CROP, PIP & SPEED TAB */}
        {activeTab === 'transform' && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Position, Scale & Rotate</span>
              <button
                type="button"
                onClick={() => updateTransform(createDefaultTransform())}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-500 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <SliderRow
                label="Scale (%)"
                value={selectedClip.transform.scale}
                min={10}
                max={250}
                onChange={(v) => updateTransform({ scale: v })}
              />
              <SliderRow
                label="Opacity (%)"
                value={selectedClip.transform.opacity}
                min={0}
                max={100}
                onChange={(v) => updateTransform({ opacity: v })}
              />
              <SliderRow
                label="Position X"
                value={selectedClip.transform.x}
                min={-100}
                max={100}
                onChange={(v) => updateTransform({ x: v })}
              />
              <SliderRow
                label="Position Y"
                value={selectedClip.transform.y}
                min={-100}
                max={100}
                onChange={(v) => updateTransform({ y: v })}
              />
              <SliderRow
                label="Rotation (°)"
                value={selectedClip.transform.rotation}
                min={-180}
                max={180}
                onChange={(v) => updateTransform({ rotation: v })}
              />
            </div>

            {/* Flip & Rotate 90° Quick Buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => updateTransform({ flipH: !selectedClip.transform.flipH })}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                  selectedClip.transform.flipH
                    ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>Flip H</span>
              </button>
              <button
                type="button"
                onClick={() => updateTransform({ flipV: !selectedClip.transform.flipV })}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                  selectedClip.transform.flipV
                    ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                <span>Flip V</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  updateTransform({
                    rotation: ((selectedClip.transform.rotation + 90 + 180) % 360) - 180,
                  })
                }
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer"
              >
                <span>Rotate 90°</span>
              </button>
            </div>

            {/* Picture-in-Picture Layout Presets */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Picture-in-Picture (PiP) Layout
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'none', label: 'Full Canvas' },
                    { id: 'top-right', label: 'PiP Top-R' },
                    { id: 'bottom-right', label: 'PiP Bot-R' },
                    { id: 'top-left', label: 'PiP Top-L' },
                    { id: 'split-left', label: 'Split Left' },
                    { id: 'split-right', label: 'Split Right' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPipPreset(p.id)}
                    className={`py-1 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                      selectedClip.transform.pipPreset === p.id
                        ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Crop Margins */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">Crop Edges (%)</span>
              <div className="grid grid-cols-2 gap-2">
                <SliderRow
                  label="Crop Top"
                  value={selectedClip.transform.cropTop}
                  min={0}
                  max={45}
                  onChange={(v) => updateTransform({ cropTop: v })}
                />
                <SliderRow
                  label="Crop Bottom"
                  value={selectedClip.transform.cropBottom}
                  min={0}
                  max={45}
                  onChange={(v) => updateTransform({ cropBottom: v })}
                />
                <SliderRow
                  label="Crop Left"
                  value={selectedClip.transform.cropLeft}
                  min={0}
                  max={45}
                  onChange={(v) => updateTransform({ cropLeft: v })}
                />
                <SliderRow
                  label="Crop Right"
                  value={selectedClip.transform.cropRight}
                  min={0}
                  max={45}
                  onChange={(v) => updateTransform({ cropRight: v })}
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { label: 'Fit', patch: { scale: 100, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 } },
                    { label: 'Fill', patch: { scale: 118, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 } },
                    { label: 'Crop', patch: { scale: 100, cropTop: 8, cropBottom: 8, cropLeft: 8, cropRight: 8 } },
                    { label: 'Clear', patch: { cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 } },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateTransform(preset.patch)}
                    className="py-1.5 rounded border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-sky-500 hover:text-sky-500 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed, Slow/Fast Motion, Reverse & Freeze Frame */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Speed, Duration & Playback
              </span>
              <SliderRow
                label="Playback Speed (x)"
                value={selectedClip.speed}
                min={0.25}
                max={4}
                step={0.25}
                onChange={(v) =>
                  onUpdateClip(selectedClip.id, (c) => ({ ...c, speed: v }))
                }
              />
              <div className="grid grid-cols-5 gap-1.5">
                {[0.25, 0.5, 1, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => onUpdateClip(selectedClip.id, (c) => ({ ...c, speed }))}
                    className={`py-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                      selectedClip.speed === speed
                        ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <SliderRow
                label="Clip Duration (s)"
                value={Number(selectedClip.duration.toFixed(1))}
                min={0.5}
                max={30}
                step={0.5}
                onChange={(v) =>
                  onUpdateClip(selectedClip.id, (c) => ({ ...c, duration: v }))
                }
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (c) => ({ ...c, reversed: !c.reversed }))
                  }
                  className={`py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                    selectedClip.reversed
                      ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {selectedClip.reversed ? 'Reversed: ON' : 'Reverse Playback'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, (c) => ({
                      ...c,
                      freezeFrame: !c.freezeFrame,
                      freezeTime: c.sourceOffset + c.duration * 0.5,
                    }))
                  }
                  className={`py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                    selectedClip.freezeFrame
                      ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {selectedClip.freezeFrame ? 'Freeze Frame: ON' : 'Freeze Frame'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* 2. COLOR GRADING & ADJUSTMENTS TAB */}
        {activeTab === 'color' && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Color Grading Wheels & Sliders</span>
              <button
                type="button"
                onClick={() => updateColor(createDefaultColor())}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-500 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Grade</span>
              </button>
            </div>
            <div className="space-y-2.5">
              <SliderRow
                label="Brightness"
                value={selectedClip.color.brightness}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ brightness: v })}
              />
              <SliderRow
                label="Contrast"
                value={selectedClip.color.contrast}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ contrast: v })}
              />
              <SliderRow
                label="Saturation"
                value={selectedClip.color.saturation}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ saturation: v })}
              />
              <SliderRow
                label="Temperature (Cool / Warm)"
                value={selectedClip.color.temperature}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ temperature: v })}
              />
              <SliderRow
                label="Tint (Green / Magenta)"
                value={selectedClip.color.tint}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ tint: v })}
              />
              <SliderRow
                label="Exposure"
                value={selectedClip.color.exposure}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ exposure: v })}
              />
              <SliderRow
                label="Highlights"
                value={selectedClip.color.highlights}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ highlights: v })}
              />
              <SliderRow
                label="Shadows"
                value={selectedClip.color.shadows}
                min={-100}
                max={100}
                onChange={(v) => updateColor({ shadows: v })}
              />
              <SliderRow
                label="Hue Shift (°)"
                value={selectedClip.color.hue}
                min={-180}
                max={180}
                onChange={(v) => updateColor({ hue: v })}
              />
              <SliderRow
                label="Sharpening"
                value={selectedClip.color.sharpen}
                min={0}
                max={100}
                onChange={(v) => updateColor({ sharpen: v })}
              />
            </div>
          </>
        )}

        {/* 3. VIDEO EFFECTS & TRANSITIONS TAB */}
        {activeTab === 'effects' && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Effect Intensity</span>
              <button
                type="button"
                onClick={() => updateEffects(createDefaultEffects())}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-500 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Effects</span>
              </button>
            </div>
            <div className="space-y-2.5">
              <SliderRow
                label="Blur"
                value={selectedClip.effects.blur}
                min={0}
                max={50}
                onChange={(v) => updateEffects({ blur: v })}
              />
              <SliderRow
                label="Glow"
                value={selectedClip.effects.glow}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ glow: v })}
              />
              <SliderRow
                label="Drop Shadow"
                value={selectedClip.effects.shadow}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ shadow: v })}
              />
              <SliderRow
                label="Vignette"
                value={selectedClip.effects.vignette}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ vignette: v })}
              />
              <SliderRow
                label="Film Grain"
                value={selectedClip.effects.filmGrain}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ filmGrain: v })}
              />
              <SliderRow
                label="RGB Glitch"
                value={selectedClip.effects.glitch}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ glitch: v })}
              />
              <SliderRow
                label="Motion Blur"
                value={selectedClip.effects.motionBlur}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ motionBlur: v })}
              />
              <SliderRow
                label="Camera Shake"
                value={selectedClip.effects.shake}
                min={0}
                max={100}
                onChange={(v) => updateEffects({ shake: v })}
              />
              <SliderRow
                label="Fade In (s)"
                value={selectedClip.effects.fadeIn}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => updateEffects({ fadeIn: v })}
              />
              <SliderRow
                label="Fade Out (s)"
                value={selectedClip.effects.fadeOut}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => updateEffects({ fadeOut: v })}
              />
            </div>

            {/* Transitions Configuration */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Entry & Exit Transitions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">In Transition</label>
                  <select
                    aria-label="In Transition Type"
                    value={selectedClip.transition.inType}
                    onChange={(e) => updateTransition({ inType: e.target.value as TransitionType })}
                    className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    {(['none', 'fade', 'dissolve', 'slide', 'zoom', 'wipe', 'spin', 'push', 'blur'] as const).map(
                      (tr) => (
                        <option key={tr} value={tr}>
                          {tr.toUpperCase()}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Out Transition</label>
                  <select
                    aria-label="Out Transition Type"
                    value={selectedClip.transition.outType}
                    onChange={(e) => updateTransition({ outType: e.target.value as TransitionType })}
                    className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    {(['none', 'fade', 'dissolve', 'slide', 'zoom', 'wipe', 'spin', 'push', 'blur'] as const).map(
                      (tr) => (
                        <option key={tr} value={tr}>
                          {tr.toUpperCase()}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
              <SliderRow
                label="In Transition Duration (s)"
                value={selectedClip.transition.inDuration}
                min={0.1}
                max={2.5}
                step={0.1}
                onChange={(v) => updateTransition({ inDuration: v })}
              />
              <SliderRow
                label="Out Transition Duration (s)"
                value={selectedClip.transition.outDuration}
                min={0.1}
                max={2.5}
                step={0.1}
                onChange={(v) => updateTransition({ outDuration: v })}
              />
            </div>
          </>
        )}

        {/* 4. TEXT & TYPOGRAPHY EDITOR TAB */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              Typography & Title Styling
            </span>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Primary Headline Text</label>
              <input
                type="text"
                aria-label="Primary Headline Text"
                value={selectedClip.textStyle?.text ?? selectedClip.name}
                onChange={(e) => updateTextStyle({ text: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Secondary Subtitle / Kicker</label>
              <input
                type="text"
                aria-label="Secondary Subtitle Text"
                value={selectedClip.textStyle?.subtext ?? ''}
                onChange={(e) => updateTextStyle({ subtext: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Font Family</label>
                <select
                  aria-label="Font Family"
                  value={selectedClip.textStyle?.fontFamily ?? 'Plus Jakarta Sans'}
                  onChange={(e) => updateTextStyle({ fontFamily: e.target.value as any })}
                  className="w-full px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Oswald">Oswald</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Alignment</label>
                <select
                  aria-label="Text Alignment"
                  value={selectedClip.textStyle?.align ?? 'center'}
                  onChange={(e) => updateTextStyle({ align: e.target.value as any })}
                  className="w-full px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateTextStyle({ bold: !(selectedClip.textStyle?.bold ?? true) })}
                className={`py-1.5 rounded border font-bold cursor-pointer ${
                  selectedClip.textStyle?.bold
                    ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                Bold (B)
              </button>
              <button
                type="button"
                onClick={() => updateTextStyle({ italic: !(selectedClip.textStyle?.italic ?? false) })}
                className={`py-1.5 rounded border italic cursor-pointer ${
                  selectedClip.textStyle?.italic
                    ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                Italic (I)
              </button>
            </div>

            <SliderRow
              label="Font Size (px)"
              value={selectedClip.textStyle?.fontSize ?? 44}
              min={18}
              max={110}
              onChange={(v) => updateTextStyle({ fontSize: v })}
            />
            <SliderRow
              label="Letter Spacing (px)"
              value={selectedClip.textStyle?.letterSpacing ?? 1}
              min={-2}
              max={16}
              onChange={(v) => updateTextStyle({ letterSpacing: v })}
            />
            <SliderRow
              label="Outline Width"
              value={selectedClip.textStyle?.outlineWidth ?? 0}
              min={0}
              max={10}
              onChange={(v) => updateTextStyle({ outlineWidth: v })}
            />
            <SliderRow
              label="Background Highlight (%)"
              value={selectedClip.textStyle?.bgOpacity ?? 65}
              min={0}
              max={100}
              onChange={(v) => updateTextStyle({ bgOpacity: v })}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Text Color</label>
                <input
                  type="color"
                  aria-label="Text Color"
                  value={selectedClip.textStyle?.color ?? '#FFFFFF'}
                  onChange={(e) => updateTextStyle({ color: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Highlight Box Color</label>
                <input
                  type="color"
                  aria-label="Highlight Box Color"
                  value={selectedClip.textStyle?.bgColor ?? '#0F172A'}
                  onChange={(e) => updateTextStyle({ bgColor: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Text Entrance Animation</label>
              <select
                aria-label="Text Entrance Animation"
                value={selectedClip.textStyle?.entranceAnim ?? 'fade-up'}
                onChange={(e) => updateTextStyle({ entranceAnim: e.target.value as TextAnimationType })}
                className="w-full px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <option value="none">None</option>
                <option value="fade-up">Fade Up</option>
                <option value="typewriter">Typewriter</option>
                <option value="pop-bounce">Pop Scale</option>
                <option value="slide-lower-third">Slide Lower Third</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. AUDIO MIXING & 3-BAND EQUALIZER TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Audio Level & Dynamics</span>
              <button
                type="button"
                onClick={() => updateAudio(createDefaultAudio())}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-500 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Audio</span>
              </button>
            </div>

            <SliderRow
              label="Clip Volume (%)"
              value={selectedClip.audio.volume}
              min={0}
              max={200}
              onChange={(v) => updateAudio({ volume: v })}
            />
            <SliderRow
              label="Audio Fade In (s)"
              value={selectedClip.audio.fadeIn}
              min={0}
              max={5}
              step={0.2}
              onChange={(v) => updateAudio({ fadeIn: v })}
            />
            <SliderRow
              label="Audio Fade Out (s)"
              value={selectedClip.audio.fadeOut}
              min={0}
              max={5}
              step={0.2}
              onChange={(v) => updateAudio({ fadeOut: v })}
            />

            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-slate-700 dark:text-slate-300">Mute Clip Audio</span>
                <input
                  type="checkbox"
                  checked={selectedClip.audio.muted}
                  onChange={(e) => updateAudio({ muted: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-slate-700 dark:text-slate-300">Noise Reduction (High-Pass)</span>
                <input
                  type="checkbox"
                  checked={selectedClip.audio.noiseReduction}
                  onChange={(e) => updateAudio({ noiseReduction: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-slate-700 dark:text-slate-300">Voice Presence Enhancement</span>
                <input
                  type="checkbox"
                  checked={selectedClip.audio.voiceEnhance}
                  onChange={(e) => updateAudio({ voiceEnhance: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-slate-700 dark:text-slate-300">Background Audio Ducking</span>
                <input
                  type="checkbox"
                  checked={selectedClip.audio.ducking}
                  onChange={(e) => updateAudio({ ducking: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
            </div>

            {/* 3-Band Parametric Equalizer */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                3-Band Equalizer (dB)
              </span>
              <SliderRow
                label="Low Bass (100 Hz)"
                value={selectedClip.audio.eq.low}
                min={-12}
                max={12}
                onChange={(v) => updateAudio({ eq: { ...selectedClip.audio.eq, low: v } })}
              />
              <SliderRow
                label="Mid Presence (1 kHz)"
                value={selectedClip.audio.eq.mid}
                min={-12}
                max={12}
                onChange={(v) => updateAudio({ eq: { ...selectedClip.audio.eq, mid: v } })}
              />
              <SliderRow
                label="High Air (8 kHz)"
                value={selectedClip.audio.eq.high}
                min={-12}
                max={12}
                onChange={(v) => updateAudio({ eq: { ...selectedClip.audio.eq, high: v } })}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-medium">
          {value}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
      />
    </div>
  );
};
