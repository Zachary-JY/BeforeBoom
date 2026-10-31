import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Heart,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  buildMultimodalTimelineSeries,
  formatActivityDisplay,
} from '../lib/beforeboomEngine';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import {
  FacialExpressionReading,
  HeartRatePoint,
  InputEntry,
  InterventionAttempt,
  PlanStepCard,
  SessionContextData,
  SignalNoticeEvidence,
} from '../types/session';
import { MultimodalTimelineChart } from './MultimodalTimelineChart';

interface SummaryViewProps {
  locale: Locale;
  context: SessionContextData;
  signalNotice: SignalNoticeEvidence;
  interventions: InterventionAttempt[];
  planCard: PlanStepCard;
  heartRateSeries: HeartRatePoint[];
  inputs: InputEntry[];
  facialReading?: FacialExpressionReading | null;
  onStartNewCheckin: () => void;
  onReturnToObservation: () => void;
  onBackToVerification?: () => void;
  onOpenHistory?: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  locale,
  context,
  signalNotice,
  interventions,
  planCard,
  heartRateSeries,
  inputs,
  facialReading,
  onStartNewCheckin,
  onReturnToObservation,
  onBackToVerification,
  onOpenHistory,
}) => {
  const t = TRANSLATIONS[locale].summary;
  const ts = TRANSLATIONS[locale].support;
  const tv = TRANSLATIONS[locale].verification;
  const isZh = locale === 'zh';

  const helpfulModes = interventions.filter((i) => i.feedback === 'Better');
  const latestIntervention = interventions[interventions.length - 1];
  const activityDisplay = formatActivityDisplay(context, locale);

  const modeLabelMap = {
    Listen: ts.listenTitle,
    Regulate: ts.regulateTitle,
    Plan: ts.planTitle,
  };

  const feelingLabelMap = {
    Better: tv.betterLabel,
    Same: tv.sameLabel,
    Worse: tv.worseLabel,
  };

  const sessionTimeline = buildMultimodalTimelineSeries({
    heartRateSeries,
    inputs,
    facialReading,
    interventions,
    baselineBpm: context.baselineBpm,
    baselineHrvMs: context.baselineHrvMs,
  });

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-3xl p-6 sm:p-8 shadow-[0_14px_36px_-10px_rgba(40,60,51,0.08)] space-y-7">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECEFE9] pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E6EFE8] text-[#2F523B] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.badge}</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#283C33]">
              {t.titlePrefix} {context.personaName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBackToVerification && (
              <button
                type="button"
                data-testid="summary-back-verify-btn"
                onClick={onBackToVerification}
                className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isZh ? '返回上一环节' : 'Previous Step'}</span>
              </button>
            )}

            {onOpenHistory && (
              <button
                type="button"
                data-testid="summary-open-history-btn"
                onClick={onOpenHistory}
                className="px-3.5 py-1.5 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>{isZh ? '查看全部历史记录与对比' : 'View Session History'}</span>
              </button>
            )}

            <span className="text-xs font-mono text-[#617068] bg-[#F7F5EF] px-3 py-1.5 rounded-xl border border-[#E5E9E2]">
              {activityDisplay} · {context.plannedDurationMinutes}{' '}
              {TRANSLATIONS[locale].welcome.minUnit}
            </span>
          </div>
        </div>

        {/* Full Session Multimodal Trajectory Visualization Chart */}
        <MultimodalTimelineChart
          locale={locale}
          timeline={sessionTimeline}
          title={
            isZh
              ? '本次观察全过程多模态状态轨迹回顾'
              : 'Session Multimodal State Trajectory Review'
          }
        />

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Signals Noticed */}
          <div
            data-testid="summary-signals-card"
            className="p-5 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2] space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#476652]">
              <Heart className="w-3.5 h-3.5" />
              <span>{t.card1Title}</span>
            </div>
            <p className="text-sm text-[#283C33] leading-relaxed">{signalNotice.summaryText}</p>
            <ul className="text-xs text-[#617068] space-y-1 list-disc pl-4">
              {signalNotice.observableEvidence.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          </div>

          {/* 2. Support Modes Tried & Feedback */}
          <div
            data-testid="summary-interventions-card"
            className="p-5 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2] space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#476652]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.card2Title}</span>
            </div>

            {interventions.length === 0 ? (
              <p className="text-xs text-[#617068] leading-relaxed">{t.noInterventionsText}</p>
            ) : (
              <div className="space-y-2">
                {interventions.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#FFFEFA] border border-[#DEE5DB] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#283C33]">
                        {modeLabelMap[item.mode]}
                      </span>
                      <span className="text-[#617068] ml-2 font-mono">{item.timestamp}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-medium ${
                        item.feedback === 'Better'
                          ? 'bg-[#E6EFE8] text-[#2F523B]'
                          : item.feedback === 'Same'
                            ? 'bg-[#EFECE4] text-[#617068]'
                            : 'bg-[#F8EAE2] text-[#7A442A]'
                      }`}
                    >
                      {item.feedback ? feelingLabelMap[item.feedback] : t.completedTag}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. What Worked & Next Step */}
        <div
          data-testid="summary-next-step-card"
          className="p-5 sm:p-6 rounded-2xl bg-[#E6EFE8]/60 border border-[#C5D6C8] space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2F523B]">
            <Compass className="w-4 h-4" />
            <span>{t.card3Title}</span>
          </div>

          <p className="text-sm text-[#283C33] leading-relaxed">
            {helpfulModes.length > 0 ? (
              <>
                {t.helpfulPrefix}{' '}
                <strong>{helpfulModes.map((m) => modeLabelMap[m.mode]).join('、')}</strong>{' '}
                {t.helpfulSuffix}
              </>
            ) : latestIntervention ? (
              <>
                {t.triedPrefix} <strong>{modeLabelMap[latestIntervention.mode]}</strong>
                {t.triedSuffix}
              </>
            ) : (
              <>{t.defaultKeepNotice}</>
            )}
          </p>

          <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#C5D6C8] space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#617068]">
              {t.next20StepLabel}
            </div>
            <p className="font-serif text-base font-medium text-[#283C33]">
              {planCard.next20MinutesAction}
            </p>
            <p className="text-xs text-[#617068]">
              {t.doneWhenPrefix} {planCard.completionCondition}
            </p>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="summary-return-observe-btn"
            onClick={onReturnToObservation}
            className="px-4 py-2.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            {t.returnObserveBtn}
          </button>

          <button
            type="button"
            data-testid="summary-new-checkin-btn"
            onClick={onStartNewCheckin}
            className="px-5 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.startNewCheckinBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
