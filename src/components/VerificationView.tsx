import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  MessageCircleHeart,
  RefreshCw,
  Wind,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { SupportMode, VerificationFeeling } from '../types/session';

interface VerificationViewProps {
  locale: Locale;
  lastSupportMode: SupportMode;
  onRecordFeedback: (
    feeling: VerificationFeeling,
    nextAction: 'summary' | 'switch' | 'observe',
    targetMode?: SupportMode
  ) => void;
  onBackToIntervention?: () => void;
  onSkipToSummary?: () => void;
}

const FEELINGS: VerificationFeeling[] = ['Better', 'Same', 'Worse'];

export const VerificationView: React.FC<VerificationViewProps> = ({
  locale,
  lastSupportMode,
  onRecordFeedback,
  onBackToIntervention,
  onSkipToSummary,
}) => {
  const [selectedFeeling, setSelectedFeeling] = useState<VerificationFeeling | null>(null);
  const t = TRANSLATIONS[locale].verification;
  const ts = TRANSLATIONS[locale].support;
  const isZh = locale === 'zh';

  const otherModes: SupportMode[] = (['Listen', 'Regulate', 'Plan'] as SupportMode[]).filter(
    (m) => m !== lastSupportMode
  );

  const modeLabelMap: Record<SupportMode, string> = {
    Listen: ts.listenTitle,
    Regulate: ts.regulateTitle,
    Plan: ts.planTitle,
  };

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-3xl p-6 sm:p-9 shadow-[0_14px_36px_-10px_rgba(40,60,51,0.08)] space-y-7">
        {/* Top Instant Step Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEFE9] pb-4">
          {onBackToIntervention ? (
            <button
              type="button"
              data-testid="verify-back-btn"
              onClick={onBackToIntervention}
              className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isZh ? '← 返回上一环节' : '← Back to Support'}</span>
            </button>
          ) : (
            <div />
          )}

          {onSkipToSummary && (
            <button
              type="button"
              data-testid="verify-skip-to-summary-btn"
              onClick={onSkipToSummary}
              className="px-3.5 py-1.5 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{isZh ? '直接查看会话总结 →' : 'Skip to Session Summary →'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EFECE4] text-xs font-medium text-[#617068]">
            <span>
              {t.badgePrefix}: {modeLabelMap[lastSupportMode]}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#283C33]">
            {t.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#617068] max-w-[48ch] mx-auto leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* 3 Equal-Weight Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {FEELINGS.map((feeling) => {
            const active = selectedFeeling === feeling;
            const label =
              feeling === 'Better'
                ? t.betterLabel
                : feeling === 'Same'
                  ? t.sameLabel
                  : t.worseLabel;
            const desc =
              feeling === 'Better'
                ? t.betterDesc
                : feeling === 'Same'
                  ? t.sameDesc
                  : t.worseDesc;
            return (
              <button
                key={feeling}
                type="button"
                data-testid={`verification-option-${feeling.toLowerCase()}`}
                onClick={() => setSelectedFeeling(feeling)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  active
                    ? 'bg-[#476652] text-[#FFFEFA] border-[#476652] shadow-sm'
                    : 'bg-[#F7F5EF] text-[#283C33] border-[#DEE5DB] hover:border-[#7F9B87]'
                }`}
              >
                <div className="font-serif text-lg font-semibold">{label}</div>
                <p
                  className={`text-xs mt-2 leading-relaxed ${
                    active ? 'text-[#E6EFE8]' : 'text-[#617068]'
                  }`}
                >
                  {desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Dynamic Follow-up Path Based on Selection */}
        {selectedFeeling === 'Better' && (
          <div
            data-testid="verification-followup-better"
            className="p-5 rounded-2xl bg-[#E6EFE8]/60 border border-[#C5D6C8] space-y-4"
          >
            <p className="text-sm text-[#283C33] leading-relaxed">{t.betterFollowup}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="verification-continue-summary-btn"
                onClick={() => onRecordFeedback('Better', 'summary')}
                className="px-5 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.viewSummaryBtn}</span>
              </button>

              <button
                type="button"
                data-testid="verification-return-observe-btn"
                onClick={() => onRecordFeedback('Better', 'observe')}
                className="px-4 py-2.5 rounded-xl bg-[#FFFEFA] hover:bg-[#EFECE4] text-[#283C33] border border-[#C5D6C8] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                {t.returnObserveBtn}
              </button>
            </div>
          </div>
        )}

        {(selectedFeeling === 'Same' || selectedFeeling === 'Worse') && (
          <div
            data-testid="verification-followup-adjust"
            className="p-5 rounded-2xl bg-[#F7F5EF] border border-[#DEE5DB] space-y-4"
          >
            <p className="text-sm text-[#283C33] leading-relaxed">
              {t.adjustFollowupPrefix} <strong>{modeLabelMap[lastSupportMode]}</strong>{' '}
              {t.adjustFollowupSuffix}
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              {otherModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`verification-try-${mode.toLowerCase()}-btn`}
                  onClick={() => onRecordFeedback(selectedFeeling, 'switch', mode)}
                  className="px-4 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {mode === 'Listen' && <MessageCircleHeart className="w-3.5 h-3.5" />}
                  {mode === 'Regulate' && <Wind className="w-3.5 h-3.5" />}
                  {mode === 'Plan' && <Compass className="w-3.5 h-3.5" />}
                  <span>
                    {t.tryModePrefix} {modeLabelMap[mode]}
                  </span>
                </button>
              ))}

              <button
                type="button"
                data-testid="verification-pause-observe-btn"
                onClick={() => onRecordFeedback(selectedFeeling, 'observe')}
                className="px-3.5 py-2.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.backToQuietBtn}</span>
              </button>

              <button
                type="button"
                data-testid="verification-end-summary-btn"
                onClick={() => onRecordFeedback(selectedFeeling, 'summary')}
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFEFA] hover:bg-[#EFECE4] text-[#617068] hover:text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.endViewSummaryBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
