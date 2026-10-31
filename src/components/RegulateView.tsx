import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Droplets,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { RegulateActivityType } from '../types/session';

interface RegulateViewProps {
  locale: Locale;
  onComplete: () => void;
  onSkipToVerification: () => void;
  onExitToSupportChoice: () => void;
  onEndEarlyToSummary?: () => void;
}

const TOTAL_ROUNDS = 3;
const INHALE_SECONDS = 6;
const EXHALE_SECONDS = 9;
const ROUND_SECONDS = INHALE_SECONDS + EXHALE_SECONDS; // 15s * 3 = 45s

interface BubbleItem {
  id: number;
  popped: boolean;
  hue: string;
}

interface RippleWave {
  id: number;
  x: number;
  y: number;
}

function createInitialBubbles(): BubbleItem[] {
  const hues = [
    'bg-[#DCE8DF] border-[#9BB5A2]',
    'bg-[#E8E1F0] border-[#B9AAD0]',
    'bg-[#F3E0D5] border-[#D9B6A3]',
    'bg-[#E4ECE8] border-[#A3BDB0]',
  ];
  return Array.from({ length: 24 }, (_, idx) => ({
    id: idx,
    popped: false,
    hue: hues[idx % hues.length],
  }));
}

export const RegulateView: React.FC<RegulateViewProps> = ({
  locale,
  onComplete,
  onSkipToVerification,
  onExitToSupportChoice,
  onEndEarlyToSummary,
}) => {
  const t = TRANSLATIONS[locale].regulate;
  const isZh = locale === 'zh';

  const [activeTab, setActiveTab] = useState<RegulateActivityType>('breathing');

  // 1. Breathing state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);

  // 2. 1-Minute Bubble Pop game state
  const [bubbles, setBubbles] = useState<BubbleItem[]>(createInitialBubbles);
  const [totalPoppedCount, setTotalPoppedCount] = useState(0);
  const [gameSecondsLeft, setGameSecondsLeft] = useState(60);

  // 3. 1-Minute Starlight Ripple Pond state
  const [ripples, setRipples] = useState<RippleWave[]>([
    { id: 1, x: 50, y: 50 },
  ]);
  const [rippleCount, setRippleCount] = useState(1);

  // 4. 5-4-3-2-1 Sensory Grounding state
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const totalSeconds = TOTAL_ROUNDS * ROUND_SECONDS; // 45s

  // Breathing timer
  useEffect(() => {
    if (activeTab !== 'breathing' || isPaused) return;
    if (elapsedSeconds >= totalSeconds) {
      onComplete();
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeTab, isPaused, elapsedSeconds, totalSeconds, onComplete]);

  // 1-Minute Game countdown timer for Bubble Pop & Ripple Pond
  useEffect(() => {
    if (activeTab !== 'bubble_pop' && activeTab !== 'ripple_canvas') return;
    if (gameSecondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setGameSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeTab, gameSecondsLeft]);

  // Optional gentle Web Audio API ambient pad (default OFF, never auto-plays)
  useEffect(() => {
    if (ambientOn) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(174, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
      } catch (_e) {
        // Ignore if browser blocks audio context
      }
    } else if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [ambientOn]);

  // Play a gentle tactile pop or chime note using Web Audio API
  const playGentleTone = (freq = 396) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 160);
    } catch (_e) {
      // Ignore in headless/muted environments
    }
  };

  const handlePopBubble = (id: number) => {
    setBubbles((prev) => {
      const target = prev.find((b) => b.id === id);
      if (!target || target.popped) return prev;
      playGentleTone(340 + (id % 6) * 45);
      setTotalPoppedCount((c) => c + 1);
      const updated = prev.map((b) => (b.id === id ? { ...b, popped: true } : b));
      // Auto-refresh sheet if all 24 bubbles are popped
      if (updated.every((b) => b.popped)) {
        setTimeout(() => {
          setBubbles(createInitialBubbles());
        }, 350);
      }
      return updated;
    });
  };

  const handleResetBubbles = () => {
    setBubbles(createInitialBubbles());
  };

  const handlePondClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newId = Date.now() + Math.random();
    playGentleTone(285 + (rippleCount % 5) * 40);
    setRippleCount((c) => c + 1);
    setRipples((prev) => [...prev.slice(-6), { id: newId, x, y }]);
  };

  const handleToggleGroundingStep = (idx: number) => {
    playGentleTone(432);
    setCheckedSteps((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const currentRound = Math.min(TOTAL_ROUNDS, Math.floor(elapsedSeconds / ROUND_SECONDS) + 1);
  const secondsIntoRound = elapsedSeconds % ROUND_SECONDS;
  const isInhaling = secondsIntoRound < INHALE_SECONDS;
  const phaseLabel = isInhaling ? t.breatheIn : t.breatheOut;
  const phaseSubLabel = isInhaling ? t.inhaleSub : t.exhaleSub;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-3xl p-6 sm:p-8 shadow-[0_14px_36px_-10px_rgba(40,60,51,0.08)] space-y-6">
        {/* Top Bar with Instant Prev / Skip Timer / End Early Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#617068]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="regulate-exit-btn"
              onClick={onExitToSupportChoice}
              className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{isZh ? '← 返回上一环节' : '← Previous Step'}</span>
            </button>
            <span className="font-semibold uppercase tracking-wider text-[#476652]">
              {t.badge}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="regulate-top-skip-btn"
              onClick={onSkipToVerification}
              className="px-3 py-1.5 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isZh ? '跳过倒计时 · 下一环节 →' : 'Skip Timer · Next Step →'}</span>
            </button>

            {onEndEarlyToSummary && (
              <button
                type="button"
                data-testid="regulate-end-early-btn"
                onClick={onEndEarlyToSummary}
                className="px-3 py-1.5 rounded-xl bg-[#F8EAE2] hover:bg-[#F3DDD4] text-[#7A442A] border border-[#E5C5B5] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isZh ? '提前结束' : 'End Early'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Decompression Mode Tabs */}
        <div
          data-testid="regulate-activity-tabs"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F5EF] p-1.5 rounded-2xl border border-[#E5E9E2]"
        >
          <button
            type="button"
            data-testid="tab-breathing"
            onClick={() => setActiveTab('breathing')}
            className={`py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'breathing'
                ? 'bg-[#476652] text-[#FFFEFA] shadow-xs'
                : 'text-[#283C33] hover:bg-[#EFECE4]'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{t.tabs.breathing}</span>
          </button>

          <button
            type="button"
            data-testid="tab-bubble-pop"
            onClick={() => {
              setActiveTab('bubble_pop');
              setGameSecondsLeft(60);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'bubble_pop'
                ? 'bg-[#476652] text-[#FFFEFA] shadow-xs'
                : 'text-[#283C33] hover:bg-[#EFECE4]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.tabs.bubble_pop}</span>
          </button>

          <button
            type="button"
            data-testid="tab-ripple-canvas"
            onClick={() => {
              setActiveTab('ripple_canvas');
              setGameSecondsLeft(60);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ripple_canvas'
                ? 'bg-[#476652] text-[#FFFEFA] shadow-xs'
                : 'text-[#283C33] hover:bg-[#EFECE4]'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>{t.tabs.ripple_canvas}</span>
          </button>

          <button
            type="button"
            data-testid="tab-sensory-grounding"
            onClick={() => setActiveTab('sensory_grounding')}
            className={`py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sensory_grounding'
                ? 'bg-[#476652] text-[#FFFEFA] shadow-xs'
                : 'text-[#283C33] hover:bg-[#EFECE4]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.tabs.sensory_grounding}</span>
          </button>
        </div>

        {/* MODE 1: 45-Second Gentle Breathing */}
        {activeTab === 'breathing' && (
          <div className="text-center space-y-6">
            <div className="space-y-1.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#283C33]">
                {t.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#617068]">{t.subtitle}</p>
            </div>

            <div className="py-6 flex flex-col items-center justify-center relative">
              <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center relative">
                <div
                  className={`absolute rounded-full bg-[#E6EFE8] border border-[#C5D6C8] transition-all ease-in-out ${
                    isPaused
                      ? 'w-44 h-44 opacity-80'
                      : isInhaling
                        ? 'w-60 h-60 sm:w-64 sm:h-64 duration-[6000ms] opacity-100'
                        : 'w-36 h-36 sm:w-40 sm:h-40 duration-[9000ms] opacity-75'
                  }`}
                />
                <div
                  data-testid="breathing-circle"
                  className={`absolute rounded-full bg-[#7F9B87]/30 border-2 border-[#476652] flex flex-col items-center justify-center px-4 transition-all ease-in-out ${
                    isPaused
                      ? 'w-36 h-36'
                      : isInhaling
                        ? 'w-48 h-48 sm:w-52 sm:h-52 duration-[6000ms]'
                        : 'w-32 h-32 sm:w-36 sm:h-36 duration-[9000ms]'
                  }`}
                >
                  <span
                    data-testid="breathing-phase-label"
                    className="font-serif text-xl sm:text-2xl font-semibold text-[#283C33]"
                  >
                    {isPaused ? t.paused : phaseLabel}
                  </span>
                  <span className="text-[11px] font-mono text-[#476652] mt-1 tabular-nums">
                    {t.roundLabel} {currentRound} / {TOTAL_ROUNDS}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#617068] mt-4 max-w-[38ch]">{phaseSubLabel}</p>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#617068] tabular-nums">
              <span>
                {remainingSeconds} {t.remainingSuffix}
              </span>
              <span>·</span>
              <span>
                {TOTAL_ROUNDS - currentRound + 1}{' '}
                {TOTAL_ROUNDS - currentRound + 1 === 1 ? t.roundSingular : t.roundPlural}{' '}
                {t.roundsLeftSuffix}
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                data-testid="regulate-pause-btn"
                onClick={() => setIsPaused((p) => !p)}
                className="px-4 py-2.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? t.resume : t.pause}</span>
              </button>

              <button
                type="button"
                data-testid="regulate-ambient-btn"
                onClick={() => setAmbientOn((a) => !a)}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  ambientOn
                    ? 'bg-[#E6EFE8] text-[#2F523B] border-[#7F9B87]'
                    : 'bg-[#F7F5EF] text-[#617068] border-[#DEE5DB] hover:text-[#283C33]'
                }`}
              >
                {ambientOn ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>{ambientOn ? t.ambientOn : t.ambientOff}</span>
              </button>

              <button
                type="button"
                data-testid="regulate-skip-btn"
                onClick={onSkipToVerification}
                className="px-4 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>{t.continueToCheckin}</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: 1-Minute Tactile Bubble Pop Decompression Game */}
        {activeTab === 'bubble_pop' && (
          <div data-testid="bubble-pop-game" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECEFE9] pb-4">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#283C33]">
                  {t.bubbleTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#617068] mt-0.5">{t.bubbleSub}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-[#E6EFE8] border border-[#C5D6C8] text-xs font-mono text-[#2F523B]">
                  {t.bubbleScoreLabel}: <strong data-testid="bubble-popped-count">{totalPoppedCount}</strong>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] border border-[#DEE5DB] text-xs font-mono text-[#476652]">
                  {t.gameTimerLabel}: {gameSecondsLeft}
                  {locale === 'zh' ? '秒' : 's'}
                </div>
              </div>
            </div>

            {/* 6x4 Tactile Bubble Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-4 sm:p-5 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2]">
              {bubbles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  data-testid={`bubble-item-${b.id}`}
                  onClick={() => handlePopBubble(b.id)}
                  className={`aspect-square rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    b.popped
                      ? 'scale-90 bg-[#EFECE4] border-[#D5DDD2] opacity-45 shadow-inner'
                      : `${b.hue} hover:scale-105 active:scale-90 shadow-[0_6px_14px_-4px_rgba(40,60,51,0.18)]`
                  }`}
                  aria-label={`Bubble ${b.id + 1}`}
                >
                  {!b.popped ? (
                    <span className="w-3 h-1.5 rounded-full bg-white/70 -translate-y-2 -translate-x-1 rotate-[-25deg]" />
                  ) : (
                    <span className="text-[11px] font-mono text-[#617068]">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                data-testid="reset-bubbles-btn"
                onClick={handleResetBubbles}
                className="px-4 py-2.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.bubbleResetBtn}</span>
              </button>

              <button
                type="button"
                data-testid="finish-bubble-game-btn"
                onClick={onSkipToVerification}
                className="px-5 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.continueToCheckin}</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: 1-Minute Starlight Ripple Pond */}
        {activeTab === 'ripple_canvas' && (
          <div data-testid="ripple-pond-game" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECEFE9] pb-4">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#283C33]">
                  {t.rippleTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#617068] mt-0.5">{t.rippleSub}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-[#E6EFE8] border border-[#C5D6C8] text-xs font-mono text-[#2F523B]">
                  {t.rippleCountLabel}: <strong data-testid="ripple-count">{rippleCount}</strong>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] border border-[#DEE5DB] text-xs font-mono text-[#476652]">
                  {t.gameTimerLabel}: {gameSecondsLeft}
                  {locale === 'zh' ? '秒' : 's'}
                </div>
              </div>
            </div>

            <div
              data-testid="ripple-pond-surface"
              onClick={handlePondClick}
              className="relative h-64 sm:h-72 rounded-2xl bg-gradient-to-b from-[#1E3129] to-[#294237] border border-[#3F5E50] overflow-hidden cursor-pointer select-none flex items-center justify-center"
            >
              {ripples.map((rp) => (
                <div
                  key={rp.id}
                  style={{ left: `${rp.x}%`, top: `${rp.y}%` }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <span className="block w-28 h-28 rounded-full border border-[#A7C4B0]/60 animate-ping" />
                  <span className="block w-14 h-14 -mt-21 ml-7 rounded-full border border-[#E6EFE8]/80 animate-pulse" />
                </div>
              ))}
              <span className="text-xs text-[#C5D6C8]/80 pointer-events-none px-4 py-1.5 rounded-full bg-[#15241E]/50 backdrop-blur-xs">
                {t.rippleHint}
              </span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                data-testid="finish-ripple-game-btn"
                onClick={onSkipToVerification}
                className="px-5 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.continueToCheckin}</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* MODE 4: 5-4-3-2-1 Sensory Grounding */}
        {activeTab === 'sensory_grounding' && (
          <div data-testid="sensory-grounding-game" className="space-y-5">
            <div className="border-b border-[#ECEFE9] pb-4">
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#283C33]">
                {t.groundingTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[#617068] mt-0.5">{t.groundingSub}</p>
            </div>

            <div className="space-y-2.5">
              {t.groundingSteps.map((stepText, idx) => {
                const done = checkedSteps[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`grounding-step-${idx}`}
                    onClick={() => handleToggleGroundingStep(idx)}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      done
                        ? 'bg-[#E6EFE8] border-[#476652] text-[#283C33]'
                        : 'bg-[#F7F5EF] border-[#DEE5DB] text-[#283C33] hover:border-[#7F9B87]'
                    }`}
                  >
                    <span className="text-sm font-medium">{stepText}</span>
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 ${
                        done ? 'text-[#476652]' : 'text-[#B8C7BC]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                data-testid="finish-grounding-btn"
                onClick={onSkipToVerification}
                className="px-5 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.continueToCheckin}</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
