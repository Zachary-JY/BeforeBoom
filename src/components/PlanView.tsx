import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Compass,
  FastForward,
  Flag,
  Layers,
  MessageCircleHeart,
  Pause,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { PlanStepCard } from '../types/session';

interface PlanViewProps {
  locale: Locale;
  planCard: PlanStepCard;
  isLoadingVariation: boolean;
  onRequestDifferentStep: () => void;
  onSwitchToListen: () => void;
  onCompletePlanBlock: () => void;
  onBackToSupportChoice?: () => void;
  onEndEarlyToSummary?: () => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
  locale,
  planCard,
  isLoadingVariation,
  onRequestDifferentStep,
  onSwitchToListen,
  onCompletePlanBlock,
  onBackToSupportChoice,
  onEndEarlyToSummary,
}) => {
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(20 * 60);

  const t = TRANSLATIONS[locale].plan;
  const isZh = locale === 'zh';

  useEffect(() => {
    if (!timerStarted || timerPaused) return;
    if (secondsLeft <= 0) {
      onCompletePlanBlock();
      return;
    }

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerStarted, timerPaused, secondsLeft, onCompletePlanBlock]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedCountdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-3xl p-6 sm:p-8 shadow-[0_14px_36px_-10px_rgba(40,60,51,0.08)] space-y-6">
        {/* Top Step Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEFE9] pb-4">
          <div className="flex items-center gap-3">
            {onBackToSupportChoice && (
              <button
                type="button"
                data-testid="plan-back-btn"
                onClick={onBackToSupportChoice}
                className="px-2.5 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isZh ? '上一环节' : 'Back'}</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-[#F3E0D5] border border-[#E5C5B5] flex items-center justify-center text-[#7A442A]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[#283C33]">
                {t.title}
              </h1>
              <p className="text-xs text-[#617068]">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="plan-skip-timer-btn"
              onClick={onCompletePlanBlock}
              className="px-3 py-1.5 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isZh ? '不等待计时 · 直接进入效果确认' : 'Skip 20m Timer · Verify Now'}</span>
            </button>

            {onEndEarlyToSummary && (
              <button
                type="button"
                data-testid="plan-end-early-btn"
                onClick={onEndEarlyToSummary}
                className="px-3 py-1.5 rounded-xl bg-[#F8EAE2] hover:bg-[#F3DDD4] text-[#7A442A] border border-[#E5C5B5] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Flag className="w-3 h-3" />
                <span>{isZh ? '提前结束' : 'End Early'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Structured 4-Part Action Card */}
        <div className="space-y-4">
          {/* 1. Priority Task */}
          <div className="p-4 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2] space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#617068]">
              {t.priorityTaskLabel}
            </div>
            <div
              data-testid="plan-priority-task"
              className="font-serif text-base sm:text-lg font-semibold text-[#283C33]"
            >
              {planCard.priorityTask}
            </div>
          </div>

          {/* 2. Next 20 Minutes Concrete Action */}
          <div className="p-5 rounded-2xl bg-[#E6EFE8]/60 border-2 border-[#7F9B87] space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#2F523B]">
              {t.next20Label}
            </div>
            <p
              data-testid="plan-20min-action"
              className="font-serif text-lg sm:text-xl text-[#283C33] leading-relaxed"
            >
              “{planCard.next20MinutesAction}”
            </p>
          </div>

          {/* 3. Clear Completion Condition */}
          <div className="p-4 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2] space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#617068] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#476652]" />
              <span>{t.doneConditionLabel}</span>
            </div>
            <p
              data-testid="plan-completion-condition"
              className="text-sm text-[#283C33] leading-relaxed"
            >
              {planCard.completionCondition}
            </p>
          </div>

          {/* 4. Temporarily Set Aside */}
          <div className="p-4 rounded-2xl bg-[#EFECE4]/70 border border-[#DCD8CD] space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#617068] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#617068]" />
              <span>{t.setAsideLabel}</span>
            </div>
            <ul className="space-y-1 text-xs text-[#617068] list-disc pl-4">
              {planCard.setAsideList.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Interactive 20-Minute Focus Timer OR Choice Buttons */}
        {!timerStarted ? (
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="plan-start-20m-btn"
              onClick={() => {
                setTimerStarted(true);
                setTimerPaused(false);
              }}
              className="px-5 py-3 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-sm font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{t.start20Btn}</span>
            </button>

            <button
              type="button"
              data-testid="plan-complete-immediately-btn"
              onClick={onCompletePlanBlock}
              className="px-4 py-3 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isZh ? '直接完成并确认感受 →' : 'Complete & Verify Now →'}</span>
            </button>

            <button
              type="button"
              data-testid="plan-different-step-btn"
              disabled={isLoadingVariation}
              onClick={onRequestDifferentStep}
              className="px-4 py-3 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingVariation ? 'animate-spin' : ''}`}
              />
              <span>{isLoadingVariation ? t.findingSmaller : t.differentStepBtn}</span>
            </button>

            <button
              type="button"
              data-testid="plan-rather-talk-btn"
              onClick={onSwitchToListen}
              className="px-4 py-3 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#617068] hover:text-[#283C33] border border-[#DEE5DB] text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageCircleHeart className="w-3.5 h-3.5" />
              <span>{t.ratherTalkBtn}</span>
            </button>
          </div>
        ) : (
          <div
            data-testid="plan-active-timer-box"
            className="p-5 rounded-2xl bg-[#F7F5EF] border-2 border-[#476652] flex flex-wrap items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#476652] uppercase tracking-wider">
                {t.activeWindowLabel}
              </div>
              <div
                data-testid="plan-countdown-display"
                className="text-3xl font-mono font-semibold text-[#283C33] tabular-nums"
              >
                {formattedCountdown}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-testid="plan-timer-pause-btn"
                onClick={() => setTimerPaused((p) => !p)}
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFEFA] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {timerPaused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{timerPaused ? t.resume : t.pause}</span>
              </button>

              <button
                type="button"
                data-testid="plan-timer-finish-btn"
                onClick={onCompletePlanBlock}
                className="px-4 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{t.finishBlockBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
