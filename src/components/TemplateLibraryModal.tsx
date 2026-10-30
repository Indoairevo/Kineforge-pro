import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Film,
  Layers,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  AspectRatioKey,
  MediaAsset,
  ProceduralSceneId,
  TextAnimationType,
  TextStyleConfig,
} from '../types/editor';
import {
  OPEN_SOURCE_TEMPLATE_LIBRARY,
  TEMPLATE_CATEGORY_TABS,
  TemplateLibraryCategory,
  VideoTemplateItem,
} from '../openSource/templateCatalog';

export interface CustomizedTemplatePayload {
  template: VideoTemplateItem;
  headline: string;
  subtext: string;
  fontFamily: TextStyleConfig['fontFamily'];
  fontSize: number;
  textColor: string;
  accentColor: string;
  bgOpacity: number;
  entranceAnim: TextAnimationType;
  duration: number;
  aspectRatio: AspectRatioKey;
  selectedMediaAssetId: string; // 'default' or user MediaAsset.id
  uploadedCustomBlobUrl?: string;
  uploadedCustomFileName?: string;
  uploadedCustomIsImage?: boolean;
  replaceAspectRatio: boolean;
}

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectAssets: MediaAsset[];
  onApplyCustomizedTemplate: (payload: CustomizedTemplatePayload) => void;
}

export const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  projectAssets,
  onApplyCustomizedTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | TemplateLibraryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<VideoTemplateItem>(
    OPEN_SOURCE_TEMPLATE_LIBRARY[0]
  );

  // Customization Form State
  const [headline, setHeadline] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultHeadline);
  const [subtext, setSubtext] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultSubtext);
  const [fontFamily, setFontFamily] = useState<TextStyleConfig['fontFamily']>(
    OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultFontFamily
  );
  const [fontSize, setFontSize] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultFontSize);
  const [textColor, setTextColor] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultTextColor);
  const [accentColor, setAccentColor] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultAccentColor);
  const [bgOpacity, setBgOpacity] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultBgOpacity);
  const [entranceAnim, setEntranceAnim] = useState<TextAnimationType>(
    OPEN_SOURCE_TEMPLATE_LIBRARY[0].defaultEntranceAnim
  );
  const [duration, setDuration] = useState(OPEN_SOURCE_TEMPLATE_LIBRARY[0].duration);
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string>('default');
  const [replaceAspectRatio, setReplaceAspectRatio] = useState<boolean>(true);

  // User-uploaded custom footage/image for this template
  const [customUploadUrl, setCustomUploadUrl] = useState<string | undefined>(undefined);
  const [customUploadName, setCustomUploadName] = useState<string | undefined>(undefined);
  const [customUploadIsImage, setCustomUploadIsImage] = useState<boolean>(false);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplateCard = (tpl: VideoTemplateItem) => {
    setActiveTemplate(tpl);
    setHeadline(tpl.defaultHeadline);
    setSubtext(tpl.defaultSubtext);
    setFontFamily(tpl.defaultFontFamily);
    setFontSize(tpl.defaultFontSize);
    setTextColor(tpl.defaultTextColor);
    setAccentColor(tpl.defaultAccentColor);
    setBgOpacity(tpl.defaultBgOpacity);
    setEntranceAnim(tpl.defaultEntranceAnim);
    setDuration(tpl.duration);
    setSelectedMediaAssetId('default');
    setCustomUploadUrl(undefined);
    setCustomUploadName(undefined);
  };

  const handleCustomMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomUploadUrl(url);
    setCustomUploadName(file.name);
    setCustomUploadIsImage(file.type.startsWith('image/'));
    setSelectedMediaAssetId('custom-upload');
    e.target.value = '';
  };

  const filteredTemplates = OPEN_SOURCE_TEMPLATE_LIBRARY.filter((tpl) => {
    const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const videoAndImageAssets = projectAssets.filter(
    (a) => a.category === 'video' || a.category === 'image' || a.category === 'background'
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-library-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-5 select-none"
    >
      <div className="w-full max-w-5xl rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-sky-500" />
            <h2
              id="template-library-modal-title"
              className="text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              Open-Source Template Library & Customizer Studio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Template Library"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Tabs + Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TEMPLATE_CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            aria-label="Search templates"
            placeholder="Search intros, outros, lower thirds, social..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Split Body: Left Template Grid + Right Live Template Customizer */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Categorized Template Cards */}
          <div className="lg:col-span-7 p-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredTemplates.map((tpl) => {
                const isSelected = tpl.id === activeTemplate.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplateCard(tpl)}
                    className={`p-3.5 rounded border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 hover:border-slate-400 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {tpl.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>

                    {/* Clean Unboxed Metadata */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>
                        {tpl.categoryLabel} · {tpl.aspectRatio} · {tpl.duration.toFixed(1)}s
                      </span>
                      <span className="text-sky-600 dark:text-sky-400 font-sans font-medium">
                        Customize
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Template Customizer */}
          <div className="lg:col-span-5 p-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between gap-4 text-xs">
            <div className="space-y-3.5">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                  {activeTemplate.categoryLabel} · {activeTemplate.sourceRepo}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Customize: {activeTemplate.name}
                </h3>
              </div>

              {/* Live Visual Preview Card of Customized Text & Colors */}
              <div
                className="p-4 rounded border border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-center min-h-28 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #090D16 0%, #1E293B 100%)',
                }}
              >
                <div
                  className="px-4 py-2.5 rounded shadow-md max-w-full"
                  style={{
                    backgroundColor: accentColor,
                    opacity: Math.max(0.25, bgOpacity / 100),
                  }}
                >
                  <p
                    className="font-bold truncate"
                    style={{
                      color: textColor,
                      fontFamily: `"${fontFamily}", sans-serif`,
                      fontSize: `${Math.min(20, Math.max(13, Math.round(fontSize * 0.34)))}px`,
                    }}
                  >
                    {headline || 'CUSTOM HEADLINE'}
                  </p>
                  {subtext && (
                    <p className="text-[10px] text-slate-200 mt-0.5 truncate">{subtext}</p>
                  )}
                </div>
                <span className="absolute bottom-1.5 right-2 text-[10px] font-mono text-slate-400">
                  {activeTemplate.aspectRatio} · {duration.toFixed(1)}s
                </span>
              </div>

              {/* 1. User-Provided Text Controls */}
              <div className="space-y-2">
                <div>
                  <label
                    htmlFor="tpl-custom-headline"
                    className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    Custom Headline Text
                  </label>
                  <input
                    id="tpl-custom-headline"
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tpl-custom-subtext"
                    className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    Custom Subtitle / Kicker Text
                  </label>
                  <input
                    id="tpl-custom-subtext"
                    type="text"
                    value={subtext}
                    onChange={(e) => setSubtext(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* 2. User-Provided Footage or Image Replacement */}
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <label
                  htmlFor="tpl-footage-select"
                  className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block"
                >
                  Background Footage or Image
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <select
                    id="tpl-footage-select"
                    value={selectedMediaAssetId}
                    onChange={(e) => setSelectedMediaAssetId(e.target.value)}
                    className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="default">
                      Template Default ({activeTemplate.defaultProceduralScene})
                    </option>
                    {customUploadName && (
                      <option value="custom-upload">Uploaded: {customUploadName}</option>
                    )}
                    {videoAndImageAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        Project Media: {asset.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => customFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:border-sky-500 text-slate-800 dark:text-slate-200 font-medium shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                  <input
                    ref={customFileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    onChange={handleCustomMediaUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 3. Typography, Colors & Duration */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Font Family</label>
                  <select
                    aria-label="Template Font Family"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Oswald">Oswald</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Entrance Motion</label>
                  <select
                    aria-label="Template Entrance Animation"
                    value={entranceAnim}
                    onChange={(e) => setEntranceAnim(e.target.value as TextAnimationType)}
                    className="w-full px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <option value="fade-up">Fade Up</option>
                    <option value="pop-bounce">Pop Scale</option>
                    <option value="typewriter">Typewriter</option>
                    <option value="slide-lower-third">Slide Lower Third</option>
                    <option value="none">Static</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Text Color</label>
                  <input
                    type="color"
                    aria-label="Template Text Color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-7 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Brand Accent</label>
                  <input
                    type="color"
                    aria-label="Template Brand Accent Color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full h-7 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Duration (s)</label>
                  <input
                    type="number"
                    aria-label="Template Duration"
                    min={1.5}
                    max={15}
                    step={0.5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) || 4)}
                    className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceAspectRatio}
                  onChange={(e) => setReplaceAspectRatio(e.target.checked)}
                  className="accent-sky-500"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  Switch canvas aspect ratio to match template ({activeTemplate.aspectRatio})
                </span>
              </label>
            </div>

            {/* Apply Customized Template CTA */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyCustomizedTemplate({
                    template: activeTemplate,
                    headline,
                    subtext,
                    fontFamily,
                    fontSize,
                    textColor,
                    accentColor,
                    bgOpacity,
                    entranceAnim,
                    duration,
                    aspectRatio: activeTemplate.aspectRatio,
                    selectedMediaAssetId,
                    uploadedCustomBlobUrl: customUploadUrl,
                    uploadedCustomFileName: customUploadName,
                    uploadedCustomIsImage: customUploadIsImage,
                    replaceAspectRatio,
                  });
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Apply Customized Template to Timeline</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
