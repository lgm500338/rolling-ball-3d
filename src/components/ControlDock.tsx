import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Compass,
  Lock,
  Palette,
  RotateCcw,
  ShoppingBag,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BallSkinId,
  CourseClearResult,
  GameStatus,
  WorldThemeId,
} from '../types/game';
import { BALL_SKINS, WORLD_THEMES } from '../three/worldThemes';
import { TelemetryData } from './GameCanvas';

interface ControlDockProps {
  courseNumber: number;
  courseTitle: string;
  highestClearedCourse: number;
  courseStars: Record<number, number>;
  coins: number;
  skinId: BallSkinId;
  unlockedSkins: BallSkinId[];
  customAccentHex: string;
  glowBoost: number;
  themeOverride: WorldThemeId | 'auto';
  cameraPreset: 'chase' | 'far' | 'low';
  soundEnabled: boolean;
  gameStatus: GameStatus;
  telemetry: TelemetryData;
  totalCourseCoins: number;
  clearResult: CourseClearResult | null;
  onSelectCourse: (courseNum: number) => void;
  onPurchaseOrSelectSkin: (skin: BallSkinId) => { ok: boolean; message?: string };
  onSelectAccentColor: (hex: string) => void;
  onChangeGlowBoost: (val: number) => void;
  onSelectTheme: (theme: WorldThemeId | 'auto') => void;
  onSelectCameraPreset: (preset: 'chase' | 'far' | 'low') => void;
  onToggleSound: () => void;
  onJump: () => void;
  onRestartCourse: () => void;
}

const ACCENT_SWATCHES = [
  { label: 'Default', hex: '' },
  { label: 'Neon Green', hex: '#4ade80' },
  { label: 'Electric Cyan', hex: '#00f5d4' },
  { label: '24K Gold', hex: '#facc15' },
  { label: 'Solar Orange', hex: '#f97316' },
  { label: 'Hyper Magenta', hex: '#f43f5e' },
  { label: 'Plasma Violet', hex: '#a855f7' },
  { label: 'Pure White', hex: '#ffffff' },
];

const QUICK_COURSES = [1, 2, 3, 5, 10, 25, 50, 100, 250, 500];

export const ControlDock: React.FC<ControlDockProps> = ({
  courseNumber,
  courseTitle,
  highestClearedCourse,
  courseStars,
  coins,
  skinId,
  unlockedSkins,
  customAccentHex,
  glowBoost,
  themeOverride,
  cameraPreset,
  soundEnabled,
  gameStatus,
  telemetry,
  totalCourseCoins,
  clearResult,
  onSelectCourse,
  onPurchaseOrSelectSkin,
  onSelectAccentColor,
  onChangeGlowBoost,
  onSelectTheme,
  onSelectCameraPreset,
  onToggleSound,
  onJump,
  onRestartCourse,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'balls' | 'courses'>(
    'controls',
  );
  const [customCourseInput, setCustomCourseInput] = useState(
    String(courseNumber),
  );
  const [shopNotice, setShopNotice] = useState<string | null>(null);

  useEffect(() => {
    setCustomCourseInput(String(courseNumber));
  }, [courseNumber]);

  useEffect(() => {
    if (!shopNotice) return;
    const t = window.setTimeout(() => setShopNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [shopNotice]);

  // Keyboard shortcut 'H' to collapse/expand bottom dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === 'KeyH' &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleCustomCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customCourseInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      onSelectCourse(Math.min(9999, parsed));
    }
  };

  const handleSkinClick = (id: BallSkinId) => {
    const res = onPurchaseOrSelectSkin(id);
    if (res.message) {
      setShopNotice(res.message);
    }
  };

  const currentBestStars = courseStars[courseNumber] || 0;

  return (
    <>
      {/* Top-Center Minimal Course & Progress Bar HUD */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 w-[min(720px,94vw)] pointer-events-none">
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg flex items-center justify-between gap-4 pointer-events-auto">
          {/* Course Identifier */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onSelectCourse(Math.max(1, courseNumber - 1))}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Previous Course"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-wider text-amber-400 whitespace-nowrap">
                  COURSE {courseNumber}
                </span>
                {currentBestStars > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`Best rating: ${currentBestStars}/3 stars`}
                  >
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= currentBestStars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </span>
                )}
                <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-medium text-slate-300 whitespace-nowrap hidden sm:inline">
                  {courseTitle}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>{telemetry.segmentLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {telemetry.speedKmh} KM/H
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {telemetry.elapsedSec.toFixed(1)}s
                </span>
              </div>
            </div>
            <button
              onClick={() => onSelectCourse(courseNumber + 1)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Next Course"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Course Progress Bar */}
          <div className="flex-1 max-w-[210px] hidden sm:block">
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 mb-1">
              <span>START</span>
              <span className="text-slate-200 font-semibold">
                {telemetry.progressPct}%
              </span>
              <span>FINISH</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300 transition-transform duration-150 origin-left"
                style={{
                  transform: `scaleX(${Math.max(0.02, telemetry.progressPct / 100)})`,
                }}
              />
            </div>
          </div>

          {/* Coins & Sound Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-400">COINS</div>
              <div className="font-mono tabular-nums text-sm font-bold text-amber-400 flex items-center justify-end gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{coins}</span>
              </div>
            </div>
            <button
              onClick={onToggleSound}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle Sound"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Center Status Banner for Ready State */}
      {gameStatus === 'ready' && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center px-3 w-full max-w-xl">
          <div className="bg-slate-950/90 border border-slate-800 px-5 py-3 rounded-xl shadow-xl inline-block">
            <p className="font-display text-lg sm:text-2xl font-bold tracking-wide text-white">
              TOUCH &amp; DRAG LEFT / RIGHT TO STEER
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Auto-accelerates forward · Drag down to brake · Tap or press JUMP to leap
            </p>
          </div>
        </div>
      )}

      {/* Fell Off Track Modal */}
      {gameStatus === 'fell' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-rose-500 tracking-wide">
              FELL OFF TRACK!
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              You plunged off Course {courseNumber} at {telemetry.progressPct}% progress.
              Every fall restarts from the beginning of the course!
            </p>
            <button
              onClick={onRestartCourse}
              className="mt-5 w-full py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer"
            >
              RETRY COURSE {courseNumber} (FROM 0%)
            </button>
          </div>
        </div>
      )}

      {/* Course Complete Modal with 1–3 Star Rating */}
      {gameStatus === 'complete' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
            <p className="text-xs font-medium text-emerald-400 tracking-wider">
              FINISH LINE CROSSED
            </p>
            <h2 className="font-display text-3xl font-bold text-white tracking-wide mt-1">
              COURSE {courseNumber} COMPLETE!
            </h2>
            <p className="text-xs text-slate-400 mt-1">{courseTitle}</p>

            {/* 1 to 3 Star Evaluation */}
            <div className="flex items-center justify-center gap-3 my-5">
              {[1, 2, 3].map((starIdx) => {
                const earned = (clearResult?.stars ?? 1) >= starIdx;
                return (
                  <div
                    key={starIdx}
                    className={`flex flex-col items-center transition-transform ${
                      starIdx === 2 ? '-translate-y-1.5 scale-110' : ''
                    }`}
                  >
                    <Star
                      className={`w-11 h-11 ${
                        earned
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]'
                          : 'text-slate-700 fill-slate-900'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Star Criteria Breakdown */}
            {clearResult && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Course Cleared</span>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                    +1 Star
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-300">
                    Clear Time (Par {clearResult.parTimeSec}s)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      clearResult.beatParTime
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {clearResult.elapsedSec.toFixed(1)}s{' '}
                    {clearResult.beatParTime ? '· +1 Star' : '· Missed'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-300">
                    Coins Collected (Goal {clearResult.coinTarget})
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      clearResult.hitCoinTarget
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {clearResult.coinsCollected} / {totalCourseCoins}{' '}
                    {clearResult.hitCoinTarget ? '· +1 Star' : '· Missed'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  <span className="text-amber-300 font-medium">
                    Course Reward Bonus
                  </span>
                  <span className="font-mono tabular-nums text-amber-400 font-bold">
                    +{clearResult.bonusCoins} Coins
                  </span>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={onRestartCourse}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Replay
              </button>
              <button
                onClick={() => onSelectCourse(courseNumber + 1)}
                className="flex-[1.6] py-3 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
              >
                NEXT COURSE ({courseNumber + 1})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        style={{
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'min(940px, 94vw)',
        }}
        className="fixed z-20 w-full pointer-events-none"
      >
        {/* Collapse / Expand Toggle Handle + Quick Jump Trigger */}
        <div className="flex items-center justify-between mb-2 pointer-events-auto">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-900 text-slate-300 border border-slate-800 text-xs font-medium shadow-md transition-colors cursor-pointer whitespace-nowrap"
          >
            {collapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>

          {/* Dedicated Thumb-Friendly Direct JUMP Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRestartCourse}
              className="px-3.5 py-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-200 border border-slate-800 text-xs font-medium shadow-md flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Restart Course from Beginning"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restart</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-display font-bold text-sm tracking-wider shadow-lg transition-transform cursor-pointer whitespace-nowrap"
            >
              JUMP (SPACE)
            </button>
          </div>
        </div>

        {/* Collapsible Drawer Body */}
        {!collapsed && (
          <div className="bg-slate-950/95 border border-slate-800 rounded-2xl p-3.5 shadow-2xl pointer-events-auto">
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80 overflow-x-auto">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('controls')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'controls'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Track &amp; Camera</span>
                </button>
                <button
                  onClick={() => setActiveTab('balls')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'balls'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Ball Shop ({unlockedSkins.length}/{BALL_SKINS.length})
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('courses')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'courses'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-sky-400" />
                  <span>Courses (1–999) &amp; Worlds</span>
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                <span>Auto-Roll Active</span>
                <span aria-hidden="true">·</span>
                <span>Drag Left/Right: Steer</span>
                <span aria-hidden="true">·</span>
                <span>Best Cleared: Course {highestClearedCourse}</span>
              </div>
            </div>

            {/* TAB 1: Track & Camera Controls */}
            {activeTab === 'controls' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Camera View Preset */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    3D Camera Perspective
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
                    {(
                      [
                        { id: 'chase', label: '3D Chase Cam' },
                        { id: 'low', label: 'Low Action Cam' },
                        { id: 'far', label: 'Wide Overview' },
                      ] as const
                    ).map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() => onSelectCameraPreset(cam.id)}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          cameraPreset === cam.id
                            ? 'bg-amber-400 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {cam.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Unlocked Ball Switcher */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    Equipped Ball · Open Ball Shop to Unlock More
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {BALL_SKINS.slice(0, 4).map((b) => {
                      const unlocked = unlockedSkins.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => handleSkinClick(b.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            skinId === b.id
                              ? 'bg-slate-800 border-amber-400 text-white'
                              : unlocked
                                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          {!unlocked && <Lock className="w-3 h-3 text-amber-400/80" />}
                          <span>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Course Stepper */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    Jump Across Courses
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectCourse(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      Course 1
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      +1 Course
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 10)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      +10 Courses
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 50)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-amber-400 cursor-pointer whitespace-nowrap"
                    >
                      +50 Courses
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Ball Skin Shop (Buy with Coins + Customize Glow) */}
            {activeTab === 'balls' && (
              <div className="space-y-3">
                {shopNotice && (
                  <div className="text-xs font-medium text-amber-300 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                    {shopNotice}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {BALL_SKINS.map((skin) => {
                    const unlocked = unlockedSkins.includes(skin.id);
                    const active = skinId === skin.id;
                    const canAfford = coins >= skin.price;

                    return (
                      <button
                        key={skin.id}
                        onClick={() => handleSkinClick(skin.id)}
                        className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-800 border-amber-400 text-white'
                            : unlocked
                              ? 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-600'
                              : canAfford
                                ? 'bg-slate-900/80 border-amber-500/40 text-slate-200 hover:border-amber-400'
                                : 'bg-slate-900/50 border-slate-800/70 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`w-4 h-4 rounded-full shrink-0 border border-white/20 ${
                              unlocked ? '' : 'opacity-60'
                            }`}
                            style={{
                              background: `radial-gradient(circle at 30% 30%, ${skin.accentColor}, ${skin.baseColor})`,
                            }}
                          />
                          {unlocked ? (
                            active ? (
                              <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">
                                Owned
                              </span>
                            )
                          ) : (
                            <span
                              className={`flex items-center gap-0.5 font-mono tabular-nums text-[10px] font-bold ${
                                canAfford ? 'text-amber-400' : 'text-slate-500'
                              }`}
                            >
                              <Lock className="w-2.5 h-2.5" />
                              {skin.price}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold truncate">
                          {skin.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {unlocked
                            ? active
                              ? 'Equipped'
                              : skin.category
                            : canAfford
                              ? 'Click to Buy'
                              : `${skin.price} Coins`}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color & Glow Intensity Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      Custom Trim / Glow Color:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {ACCENT_SWATCHES.map((sw) => (
                        <button
                          key={sw.label}
                          onClick={() => onSelectAccentColor(sw.hex)}
                          title={sw.label}
                          className={`w-6 h-6 rounded-lg border transition-transform cursor-pointer ${
                            customAccentHex === sw.hex
                              ? 'scale-110 border-white'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{
                            background: sw.hex
                              ? sw.hex
                              : 'linear-gradient(135deg, #4ade80 0%, #facc15 50%, #38bdf8 100%)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      Luminous Glow Power:
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={glowBoost}
                      onChange={(e) =>
                        onChangeGlowBoost(parseFloat(e.target.value))
                      }
                      className="w-28 accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums text-xs text-amber-400 w-10">
                      {Math.round(glowBoost * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Courses (1 - 999) & World Backgrounds */}
            {activeTab === 'courses' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                {/* Course Presets + Direct Number Input */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    Select Any Course (Course 1 to 999+) · Highest Cleared: Course{' '}
                    {highestClearedCourse}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_COURSES.map((cNum) => {
                      const bestStars = courseStars[cNum] || 0;
                      return (
                        <button
                          key={cNum}
                          onClick={() => onSelectCourse(cNum)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            courseNumber === cNum
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          <span>Course {cNum}</span>
                          {bestStars > 0 && (
                            <span
                              className={
                                courseNumber === cNum
                                  ? 'text-slate-950'
                                  : 'text-amber-400'
                              }
                            >
                              {'★'.repeat(bestStars)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <form
                      onSubmit={handleCustomCourseSubmit}
                      className="flex items-center gap-1 ml-1"
                    >
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={customCourseInput}
                        onChange={(e) => setCustomCourseInput(e.target.value)}
                        className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono tabular-nums text-white"
                        placeholder="Course #"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Go
                      </button>
                    </form>
                  </div>
                </div>

                {/* World Backdrop Theme Selector */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    World Backdrop &amp; Track Surface
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => onSelectTheme('auto')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        themeOverride === 'auto'
                          ? 'bg-sky-400 text-slate-950 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Auto per Course
                    </button>
                    {Object.values(WORLD_THEMES).map((th) => (
                      <button
                        key={th.id}
                        onClick={() => onSelectTheme(th.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          themeOverride === th.id
                            ? 'bg-sky-400 text-slate-950 font-bold'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {th.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
