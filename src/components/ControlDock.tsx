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
import { Lang } from '../utils/i18n';

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
  lang: Lang;
  onToggleLang: () => void;
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
  lang,
  onToggleLang,
}) => {
  const T = (en: string, ko: string) => (lang === 'ko' ? ko : en);
  // Start collapsed on phones so the drawer doesn't cover the ball
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
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
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 sm:px-4 py-2.5 shadow-lg flex items-center justify-between gap-2 sm:gap-4 pointer-events-auto">
          {/* Course Identifier */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button
              onClick={() => onSelectCourse(Math.max(1, courseNumber - 1))}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title={T('Previous Course', '이전 코스')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-wider text-amber-400 whitespace-nowrap">
                  {T('COURSE', '코스')} {courseNumber}
                </span>
                {currentBestStars > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={T(`Best rating: ${currentBestStars}/3 stars`, `최고 기록: 별 ${currentBestStars}/3`)}
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
              title={T('Next Course', '다음 코스')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Course Progress Bar */}
          <div className="flex-1 max-w-[210px] hidden sm:block">
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 mb-1">
              <span>{T('START', '출발')}</span>
              <span className="text-slate-200 font-semibold">
                {telemetry.progressPct}%
              </span>
              <span>{T('FINISH', '도착')}</span>
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
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-400">{T('COINS', '코인')}</div>
              <div className="font-mono tabular-nums text-sm font-bold text-amber-400 flex items-center justify-end gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{coins}</span>
              </div>
            </div>
            <button
              onClick={onToggleLang}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              aria-label={T('Switch to Korean', 'Switch to English')}
              title={T('한국어로 보기', 'View in English')}
            >
              {lang === 'ko' ? 'EN' : '한국어'}
            </button>
            <button
              onClick={onToggleSound}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors cursor-pointer"
              aria-label={T('Toggle Sound', '소리 켜기/끄기')}
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
              {T('TOUCH & DRAG LEFT / RIGHT TO STEER', '화면을 좌우로 밀어서 조종하세요')}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              {T(
                'Auto-accelerates forward · Drag down to brake · Tap or press JUMP to leap',
                '공은 자동으로 앞으로 굴러가요 · 아래로 당기면 감속 · 탭하거나 점프 버튼으로 점프',
              )}
            </p>
          </div>
        </div>
      )}

      {/* Fell Off Track Modal */}
      {gameStatus === 'fell' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-rose-500 tracking-wide">
              {T('FELL OFF TRACK!', '트랙에서 떨어졌어요!')}
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              {T(
                `You plunged off Course ${courseNumber} at ${telemetry.progressPct}% progress. Every fall restarts from the beginning of the course!`,
                `코스 ${courseNumber}의 ${telemetry.progressPct}% 지점에서 떨어졌어요. 떨어지면 코스 처음부터 다시 시작해요!`,
              )}
            </p>
            <button
              onClick={onRestartCourse}
              className="mt-5 w-full py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer"
            >
              {T(`RETRY COURSE ${courseNumber} (FROM 0%)`, `코스 ${courseNumber} 다시 하기`)}
            </button>
          </div>
        </div>
      )}

      {/* Course Complete Modal with 1–3 Star Rating */}
      {gameStatus === 'complete' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
            <p className="text-xs font-medium text-emerald-400 tracking-wider">
              {T('FINISH LINE CROSSED', '결승선 통과')}
            </p>
            <h2 className="font-display text-3xl font-bold text-white tracking-wide mt-1">
              {T(`COURSE ${courseNumber} COMPLETE!`, `코스 ${courseNumber} 완료!`)}
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
                  <span className="text-slate-300">{T('Course Cleared', '코스 완주')}</span>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                    {T('+1 Star', '별 +1')}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-300">
                    {T(`Clear Time (Par ${clearResult.parTimeSec}s)`, `완주 시간 (목표 ${clearResult.parTimeSec}초)`)}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      clearResult.beatParTime
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {clearResult.elapsedSec.toFixed(1)}s{' '}
                    {clearResult.beatParTime ? T('· +1 Star', '· 별 +1') : T('· Missed', '· 실패')}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-300">
                    {T(`Coins Collected (Goal ${clearResult.coinTarget})`, `모은 코인 (목표 ${clearResult.coinTarget}개)`)}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      clearResult.hitCoinTarget
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {clearResult.coinsCollected} / {totalCourseCoins}{' '}
                    {clearResult.hitCoinTarget ? T('· +1 Star', '· 별 +1') : T('· Missed', '· 실패')}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  <span className="text-amber-300 font-medium">
                    {T('Course Reward Bonus', '코스 보상 보너스')}
                  </span>
                  <span className="font-mono tabular-nums text-amber-400 font-bold">
                    +{clearResult.bonusCoins} {T('Coins', '코인')}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={onRestartCourse}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                {T('Replay', '다시 하기')}
              </button>
              <button
                onClick={() => onSelectCourse(courseNumber + 1)}
                className="flex-[1.6] py-3 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
              >
                {T(`NEXT COURSE (${courseNumber + 1})`, `다음 코스 (${courseNumber + 1})`)}
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
                <span>{T('Show Controls (H)', '메뉴 열기')}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>{T('Hide Controls (H)', '메뉴 닫기')}</span>
              </>
            )}
          </button>

          {/* Dedicated Thumb-Friendly Direct JUMP Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRestartCourse}
              className="px-3.5 py-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-200 border border-slate-800 text-xs font-medium shadow-md flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title={T('Restart Course from Beginning', '코스 처음부터 다시')}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>{T('Restart', '재시작')}</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-display font-bold text-sm tracking-wider shadow-lg transition-transform cursor-pointer whitespace-nowrap"
            >
              {T('JUMP (SPACE)', '점프')}
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
                  <span>{T('Track & Camera', '트랙 & 카메라')}</span>
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
                    {T('Ball Shop', '공 상점')} ({unlockedSkins.length}/{BALL_SKINS.length})
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
                  <span>{T('Courses (1–999) & Worlds', '코스 (1–999) & 월드')}</span>
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                <span>{T('Auto-Roll Active', '자동 굴러가기')}</span>
                <span aria-hidden="true">·</span>
                <span>{T('Drag Left/Right: Steer', '좌우로 밀어서 조종')}</span>
                <span aria-hidden="true">·</span>
                <span>{T(`Best Cleared: Course ${highestClearedCourse}`, `최고 기록: 코스 ${highestClearedCourse}`)}</span>
              </div>
            </div>

            {/* TAB 1: Track & Camera Controls */}
            {activeTab === 'controls' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Camera View Preset */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    {T('3D Camera Perspective', '카메라 시점')}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
                    {(
                      [
                        { id: 'chase', label: T('3D Chase Cam', '추적 카메라') },
                        { id: 'low', label: T('Low Action Cam', '낮은 시점') },
                        { id: 'far', label: T('Wide Overview', '넓은 시점') },
                      ]
                    ).map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() => onSelectCameraPreset(cam.id as 'chase' | 'far' | 'low')}
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
                    {T('Equipped Ball · Open Ball Shop to Unlock More', '장착한 공 · 공 상점에서 더 열 수 있어요')}
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
                    {T('Jump Across Courses', '코스 이동')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectCourse(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      {T('Course 1', '코스 1')}
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      {T('+1 Course', '+1 코스')}
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 10)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      {T('+10 Courses', '+10 코스')}
                    </button>
                    <button
                      onClick={() => onSelectCourse(courseNumber + 50)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-amber-400 cursor-pointer whitespace-nowrap"
                    >
                      {T('+50 Courses', '+50 코스')}
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
                                {T('Owned', '보유')}
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
                              ? T('Equipped', '장착 중')
                              : skin.category
                            : canAfford
                              ? T('Click to Buy', '눌러서 구매')
                              : T(`${skin.price} Coins`, `${skin.price} 코인`)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color & Glow Intensity Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {T('Custom Trim / Glow Color:', '빛 색상:')}
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
                      {T('Luminous Glow Power:', '빛 세기:')}
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
                    {T(
                      `Select Any Course (Course 1 to 999+) · Highest Cleared: Course ${highestClearedCourse}`,
                      `원하는 코스 선택 (1~999+) · 최고 기록: 코스 ${highestClearedCourse}`,
                    )}
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
                          <span>{T('Course', '코스')} {cNum}</span>
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
                        placeholder={T('Course #', '코스 번호')}
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        {T('Go', '이동')}
                      </button>
                    </form>
                  </div>
                </div>

                {/* World Backdrop Theme Selector */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    {T('World Backdrop & Track Surface', '배경 월드 & 트랙')}
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
                      {T('Auto per Course', '코스마다 자동')}
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
                        {lang === 'ko' && th.nameKo ? th.nameKo : th.name}
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
