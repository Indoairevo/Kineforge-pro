import React, { useRef, useState } from 'react';
import {
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AspectRatioKey, VideoProject } from '../types/editor';
import { ProjectSummary } from '../utils/localDb';
import { ASPECT_RATIO_PRESETS } from '../data/defaultCatalog';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: VideoProject;
  projectsList: ProjectSummary[];
  onCreateNewProject: (name: string, aspectRatio: AspectRatioKey) => void;
  onLoadProject: (projectId: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onImportProjectJson: (project: VideoProject) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  projectsList,
  onCreateNewProject,
  onLoadProject,
  onDuplicateProject,
  onDeleteProject,
  onImportProjectJson,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectRatio, setNewProjectRatio] = useState<AspectRatioKey>('16:9');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadProjectFile = () => {
    const blob = new Blob([JSON.stringify(currentProject, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.kineproj.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as VideoProject;
        if (!parsed.id || !parsed.name || !Array.isArray(parsed.clips) || !Array.isArray(parsed.tracks)) {
          throw new Error('Invalid project file schema.');
        }
        onImportProjectJson(parsed);
        onClose();
      } catch (err: any) {
        setImportError(err?.message || 'Failed to parse project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-500" />
            <h2 id="project-manager-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Project Manager & Database Recovery
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Project Manager"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs">
          {/* Create New Project Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newProjectName.trim()) return;
              onCreateNewProject(newProjectName.trim(), newProjectRatio);
              setNewProjectName('');
              onClose();
            }}
            className="p-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Create New Video Project
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                aria-label="New Project Title"
                placeholder="Enter project title..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="sm:col-span-2 px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
              <select
                aria-label="New Project Aspect Ratio"
                value={newProjectRatio}
                onChange={(e) => setNewProjectRatio(e.target.value as AspectRatioKey)}
                className="px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                {ASPECT_RATIO_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Projects auto-save continuously to the server database and local IndexedDB.
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          </form>

          {/* Editable Project File Export / Import */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded border border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Portable Project File (`.kineproj.json`)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Save an editable project file to your computer or restore from backup.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadProjectFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Project File</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Open Project File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJsonFile}
                className="hidden"
              />
            </div>
          </div>

          {importError && (
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              {importError}
            </div>
          )}

          {/* Saved & Recent Projects List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Saved Projects in Database ({projectsList.length})
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded">
              {projectsList.map((proj) => {
                const isCurrent = proj.id === currentProject.id;
                return (
                  <div
                    key={proj.id}
                    className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {proj.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                            · Active Project
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        <span>Ratio {proj.aspectRatio}</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.clipCount} clips</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {new Date(proj.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            onLoadProject(proj.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(proj.id)}
                        aria-label={`Duplicate ${proj.name}`}
                        title="Duplicate project"
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-500 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {projectsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          aria-label={`Delete ${proj.name}`}
                          title="Delete project"
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:border-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
