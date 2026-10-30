import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  X,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import {
  ExportFormat,
  ExportFps,
  ExportResolution,
  ExportSettings,
} from '../types/editor';
import { estimateExportFileSizeMB } from '../engine/timelineLogic';
import {
  getOrLoadFFmpeg,
  renderWithMp4MuxerOrFallback,
} from '../engine/openSourceMediaPipeline';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  timelineDuration: number;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onRenderTickSeek: (time: number) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectName,
  timelineDuration,
  canvasRef,
  onRenderTickSeek,
}) => {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    bitrateMbps: 16,
    audioBitrateKbps: 192,
    qualityPreset: 'high',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeEngineLabel, setActiveEngineLabel] = useState<string>('mp4-muxer + WebCodecs');
  const [exportedBlobUrl, setExportedBlobUrl] = useState<string | null>(null);
  const [exportedExtension, setExportedExtension] = useState<string>('mp4');
  const [exportError, setExportError] = useState<string | null>(null);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>('Idle (FFmpeg.wasm Core Ready on Demand)');
  const cancelFlagRef = useRef(false);

  if (!isOpen) return null;

  const estimatedSizeMB = estimateExportFileSizeMB(
    timelineDuration,
    settings.resolution,
    settings.fps,
    settings.bitrateMbps,
    settings.audioBitrateKbps
  );

  const handleLoadFFmpegCore = async () => {
    setFfmpegStatus('Loading @ffmpeg/ffmpeg WebAssembly core...');
    const res = await getOrLoadFFmpeg((msg) => setFfmpegStatus(msg.slice(0, 60)));
    setFfmpegStatus(
      res.ready
        ? '@ffmpeg/ffmpeg WebAssembly Core Loaded & Active'
        : 'Using Native WebCodecs + mp4-muxer Hardware Engine (Sandbox Mode)'
    );
  };

  const startRealExportRender = async () => {
    setExportError(null);
    setExportedBlobUrl(null);
    setExportProgress(0);
    setIsExporting(true);
    cancelFlagRef.current = false;

    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Program monitor canvas is not mounted.');
      }

      const result = await renderWithMp4MuxerOrFallback(
        canvas,
        timelineDuration,
        settings,
        onRenderTickSeek,
        (pct, engineLabel) => {
          setExportProgress(pct);
          setActiveEngineLabel(engineLabel);
        },
        () => cancelFlagRef.current
      );

      const url = URL.createObjectURL(result.blob);
      setExportedExtension(result.extension);
      setActiveEngineLabel(result.engineUsed);
      setExportedBlobUrl(url);
      setIsExporting(false);
    } catch (err: any) {
      setIsExporting(false);
      if (err?.message === 'EXPORT_CANCELLED') {
        setExportProgress(0);
        return;
      }
      setExportError(err?.message || 'Hardware encoder interrupted during export.');
    }
  };

  const handleCancelExport = () => {
    cancelFlagRef.current = true;
    setIsExporting(false);
    setExportProgress(0);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-sky-500" />
            <h2 id="export-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Export & Render Master Video
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Export Modal"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Format & Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Container Format</label>
              <select
                aria-label="Export Format"
                disabled={isExporting}
                value={settings.format}
                onChange={(e) => setSettings((s) => ({ ...s, format: e.target.value as ExportFormat }))}
                className="w-full px-3 py-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="mp4">MP4 (H.264 / WebCodecs)</option>
                <option value="mov">MOV (QuickTime Production)</option>
                <option value="webm">WebM (VP9 Open Media)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Resolution</label>
              <select
                aria-label="Export Resolution"
                disabled={isExporting}
                value={settings.resolution}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, resolution: e.target.value as ExportResolution }))
                }
                className="w-full px-3 py-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="480p">480p SD (854×480)</option>
                <option value="720p">720p HD (1280×720)</option>
                <option value="1080p">1080p Full HD (1920×1080)</option>
                <option value="4K">4K UHD (3840×2160)</option>
              </select>
            </div>
          </div>

          {/* Frame Rate & Audio Quality */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Frame Rate (FPS)</label>
              <select
                aria-label="Export Frame Rate"
                disabled={isExporting}
                value={settings.fps}
                onChange={(e) => setSettings((s) => ({ ...s, fps: Number(e.target.value) as ExportFps }))}
                className="w-full px-3 py-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              >
                <option value={24}>24 FPS (Cinema)</option>
                <option value={25}>25 FPS (PAL Broadcast)</option>
                <option value={30}>30 FPS (Standard Digital)</option>
                <option value={50}>50 FPS (High Motion PAL)</option>
                <option value={60}>60 FPS (Ultra Smooth)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Audio Bitrate (AAC / PCM)</label>
              <select
                aria-label="Audio Quality Bitrate"
                disabled={isExporting}
                value={settings.audioBitrateKbps}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    audioBitrateKbps: Number(e.target.value) as 128 | 192 | 320,
                  }))
                }
                className="w-full px-3 py-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              >
                <option value={128}>128 kbps (Standard Stereo)</option>
                <option value={192}>192 kbps (Broadcast Stereo)</option>
                <option value={320}>320 kbps (Studio Master)</option>
              </select>
            </div>
          </div>

          {/* Video Bitrate Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Target Video Bitrate (Mbps)</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {settings.bitrateMbps} Mbps
              </span>
            </div>
            <input
              type="range"
              aria-label="Target Video Bitrate"
              disabled={isExporting}
              min={4}
              max={45}
              value={settings.bitrateMbps}
              onChange={(e) => setSettings((s) => ({ ...s, bitrateMbps: Number(e.target.value) }))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          {/* Summary Telemetry Strip */}
          <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono tabular-nums">
            <div>
              <span className="text-slate-500 block text-[10px]">DURATION</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {timelineDuration.toFixed(1)}s
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">OUTPUT</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {settings.resolution} @ {settings.fps}fps
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">ESTIMATED FILE SIZE</span>
              <span data-testid="export-estimated-size" className="font-semibold text-sky-600 dark:text-sky-400">
                ~{estimatedSizeMB} MB
              </span>
            </div>
          </div>

          {/* Open-Source Multimedia Pipeline Strip (mp4-muxer + @ffmpeg/ffmpeg) */}
          <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                <Cpu className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>Open-Source Pipeline: mp4-muxer & @ffmpeg/ffmpeg</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {ffmpegStatus}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadFFmpegCore}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:border-sky-500 text-[11px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Init FFmpeg.wasm
            </button>
          </div>

          {/* Progress Bar while Rendering */}
          {isExporting && (
            <div className="space-y-2 p-3 rounded border border-sky-500/40 bg-sky-500/5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Rendering via {activeEngineLabel}...</span>
                </span>
                <span className="font-mono tabular-nums font-bold">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-75"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {exportError && (
            <div className="flex items-center gap-2 p-2.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportedBlobUrl && !isExporting && (
            <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Master video rendered and ready to save to device.</span>
              </div>
              <a
                href={exportedBlobUrl}
                download={`${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${settings.resolution}.${exportedExtension}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Device</span>
              </a>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            {isExporting ? (
              <button
                type="button"
                onClick={handleCancelExport}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                Cancel Export
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={startRealExportRender}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Start Render & Export</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
