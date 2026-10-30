import {
  AspectRatioKey,
  ProceduralSceneId,
  TextAnimationType,
  TextStyleConfig,
} from '../types/editor';

export type TemplateLibraryCategory =
  | 'intros'
  | 'outros'
  | 'animated-titles'
  | 'lower-thirds'
  | 'social-media';

export interface VideoTemplateItem {
  id: string;
  name: string;
  category: TemplateLibraryCategory;
  categoryLabel: string;
  sourceRepo: string;
  aspectRatio: AspectRatioKey;
  duration: number;
  description: string;
  defaultHeadline: string;
  defaultSubtext: string;
  defaultFontFamily: TextStyleConfig['fontFamily'];
  defaultFontSize: number;
  defaultTextColor: string;
  defaultAccentColor: string;
  defaultBgOpacity: number;
  defaultEntranceAnim: TextAnimationType;
  defaultYOffset: number;
  defaultXOffset: number;
  defaultProceduralScene: ProceduralSceneId;
  pipOverlayScene?: ProceduralSceneId;
}

export const TEMPLATE_CATEGORY_TABS: Array<{
  id: 'all' | TemplateLibraryCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Templates' },
  { id: 'intros', label: 'Intros' },
  { id: 'outros', label: 'Outros' },
  { id: 'animated-titles', label: 'Animated Titles' },
  { id: 'lower-thirds', label: 'Lower Thirds' },
  { id: 'social-media', label: 'Social Media Formats' },
];

export const OPEN_SOURCE_TEMPLATE_LIBRARY: VideoTemplateItem[] = [
  // 1. INTROS
  {
    id: 'tpl-intro-kinetic-tech',
    name: 'Kinetic Horizon Opener',
    category: 'intros',
    categoryLabel: 'Intros',
    sourceRepo: 'Remotion / Motionity Open Templates',
    aspectRatio: '16:9',
    duration: 4.5,
    description: 'High-contrast widescreen title sequence with geometric grid backdrop and bold kinetic typography.',
    defaultHeadline: 'NEXT GENERATION VISION',
    defaultSubtext: 'EPISODE 01 · ENGINEERING THE FUTURE',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 56,
    defaultTextColor: '#F8FAFC',
    defaultAccentColor: '#0284C7',
    defaultBgOpacity: 82,
    defaultEntranceAnim: 'pop-bounce',
    defaultYOffset: 0,
    defaultXOffset: 0,
    defaultProceduralScene: 'intro_neon_kinetic',
  },
  {
    id: 'tpl-intro-doc-cinema',
    name: 'Documentary Feature Opener',
    category: 'intros',
    categoryLabel: 'Intros',
    sourceRepo: 'OpenShot / Olive NLE Community',
    aspectRatio: '16:9',
    duration: 5.0,
    description: 'Atmospheric mountain sunrise aerial opener with editorial serif headline.',
    defaultHeadline: 'BEYOND THE SUMMIT',
    defaultSubtext: 'AN ORIGINAL DOCUMENTARY FILM',
    defaultFontFamily: 'Playfair Display',
    defaultFontSize: 54,
    defaultTextColor: '#FEF3C7',
    defaultAccentColor: '#0F172A',
    defaultBgOpacity: 72,
    defaultEntranceAnim: 'fade-up',
    defaultYOffset: -6,
    defaultXOffset: 0,
    defaultProceduralScene: 'alpine_drone_sunrise',
  },
  {
    id: 'tpl-intro-cyber-pulse',
    name: 'Autonomous Night Drive Opener',
    category: 'intros',
    categoryLabel: 'Intros',
    sourceRepo: 'OmniClip Open Templates',
    aspectRatio: '16:9',
    duration: 4.0,
    description: 'Fast-paced urban night drive intro with typewriter telemetry title reveal.',
    defaultHeadline: 'SYSTEM ARCHITECTURES',
    defaultSubtext: 'TOKYO FIELD TEST · 4K RAW',
    defaultFontFamily: 'JetBrains Mono',
    defaultFontSize: 44,
    defaultTextColor: '#38BDF8',
    defaultAccentColor: '#090D16',
    defaultBgOpacity: 86,
    defaultEntranceAnim: 'typewriter',
    defaultYOffset: 18,
    defaultXOffset: 0,
    defaultProceduralScene: 'cyber_city_drive',
  },

  // 2. OUTROS
  {
    id: 'tpl-outro-minimal-endscreen',
    name: 'Dual-Card Subscribe End Screen',
    category: 'outros',
    categoryLabel: 'Outros',
    sourceRepo: 'Remotion / Creator Commons',
    aspectRatio: '16:9',
    duration: 5.0,
    description: 'Clean YouTube end card with picture-in-picture next episode preview and subscribe callout.',
    defaultHeadline: 'THANKS FOR WATCHING',
    defaultSubtext: 'SUBSCRIBE · WATCH NEXT EPISODE ON THE RIGHT',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 48,
    defaultTextColor: '#FFFFFF',
    defaultAccentColor: '#0F172A',
    defaultBgOpacity: 88,
    defaultEntranceAnim: 'fade-up',
    defaultYOffset: 24,
    defaultXOffset: -18,
    defaultProceduralScene: 'outro_minimal_subscribe',
    pipOverlayScene: 'alpine_drone_sunrise',
  },
  {
    id: 'tpl-outro-brand-signoff',
    name: 'Studio Production Sign-Off',
    category: 'outros',
    categoryLabel: 'Outros',
    sourceRepo: 'Motionity Open Pack',
    aspectRatio: '16:9',
    duration: 4.5,
    description: 'Minimalist architectural blueprint grid outro for brand credits and website URLs.',
    defaultHeadline: 'KINEFORGE PRODUCTIONS',
    defaultSubtext: 'WWW.KINEFORGE.STUDIO · ALL RIGHTS RESERVED',
    defaultFontFamily: 'Oswald',
    defaultFontSize: 52,
    defaultTextColor: '#F8FAFC',
    defaultAccentColor: '#0369A1',
    defaultBgOpacity: 80,
    defaultEntranceAnim: 'pop-bounce',
    defaultYOffset: 0,
    defaultXOffset: 0,
    defaultProceduralScene: 'bg_cinematic_grid',
  },

  // 3. ANIMATED TITLES
  {
    id: 'tpl-title-kinetic-headline',
    name: 'Anamorphic Center Headline',
    category: 'animated-titles',
    categoryLabel: 'Animated Titles',
    sourceRepo: 'Motionity / WebGL Titles',
    aspectRatio: '16:9',
    duration: 4.0,
    description: 'Full-width display title card with subtle backdrop scrim and smooth upward settle.',
    defaultHeadline: 'THE ART OF PRECISION',
    defaultSubtext: 'CHAPTER 02 · OPTICAL ENGINEERING',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 54,
    defaultTextColor: '#FFFFFF',
    defaultAccentColor: '#1E293B',
    defaultBgOpacity: 75,
    defaultEntranceAnim: 'fade-up',
    defaultYOffset: 0,
    defaultXOffset: 0,
    defaultProceduralScene: 'bg_gradient_aurora',
  },
  {
    id: 'tpl-title-typewriter-quote',
    name: 'Typewriter Editorial Pull-Quote',
    category: 'animated-titles',
    categoryLabel: 'Animated Titles',
    sourceRepo: 'OpenShot Title Library',
    aspectRatio: '16:9',
    duration: 4.5,
    description: 'Character-by-character typewriter reveal for key statistics, quotes, and timestamps.',
    defaultHeadline: '“DESIGN IS HOW IT WORKS IN MOTION.”',
    defaultSubtext: 'STUDIO KEYNOTE · OCTOBER 2026',
    defaultFontFamily: 'JetBrains Mono',
    defaultFontSize: 38,
    defaultTextColor: '#38BDF8',
    defaultAccentColor: '#090D16',
    defaultBgOpacity: 88,
    defaultEntranceAnim: 'typewriter',
    defaultYOffset: 0,
    defaultXOffset: 0,
    defaultProceduralScene: 'studio_director_interview',
  },

  // 4. LOWER THIRDS
  {
    id: 'tpl-lower-broadcast-speaker',
    name: 'Broadcast Documentary Lower Third',
    category: 'lower-thirds',
    categoryLabel: 'Lower Thirds',
    sourceRepo: 'Olive NLE Broadcast Pack',
    aspectRatio: '16:9',
    duration: 4.5,
    description: 'Left-anchored speaker identification badge with slide-in entrance and role subtitle.',
    defaultHeadline: 'Dr. Elena Rostova',
    defaultSubtext: 'Chief Autonomous Systems Architect',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 34,
    defaultTextColor: '#FFFFFF',
    defaultAccentColor: '#0284C7',
    defaultBgOpacity: 92,
    defaultEntranceAnim: 'slide-lower-third',
    defaultYOffset: 32,
    defaultXOffset: -24,
    defaultProceduralScene: 'studio_director_interview',
  },
  {
    id: 'tpl-lower-tech-spec',
    name: 'Technical Telemetry Callout Bar',
    category: 'lower-thirds',
    categoryLabel: 'Lower Thirds',
    sourceRepo: 'Natron / OpenFX Community',
    aspectRatio: '16:9',
    duration: 4.0,
    description: 'Monospace HUD lower third for product specs, camera settings, or location stamps.',
    defaultHeadline: 'LOC: TOKYO BAY EXPRESSWAY',
    defaultSubtext: 'SPEED: 112 KM/H · LIDAR ACTIVE · 60 FPS',
    defaultFontFamily: 'JetBrains Mono',
    defaultFontSize: 30,
    defaultTextColor: '#F8FAFC',
    defaultAccentColor: '#0F172A',
    defaultBgOpacity: 88,
    defaultEntranceAnim: 'slide-lower-third',
    defaultYOffset: 34,
    defaultXOffset: -22,
    defaultProceduralScene: 'cyber_city_drive',
  },

  // 5. SOCIAL MEDIA SPECIFIC FORMATS
  {
    id: 'tpl-social-reels-9x16',
    name: '9:16 Vertical Reels & Shorts Hook',
    category: 'social-media',
    categoryLabel: 'Social Media Formats',
    sourceRepo: 'CapCut / OpenReels 9:16 Pack',
    aspectRatio: '9:16',
    duration: 5.0,
    description: 'Vertical 1080×1920 mobile layout with high-impact top hook banner and bottom caption zone.',
    defaultHeadline: '3 SECRETS OF ESPRESSO EXTRACTION',
    defaultSubtext: 'SAVE THIS REEL FOR YOUR MORNING BREW',
    defaultFontFamily: 'Oswald',
    defaultFontSize: 46,
    defaultTextColor: '#FEF3C7',
    defaultAccentColor: '#78350F',
    defaultBgOpacity: 90,
    defaultEntranceAnim: 'pop-bounce',
    defaultYOffset: -28,
    defaultXOffset: 0,
    defaultProceduralScene: 'roastery_vertical_reel',
  },
  {
    id: 'tpl-social-square-1x1',
    name: '1:1 Square Feed Product Spotlight',
    category: 'social-media',
    categoryLabel: 'Social Media Formats',
    sourceRepo: 'Motionity Social Kit',
    aspectRatio: '1:1',
    duration: 4.5,
    description: 'Balanced 1080×1080 square social post with bold bottom title bar and PiP badge.',
    defaultHeadline: 'AUTONOMOUS SERIES X',
    defaultSubtext: 'PRE-ORDER NOW · LINK IN BIO',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 42,
    defaultTextColor: '#FFFFFF',
    defaultAccentColor: '#0284C7',
    defaultBgOpacity: 88,
    defaultEntranceAnim: 'fade-up',
    defaultYOffset: 30,
    defaultXOffset: 0,
    defaultProceduralScene: 'cyber_city_drive',
  },
  {
    id: 'tpl-social-portrait-4x5',
    name: '4:5 Portrait Editorial Story',
    category: 'social-media',
    categoryLabel: 'Social Media Formats',
    sourceRepo: 'OpenSocial Creator Templates',
    aspectRatio: '4:5',
    duration: 5.0,
    description: '1080×1350 portrait feed layout optimized for maximum mobile screen real estate.',
    defaultHeadline: 'INSIDE THE DESIGN STUDIO',
    defaultSubtext: 'SWIPE FOR BEHIND THE SCENES',
    defaultFontFamily: 'Plus Jakarta Sans',
    defaultFontSize: 40,
    defaultTextColor: '#F8FAFC',
    defaultAccentColor: '#0F172A',
    defaultBgOpacity: 85,
    defaultEntranceAnim: 'fade-up',
    defaultYOffset: 28,
    defaultXOffset: 0,
    defaultProceduralScene: 'studio_director_interview',
  },
];
