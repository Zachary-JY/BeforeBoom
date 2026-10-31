import React from 'react';
import { Activity, Heart, Watch, Wind, X } from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { WatchAlertState } from '../types/session';

interface SmartwatchAlertModalProps {
  watchAlert: WatchAlertState;
  locale: Locale;
  onQuickBreathe: () => void;
  onDismiss: () => void;
}

export const SmartwatchAlertModal: React.FC<SmartwatchAlertModalProps> = ({
  watchAlert,
  locale,
  onQuickBreathe,
  onDismiss,
}) => {
  if (!watchAlert.triggered || watchAlert.acknowledged) {
    return null;
  }

  const t = TRANSLATIONS[locale].watch;
  const localizedReason = locale === 'zh' ? watchAlert.reasonZh : watchAlert.reasonEn;

  return (
    <div
      data-testid="smartwatch-alert-modal"
      className="fixed top-20 right-4 sm:right-6 z-50 w-[310px] animate-in fade-in slide-in-from-top-3 duration-300"
    >
      {/* Realistic Smartwatch Bezel Card */}
      <div className="bg-[#1C2822] text-[#F7F5EF] rounded-[28px] p-4 border-2 border-[#476652] shadow-[0_18px_40px_-10px_rgba(20,32,26,0.45)] relative overflow-hidden">
        {/* Subtle haptic pulse ring */}
        <div className="flex items-center justify-between border-b border-[#31453B] pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E59866] animate-ping" />
            <Watch className="w-4 h-4 text-[#A7C4B0]" />
            <span className="text-xs font-semibold tracking-wide text-[#D5E2D9]">
              {t.alertTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono tabular-nums text-[#9AB0A3]">
              {watchAlert.triggeredAt}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[#9AB0A3] hover:text-white p-0.5 rounded cursor-pointer"
              aria-label="Close watch alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-wider text-[#E59866] font-semibold mb-1">
          {t.alertSubtitle}
        </p>

        {/* Watch Metrics Row */}
        <div className="grid grid-cols-2 gap-2 my-2.5">
          <div className="bg-[#26362E] rounded-xl px-3 py-2 border border-[#364B40]">
            <div className="flex items-center gap-1 text-[10px] text-[#A7C4B0]">
              <Activity className="w-3 h-3 text-[#E59866]" />
              <span>{t.hrvLabel}</span>
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-white mt-0.5">
              {watchAlert.hrvRmssdMs} {locale === 'zh' ? '毫秒' : 'ms'}
              <span className="text-[10px] text-[#9AB0A3] block font-normal">
                {t.basePrefix} {watchAlert.baselineHrvMs} {locale === 'zh' ? '毫秒' : 'ms'}
              </span>
            </div>
          </div>

          <div className="bg-[#26362E] rounded-xl px-3 py-2 border border-[#364B40]">
            <div className="flex items-center gap-1 text-[10px] text-[#A7C4B0]">
              <Heart className="w-3 h-3 text-[#E59866]" />
              <span>{t.hrLabel}</span>
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-white mt-0.5">
              {watchAlert.bpm} {locale === 'zh' ? '次/分' : 'bpm'}
              <span className="text-[10px] text-[#E59866] block font-normal">
                {t.elevatedTag}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#D5E2D9] leading-relaxed mb-3.5">{localizedReason}</p>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="watch-quick-breathe-btn"
            onClick={onQuickBreathe}
            className="w-full py-2 px-3 rounded-xl bg-[#476652] hover:bg-[#567A63] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Wind className="w-3.5 h-3.5" />
            {t.actionBreathe}
          </button>
          <button
            type="button"
            data-testid="watch-dismiss-btn"
            onClick={onDismiss}
            className="w-full py-1.5 px-3 rounded-xl bg-[#26362E] hover:bg-[#31453B] text-[#C5D6C8] text-xs font-medium transition-colors cursor-pointer"
          >
            {t.actionDismiss}
          </button>
        </div>
      </div>
    </div>
  );
};
