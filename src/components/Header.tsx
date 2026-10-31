import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Globe,
  History,
  Leaf,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { SessionStage, SignalLevel, SupportMode } from '../types/session';

interface HeaderProps {
  stage: SessionStage;
  activeSupportMode?: SupportMode;
  signalLevel: SignalLevel;
  isDemoMode: boolean;
  aiMode: 'live_ai' | 'demo_fallback';
  locale: Locale;
  historyCount: number;
  onOpenHistory: () => void;
  onToggleLocale: () => void;
  onStartDemo: () => void;
  onReset: () => void;
  onNavigateStage?: (stage: SessionStage) => void;
}

export const Header: React.FC<HeaderProps> = ({
  stage,
  activeSupportMode = 'Plan',
  signalLevel,
  isDemoMode,
  aiMode,
  locale,
  historyCount,
  onOpenHistory,
  onToggleLocale,
  onStartDemo,
  onReset,
  onNavigateStage,
}) => {
  const t = TRANSLATIONS[locale].header;
  const isZh = locale === 'zh';

  const statusColor =
    signalLevel === 'Settled'
      ? 'bg-[#E6EFE8] text-[#2F523B] border-[#C5D6C8]'
      : signalLevel === 'Signals rising'
        ? 'bg-[#F8EAE2] text-[#7A442A] border-[#E5C5B5]'
        : 'bg-[#F3DDD4] text-[#843B22] border-[#DFB6A5]';

  const localizedSignalLevel =
    signalLevel === 'Settled'
      ? t.settled
      : signalLevel === 'Signals rising'
        ? t.rising
        : t.elevated;

  const activeInterventionStage: SessionStage =
    stage === 'listen' || stage === 'regulate' || stage === 'plan'
      ? stage
      : activeSupportMode === 'Listen'
        ? 'listen'
        : activeSupportMode === 'Regulate'
          ? 'regulate'
          : 'plan';

  const flowSteps: Array<{
    key: string;
    targetStage: SessionStage;
    matchStages: SessionStage[];
    labelZh: string;
    labelEn: string;
  }> = [
    {
      key: 'welcome',
      targetStage: 'welcome',
      matchStages: ['welcome'],
      labelZh: '1. 设备与准备',
      labelEn: '1. Setup',
    },
    {
      key: 'live_checkin',
      targetStage: 'live_checkin',
      matchStages: ['live_checkin'],
      labelZh: '2. 实时观察',
      labelEn: '2. Live Observe',
    },
    {
      key: 'support_choice',
      targetStage: 'support_choice',
      matchStages: ['support_choice'],
      labelZh: '3. 选择支持',
      labelEn: '3. Choose Support',
    },
    {
      key: 'intervention',
      targetStage: activeInterventionStage,
      matchStages: ['listen', 'regulate', 'plan'],
      labelZh: '4. 支持干预',
      labelEn: '4. Intervention',
    },
    {
      key: 'verification',
      targetStage: 'verification',
      matchStages: ['verification'],
      labelZh: '5. 效果确认',
      labelEn: '5. Verify',
    },
    {
      key: 'summary',
      targetStage: 'summary',
      matchStages: ['summary'],
      labelZh: '6. 会话总结',
      labelEn: '6. Summary',
    },
  ];

  const currentStepIndex = Math.max(
    0,
    flowSteps.findIndex((s) => s.matchStages.includes(stage))
  );

  const handleGoPrevStep = () => {
    if (!onNavigateStage || currentStepIndex <= 0) return;
    onNavigateStage(flowSteps[currentStepIndex - 1].targetStage);
  };

  const handleGoNextStep = () => {
    if (!onNavigateStage || currentStepIndex >= flowSteps.length - 1) return;
    onNavigateStage(flowSteps[currentStepIndex + 1].targetStage);
  };

  return (
    <header className="w-full border-b border-[#DEE5DB] bg-[#F7F5EF]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#476652] text-[#FFFEFA] flex items-center justify-center shadow-xs group-hover:bg-[#3A5443] transition-colors">
            <Leaf className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-lg tracking-tight text-[#283C33]">
                {t.brandName}
              </span>
              {isDemoMode && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#E8E1F0] text-[#4A3B5C] border border-[#D4C7E3]">
                  {t.demoPersona}
                </span>
              )}
            </div>
            <p className="text-xs text-[#617068] hidden sm:block">{t.slogan}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {stage !== 'welcome' && (
            <div
              data-testid="header-signal-status"
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${statusColor}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  signalLevel === 'Settled'
                    ? 'bg-[#3D6B4E]'
                    : signalLevel === 'Signals rising'
                      ? 'bg-[#B8653B]'
                      : 'bg-[#A63D21]'
                }`}
              />
              <span>{localizedSignalLevel}</span>
            </div>
          )}

          <div
            title={
              aiMode === 'live_ai'
                ? 'Gemini AI router active with automatic fallback'
                : 'Reliable local fallback mode active'
            }
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFECE4] border border-[#DEE5DB] text-[11px] text-[#617068]"
          >
            <Sparkles className="w-3 h-3 text-[#476652]" />
            <span>{aiMode === 'live_ai' ? t.aiAssisted : t.resilientFallback}</span>
          </div>

          {/* History Records Button (Always accessible) */}
          <button
            type="button"
            data-testid="open-history-btn"
            onClick={onOpenHistory}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FFFEFA] hover:bg-[#E6EFE8] text-[#283C33] border border-[#C5D6C8] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-[#476652]" />
            <span>{isZh ? '历史记录' : 'History'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#E6EFE8] text-[#2F523B] font-mono text-[10px] font-semibold">
              {historyCount}
            </span>
          </button>

          {/* Language Switcher Button (Strict Chinese / English toggle) */}
          <button
            type="button"
            data-testid="language-toggle-btn"
            onClick={onToggleLocale}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FFFEFA] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#476652]" />
            <span>{t.langSwitch}</span>
          </button>

          {stage === 'welcome' ? (
            <button
              type="button"
              data-testid="header-try-demo"
              onClick={onStartDemo}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] transition-colors cursor-pointer"
            >
              {t.tryDemo}
            </button>
          ) : (
            <button
              type="button"
              data-testid="header-reset-session"
              onClick={onReset}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#617068] hover:text-[#283C33] hover:bg-[#EFECE4] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.startOver}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Closed-Loop Flow Stepper & Instant Jump Bar (Allows skipping timers / jumping Prev or Next anytime) */}
      {stage !== 'welcome' && onNavigateStage && (
        <div
          data-testid="flow-stepper-bar"
          className="w-full border-t border-[#E5E9E2] bg-[#FFFEFA]/95 px-4 sm:px-6 py-2"
        >
          <div className="max-w-[1120px] mx-auto flex flex-wrap items-center justify-between gap-2">
            {/* Step Pills */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {flowSteps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                return (
                  <button
                    key={step.key}
                    type="button"
                    data-testid={`flow-step-${step.key}`}
                    onClick={() => onNavigateStage(step.targetStage)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      isActive
                        ? 'bg-[#476652] text-[#FFFEFA] shadow-2xs font-semibold'
                        : isPassed
                          ? 'bg-[#E6EFE8] text-[#2F523B] hover:bg-[#D5E5D9]'
                          : 'bg-[#F7F5EF] text-[#617068] hover:text-[#283C33] hover:bg-[#EFECE4]'
                    }`}
                  >
                    <span>{isZh ? step.labelZh : step.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Instant Prev / Next / Finish Early Action Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="flow-prev-step-btn"
                disabled={currentStepIndex <= 0}
                onClick={handleGoPrevStep}
                className="px-2.5 py-1 rounded-lg bg-[#F7F5EF] hover:bg-[#EFECE4] disabled:opacity-40 text-[#283C33] border border-[#DEE5DB] text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{isZh ? '上一环节' : 'Prev Step'}</span>
              </button>

              {currentStepIndex < flowSteps.length - 1 && (
                <button
                  type="button"
                  data-testid="flow-next-step-btn"
                  onClick={handleGoNextStep}
                  className="px-2.5 py-1 rounded-lg bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{isZh ? '跳过计时 · 下一环节' : 'Skip Timer · Next Step'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {stage !== 'summary' && (
                <button
                  type="button"
                  data-testid="flow-end-early-btn"
                  onClick={() => onNavigateStage('summary')}
                  className="px-2.5 py-1 rounded-lg bg-[#F8EAE2] hover:bg-[#F3DDD4] text-[#7A442A] border border-[#E5C5B5] text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Flag className="w-3 h-3" />
                  <span>{isZh ? '提前结束看总结' : 'End Early'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
