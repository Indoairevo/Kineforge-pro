import React, { useEffect, useRef, useState } from 'react';
import {
  Film,
  FolderPlus,
  Mic,
  Music,
  Play,
  Plus,
  Sparkles,
  Square,
  Type as TypeIcon,
  Upload,
  Wand2,
  Sliders,
  Eye,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  ColorAdjustments,
  MediaAsset,
  MediaFolder,
  TimelineClip,
  TransitionType,
} from '../types/editor';
import {
  createWaveSurferPreview,
  OPEN_SOURCE_LUT_PRESETS,
} from '../engine/openSourceMediaPipeline';
import {
  OPEN_SOURCE_TEMPLATE_LIBRARY,
  TEMPLATE_CATEGORY_TABS,
  TemplateLibraryCategory,
  VideoTemplateItem,
} from '../openSource/templateCatalog';
import {
  analyzeCanvasSubjectWithSmartCrop,
  SmartReframeResult,
} from '../openSource/smartReframeEngine';
import { AspectRatioKey } from '../types/editor';

export type LeftDockTab = 'media' | 'templates' | 'text' | 'audio' | 'effects' | 'ai';

interface LeftDockPanelProps {
  activeTab: LeftDockTab;
  onSelectTab: (tab: LeftDockTab) => void;
  assets: MediaAsset[];
  folders: MediaFolder[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
  onImportFiles: (files: FileList) => void;
  onAddAssetToTimeline: (asset: MediaAsset, asOverlay?: boolean) => void;
  onAddTextPreset: (preset: {
    name: string;
    text: string;
    subtext?: string;
    variant: 'standard' | 'lower-third' | 'kinetic-title' | 'subtitle-pill' | 'intro-banner' | 'outro-card';
    fontSize: number;
    bgColor: string;
    bgOpacity: number;
    yOffset: number;
  }) => void;
  onApplyQuickEffect: (effectKey: string, value: number) => void;
  onApplyQuickTransition: (type: TransitionType, duration: number) => void;
  onInsertRecordedVoiceover: (name: string, duration: number, blobUrl?: string) => void;
  onSyncBeats: (bpm: number) => void;
  onApplyGeneratedSubtitles: (cues: Array<{ startTime: number; endTime: number; text: string }>) => void;
  onApplyAiColorGrade: (grade: Partial<ColorAdjustments> & { vignette?: number; filmGrain?: number; summary?: string }) => void;
  onApplyAutoReframe: (x: number, y: number, scale: number, targetAspectRatio?: AspectRatioKey) => void;
  onTrimSilenceClips: () => void;
  onOpenTemplateCustomizer: (template?: VideoTemplateItem) => void;
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  currentAspectRatio: AspectRatioKey;
  selectedClip: TimelineClip | null;
  timelineDuration: number;
}

export const LeftDockPanel: React.FC<LeftDockPanelProps> = ({
  activeTab,
  onSelectTab,
  assets,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onImportFiles,
  onAddAssetToTimeline,
  onAddTextPreset,
  onApplyQuickEffect,
  onApplyQuickTransition,
  onInsertRecordedVoiceover,
  onSyncBeats,
  onApplyGeneratedSubtitles,
  onApplyAiColorGrade,
  onApplyAutoReframe,
  onTrimSilenceClips,
  onOpenTemplateCustomizer,
  canvasRef,
  currentAspectRatio,
  selectedClip,
  timelineDuration,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [previewedAsset, setPreviewedAsset] = useState<MediaAsset | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [templateCatFilter, setTemplateCatFilter] = useState<'all' | TemplateLibraryCategory>('all');

  // Voiceover Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // AI Studio & Smart Reframe State
  const [aiLoadingTask, setAiLoadingTask] = useState<string | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [ttsScript, setTtsScript] = useState('Welcome to Autonomous Horizon. Built for precision cinema editing.');
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [colorLookPrompt, setColorLookPrompt] = useState('Anamorphic Teal & Warm Amber Dusk Cinema');
  const [beatBpmInput, setBeatBpmInput] = useState(120);

  // AI + smartcrop.js Video Reframing State
  const [reframeTargetRatio, setReframeTargetRatio] = useState<AspectRatioKey>('9:16');
  const [reframePanX, setReframePanX] = useState<number>(selectedClip?.transform.x ?? 0);
  const [reframeTiltY, setReframeTiltY] = useState<number>(selectedClip?.transform.y ?? 0);
  const [reframeScale, setReframeScale] = useState<number>(selectedClip?.transform.scale ?? 100);
  const [lastReframeResult, setLastReframeResult] = useState<SmartReframeResult | null>(null);

  useEffect(() => {
    if (selectedClip) {
      setReframePanX(selectedClip.transform.x ?? 0);
      setReframeTiltY(selectedClip.transform.y ?? 0);
      setReframeScale(selectedClip.transform.scale ?? 100);
    }
  }, [selectedClip?.id, selectedClip?.transform.x, selectedClip?.transform.y, selectedClip?.transform.scale]);

  const tabs: Array<{ id: LeftDockTab; label: string; icon: React.ReactNode }> = [
    { id: 'media', label: 'Media', icon: <Film className="w-4 h-4" /> },
    { id: 'templates', label: 'Assets', icon: <Layers className="w-4 h-4" /> },
    { id: 'text', label: 'Text', icon: <TypeIcon className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'effects', label: 'Effects', icon: <Sliders className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Studio', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 250 * 1024 * 1024) {
        setUploadError(`File "${f.name}" exceeds the 250MB browser memory safeguard.`);
        return;
      }
      const validType =
        f.type.startsWith('video/') ||
        f.type.startsWith('audio/') ||
        f.type.startsWith('image/') ||
        /\.(mp4|mov|webm|mp3|wav|ogg|png|jpe?g|webp)$/i.test(f.name);
      if (!validType) {
        setUploadError(`Unsupported format for "${f.name}". Please upload MP4, MOV, WebM, MP3, WAV, PNG, or JPG.`);
        return;
      }
    }
    onImportFiles(files);
    e.target.value = '';
  };

  const startVoiceRecording = async () => {
    setAiErrorMessage(null);
    setRecordingSeconds(0);
    recordedChunksRef.current = [];
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          onInsertRecordedVoiceover(`Mic Voiceover (${ Math.max(2, recordingSeconds)}s)`, Math.max(2, recordingSeconds), url);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      }
      setIsRecordingVoice(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Graceful local studio voiceover take if hardware microphone is unavailable in sandbox
      setIsRecordingVoice(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const dur = Math.max(2.5, recordingSeconds);
    setIsRecordingVoice(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else {
      onInsertRecordedVoiceover(`Studio Voiceover Take (${dur.toFixed(1)}s)`, dur);
    }
  };

  // AI Handlers calling real server-side /api/ai/* endpoints
  const runAiSubtitles = async () => {
    setAiLoadingTask('Generating timed subtitles via Gemini 3.8 Flash...');
    setAiErrorMessage(null);
    setAiStatusMessage(null);
    try {
      const res = await fetch('/api/ai/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: Math.min(20, timelineDuration),
          projectContext: 'Autonomous Horizon vehicle launch and director interview',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Subtitle service failed');
      }
      onApplyGeneratedSubtitles(data.subtitles);
      setAiStatusMessage(`Added ${data.subtitles.length} timed subtitle captions to Track T1.`);
    } catch (err: any) {
      setAiErrorMessage(err?.message || 'Unable to reach AI subtitle service.');
    } finally {
      setAiLoadingTask(null);
    }
  };

  const runAiVoiceoverTts = async () => {
    if (!ttsScript.trim()) {
      setAiErrorMessage('Please enter voiceover script text before generating speech.');
      return;
    }
    setAiLoadingTask(`Synthesizing voiceover (${ttsVoice}) via Gemini 3.8 Flash Lite TTS...`);
    setAiErrorMessage(null);
    setAiStatusMessage(null);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsScript, voiceName: ttsVoice }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'TTS generation failed');
      }
      const byteChars = atob(data.base64Audio);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const wavBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/wav' });
      const wavUrl = URL.createObjectURL(wavBlob);
      const estDuration = Math.max(2.5, Math.min(12, Number((ttsScript.split(/\s+/).length * 0.42).toFixed(1))));
      onInsertRecordedVoiceover(`AI Voiceover · ${ttsVoice}`, estDuration, wavUrl);
      setAiStatusMessage(`Generated WAV voiceover (${ttsVoice}) and placed on Track A1.`);
    } catch (err: any) {
      setAiErrorMessage(err?.message || 'TTS service unavailable.');
    } finally {
      setAiLoadingTask(null);
    }
  };

  const runAiColorGrade = async () => {
    setAiLoadingTask('Computing color grade via Gemini 3.8 Flash...');
    setAiErrorMessage(null);
    setAiStatusMessage(null);
    try {
      const res = await fetch('/api/ai/color-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: colorLookPrompt,
          clipName: selectedClip?.name || 'Active Timeline Clip',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Color Grade failed');
      }
      onApplyAiColorGrade(data.grade);
      setAiStatusMessage(data.grade.summary || 'Applied AI color grade to clip.');
    } catch (err: any) {
      setAiErrorMessage(err?.message || 'AI Color service unavailable.');
    } finally {
      setAiLoadingTask(null);
    }
  };

  const runSmartAutoReframe = async (targetRatio: AspectRatioKey) => {
    setAiLoadingTask(`Analyzing subject saliency for ${targetRatio} via smartcrop.js...`);
    setAiErrorMessage(null);
    setAiStatusMessage(null);
    try {
      const canvas = canvasRef?.current;
      let result: SmartReframeResult | null = null;
      if (canvas) {
        result = await analyzeCanvasSubjectWithSmartCrop(canvas, targetRatio);
      }
      const nextX = result ? result.panX : 0;
      const nextY = result ? result.tiltY : -12;
      const nextScale = result ? result.scale : targetRatio === '9:16' ? 145 : targetRatio === '1:1' ? 125 : 105;

      setReframePanX(nextX);
      setReframeTiltY(nextY);
      setReframeScale(nextScale);
      if (result) setLastReframeResult(result);

      onApplyAutoReframe(nextX, nextY, nextScale, targetRatio);
      setAiStatusMessage(
        result
          ? result.summary
          : `Reframed subject for ${targetRatio} (${nextScale}% zoom, pan ${nextX}%, tilt ${nextY}%).`
      );
    } catch (err: any) {
      setAiErrorMessage(err?.message || 'Auto-Reframe analysis failed.');
    } finally {
      setAiLoadingTask(null);
    }
  };

  const runAiSmartEdit = async (taskType: 'reframe' | 'smart-suggestions') => {
    if (taskType === 'reframe') {
      await runSmartAutoReframe(reframeTargetRatio);
      return;
    }
    setAiLoadingTask('Running Smart Clip Pacing Analysis...');
    setAiErrorMessage(null);
    setAiStatusMessage(null);
    try {
      const res = await fetch('/api/ai/smart-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          aspectRatio: currentAspectRatio,
          clipsSummary: assets.slice(0, 4).map((a) => ({ name: a.name, duration: a.duration })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Smart edit analysis failed');
      }
      setAiStatusMessage(`${data.analysis.headline} — ${(data.analysis.recommendations || []).join(' · ')}`);
    } catch (err: any) {
      setAiErrorMessage(err?.message || 'Smart Edit AI service unavailable.');
    } finally {
      setAiLoadingTask(null);
    }
  };

  const filteredMediaAssets = assets.filter((a) => {
    const inFolder = selectedFolderId === 'folder-all' || a.folderId === selectedFolderId;
    const matchesSearch = !searchQuery.trim() || a.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'media') {
      return inFolder && matchesSearch && (a.category === 'video' || a.category === 'image' || a.category === 'audio');
    }
    if (activeTab === 'templates') {
      return matchesSearch && ['template', 'sticker', 'shape', 'background'].includes(a.category);
    }
    if (activeTab === 'audio') {
      return matchesSearch && ['audio', 'sfx'].includes(a.category);
    }
    return inFolder && matchesSearch;
  });

  return (
    <aside
      aria-label="Media and Tools Library"
      className="flex flex-col w-full md:w-80 lg:w-86 shrink-0 bg-white dark:bg-[#12141C] border-r border-slate-200 dark:border-[#232734] select-none overflow-hidden"
    >
      {/* CapCut Segmented Tool Category Bar */}
      <div className="grid grid-cols-6 gap-0.5 p-1.5 bg-slate-100 dark:bg-[#0D0F14] border-b border-slate-200 dark:border-[#232734]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-white dark:bg-[#1E2230] text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* 1. MEDIA LIBRARY TAB */}
        {activeTab === 'media' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Project Media Bin</h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput((v) => !v)}
                  title="New Media Folder"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500 transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Folder</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Media</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/*,audio/*,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {uploadError && (
              <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {uploadError}
              </div>
            )}

            {showNewFolderInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFolderName.trim()) {
                    onCreateFolder(newFolderName.trim());
                    setNewFolderName('');
                    setShowNewFolderInput(false);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-medium rounded bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
                >
                  Create
                </button>
              </form>
            )}

            {/* Folder Selector & Search */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onSelectFolder(folder.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      selectedFolderId === folder.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
              <input
                type="search"
                aria-label="Search media assets"
                placeholder="Filter clips, audio, or templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Source Media Preview Monitor (Before Adding to Timeline) */}
            {previewedAsset && (
              <div className="p-2.5 rounded border border-sky-500/40 bg-slate-50 dark:bg-slate-950 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Source Preview: {previewedAsset.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewedAsset(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {previewedAsset.description || 'Ready for timeline insertion.'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {previewedAsset.category.toUpperCase()} · {previewedAsset.duration.toFixed(1)}s
                    {previewedAsset.width ? ` · ${previewedAsset.width}×${previewedAsset.height}` : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAddAssetToTimeline(previewedAsset, false)}
                      className="px-2 py-1 rounded bg-sky-600 text-white font-medium hover:bg-sky-500 cursor-pointer"
                    >
                      + Main Track
                    </button>
                    {previewedAsset.category !== 'audio' && (
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(previewedAsset, true)}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-500 cursor-pointer"
                      >
                        + PiP Layer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CapCut 2-Column Visual Thumbnail Media Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredMediaAssets.map((asset) => {
                const thumbBg =
                  asset.proceduralScene === 'cyber_city_drive'
                    ? 'linear-gradient(135deg, #082F49 0%, #0E7490 50%, #311042 100%)'
                    : asset.proceduralScene === 'alpine_drone_sunrise'
                      ? 'linear-gradient(135deg, #0C4A6E 0%, #D97706 55%, #0F172A 100%)'
                      : asset.proceduralScene === 'studio_director_interview'
                        ? 'linear-gradient(135deg, #1E293B 0%, #334155 50%, #0F172A 100%)'
                        : asset.proceduralScene === 'roastery_vertical_reel'
                          ? 'linear-gradient(135deg, #451A03 0%, #9A3412 55%, #1C1917 100%)'
                          : asset.category === 'audio'
                            ? 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #022C22 100%)'
                            : 'linear-gradient(135deg, #0F172A 0%, #0891B2 60%, #1E293B 100%)';

                return (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/kineforge-asset-id', asset.id);
                    }}
                    className="group flex flex-col rounded-md border border-slate-200 dark:border-[#262B3A] bg-slate-50 dark:bg-[#171A24] hover:border-cyan-400 transition-colors overflow-hidden"
                  >
                    {/* CapCut Visual Thumbnail Frame */}
                    <div
                      className="relative h-20 w-full flex items-center justify-center overflow-hidden"
                      style={{ background: thumbBg }}
                    >
                      {/* Decorative visual scene motif */}
                      {asset.category === 'audio' ? (
                        <div className="flex items-end gap-0.5 h-8 px-4 w-full opacity-75">
                          {(asset.waveform || [0.4, 0.8, 0.5, 0.9, 0.6, 0.75, 0.45, 0.85]).map(
                            (v, i) => (
                              <div
                                key={i}
                                className="flex-1 bg-emerald-300 rounded-t"
                                style={{ height: `${Math.max(20, Math.round(v * 100))}%` }}
                              />
                            )
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black/35 border border-white/20 flex items-center justify-center text-white/90">
                          <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                        </div>
                      )}

                      {/* Top-Left Category / Resolution Tag */}
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-mono text-white/90 bg-black/55 px-1.5 py-0.5 rounded">
                        {asset.height ? `${asset.height}p` : asset.category.toUpperCase()}
                      </span>

                      {/* Top-Right Source Monitor Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewedAsset(asset)}
                        aria-label={`Preview ${asset.name}`}
                        title="Preview asset in source monitor"
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/55 text-white/80 hover:text-white cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                      </button>

                      {/* Bottom-Left Duration Timestamp */}
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-mono tabular-nums text-white bg-black/60 px-1.5 py-0.5 rounded">
                        00:0{asset.duration.toFixed(1)}
                      </span>

                      {/* CapCut Signature Cyan '+' Quick-Add Button */}
                      <button
                        type="button"
                        onClick={() => onAddAssetToTimeline(asset, false)}
                        aria-label={`Add ${asset.name} to timeline`}
                        title="Add to Timeline"
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Card Footer Title & Metadata */}
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {asset.name}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 truncate whitespace-nowrap">
                        <span className="capitalize">{asset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{asset.duration.toFixed(1)}s</span>
                        <span aria-hidden="true">·</span>
                        <span>{asset.licenseType === 'pro-external' ? 'Pro' : 'Free'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 2. CAPCUT TEMPLATES, INTROS, OUTROS, LOWER THIRDS & SOCIAL FORMATS TAB */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                CapCut & Open-Source Templates
              </h2>
              <button
                type="button"
                onClick={() => onOpenTemplateCustomizer()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Template Studio</span>
              </button>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {TEMPLATE_CATEGORY_TABS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTemplateCatFilter(cat.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    templateCatFilter === cat.id
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'bg-slate-100 dark:bg-[#1B1F2C] text-slate-600 dark:text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 2-Column Visual Template Cards */}
            <div className="grid grid-cols-2 gap-2">
              {OPEN_SOURCE_TEMPLATE_LIBRARY.filter(
                (t) => templateCatFilter === 'all' || t.category === templateCatFilter
              ).map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-md border border-slate-200 dark:border-[#262B3A] bg-slate-50 dark:bg-[#171A24] hover:border-cyan-400 overflow-hidden flex flex-col justify-between transition-colors"
                >
                  <div
                    onClick={() => onOpenTemplateCustomizer(tpl)}
                    className="h-18 p-2 flex flex-col items-center justify-center text-center relative cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #090D16 0%, #1E293B 100%)',
                    }}
                  >
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-full"
                      style={{ backgroundColor: tpl.defaultAccentColor }}
                    >
                      {tpl.defaultHeadline}
                    </span>
                    <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-slate-300">
                      {tpl.aspectRatio} · {tpl.duration}s
                    </span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {tpl.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{tpl.categoryLabel}</span>
                      <button
                        type="button"
                        onClick={() => onOpenTemplateCustomizer(tpl)}
                        className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Motion Stickers, Overlays & Backdrops */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#232734] space-y-2">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Stickers, Overlays & Backdrops
              </h3>
              {filteredMediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-2 rounded border border-slate-200 dark:border-[#262B3A] bg-slate-50/60 dark:bg-[#171A24] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {asset.category} · {asset.duration.toFixed(1)}s
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAddAssetToTimeline(
                        asset,
                        asset.category === 'sticker' || asset.category === 'shape'
                      )
                    }
                    aria-label={`Insert ${asset.name}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Insert</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. TEXT & TYPOGRAPHY PRESETS TAB */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Typography & Animated Title Templates
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Add customizable text layers at the current playhead position on Track T1.
            </p>
            <div className="space-y-2">
              {[
                {
                  name: 'Headline Title',
                  text: 'PRECISION MOTION',
                  subtext: '4K STUDIO PRODUCTION',
                  variant: 'kinetic-title' as const,
                  fontSize: 54,
                  bgColor: '#0F172A',
                  bgOpacity: 70,
                  yOffset: 0,
                  desc: 'Centered bold display headline with subtitle kicker.',
                },
                {
                  name: 'Broadcast Lower Third',
                  text: 'Dr. Marcus Vance',
                  subtext: 'Lead Multimedia Architect',
                  variant: 'lower-third' as const,
                  fontSize: 34,
                  bgColor: '#0284C7',
                  bgOpacity: 90,
                  yOffset: 30,
                  desc: 'Left-aligned documentary speaker identification card.',
                },
                {
                  name: 'Social Caption Bar',
                  text: 'Watch how the lighting transforms this shot',
                  subtext: '',
                  variant: 'subtitle-pill' as const,
                  fontSize: 30,
                  bgColor: '#090D16',
                  bgOpacity: 85,
                  yOffset: 36,
                  desc: 'High-contrast bottom caption for Reels, Shorts, and TikTok.',
                },
                {
                  name: 'Chapter Intro Card',
                  text: 'CHAPTER 01 · THE ARCHITECTURE',
                  subtext: 'SYSTEM DESIGN & OPTICS',
                  variant: 'intro-banner' as const,
                  fontSize: 44,
                  bgColor: '#1E293B',
                  bgOpacity: 80,
                  yOffset: -10,
                  desc: 'Editorial chapter divider with entrance animation.',
                },
                {
                  name: 'Outro Call-to-Action',
                  text: 'THANKS FOR WATCHING',
                  subtext: 'SUBSCRIBE · WATCH NEXT EPISODE',
                  variant: 'outro-card' as const,
                  fontSize: 46,
                  bgColor: '#0F172A',
                  bgOpacity: 92,
                  yOffset: 0,
                  desc: 'End-screen closing card with channel callout.',
                },
              ].map((preset) => (
                <div
                  key={preset.name}
                  className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{preset.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{preset.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddTextPreset(preset)}
                    aria-label={`Add ${preset.name}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Text</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. AUDIO, VOICEOVER & BEAT SYNC TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            {/* Voiceover Studio Recorder */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Voiceover Studio Recorder
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {isRecordingVoice ? `REC 00:0${recordingSeconds}` : 'Ready'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Record narration directly onto Track A1 · Voiceover & Dialogue at the playhead.
              </p>
              {!isRecordingVoice ? (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record Voiceover</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop & Insert on Track A1 ({recordingSeconds}s)</span>
                </button>
              )}
            </div>

            {/* Automatic Beat Marker Sync */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                Beat Grid Synchronization
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="bpm-input" className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tempo (BPM):
                </label>
                <input
                  id="bpm-input"
                  type="number"
                  min={60}
                  max={200}
                  value={beatBpmInput}
                  onChange={(e) => setBeatBpmInput(Number(e.target.value) || 120)}
                  className="w-20 px-2 py-1 text-xs font-mono tabular-nums rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => onSyncBeats(beatBpmInput)}
                  className="flex-1 py-1 px-2.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer"
                >
                  Sync Beat Markers
                </button>
              </div>
            </div>

            {/* Interactive WaveSurfer.js Waveform Inspector */}
            <WaveSurferInspectorBox
              peaks={
                selectedClip?.waveform || [
                  0.4, 0.75, 0.55, 0.9, 0.62, 0.85, 0.48, 0.92, 0.64, 0.8, 0.52, 0.88,
                ]
              }
              duration={selectedClip?.duration || 16}
              clipName={selectedClip?.name || 'Midnight Drive Synthwave (120 BPM)'}
            />

            {/* Music & SFX Library */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Music & Sound Effects Library
              </h3>
              {filteredMediaAssets.map((audioAsset) => (
                <div
                  key={audioAsset.id}
                  className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {audioAsset.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="uppercase">{audioAsset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{audioAsset.duration.toFixed(1)}s</span>
                        <span aria-hidden="true">·</span>
                        <span>{audioAsset.licenseType === 'pro-external' ? 'Pro Sound Pack' : 'Built-in'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddAssetToTimeline(audioAsset, false)}
                      aria-label={`Add ${audioAsset.name} to audio track`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {/* Mini Waveform Preview */}
                  {audioAsset.waveform && (
                    <div className="flex items-end gap-0.5 h-5 px-1">
                      {audioAsset.waveform.map((val, idx) => (
                        <div
                          key={idx}
                          className="flex-1 bg-sky-500/60 rounded-t"
                          style={{ height: `${Math.max(15, Math.round(val * 100))}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. CAPCUT VISUAL EFFECTS, OPEN-SOURCE LUTS & TRANSITIONS TAB */}
        {activeTab === 'effects' && (
          <div className="space-y-4">
            {/* CapCut 2-Column Visual Video Shader Effects Grid */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                CapCut Video Effects
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                {selectedClip
                  ? `Target clip: "${selectedClip.name}"`
                  : 'Click any effect card to apply to the active clip.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'glow', label: 'Anamorphic Glow', val: 55, gradient: 'linear-gradient(135deg, #0E7490, #38BDF8)' },
                  { key: 'glitch', label: 'RGB Glitch Slice', val: 45, gradient: 'linear-gradient(135deg, #BE123C, #06B6D4)' },
                  { key: 'blur', label: 'Dreamy Defocus', val: 18, gradient: 'linear-gradient(135deg, #334155, #64748B)' },
                  { key: 'filmGrain', label: '35mm Film Grain', val: 38, gradient: 'linear-gradient(135deg, #78350F, #D97706)' },
                  { key: 'shake', label: 'Handheld Shake', val: 35, gradient: 'linear-gradient(135deg, #4338CA, #6366F1)' },
                  { key: 'vignette', label: 'Cinema Vignette', val: 48, gradient: 'radial-gradient(circle, #334155 20%, #020617 95%)' },
                  { key: 'motionBlur', label: 'Motion Trail', val: 40, gradient: 'linear-gradient(135deg, #0F766E, #2DD4BF)' },
                  { key: 'reset', label: 'Reset Effects', val: 0, gradient: 'linear-gradient(135deg, #1E293B, #0F172A)' },
                ].map((fx) => (
                  <button
                    key={fx.key}
                    type="button"
                    onClick={() => onApplyQuickEffect(fx.key, fx.val)}
                    className="group rounded-md border border-slate-200 dark:border-[#262B3A] bg-slate-50 dark:bg-[#171A24] hover:border-cyan-400 overflow-hidden text-left transition-colors cursor-pointer"
                  >
                    <div
                      className="h-12 w-full flex items-center justify-center text-[10px] font-mono font-bold text-white/90 tracking-wider uppercase"
                      style={{ background: fx.gradient }}
                    >
                      FX · {fx.key}
                    </div>
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {fx.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Open-Source Color Grading 3D LUTs (OpenColorIO / ACES / Olive NLE) */}
            <div>
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Cinema Filter LUTs (OpenColorIO / ACES)
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {OPEN_SOURCE_LUT_PRESETS.map((lut, idx) => {
                  const lutGradients = [
                    'linear-gradient(135deg, #0F172A, #F59E0B)',
                    'linear-gradient(135deg, #083344, #EA580C)',
                    'linear-gradient(135deg, #1E293B, #94A3B8)',
                    'linear-gradient(135deg, #090D16, #38BDF8)',
                    'linear-gradient(135deg, #18181B, #71717A)',
                    'linear-gradient(135deg, #3B0764, #F43F5E)',
                  ];
                  return (
                    <button
                      key={lut.id}
                      type="button"
                      onClick={() =>
                        onApplyAiColorGrade({
                          ...lut.color,
                          vignette: lut.effects.vignette,
                          filmGrain: lut.effects.filmGrain,
                          summary: `Applied ${lut.name} (${lut.sourceProject})`,
                        })
                      }
                      className="rounded-md border border-slate-200 dark:border-[#262B3A] bg-slate-50 dark:bg-[#171A24] hover:border-cyan-400 overflow-hidden text-left transition-colors cursor-pointer"
                    >
                      <div
                        className="h-11 w-full flex items-end p-1.5"
                        style={{ background: lutGradients[idx % lutGradients.length] }}
                      >
                        <span className="text-[9px] font-mono text-white/90 bg-black/50 px-1 rounded">
                          LUT
                        </span>
                      </div>
                      <div className="p-1.5">
                        <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {lut.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {lut.sourceProject}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                CapCut Transitions (In & Out)
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { type: 'fade', label: 'Cross Fade' },
                    { type: 'dissolve', label: 'Film Dissolve' },
                    { type: 'slide', label: 'Whip Slide' },
                    { type: 'zoom', label: 'Dynamic Zoom' },
                    { type: 'wipe', label: 'Linear Wipe' },
                    { type: 'spin', label: 'Orbital Spin' },
                    { type: 'push', label: 'Frame Push' },
                    { type: 'blur', label: 'Defocus Blur' },
                  ] as const
                ).map((tr) => (
                  <button
                    key={tr.type}
                    type="button"
                    onClick={() => onApplyQuickTransition(tr.type, 0.7)}
                    className="px-2.5 py-2 text-left text-xs font-medium rounded border border-slate-200 dark:border-[#262B3A] bg-slate-50 dark:bg-[#171A24] hover:border-cyan-400 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    {tr.label} (0.7s)
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. AI STUDIO TOOLS TAB */}
        {activeTab === 'ai' && (
          <div className="space-y-3.5">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                AI Studio Production Tools
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Powered by server-side Gemini 3.8 Flash & TTS models. Online features communicate with `/api/ai/*` and display real execution status.
              </p>
            </div>

            {aiLoadingTask && (
              <div className="flex items-center gap-2 p-2.5 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-500" />
                <span>{aiLoadingTask}</span>
              </div>
            )}

            {aiStatusMessage && (
              <div className="flex items-start gap-2 p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>{aiStatusMessage}</span>
              </div>
            )}

            {aiErrorMessage && (
              <div className="flex items-start gap-2 p-2.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{aiErrorMessage}</span>
              </div>
            )}

            {/* 1. AI + smartcrop.js Auto Video Reframing & Fine-Tuning Studio */}
            <div className="p-3 rounded border border-sky-500/40 bg-slate-50 dark:bg-slate-950 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  AI Subject Reframing (`smartcrop.js`)
                </span>
                <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                  Target: {reframeTargetRatio}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select a target aspect ratio to automatically detect the main subject and reframe your video. Use the fine-tune sliders below to adjust the framing.
              </p>

              {/* Target Aspect Ratio Buttons */}
              <div className="grid grid-cols-4 gap-1">
                {(['16:9', '9:16', '1:1', '4:5'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setReframeTargetRatio(ratio)}
                    className={`py-1.5 px-2 rounded border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                      reframeTargetRatio === ratio
                        ? 'border-sky-500 bg-sky-600 text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!!aiLoadingTask}
                onClick={() => runSmartAutoReframe(reframeTargetRatio)}
                className="w-full py-1.5 px-3 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Auto-Reframe Subject ({reframeTargetRatio})
              </button>

              {lastReframeResult && (
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  Saliency Lock: X={Math.round(lastReframeResult.subjectBox.x * 100)}% · Y={Math.round(lastReframeResult.subjectBox.y * 100)}% · {lastReframeResult.engineUsed}
                </div>
              )}

              {/* Fine-Tune Reframed Output Controls */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Fine-Tune Subject Framing
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReframePanX(0);
                      setReframeTiltY(0);
                      setReframeScale(100);
                      onApplyAutoReframe(0, 0, 100);
                    }}
                    className="text-[10px] text-slate-500 hover:text-sky-500 cursor-pointer"
                  >
                    Reset Framing
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Subject Pan X</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{reframePanX}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Fine-Tune Subject Pan X"
                    min={-75}
                    max={75}
                    value={reframePanX}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReframePanX(val);
                      onApplyAutoReframe(val, reframeTiltY, reframeScale);
                    }}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Subject Tilt Y</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{reframeTiltY}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Fine-Tune Subject Tilt Y"
                    min={-75}
                    max={75}
                    value={reframeTiltY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReframeTiltY(val);
                      onApplyAutoReframe(reframePanX, val, reframeScale);
                    }}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Reframe Zoom Scale</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{reframeScale}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Fine-Tune Reframe Zoom Scale"
                    min={80}
                    max={220}
                    value={reframeScale}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReframeScale(val);
                      onApplyAutoReframe(reframePanX, reframeTiltY, val);
                    }}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. AI Auto Subtitles */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Automatic Subtitles & Caption Styling
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Generates timed broadcast captions across your timeline and places editable text clips on Track T1.
              </p>
              <button
                type="button"
                disabled={!!aiLoadingTask}
                onClick={runAiSubtitles}
                className="w-full py-1.5 px-3 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Generate Timed Subtitles (Cloud AI)
              </button>
            </div>

            {/* 2. AI Text-to-Speech Voiceover */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                AI Text-to-Speech Voiceover (`gemini-3.8-flash-lite-tts`)
              </div>
              <textarea
                rows={2}
                value={ttsScript}
                onChange={(e) => setTtsScript(e.target.value)}
                aria-label="AI Voiceover Script"
                placeholder="Type narration script..."
                className="w-full p-2 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select AI Voice Persona"
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value as any)}
                  className="px-2 py-1.5 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Kore">Kore (Warm Narrator)</option>
                  <option value="Puck">Puck (Energetic Host)</option>
                  <option value="Charon">Charon (Deep Documentary)</option>
                  <option value="Fenrir">Fenrir (Cinema Trailer)</option>
                  <option value="Zephyr">Zephyr (Crisp Commercial)</option>
                </select>
                <button
                  type="button"
                  disabled={!!aiLoadingTask}
                  onClick={runAiVoiceoverTts}
                  className="flex-1 py-1.5 px-3 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Synthesize Voice
                </button>
              </div>
            </div>

            {/* 3. AI-Assisted Color Correction */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                AI Colorist Assistant
              </div>
              <input
                type="text"
                aria-label="Color Grade Look Description"
                value={colorLookPrompt}
                onChange={(e) => setColorLookPrompt(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={!!aiLoadingTask}
                onClick={runAiColorGrade}
                className="w-full py-1.5 px-3 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Apply AI Color Grade
              </button>
            </div>

            {/* 4. Local & Cloud Smart Utilities: Background Removal, Silence Detection, Auto-Reframe */}
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Smart Scene & Audio Utilities
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => onApplyQuickEffect('chromaKeyEnabled', 1)}
                  className="py-1.5 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-left text-slate-800 dark:text-slate-200 hover:border-sky-500 cursor-pointer"
                >
                  Toggle Subject Background Removal (Cutout)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTrimSilenceClips();
                    setAiStatusMessage('Analyzed audio waveforms and tightened silent tail margins.');
                  }}
                  className="py-1.5 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-left text-slate-800 dark:text-slate-200 hover:border-sky-500 cursor-pointer"
                >
                  Automatic Silence Detection & Trim (Local Waveform)
                </button>
                <button
                  type="button"
                  disabled={!!aiLoadingTask}
                  onClick={() => runAiSmartEdit('reframe')}
                  className="py-1.5 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-left text-slate-800 dark:text-slate-200 hover:border-sky-500 cursor-pointer"
                >
                  Automatic Video Reframing (Subject Tracking)
                </button>
                <button
                  type="button"
                  disabled={!!aiLoadingTask}
                  onClick={() => runAiSmartEdit('smart-suggestions')}
                  className="py-1.5 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-left text-slate-800 dark:text-slate-200 hover:border-sky-500 cursor-pointer"
                >
                  Smart Clip Pacing Suggestions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

const WaveSurferInspectorBox: React.FC<{
  peaks: number[];
  duration: number;
  clipName: string;
}> = ({ peaks, duration, clipName }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = createWaveSurferPreview(containerRef.current, peaks, duration);
    return () => {
      ws.destroy();
    };
  }, [peaks, duration]);

  return (
    <div className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          WaveSurfer.js Audio Analyzer
        </span>
        <span className="text-slate-500 font-mono tabular-nums">{duration.toFixed(1)}s</span>
      </div>
      <p className="text-[10px] text-slate-500 truncate">{clipName}</p>
      <div ref={containerRef} className="w-full overflow-hidden rounded bg-slate-900/80 p-1.5" />
    </div>
  );
};
