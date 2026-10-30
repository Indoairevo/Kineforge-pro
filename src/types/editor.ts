export type AspectRatioKey = '16:9' | '9:16' | '1:1' | '4:5' | 'custom';

export interface AspectRatioPreset {
  key: AspectRatioKey;
  label: string;
  platform: string;
  width: number;
  height: number;
}

export type TrackType = 'video' | 'overlay' | 'text' | 'audio';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  order: number;
}

export type MediaCategory = 'video' | 'image' | 'audio' | 'sfx' | 'template' | 'sticker' | 'shape' | 'background';

export type ProceduralSceneId =
  | 'cyber_city_drive'
  | 'alpine_drone_sunrise'
  | 'studio_director_interview'
  | 'roastery_vertical_reel'
  | 'intro_neon_kinetic'
  | 'outro_minimal_subscribe'
  | 'bg_gradient_aurora'
  | 'bg_cinematic_grid'
  | 'shape_callout_frame'
  | 'sticker_rec_indicator'
  | 'sticker_4k_badge';

export interface MediaAsset {
  id: string;
  name: string;
  category: MediaCategory;
  folderId: string;
  duration: number; // in seconds
  width?: number;
  height?: number;
  proceduralScene?: ProceduralSceneId;
  audioSynthPreset?: 'cyber_pulse_120' | 'ambient_horizon_90' | 'whoosh_sfx' | 'sub_impact_sfx' | 'voiceover_demo';
  blobUrl?: string; // local object URL from IndexedDB or File upload
  mimeType?: string;
  fileSize?: number;
  waveform?: number[]; // normalized 0..1 array for audio waveform visualization
  licenseType: 'built-in' | 'free' | 'pro-external';
  description?: string;
}

export interface MediaFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ColorAdjustments {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  temperature: number;// -100 (cool) to 100 (warm)
  tint: number;       // -100 (green) to 100 (magenta)
  highlights: number; // -100 to 100
  shadows: number;    // -100 to 100
  exposure: number;   // -100 to 100
  hue: number;        // -180 to 180
  sharpen: number;    // 0 to 100
}

export interface VideoEffects {
  blur: number;       // 0 to 50 px
  glow: number;       // 0 to 100
  shadow: number;     // 0 to 100
  vignette: number;   // 0 to 100
  filmGrain: number;  // 0 to 100
  glitch: number;     // 0 to 100
  motionBlur: number; // 0 to 100
  shake: number;      // 0 to 100
  fadeIn: number;     // 0 to 5 seconds
  fadeOut: number;    // 0 to 5 seconds
  chromaKeyEnabled: boolean; // AI / Background removal simulation or alpha mask
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'dissolve'
  | 'slide'
  | 'zoom'
  | 'wipe'
  | 'spin'
  | 'push'
  | 'blur';

export interface ClipTransition {
  inType: TransitionType;
  inDuration: number; // 0 to 3 seconds
  outType: TransitionType;
  outDuration: number; // 0 to 3 seconds
}

export interface ClipTransform {
  x: number;          // percentage offset -100 to 100 (0 is center)
  y: number;          // percentage offset -100 to 100 (0 is center)
  scale: number;      // 10 to 300 (%)
  rotation: number;   // -180 to 180 deg
  flipH: boolean;
  flipV: boolean;
  cropTop: number;    // 0 to 45%
  cropBottom: number; // 0 to 45%
  cropLeft: number;   // 0 to 45%
  cropRight: number;  // 0 to 45%
  opacity: number;    // 0 to 100%
  pipPreset?: 'none' | 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left' | 'split-left' | 'split-right';
}

export type TextAnimationType = 'none' | 'fade-up' | 'typewriter' | 'pop-bounce' | 'slide-lower-third' | 'glitch';

export interface TextStyleConfig {
  text: string;
  subtext?: string;
  fontFamily: 'Plus Jakarta Sans' | 'DM Sans' | 'JetBrains Mono' | 'Playfair Display' | 'Oswald';
  fontSize: number; // 16 to 120
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing: number; // -2 to 20 px
  lineHeight: number;    // 0.8 to 2.2
  outlineColor: string;
  outlineWidth: number;  // 0 to 10
  shadowColor: string;
  shadowBlur: number;    // 0 to 30
  bgColor: string;
  bgOpacity: number;     // 0 to 100
  templateVariant?: 'standard' | 'lower-third' | 'kinetic-title' | 'subtitle-pill' | 'intro-banner' | 'outro-card';
  entranceAnim: TextAnimationType;
  exitAnim: TextAnimationType;
}

export interface AudioEqualizer {
  low: number;  // -12 to +12 dB (100 Hz)
  mid: number;  // -12 to +12 dB (1000 Hz)
  high: number; // -12 to +12 dB (8000 Hz)
}

export interface ClipAudioSettings {
  volume: number;         // 0 to 200%
  muted: boolean;
  fadeIn: number;         // 0 to 5s
  fadeOut: number;        // 0 to 5s
  noiseReduction: boolean;
  voiceEnhance: boolean;
  ducking: boolean;       // lower music volume when voiceover/dialogue plays
  eq: AudioEqualizer;
}

export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  groupId?: string;
  name: string;
  type: TrackType;
  startTime: number;      // position on timeline (seconds)
  duration: number;       // timeline duration (seconds)
  sourceOffset: number;   // trim in-point within media asset (seconds)
  speed: number;          // 0.25x to 4x
  reversed: boolean;
  freezeFrame: boolean;
  freezeTime?: number;
  transform: ClipTransform;
  color: ColorAdjustments;
  effects: VideoEffects;
  transition: ClipTransition;
  audio: ClipAudioSettings;
  textStyle?: TextStyleConfig;
  proceduralScene?: ProceduralSceneId;
  audioSynthPreset?: MediaAsset['audioSynthPreset'];
  blobUrl?: string;
  waveform?: number[];
}

export type ExportFormat = 'mp4' | 'mov' | 'webm';
export type ExportResolution = '480p' | '720p' | '1080p' | '4K';
export type ExportFps = 24 | 25 | 30 | 50 | 60;

export interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  bitrateMbps: number; // 2 to 50 Mbps
  audioBitrateKbps: 128 | 192 | 320;
  qualityPreset: 'draft' | 'standard' | 'high' | 'master';
}

export interface VideoProject {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  aspectRatio: AspectRatioKey;
  customWidth: number;
  customHeight: number;
  canvasBackgroundColor?: string;
  magneticTimeline: boolean;
  snappingEnabled: boolean;
  tracks: Track[];
  clips: TimelineClip[];
  folders: MediaFolder[];
  assets: MediaAsset[];
  beatMarkers: number[];
}
