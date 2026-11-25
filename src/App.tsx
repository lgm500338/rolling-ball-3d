import { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { GameCanvas, TelemetryData } from './components/GameCanvas';
import { generateCourse } from './three/courseGenerator';
import { BALL_SKINS } from './three/worldThemes';
import {
  BallSkinId,
  CourseClearResult,
  GameStatus,
  WorldThemeId,
} from './types/game';
import { soundEngine } from './utils/sound';
import { loadProgress, saveProgress } from './utils/storage';
import { Lang, loadLang, saveLang } from './utils/i18n';

export default function App() {
  const initialProgress = useMemo(() => loadProgress(), []);

  // Only cleared courses + the next one are playable
  const [courseNumber, setCourseNumber] = useState<number>(() =>
    Math.max(
      1,
      Math.min(
        initialProgress.currentCourse,
        initialProgress.highestClearedCourse + 1,
      ),
    ),
  );
  const [highestClearedCourse, setHighestClearedCourse] = useState<number>(
    initialProgress.highestClearedCourse,
  );
  const [courseStars, setCourseStars] = useState<Record<number, number>>(
    initialProgress.courseStars,
  );
  const [coins, setCoins] = useState<number>(initialProgress.coins);
  const [skinId, setSkinId] = useState<BallSkinId>(
    initialProgress.selectedSkin,
  );
  const [unlockedSkins, setUnlockedSkins] = useState<BallSkinId[]>(
    initialProgress.unlockedSkins,
  );
  const [customAccentHex, setCustomAccentHex] = useState<string>(
    initialProgress.customAccentHex,
  );
  const [glowBoost, setGlowBoost] = useState<number>(initialProgress.glowBoost);
  const [themeOverride, setThemeOverride] = useState<WorldThemeId | 'auto'>(
    initialProgress.themeOverride,
  );
  const [cameraPreset, setCameraPreset] = useState<'chase' | 'far' | 'low'>(
    initialProgress.cameraPreset,
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    initialProgress.soundEnabled,
  );
  const [lang, setLang] = useState<Lang>(() => loadLang());
  useEffect(() => {
    saveLang(lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('ready');
  const [clearResult, setClearResult] = useState<CourseClearResult | null>(null);
  const [jumpTriggerCount, setJumpTriggerCount] = useState<number>(0);
  const [restartTriggerCount, setRestartTriggerCount] = useState<number>(0);

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    speedKmh: 0,
    progressPct: 0,
    segmentLabel: 'Skyway Track',
    isAirborne: false,
    elapsedSec: 0,
    runCoinsCollected: 0,
  });

  // Sync audio engine state on mount & changes
  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Persist coins, cleared courses, stars, skins, and preferences to localStorage
  useEffect(() => {
    saveProgress({
      coins,
      currentCourse: courseNumber,
      highestClearedCourse,
      courseStars,
      selectedSkin: skinId,
      unlockedSkins,
      customAccentHex,
      glowBoost,
      themeOverride,
      cameraPreset,
      soundEnabled,
    });
  }, [
    coins,
    courseNumber,
    highestClearedCourse,
    courseStars,
    skinId,
    unlockedSkins,
    customAccentHex,
    glowBoost,
    themeOverride,
    cameraPreset,
    soundEnabled,
  ]);

  // Generate current course deterministically from courseNumber (1 to 999+)
  const currentCourse = useMemo(
    () => generateCourse(courseNumber),
    [courseNumber],
  );

  const maxUnlockedCourse = Math.min(9999, highestClearedCourse + 1);

  const handleSelectCourse = useCallback(
    (nextCourse: number) => {
      const clamped = Math.max(1, Math.min(maxUnlockedCourse, nextCourse));
      setCourseNumber(clamped);
      setClearResult(null);
      setGameStatus('ready');
      setRestartTriggerCount((c) => c + 1);
    },
    [maxUnlockedCourse],
  );

  const handleRestartCourse = useCallback(() => {
    setClearResult(null);
    setGameStatus('ready');
    setRestartTriggerCount((c) => c + 1);
  }, []);

  const handleCourseComplete = useCallback(
    ({
      elapsedSec,
      coinsCollected,
    }: {
      elapsedSec: number;
      coinsCollected: number;
    }) => {
      const beatParTime = elapsedSec <= currentCourse.parTimeSec;
      const hitCoinTarget = coinsCollected >= currentCourse.coinTarget;
      const stars = 1 + (beatParTime ? 1 : 0) + (hitCoinTarget ? 1 : 0);
      const bonusCoins = stars === 3 ? 50 : stars === 2 ? 30 : 15;

      setCoins((c) => c + bonusCoins);
      setHighestClearedCourse((prev) => Math.max(prev, currentCourse.courseNumber));
      setCourseStars((prev) => ({
        ...prev,
        [currentCourse.courseNumber]: Math.max(
          prev[currentCourse.courseNumber] || 0,
          stars,
        ),
      }));

      setClearResult({
        stars,
        elapsedSec,
        parTimeSec: currentCourse.parTimeSec,
        coinsCollected,
        totalCoins: currentCourse.coins.length,
        coinTarget: currentCourse.coinTarget,
        bonusCoins,
        beatParTime,
        hitCoinTarget,
      });
      setGameStatus('complete');
    },
    [currentCourse],
  );

  const handlePurchaseOrSelectSkin = useCallback(
    (targetSkinId: BallSkinId): { ok: boolean; message?: string } => {
      if (unlockedSkins.includes(targetSkinId)) {
        setSkinId(targetSkinId);
        return { ok: true };
      }

      const skin = BALL_SKINS.find((s) => s.id === targetSkinId);
      if (!skin) return { ok: false };

      if (coins < skin.price) {
        const shortfall = skin.price - coins;
        return {
          ok: false,
          message:
            lang === 'ko'
              ? `${skin.name}을(를) 열려면 코인이 ${shortfall}개 더 필요해요 (가격 ${skin.price}).`
              : `Need ${shortfall} more coins to unlock ${skin.name} (${skin.price} coins).`,
        };
      }

      setCoins((c) => c - skin.price);
      setUnlockedSkins((prev) =>
        prev.includes(targetSkinId) ? prev : [...prev, targetSkinId],
      );
      setSkinId(targetSkinId);
      soundEngine.playCourseComplete();
      return {
        ok: true,
        message:
          lang === 'ko'
            ? `${skin.name}을(를) 열고 장착했어요!`
            : `Unlocked and equipped ${skin.name}!`,
      };
    },
    [unlockedSkins, coins, lang],
  );

  const handleJump = useCallback(() => {
    setJumpTriggerCount((c) => c + 1);
  }, []);

  const handleCoinCollected = useCallback(() => {
    setCoins((c) => c + 5);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 100% Unobstructed Full-Viewport 3D WebGL Scene */}
      <GameCanvas
        course={currentCourse}
        skinId={skinId}
        customAccentHex={customAccentHex}
        glowBoost={glowBoost}
        themeOverride={themeOverride}
        cameraPreset={cameraPreset}
        gameStatus={gameStatus}
        jumpTriggerCount={jumpTriggerCount}
        restartTriggerCount={restartTriggerCount}
        onStatusChange={setGameStatus}
        onCourseComplete={handleCourseComplete}
        onCoinCollected={handleCoinCollected}
        onTelemetryUpdate={setTelemetry}
      />

      {/* Semantic DOM HUD & Unified Collapsible Bottom Control Dock */}
      <ControlDock
        courseNumber={courseNumber}
        courseTitle={currentCourse.courseTitle}
        highestClearedCourse={highestClearedCourse}
        maxUnlockedCourse={maxUnlockedCourse}
        courseStars={courseStars}
        coins={coins}
        skinId={skinId}
        unlockedSkins={unlockedSkins}
        customAccentHex={customAccentHex}
        glowBoost={glowBoost}
        themeOverride={themeOverride}
        cameraPreset={cameraPreset}
        soundEnabled={soundEnabled}
        gameStatus={gameStatus}
        telemetry={telemetry}
        totalCourseCoins={currentCourse.coins.length}
        clearResult={clearResult}
        onSelectCourse={handleSelectCourse}
        onPurchaseOrSelectSkin={handlePurchaseOrSelectSkin}
        onSelectAccentColor={setCustomAccentHex}
        onChangeGlowBoost={setGlowBoost}
        onSelectTheme={setThemeOverride}
        onSelectCameraPreset={setCameraPreset}
        onToggleSound={handleToggleSound}
        onJump={handleJump}
        onRestartCourse={handleRestartCourse}
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
      />
    </main>
  );
}
