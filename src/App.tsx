/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AspectRatioKey,
  ColorAdjustments,
  MediaAsset,
  TimelineClip,
  Track,
  TrackType,
  TransitionType,
  VideoProject,
} from './types/editor';
import { createStarterProject } from './data/defaultCatalog';
import {
  applyMagneticRipple,
  calculateTimelineDuration,
  createDefaultAudio,
  createDefaultColor,
  createDefaultEffects,
  createDefaultTransform,
  createDefaultTransition,
  createHistoryStack,
  detectBeatMarkers,
  duplicateClipInTrack,
  HistoryStack,
  mergeAdjacentClips,
  pushHistoryState,
  redoHistoryState,
  splitClipAtTime,
  trimClipBounds,
  undoHistoryState,
} from './engine/timelineLogic';
import {
  fetchProjectById,
  fetchProjectsList,
  persistProjectEverywhere,
  ProjectSummary,
  saveMediaBlobToIndexedDB,
} from './utils/localDb';
import { audioEngine } from './engine/audioEngine';
import { TopHeader } from './components/TopHeader';
import { LeftDockPanel, LeftDockTab } from './components/LeftDockPanel';
import { CanvasPreview } from './components/CanvasPreview';
import { InspectorPanel } from './components/InspectorPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import {
  CustomizedTemplatePayload,
  TemplateLibraryModal,
} from './components/TemplateLibraryModal';

export default function App() {
  const [history, setHistory] = useState<HistoryStack<VideoProject>>(() =>
    createHistoryStack(createStarterProject())
  );
  const project = history.present;

  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip-v1-drive');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('folder-all');
  const [leftDockTab, setLeftDockTab] = useState<LeftDockTab>('media');
  const [activeNavSection, setActiveNavSection] = useState<
    'workspace' | 'projects' | 'templates' | 'ai-studio' | 'shortcuts'
  >('workspace');

  // Playback & Transport State
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);
  const playheadRef = useRef<number>(0);
  playheadRef.current = playheadTime;

  // Workspace Customization & Theme
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [workspaceLayout, setWorkspaceLayout] = useState<
    'standard' | 'wide-preview' | 'timeline-focus'
  >('standard');
  const [mobilePanel, setMobilePanel] = useState<'preview' | 'media' | 'timeline' | 'inspector'>('preview');

  // Modals & Database Sync Status
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineDuration = calculateTimelineDuration(project.clips);
  const selectedClip = project.clips.find((c) => c.id === selectedClipId) || null;

  // Toggle dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial load from Express Database + IndexedDB
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const listData = await fetchProjectsList();
        if (!mounted) return;
        setProjectsList(listData.projects);
        if (listData.lastActiveProjectId) {
          const loaded = await fetchProjectById(listData.lastActiveProjectId);
          if (mounted && loaded) {
            setHistory(createHistoryStack(loaded));
            setLastSavedAt(loaded.updatedAt);
          }
        }
      } catch {
        // Fallback already initialized with starter project
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-save debounced to database + IndexedDB whenever project state changes
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        const savedAt = await persistProjectEverywhere(project);
        setLastSavedAt(savedAt);
        const listData = await fetchProjectsList();
        setProjectsList(listData.projects);
      } catch {
        // Ignore transient offline error
      } finally {
        setIsSaving(false);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [project]);

  const commitProjectChange = useCallback(
    (updater: (prev: VideoProject) => VideoProject) => {
      setHistory((prevStack) => {
        const nextProj = updater(prevStack.present);
        return pushHistoryState(prevStack, {
          ...nextProj,
          updatedAt: new Date().toISOString(),
        });
      });
    },
    []
  );

  // Playback 60fps loop
  useEffect(() => {
    if (!isPlaying) {
      audioEngine.stopAllHtmlAudio();
      return;
    }
    let lastTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      let nextTime = playheadRef.current + dt;
      if (nextTime >= timelineDuration) {
        if (loopPlayback) {
          nextTime = 0;
        } else {
          nextTime = timelineDuration;
          setIsPlaying(false);
        }
      }
      playheadRef.current = nextTime;
      setPlayheadTime(nextTime);
      audioEngine.syncPlaybackTick(nextTime, true, project.clips, project.tracks);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, loopPlayback, timelineDuration, project.clips, project.tracks]);

  // Core Editing Operations
  const handleSplitAtPlayhead = useCallback(() => {
    const targetClip =
      selectedClip &&
      playheadRef.current > selectedClip.startTime + 0.15 &&
      playheadRef.current < selectedClip.startTime + selectedClip.duration - 0.15
        ? selectedClip
        : project.clips.find(
            (c) =>
              playheadRef.current > c.startTime + 0.15 &&
              playheadRef.current < c.startTime + c.duration - 0.15
          );

    if (!targetClip) return;
    commitProjectChange((prev) => ({
      ...prev,
      clips: splitClipAtTime(prev.clips, targetClip.id, playheadRef.current),
    }));
  }, [selectedClip, project.clips, commitProjectChange]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedClipId) return;
    commitProjectChange((prev) => ({
      ...prev,
      clips: duplicateClipInTrack(prev.clips, selectedClipId),
    }));
  }, [selectedClipId, commitProjectChange]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedClipId) return;
    commitProjectChange((prev) => {
      const target = prev.clips.find((c) => c.id === selectedClipId);
      const remaining = prev.clips.filter((c) => c.id !== selectedClipId);
      const finalClips =
        prev.magneticTimeline && target
          ? applyMagneticRipple(remaining, target.trackId)
          : remaining;
      return { ...prev, clips: finalClips };
    });
    setSelectedClipId(null);
  }, [selectedClipId, commitProjectChange]);

  const handleMergeAdjacent = useCallback(() => {
    if (!selectedClip) return;
    const sameTrack = project.clips
      .filter((c) => c.trackId === selectedClip.trackId)
      .sort((a, b) => a.startTime - b.startTime);
    const idx = sameTrack.findIndex((c) => c.id === selectedClip.id);
    const neighbor = sameTrack[idx + 1] || sameTrack[idx - 1];
    if (!neighbor) return;

    commitProjectChange((prev) => ({
      ...prev,
      clips: mergeAdjacentClips(prev.clips, selectedClip.id, neighbor.id),
    }));
  }, [selectedClip, project.clips, commitProjectChange]);

  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const savedAt = await persistProjectEverywhere(project);
      setLastSavedAt(savedAt);
      const listData = await fetchProjectsList();
      setProjectsList(listData.projects);
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 's' || e.key === 'S') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleManualSave();
        } else {
          e.preventDefault();
          handleSplitAtPlayhead();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setHistory((st) => undoHistoryState(st));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setHistory((st) => redoHistoryState(st));
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleMergeAdjacent();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlayheadTime((t) => Math.max(0, Number((t - 1 / 30).toFixed(3))));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlayheadTime((t) => Math.min(timelineDuration, Number((t + 1 / 30).toFixed(3))));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSplitAtPlayhead,
    handleDuplicateSelected,
    handleMergeAdjacent,
    handleDeleteSelected,
    handleManualSave,
    timelineDuration,
  ]);

  // Navigation Bar Handler
  const handleSelectNavSection = (
    section: 'workspace' | 'projects' | 'templates' | 'ai-studio' | 'shortcuts'
  ) => {
    setActiveNavSection(section);
    if (section === 'projects') {
      setIsProjectModalOpen(true);
    } else if (section === 'templates') {
      setLeftDockTab('templates');
      setMobilePanel('media');
      setIsTemplateModalOpen(true);
    } else if (section === 'ai-studio') {
      setLeftDockTab('ai');
      setMobilePanel('media');
    } else if (section === 'shortcuts') {
      setIsShortcutsModalOpen(true);
    }
  };

  // Customized Open-Source Template Insertion Handler
  const handleApplyCustomizedTemplate = (payload: CustomizedTemplatePayload) => {
    commitProjectChange((prev) => {
      const insertTime = Number(playheadRef.current.toFixed(2));
      const newClips: TimelineClip[] = [];
      const tpl = payload.template;
      const chosenAsset =
        payload.selectedMediaAssetId !== 'default' &&
        payload.selectedMediaAssetId !== 'custom-upload'
          ? prev.assets.find((a) => a.id === payload.selectedMediaAssetId)
          : undefined;

      // If not a transparent lower-third or if user chose custom footage/backdrop, add footage clip on V2 Overlay or V1
      if (tpl.category !== 'lower-thirds' || payload.uploadedCustomBlobUrl || chosenAsset) {
        const videoTrack =
          prev.tracks.find((t) => t.id === 'track-v2') ||
          prev.tracks.find((t) => t.type === 'video') ||
          prev.tracks[0];
        const bgClip: TimelineClip = {
          id: `clip_tpl_bg_${Date.now()}`,
          assetId: chosenAsset?.id || 'asset-intro-kinetic',
          trackId: videoTrack.id,
          name: `${tpl.name} (Backdrop)`,
          type: videoTrack.type,
          startTime: insertTime,
          duration: payload.duration,
          sourceOffset: 0,
          speed: 1,
          reversed: false,
          freezeFrame: false,
          proceduralScene: payload.uploadedCustomBlobUrl
            ? undefined
            : chosenAsset?.proceduralScene || tpl.defaultProceduralScene,
          blobUrl: payload.uploadedCustomBlobUrl || chosenAsset?.blobUrl,
          transform: createDefaultTransform(),
          color: createDefaultColor(),
          effects: createDefaultEffects(),
          transition: {
            inType: insertTime === 0 ? 'none' : 'fade',
            inDuration: 0.35,
            outType: 'fade',
            outDuration: 0.35,
          },
          audio: { ...createDefaultAudio(), muted: true },
        };
        newClips.push(bgClip);
      }

      const variantMap: Record<
        string,
        'lower-third' | 'intro-banner' | 'outro-card' | 'kinetic-title'
      > = {
        'lower-thirds': 'lower-third',
        intros: 'intro-banner',
        outros: 'outro-card',
        'animated-titles': 'kinetic-title',
        'social-media': 'kinetic-title',
      };
      const resolvedVariant = variantMap[tpl.category] || 'kinetic-title';

      const textTrack = prev.tracks.find((t) => t.type === 'text') || prev.tracks[0];
      const titleClip: TimelineClip = {
        id: `clip_tpl_txt_${Date.now()}`,
        assetId: 'asset-intro-kinetic',
        trackId: textTrack.id,
        name: `${tpl.name}: ${payload.headline.slice(0, 18)}`,
        type: 'text',
        startTime: insertTime,
        duration: payload.duration,
        sourceOffset: 0,
        speed: 1,
        reversed: false,
        freezeFrame: false,
        transform: {
          ...createDefaultTransform(),
          x: tpl.defaultXOffset ?? 0,
          y: tpl.defaultYOffset ?? 0,
        },
        color: createDefaultColor(),
        effects: createDefaultEffects(),
        transition: {
          inType: insertTime === 0 ? 'none' : 'fade',
          inDuration: 0.25,
          outType: 'fade',
          outDuration: 0.25,
        },
        audio: { ...createDefaultAudio(), muted: true },
        textStyle: {
          text: payload.headline,
          subtext: payload.subtext || undefined,
          fontFamily: payload.fontFamily,
          fontSize: payload.fontSize,
          color: payload.textColor,
          bold: true,
          italic: false,
          align: resolvedVariant === 'lower-third' ? 'left' : 'center',
          letterSpacing: 1.2,
          lineHeight: 1.2,
          outlineColor: '#000000',
          outlineWidth: 0,
          shadowColor: '#000000',
          shadowBlur: 14,
          bgColor: payload.accentColor,
          bgOpacity: payload.bgOpacity,
          templateVariant: resolvedVariant,
          entranceAnim: insertTime === 0 ? 'none' : payload.entranceAnim,
          exitAnim: 'fade-up',
        },
      };
      newClips.push(titleClip);
      setSelectedClipId(titleClip.id);

      return {
        ...prev,
        aspectRatio: payload.replaceAspectRatio ? payload.aspectRatio : prev.aspectRatio,
        clips: [...prev.clips, ...newClips],
      };
    });
  };

  // Media Importing & Timeline Insertion Handlers
  const handleImportFiles = async (files: FileList) => {
    const newAssets: MediaAsset[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const assetId = `asset_${Date.now()}_${i}`;
      await saveMediaBlobToIndexedDB(assetId, file);
      const blobUrl = URL.createObjectURL(file);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

      newAssets.push({
        id: assetId,
        name: file.name.replace(/\.[^.]+$/, ''),
        category: isAudio ? 'audio' : isImage ? 'image' : 'video',
        folderId: selectedFolderId === 'folder-all' ? 'folder-footage' : selectedFolderId,
        duration: isImage ? 4.5 : 6.0,
        width: isAudio ? undefined : 1920,
        height: isAudio ? undefined : 1080,
        blobUrl,
        mimeType: file.type,
        fileSize: file.size,
        licenseType: 'built-in',
        waveform: [0.35, 0.65, 0.5, 0.8, 0.6, 0.72, 0.45, 0.55, 0.68, 0.4],
      });
    }

    commitProjectChange((prev) => ({
      ...prev,
      assets: [...newAssets, ...prev.assets],
    }));
  };

  const handleAddAssetToTimeline = (asset: MediaAsset, asOverlay = false) => {
    commitProjectChange((prev) => {
      const targetTrackType: TrackType = asOverlay
        ? 'overlay'
        : asset.category === 'audio' || asset.category === 'sfx'
          ? 'audio'
          : asset.category === 'sticker' || asset.category === 'shape'
            ? 'overlay'
            : 'video';

      const targetTrack =
        prev.tracks.find((t) => t.type === targetTrackType) || prev.tracks[0];
      const trackClips = prev.clips.filter((c) => c.trackId === targetTrack.id);
      const appendTime = asOverlay
        ? playheadRef.current
        : trackClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);

      const newClip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        assetId: asset.id,
        trackId: targetTrack.id,
        name: asset.name,
        type: targetTrack.type,
        startTime: Number(appendTime.toFixed(2)),
        duration: asset.duration,
        sourceOffset: 0,
        speed: 1,
        reversed: false,
        freezeFrame: false,
        proceduralScene: asset.proceduralScene,
        audioSynthPreset: asset.audioSynthPreset,
        blobUrl: asset.blobUrl,
        waveform: asset.waveform,
        transform: asOverlay
          ? { ...createDefaultTransform(), x: 28, y: -24, scale: 38, pipPreset: 'top-right' }
          : createDefaultTransform(),
        color: createDefaultColor(),
        effects: createDefaultEffects(),
        transition: createDefaultTransition(),
        audio: createDefaultAudio(),
      };

      setSelectedClipId(newClip.id);
      return {
        ...prev,
        clips: [...prev.clips, newClip],
      };
    });
  };

  const handleAddTextPreset = (preset: {
    name: string;
    text: string;
    subtext?: string;
    variant: 'standard' | 'lower-third' | 'kinetic-title' | 'subtitle-pill' | 'intro-banner' | 'outro-card';
    fontSize: number;
    bgColor: string;
    bgOpacity: number;
    yOffset: number;
  }) => {
    commitProjectChange((prev) => {
      const textTrack = prev.tracks.find((t) => t.type === 'text') || prev.tracks[0];
      const newClip: TimelineClip = {
        id: `clip_text_${Date.now()}`,
        assetId: 'asset-intro-kinetic',
        trackId: textTrack.id,
        name: preset.name,
        type: 'text',
        startTime: Number(playheadRef.current.toFixed(2)),
        duration: 4.0,
        sourceOffset: 0,
        speed: 1,
        reversed: false,
        freezeFrame: false,
        transform: { ...createDefaultTransform(), x: 0, y: preset.yOffset },
        color: createDefaultColor(),
        effects: createDefaultEffects(),
        transition: { inType: 'fade', inDuration: 0.3, outType: 'fade', outDuration: 0.3 },
        audio: { ...createDefaultAudio(), muted: true },
        textStyle: {
          text: preset.text,
          subtext: preset.subtext,
          fontFamily: 'Plus Jakarta Sans',
          fontSize: preset.fontSize,
          color: '#FFFFFF',
          bold: true,
          italic: false,
          align: preset.variant === 'lower-third' ? 'left' : 'center',
          letterSpacing: 1,
          lineHeight: 1.2,
          outlineColor: '#000000',
          outlineWidth: 0,
          shadowColor: '#000000',
          shadowBlur: 12,
          bgColor: preset.bgColor,
          bgOpacity: preset.bgOpacity,
          templateVariant: preset.variant,
          entranceAnim: preset.variant === 'lower-third' ? 'slide-lower-third' : 'fade-up',
          exitAnim: 'fade-up',
        },
      };
      setSelectedClipId(newClip.id);
      return {
        ...prev,
        clips: [...prev.clips, newClip],
      };
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top Bar + Workspace Utility Bar */}
      <TopHeader
        projectName={project.name}
        activeNavSection={activeNavSection}
        onSelectNavSection={handleSelectNavSection}
        onOpenExport={() => setIsExportModalOpen(true)}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => setHistory((s) => undoHistoryState(s))}
        onRedo={() => setHistory((s) => redoHistoryState(s))}
        aspectRatio={project.aspectRatio}
        onChangeAspectRatio={(ratio) =>
          commitProjectChange((p) => ({ ...p, aspectRatio: ratio }))
        }
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onManualSave={handleManualSave}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        workspaceLayout={workspaceLayout}
        onChangeWorkspaceLayout={setWorkspaceLayout}
        onRenameProject={(newName) =>
          commitProjectChange((p) => ({ ...p, name: newName }))
        }
      />

      {/* Mobile CapCut / InShot Section Switcher (Visible on screens < 768px) */}
      <div className="flex md:hidden items-center justify-around bg-white dark:bg-[#12141C] border-b border-slate-200 dark:border-[#232734] py-1.5 px-2 text-xs font-medium shrink-0">
        {(
          [
            { id: 'preview', label: 'Player' },
            { id: 'media', label: 'Media & AI' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'inspector', label: 'Adjust' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMobilePanel(m.id)}
            className={`px-3 py-1 rounded ${
              mobilePanel === m.id
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Upper Editor Area: Left Library Dock + Center Program Monitor + Right Properties Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Dock Panel */}
        <div
          className={`${
            mobilePanel === 'media' ? 'flex w-full md:w-auto' : 'hidden'
          } ${workspaceLayout === 'wide-preview' ? 'md:hidden lg:flex' : 'md:flex'}`}
        >
          <LeftDockPanel
            activeTab={leftDockTab}
            onSelectTab={setLeftDockTab}
            assets={project.assets}
            folders={project.folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onCreateFolder={(folderName) =>
              commitProjectChange((prev) => ({
                ...prev,
                folders: [
                  ...prev.folders,
                  {
                    id: `folder_${Date.now()}`,
                    name: folderName,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }))
            }
            onImportFiles={handleImportFiles}
            onAddAssetToTimeline={handleAddAssetToTimeline}
            onAddTextPreset={handleAddTextPreset}
            onOpenTemplateCustomizer={() => setIsTemplateModalOpen(true)}
            onApplyQuickEffect={(effectKey, val) => {
              const target =
                selectedClip ||
                project.clips.find(
                  (c) =>
                    playheadRef.current >= c.startTime &&
                    playheadRef.current <= c.startTime + c.duration
                ) ||
                project.clips[0];
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) => {
                  if (c.id !== target.id) return c;
                  if (effectKey === 'reset') {
                    return { ...c, effects: createDefaultEffects() };
                  }
                  if (effectKey === 'chromaKeyEnabled') {
                    return {
                      ...c,
                      effects: { ...c.effects, chromaKeyEnabled: !c.effects.chromaKeyEnabled },
                    };
                  }
                  return {
                    ...c,
                    effects: { ...c.effects, [effectKey]: val },
                  };
                }),
              }));
            }}
            onApplyQuickTransition={(type: TransitionType, duration: number) => {
              const target = selectedClip || project.clips[0];
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id
                    ? {
                        ...c,
                        transition: {
                          inType: type,
                          inDuration: duration,
                          outType: type,
                          outDuration: duration,
                        },
                      }
                    : c
                ),
              }));
            }}
            onInsertRecordedVoiceover={(name, duration, blobUrl) => {
              commitProjectChange((prev) => {
                const voiceTrack =
                  prev.tracks.find((t) => t.id === 'track-a1') ||
                  prev.tracks.find((t) => t.type === 'audio') ||
                  prev.tracks[0];
                const newClip: TimelineClip = {
                  id: `clip_vo_${Date.now()}`,
                  assetId: 'asset-studio-interview',
                  trackId: voiceTrack.id,
                  name,
                  type: 'audio',
                  startTime: Number(playheadRef.current.toFixed(2)),
                  duration,
                  sourceOffset: 0,
                  speed: 1,
                  reversed: false,
                  freezeFrame: false,
                  audioSynthPreset: blobUrl ? undefined : 'voiceover_demo',
                  blobUrl,
                  waveform: [0.6, 0.85, 0.5, 0.92, 0.7, 0.4, 0.88, 0.75, 0.62, 0.8],
                  transform: createDefaultTransform(),
                  color: createDefaultColor(),
                  effects: createDefaultEffects(),
                  transition: createDefaultTransition(),
                  audio: { ...createDefaultAudio(), volume: 115, voiceEnhance: true },
                };
                setSelectedClipId(newClip.id);
                return {
                  ...prev,
                  clips: [...prev.clips, newClip],
                };
              });
            }}
            onSyncBeats={(bpm) =>
              commitProjectChange((prev) => ({
                ...prev,
                beatMarkers: detectBeatMarkers(bpm, calculateTimelineDuration(prev.clips), 0),
              }))
            }
            onApplyGeneratedSubtitles={(cues) => {
              commitProjectChange((prev) => {
                const textTrack = prev.tracks.find((t) => t.type === 'text') || prev.tracks[0];
                const subClips: TimelineClip[] = cues.map((cue, idx) => ({
                  id: `clip_sub_${Date.now()}_${idx}`,
                  assetId: 'asset-intro-kinetic',
                  trackId: textTrack.id,
                  name: `Subtitle: ${cue.text.slice(0, 22)}`,
                  type: 'text',
                  startTime: Number(cue.startTime.toFixed(2)),
                  duration: Math.max(1.2, Number((cue.endTime - cue.startTime).toFixed(2))),
                  sourceOffset: 0,
                  speed: 1,
                  reversed: false,
                  freezeFrame: false,
                  transform: { ...createDefaultTransform(), x: 0, y: 36 },
                  color: createDefaultColor(),
                  effects: createDefaultEffects(),
                  transition: { inType: 'fade', inDuration: 0.15, outType: 'fade', outDuration: 0.15 },
                  audio: { ...createDefaultAudio(), muted: true },
                  textStyle: {
                    text: cue.text,
                    fontFamily: 'DM Sans',
                    fontSize: 30,
                    color: '#FFFFFF',
                    bold: true,
                    italic: false,
                    align: 'center',
                    letterSpacing: 0.5,
                    lineHeight: 1.2,
                    outlineColor: '#000000',
                    outlineWidth: 2,
                    shadowColor: '#000000',
                    shadowBlur: 8,
                    bgColor: '#090D16',
                    bgOpacity: 82,
                    templateVariant: 'subtitle-pill',
                    entranceAnim: 'fade-up',
                    exitAnim: 'none',
                  },
                }));
                return {
                  ...prev,
                  clips: [...prev.clips, ...subClips],
                };
              });
            }}
            onApplyAiColorGrade={(grade) => {
              const target = selectedClip || project.clips.find((c) => c.type === 'video');
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id
                    ? {
                        ...c,
                        color: {
                          ...c.color,
                          brightness: grade.brightness ?? c.color.brightness,
                          contrast: grade.contrast ?? c.color.contrast,
                          saturation: grade.saturation ?? c.color.saturation,
                          temperature: grade.temperature ?? c.color.temperature,
                          tint: grade.tint ?? c.color.tint,
                          highlights: grade.highlights ?? c.color.highlights,
                          shadows: grade.shadows ?? c.color.shadows,
                          exposure: grade.exposure ?? c.color.exposure,
                          hue: grade.hue ?? c.color.hue,
                          sharpen: grade.sharpen ?? c.color.sharpen,
                        },
                        effects: {
                          ...c.effects,
                          vignette: grade.vignette ?? c.effects.vignette,
                          filmGrain: grade.filmGrain ?? c.effects.filmGrain,
                        },
                      }
                    : c
                ),
              }));
            }}
            onApplyAutoReframe={(x, y, scale, targetAspectRatio) => {
              const target =
                (selectedClip?.type === 'video' ? selectedClip : null) ||
                project.clips.find((c) => c.type === 'video');
              if (!target) return;
              setSelectedClipId(target.id);
              commitProjectChange((prev) => ({
                ...prev,
                aspectRatio: targetAspectRatio || prev.aspectRatio,
                clips: prev.clips.map((c) =>
                  c.id === target.id
                    ? { ...c, transform: { ...c.transform, x, y, scale } }
                    : c
                ),
              }));
            }}
            onTrimSilenceClips={() => {
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.type === 'audio' || c.audioSynthPreset === 'voiceover_demo'
                    ? { ...c, duration: Math.max(1.5, Number((c.duration * 0.92).toFixed(2))) }
                    : c
                ),
              }));
            }}
            selectedClip={selectedClip}
            timelineDuration={timelineDuration}
            canvasRef={canvasRef}
            currentAspectRatio={project.aspectRatio}
          />
        </div>

        {/* Center Video Compositor Preview */}
        <div
          className={`${
            mobilePanel === 'preview' ? 'flex flex-1' : 'hidden'
          } md:flex md:flex-1 min-w-0`}
        >
          <CanvasPreview
            aspectRatio={project.aspectRatio}
            customWidth={project.customWidth}
            customHeight={project.customHeight}
            playheadTime={playheadTime}
            timelineDuration={timelineDuration}
            isPlaying={isPlaying}
            loopPlayback={loopPlayback}
            tracks={project.tracks}
            clips={project.clips}
            assets={project.assets}
            selectedClipId={selectedClipId}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onSeek={(t) => {
              setIsPlaying(false);
              setPlayheadTime(t);
            }}
            onStepFrame={(deltaFrames) => {
              setIsPlaying(false);
              setPlayheadTime((t) =>
                Math.max(0, Math.min(timelineDuration, Number((t + deltaFrames / 30).toFixed(3))))
              );
            }}
            onToggleLoop={() => setLoopPlayback((l) => !l)}
            onUpdateClipPosition={(clipId, newX, newY) => {
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === clipId ? { ...c, transform: { ...c.transform, x: newX, y: newY } } : c
                ),
              }));
            }}
            onQuickSplit={handleSplitAtPlayhead}
            onQuickCycleSpeed={() => {
              const target = selectedClip || project.clips[0];
              if (!target) return;
              const speeds = [0.5, 1, 1.5, 2];
              const nextSpeed = speeds[(speeds.indexOf(target.speed) + 1) % speeds.length] || 1.5;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id ? { ...c, speed: nextSpeed } : c
                ),
              }));
            }}
            onQuickCycleRatio={() => {
              const ratios: AspectRatioKey[] = ['16:9', '9:16', '1:1', '4:5'];
              const nextRatio =
                ratios[(ratios.indexOf(project.aspectRatio) + 1) % ratios.length] || '9:16';
              commitProjectChange((prev) => ({ ...prev, aspectRatio: nextRatio }));
            }}
            onQuickFlipH={() => {
              const target = selectedClip || project.clips[0];
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id
                    ? { ...c, transform: { ...c.transform, flipH: !c.transform.flipH } }
                    : c
                ),
              }));
            }}
            onQuickFreeze={() => {
              const target = selectedClip || project.clips[0];
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id
                    ? {
                        ...c,
                        freezeFrame: !c.freezeFrame,
                        freezeTime: c.sourceOffset + c.duration * 0.5,
                      }
                    : c
                ),
              }));
            }}
            onQuickReverse={() => {
              const target = selectedClip || project.clips[0];
              if (!target) return;
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === target.id ? { ...c, reversed: !c.reversed } : c
                ),
              }));
            }}
            onQuickDuplicate={handleDuplicateSelected}
            onQuickDelete={handleDeleteSelected}
            onQuickOpenTemplates={() => setIsTemplateModalOpen(true)}
            onQuickOpenAiReframe={() => {
              setLeftDockTab('ai');
              setMobilePanel('media');
            }}
            canvasRefExternal={canvasRef}
          />
        </div>

        {/* Right Context-Sensitive Properties & Color/Audio Inspector */}
        <div
          className={`${
            mobilePanel === 'inspector' ? 'flex w-full md:w-auto' : 'hidden'
          } ${workspaceLayout === 'wide-preview' ? 'md:hidden xl:flex' : 'md:flex'}`}
        >
          <InspectorPanel
            selectedClip={selectedClip}
            onUpdateClip={(clipId, updater) =>
              commitProjectChange((prev) => ({
                ...prev,
                clips: prev.clips.map((c) => (c.id === clipId ? updater(c) : c)),
              }))
            }
          />
        </div>
      </div>

      {/* Bottom Multi-Track Editing Timeline (Always visible below Player on Mobile & Desktop like CapCut/InShot) */}
      <div
        className={`${
          mobilePanel === 'timeline' || mobilePanel === 'preview' ? 'block' : 'hidden'
        } md:block`}
      >
        <TimelinePanel
          tracks={project.tracks}
          clips={project.clips}
          playheadTime={playheadTime}
          timelineDuration={timelineDuration}
          selectedClipId={selectedClipId}
          magneticTimeline={project.magneticTimeline}
          snappingEnabled={project.snappingEnabled}
          beatMarkers={project.beatMarkers}
          onSeek={(t) => setPlayheadTime(t)}
          onSelectClip={setSelectedClipId}
          onSplitAtPlayhead={handleSplitAtPlayhead}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onMergeAdjacent={handleMergeAdjacent}
          onToggleFreezeSelected={() => {
            if (!selectedClipId) return;
            commitProjectChange((prev) => ({
              ...prev,
              clips: prev.clips.map((c) =>
                c.id === selectedClipId
                  ? { ...c, freezeFrame: !c.freezeFrame, freezeTime: c.sourceOffset + c.duration * 0.5 }
                  : c
              ),
            }));
          }}
          onToggleReverseSelected={() => {
            if (!selectedClipId) return;
            commitProjectChange((prev) => ({
              ...prev,
              clips: prev.clips.map((c) =>
                c.id === selectedClipId ? { ...c, reversed: !c.reversed } : c
              ),
            }));
          }}
          onToggleMagnetic={() =>
            commitProjectChange((prev) => {
              const nextMag = !prev.magneticTimeline;
              let updatedClips = prev.clips;
              if (nextMag) {
                for (const tr of prev.tracks) {
                  updatedClips = applyMagneticRipple(updatedClips, tr.id);
                }
              }
              return { ...prev, magneticTimeline: nextMag, clips: updatedClips };
            })
          }
          onToggleSnapping={() =>
            commitProjectChange((prev) => ({ ...prev, snappingEnabled: !prev.snappingEnabled }))
          }
          onUpdateTrack={(trackId, updater) =>
            commitProjectChange((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t) => (t.id === trackId ? updater(t) : t)),
            }))
          }
          onReorderTrack={(trackId, direction) =>
            commitProjectChange((prev) => {
              const sorted = [...prev.tracks].sort((a, b) => a.order - b.order);
              const idx = sorted.findIndex((t) => t.id === trackId);
              const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
              if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
              const orderA = sorted[idx].order;
              const orderB = sorted[swapIdx].order;
              sorted[idx] = { ...sorted[idx], order: orderB };
              sorted[swapIdx] = { ...sorted[swapIdx], order: orderA };
              return { ...prev, tracks: sorted };
            })
          }
          onAddTrack={(type: TrackType) =>
            commitProjectChange((prev) => {
              const count = prev.tracks.filter((t) => t.type === type).length + 1;
              const maxOrder = prev.tracks.reduce((m, t) => Math.max(m, t.order), 0);
              const newTrack: Track = {
                id: `track_${type}_${Date.now()}`,
                name: `${type === 'video' ? 'V' : type === 'audio' ? 'A' : 'T'}${count} · ${type.toUpperCase()} Track`,
                type,
                locked: false,
                hidden: false,
                muted: false,
                solo: false,
                order: maxOrder + 1,
              };
              return { ...prev, tracks: [...prev.tracks, newTrack] };
            })
          }
          onMoveOrTrimClip={(clipId, newStart, newDur, newTrackId) =>
            commitProjectChange((prev) => ({
              ...prev,
              clips: prev.clips.map((c) => {
                if (c.id !== clipId) return c;
                const trimmed = trimClipBounds(c, newStart, newDur);
                return newTrackId ? { ...trimmed, trackId: newTrackId } : trimmed;
              }),
            }))
          }
          onDropAssetOnTrack={(assetId, trackId, dropTime) => {
            const asset = project.assets.find((a) => a.id === assetId);
            const track = project.tracks.find((t) => t.id === trackId);
            if (!asset || !track) return;
            commitProjectChange((prev) => {
              const newClip: TimelineClip = {
                id: `clip_drop_${Date.now()}`,
                assetId: asset.id,
                trackId: track.id,
                name: asset.name,
                type: track.type,
                startTime: dropTime,
                duration: asset.duration,
                sourceOffset: 0,
                speed: 1,
                reversed: false,
                freezeFrame: false,
                proceduralScene: asset.proceduralScene,
                audioSynthPreset: asset.audioSynthPreset,
                blobUrl: asset.blobUrl,
                waveform: asset.waveform,
                transform: createDefaultTransform(),
                color: createDefaultColor(),
                effects: createDefaultEffects(),
                transition: createDefaultTransition(),
                audio: createDefaultAudio(),
              };
              setSelectedClipId(newClip.id);
              return { ...prev, clips: [...prev.clips, newClip] };
            });
          }}
          onCycleClipTransition={(clipId) => {
            const order: TransitionType[] = ['fade', 'dissolve', 'slide', 'zoom', 'spin'];
            commitProjectChange((prev) => ({
              ...prev,
              clips: prev.clips.map((c) => {
                if (c.id !== clipId) return c;
                const nextType =
                  order[(order.indexOf(c.transition.inType) + 1) % order.length] || 'fade';
                return {
                  ...c,
                  transition: {
                    inType: nextType,
                    inDuration: 0.7,
                    outType: nextType,
                    outDuration: 0.7,
                  },
                };
              }),
            }));
          }}
        />
      </div>

      {/* Modals */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setActiveNavSection('workspace');
        }}
        currentProject={project}
        projectsList={projectsList}
        onCreateNewProject={async (name, ratio) => {
          const fresh = createStarterProject(`proj_${Date.now()}`, name);
          fresh.aspectRatio = ratio;
          setHistory(createHistoryStack(fresh));
          setPlayheadTime(0);
          await persistProjectEverywhere(fresh);
          const listData = await fetchProjectsList();
          setProjectsList(listData.projects);
        }}
        onLoadProject={async (projectId) => {
          const loaded = await fetchProjectById(projectId);
          setHistory(createHistoryStack(loaded));
          setPlayheadTime(0);
          setSelectedClipId(loaded.clips[0]?.id || null);
        }}
        onDuplicateProject={async (projectId) => {
          const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/duplicate`, {
            method: 'POST',
          });
          if (res.ok) {
            const data = await res.json();
            setHistory(createHistoryStack(data.project));
            const listData = await fetchProjectsList();
            setProjectsList(listData.projects);
          }
        }}
        onDeleteProject={async (projectId) => {
          const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            const data = await res.json();
            if (projectId === project.id && data.nextProject) {
              setHistory(createHistoryStack(data.nextProject));
            }
            const listData = await fetchProjectsList();
            setProjectsList(listData.projects);
          }
        }}
        onImportProjectJson={async (imported) => {
          setHistory(createHistoryStack(imported));
          await persistProjectEverywhere(imported);
          const listData = await fetchProjectsList();
          setProjectsList(listData.projects);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={project.name}
        timelineDuration={timelineDuration}
        canvasRef={canvasRef}
        onRenderTickSeek={(t) => {
          setIsPlaying(false);
          setPlayheadTime(t);
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => {
          setIsShortcutsModalOpen(false);
          setActiveNavSection('workspace');
        }}
      />

      <TemplateLibraryModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setActiveNavSection('workspace');
        }}
        projectAssets={project.assets}
        onApplyCustomizedTemplate={handleApplyCustomizedTemplate}
      />
    </div>
  );
}
