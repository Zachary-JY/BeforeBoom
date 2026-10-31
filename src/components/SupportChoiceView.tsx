import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Flag,
  MessageCircleHeart,
  Sparkles,
  Wind,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { DismissReason, SignalNoticeEvidence, SupportMode } from '../types/session';

interface SupportChoiceViewProps {
  locale: Locale;
  signalNotice: SignalNoticeEvidence;
  onSelectSupport: (mode: SupportMode) => void;
  onDismissCheckin: (reason?: DismissReason) => void;
  onBackToObservation: () => void;
  onSkipToVerification?: () => void;
  onEndEarlyToSummary?: () => void;
}

const DISMISS_KEYS: DismissReason[] = [
  'Just excited',
  'Just exercised',
  "Doesn't feel accurate",
];

export const SupportChoiceView: React.FC<SupportChoiceViewProps> = ({
  locale,
  signalNotice,
  onSelectSupport,
  onDismissCheckin,
  onBackToObservation,
  onSkipToVerification,
  onEndEarlyToSummary,
}) => {
  const [showDismissOptions, setShowDismissOptions] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DismissReason | undefined>(undefined);

  const t = TRANSLATIONS[locale].support;
  const isZh = locale === 'zh';

  const cards: Array<{
    mode: SupportMode;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    accentBg: string;
  }> = [
    {
      mode: 'Listen',
      title: t.listenTitle,
      subtitle: t.listenSub,
      icon: <MessageCircleHeart className="w-5 h-5 text-[#476652]" />,
      accentBg: 'bg-[#E6EFE8] border-[#C5D6C8]',
    },
    {
      mode: 'Regulate',
      title: t.regulateTitle,
      subtitle: t.regulateSub,
      icon: <Wind className="w-5 h-5 text-[#4A3B5C]" />,
      accentBg: 'bg-[#E8E1F0] border-[#D4C7E3]',
    },
    {
      mode: 'Plan',
      title: t.planTitle,
      subtitle: t.planSub,
      icon: <Compass className="w-5 h-5 text-[#7A442A]" />,
      accentBg: 'bg-[#F3E0D5] border-[#E5C5B5]',
    },
  ];

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-7">
      {/* Top Step Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid="support-back-to-live-btn"
          onClick={onBackToObservation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFEFA] hover:bg-[#EFECE4] border border-[#DEE5DB] text-xs font-medium text-[#283C33] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.backBtn}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onSkipToVerification && (
            <button
              type="button"
              data-testid="support-skip-to-verify-btn"
              onClick={onSkipToVerification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] border border-[#C5D6C8] text-xs font-medium text-[#2F523B] transition-colors cursor-pointer"
            >
              <span>{isZh ? '跳到效果确认' : 'Jump to Verification'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onEndEarlyToSummary && (
            <button
              type="button"
              data-testid="support-end-early-btn"
              onClick={onEndEarlyToSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8EAE2] hover:bg-[#F3DDD4] border border-[#E5C5B5] text-xs font-medium text-[#7A442A] transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{isZh ? '提前结束并查看总结' : 'End Early & View Summary'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Header & Grounded Context */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#EFECE4] border border-[#DCD8CD] text-xs text-[#617068]">
          <Sparkles className="w-3.5 h-3.5 text-[#476652]" />
          <span>{t.badge}</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#283C33]">
          {t.title}
        </h1>
        <p className="text-sm sm:text-base text-[#617068] max-w-[65ch] leading-relaxed">
          {signalNotice.recommendationReason}
        </p>
      </div>

      {/* 3 Primary Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((card) => {
          const isRecommended = signalNotice.recommendedSupport === card.mode;
          return (
            <button
              key={card.mode}
              type="button"
              data-testid={`support-card-${card.mode.toLowerCase()}`}
              onClick={() => onSelectSupport(card.mode)}
              className={`text-left rounded-2xl p-6 transition-all flex flex-col justify-between border cursor-pointer group ${
                isRecommended
                  ? 'bg-[#FFFEFA] border-2 border-[#476652] shadow-[0_12px_30px_-8px_rgba(71,102,82,0.16)]'
                  : 'bg-[#FFFEFA] border-[#DEE5DB] hover:border-[#7F9B87] shadow-xs'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.accentBg}`}
                  >
                    {card.icon}
                  </div>
                  {isRecommended && (
                    <span
                      data-testid="recommended-support-badge"
                      className="px-2.5 py-1 rounded-md bg-[#E6EFE8] text-[#2F523B] text-[11px] font-semibold border border-[#C5D6C8]"
                    >
                      {t.suggestedBadge}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h2 className="font-serif text-xl font-semibold text-[#283C33] group-hover:text-[#476652] transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-sm text-[#617068] leading-relaxed">{card.subtitle}</p>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-[#F0F2ED] flex items-center justify-between text-xs font-semibold text-[#476652]">
                <span>
                  {t.choosePrefix} {card.title}
                </span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4th Option: "I'm okay — Dismiss this check-in" */}
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif text-base font-semibold text-[#283C33]">{t.imOkayTitle}</h3>
            <p className="text-xs text-[#617068]">{t.imOkaySub}</p>
          </div>

          {!showDismissOptions ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-testid="support-im-okay-expand-btn"
                onClick={() => setShowDismissOptions(true)}
                className="px-4 py-2.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium transition-colors cursor-pointer"
              >
                {t.imOkayAddNoteBtn}
              </button>
              <button
                type="button"
                data-testid="support-im-okay-quick-btn"
                onClick={() => onDismissCheckin(undefined)}
                className="px-4 py-2.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#617068] hover:text-[#283C33] border border-[#DEE5DB] text-xs font-medium transition-colors cursor-pointer"
              >
                {t.dismissNowBtn}
              </button>
            </div>
          ) : null}
        </div>

        {showDismissOptions && (
          <div
            data-testid="dismiss-reason-panel"
            className="pt-3 border-t border-[#ECEFE9] space-y-3"
          >
            <div className="text-xs font-medium text-[#283C33]">{t.optionalFeedbackLabel}</div>
            <div className="flex flex-wrap gap-2">
              {DISMISS_KEYS.map((reason) => {
                const active = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    data-testid={`dismiss-reason-${reason.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    onClick={() => setSelectedReason(active ? undefined : reason)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-[#476652] text-[#FFFEFA] border-[#476652]'
                        : 'bg-[#F7F5EF] text-[#283C33] border-[#DEE5DB] hover:border-[#7F9B87]'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{t.dismissReasons[reason]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                data-testid="confirm-dismiss-btn"
                onClick={() => onDismissCheckin(selectedReason)}
                className="px-4 py-2 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium transition-colors cursor-pointer"
              >
                {t.returnToQuietBtn}
              </button>
              <button
                type="button"
                onClick={() => setShowDismissOptions(false)}
                className="px-3 py-2 rounded-xl text-xs text-[#617068] hover:text-[#283C33] cursor-pointer"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
