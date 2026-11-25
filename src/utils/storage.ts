import { BallSkinId, WorldThemeId } from '../types/game';

const STORAGE_KEY = 'going_balls_3d_progress_v1';

export interface SavedProgress {
  coins: number;
  currentCourse: number;
  highestClearedCourse: number;
  courseStars: Record<number, number>;
  selectedSkin: BallSkinId;
  unlockedSkins: BallSkinId[];
  customAccentHex: string;
  glowBoost: number;
  themeOverride: WorldThemeId | 'auto';
  cameraPreset: 'chase' | 'far' | 'low';
  soundEnabled: boolean;
}

const VALID_SKINS: BallSkinId[] = [
  'cyber-chevron',
  'royal-gold',
  'neon-plasma',
  'solar-nova',
  'star-striker',
  'pro-baseball',
  'ruby-core',
  'galaxy-orb',
];

export const DEFAULT_PROGRESS: SavedProgress = {
  coins: 100,
  currentCourse: 1,
  highestClearedCourse: 0,
  courseStars: {},
  selectedSkin: 'cyber-chevron',
  unlockedSkins: ['cyber-chevron'],
  customAccentHex: '',
  glowBoost: 1.0,
  themeOverride: 'auto',
  cameraPreset: 'chase',
  soundEnabled: true,
};

export function loadProgress(): SavedProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;

    const unlockedSkins: BallSkinId[] = Array.isArray(parsed.unlockedSkins)
      ? parsed.unlockedSkins.filter((id): id is BallSkinId =>
          VALID_SKINS.includes(id as BallSkinId),
        )
      : ['cyber-chevron'];
    if (!unlockedSkins.includes('cyber-chevron')) {
      unlockedSkins.unshift('cyber-chevron');
    }

    const selectedSkin =
      parsed.selectedSkin && unlockedSkins.includes(parsed.selectedSkin)
        ? parsed.selectedSkin
        : 'cyber-chevron';

    const courseStars: Record<number, number> = {};
    if (parsed.courseStars && typeof parsed.courseStars === 'object') {
      for (const [k, v] of Object.entries(parsed.courseStars)) {
        const courseNum = Number(k);
        const stars = Number(v);
        if (
          Number.isFinite(courseNum) &&
          courseNum >= 1 &&
          Number.isFinite(stars) &&
          stars >= 1 &&
          stars <= 3
        ) {
          courseStars[courseNum] = Math.round(stars);
        }
      }
    }

    return {
      coins:
        typeof parsed.coins === 'number' && Number.isFinite(parsed.coins)
          ? Math.max(0, Math.floor(parsed.coins))
          : DEFAULT_PROGRESS.coins,
      currentCourse:
        typeof parsed.currentCourse === 'number' &&
        Number.isFinite(parsed.currentCourse)
          ? Math.max(1, Math.min(9999, Math.floor(parsed.currentCourse)))
          : DEFAULT_PROGRESS.currentCourse,
      highestClearedCourse:
        typeof parsed.highestClearedCourse === 'number' &&
        Number.isFinite(parsed.highestClearedCourse)
          ? Math.max(0, Math.floor(parsed.highestClearedCourse))
          : DEFAULT_PROGRESS.highestClearedCourse,
      courseStars,
      selectedSkin,
      unlockedSkins,
      customAccentHex:
        typeof parsed.customAccentHex === 'string'
          ? parsed.customAccentHex
          : '',
      glowBoost:
        typeof parsed.glowBoost === 'number' &&
        Number.isFinite(parsed.glowBoost)
          ? Math.max(0, Math.min(2.5, parsed.glowBoost))
          : 1.0,
      themeOverride: parsed.themeOverride || 'auto',
      cameraPreset: parsed.cameraPreset || 'chase',
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: SavedProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}
