import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause timeline preview' },
    { key: 'S', desc: 'Split selected clip at playhead' },
    { key: 'D', desc: 'Duplicate selected clip on track' },
    { key: 'M', desc: 'Merge selected clip with adjacent clip' },
    { key: 'Delete / Backspace', desc: 'Delete selected clip' },
    { key: 'Left / Right Arrow', desc: 'Step 1 frame backward / forward' },
    { key: 'Ctrl + Z', desc: 'Undo last editing action' },
    { key: 'Ctrl + Y', desc: 'Redo editing action' },
    { key: 'Ctrl + S', desc: 'Save project to database & IndexedDB' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-sky-500" />
            <h2 id="shortcuts-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Shortcuts Modal"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
          {shortcuts.map((item) => (
            <div key={item.key} className="py-2 flex items-center justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
              <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-900 dark:text-slate-100 shrink-0">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
