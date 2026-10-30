import React from 'react';
import {
  Download,
  FolderOpen,
  Keyboard,
  Moon,
  Redo2,
  Save,
  Sun,
  Undo2,
  LayoutGrid,
  Smartphone,
} from 'lucide-react';
import { AspectRatioKey } from '../types/editor';
import { ASPECT_RATIO_PRESETS } from '../data/defaultCatalog';

interface TopHeaderProps {
  projectName: string;
  activeNavSection: 'workspace' | 'projects' | 'templates' | 'ai-studio' | 'shortcuts';
  onSelectNavSection: (section: 'workspace' | 'projects' | 'templates' | 'ai-studio' | 'shortcuts') => void;
  onOpenExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  aspectRatio: AspectRatioKey;
  onChangeAspectRatio: (ratio: AspectRatioKey) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onManualSave: () => void;
  isSaving: boolean;
  lastSavedAt: string | null;
  workspaceLayout: 'standard' | 'wide-preview' | 'timeline-focus';
  onChangeWorkspaceLayout: (layout: 'standard' | 'wide-preview' | 'timeline-focus') => void;
  onRenameProject: (newName: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  projectName,
  activeNavSection,
  onSelectNavSection,
  onOpenExport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  aspectRatio,
  onChangeAspectRatio,
  darkMode,
  onToggleDarkMode,
  onManualSave,
  isSaving,
  lastSavedAt,
  workspaceLayout,
  onChangeWorkspaceLayout,
  onRenameProject,
}) => {
  return (
    <div className="shrink-0 select-none">
      {/* Primary Top Bar following the strict 1-row, 3-zone contract */}
      <header className="flex items-center justify-between gap-8 px-5 py-2.5 bg-white dark:bg-[#12141C] border-b border-slate-200 dark:border-[#232734]">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            onSelectNavSection('workspace');
          }}
          className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display"
        >
          KineForge Studio
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => onSelectNavSection('workspace')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeNavSection === 'workspace'
                ? 'border-cyan-400 text-slate-900 dark:text-cyan-300 font-semibold'
                : 'border-transparent'
            }`}
          >
            Editor Workspace
          </button>
          <button
            type="button"
            onClick={() => onSelectNavSection('projects')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeNavSection === 'projects'
                ? 'border-cyan-400 text-slate-900 dark:text-cyan-300 font-semibold'
                : 'border-transparent'
            }`}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => onSelectNavSection('templates')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeNavSection === 'templates'
                ? 'border-cyan-400 text-slate-900 dark:text-cyan-300 font-semibold'
                : 'border-transparent'
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => onSelectNavSection('ai-studio')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeNavSection === 'ai-studio'
                ? 'border-cyan-400 text-slate-900 dark:text-cyan-300 font-semibold'
                : 'border-transparent'
            }`}
          >
            AI Tools
          </button>
          <button
            type="button"
            onClick={() => onSelectNavSection('shortcuts')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeNavSection === 'shortcuts'
                ? 'border-cyan-400 text-slate-900 dark:text-cyan-300 font-semibold'
                : 'border-transparent'
            }`}
          >
            Shortcuts
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA Button (CapCut Signature Teal-Cyan Export Button) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenExport}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Video</span>
          </button>
        </div>
      </header>

      {/* Secondary Contextual Workspace Utility Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-slate-100 dark:bg-[#0D0F14] border-b border-slate-200 dark:border-[#232734] text-xs">
        {/* Left: Active Project Title Input & Database Save Control */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onSelectNavSection('projects')}
            title="Open Project Manager"
            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] text-slate-700 dark:text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Manage Projects</span>
            <span className="sm:hidden">Projects</span>
          </button>

          <label htmlFor="project-title-input" className="sr-only">
            Active Project Name
          </label>
          <input
            id="project-title-input"
            type="text"
            value={projectName}
            onChange={(e) => onRenameProject(e.target.value)}
            aria-label="Active Project Name"
            className="px-2 py-1 rounded bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] text-slate-900 dark:text-slate-100 font-medium text-xs min-w-0 flex-1 sm:w-52 truncate focus:outline-none focus:border-cyan-400"
          />

          <button
            type="button"
            onClick={onManualSave}
            aria-label="Save Project"
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] text-slate-700 dark:text-slate-200 hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Save project to database and IndexedDB (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Project'}</span>
            <span className="sm:hidden">{isSaving ? '...' : 'Save'}</span>
          </button>

          {lastSavedAt && (
            <span className="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
              Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Center/Right: Undo/Redo, Aspect Ratio Preset, CapCut/InShot UI Mode Switcher & Theme */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] rounded p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo edit"
              title="Undo (Ctrl+Z)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo edit"
              title="Redo (Ctrl+Y)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Redo</span>
            </button>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] rounded px-2 py-1">
            <label htmlFor="canvas-aspect-select" className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Ratio:
            </label>
            <select
              id="canvas-aspect-select"
              aria-label="Canvas Aspect Ratio"
              value={aspectRatio}
              onChange={(e) => onChangeAspectRatio(e.target.value as AspectRatioKey)}
              className="bg-transparent text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none cursor-pointer"
            >
              {ASPECT_RATIO_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* CapCut Pro vs InShot Touch vs Cinema View Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] rounded p-0.5">
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-400 ml-1.5" />
            {(
              [
                { id: 'standard', label: 'CapCut Pro' },
                { id: 'timeline-focus', label: 'InShot Touch' },
                { id: 'wide-preview', label: 'Cinema View' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeWorkspaceLayout(mode.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceLayout === mode.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode.id === 'timeline-focus' && <Smartphone className="w-3 h-3" />}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSelectNavSection('shortcuts')}
            aria-label="Keyboard Shortcuts"
            title="Keyboard Shortcuts (?)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] text-slate-700 dark:text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Keys</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            title={darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-[#171A24] border border-slate-200 dark:border-[#282D3E] text-slate-700 dark:text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
