import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Flag,
  MessageCircleHeart,
  Send,
  Wind,
} from 'lucide-react';
import { formatActivityDisplay } from '../lib/beforeboomEngine';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import {
  ListenChatMessage,
  ListenSubMode,
  SessionContextData,
  SupportMode,
} from '../types/session';

interface ListenViewProps {
  locale: Locale;
  context: SessionContextData;
  messages: ListenChatMessage[];
  subMode: ListenSubMode;
  isSending: boolean;
  onChangeSubMode: (mode: ListenSubMode) => void;
  onSendMessage: (text: string) => void;
  onSwitchSupportMode: (mode: SupportMode) => void;
  onFinishToVerification: () => void;
  onBackToSupportChoice?: () => void;
  onEndToSummary?: () => void;
}

const SUB_MODES: ListenSubMode[] = ['Just listen', 'Help me settle', 'Find a next step'];

export const ListenView: React.FC<ListenViewProps> = ({
  locale,
  context,
  messages,
  subMode,
  isSending,
  onChangeSubMode,
  onSendMessage,
  onSwitchSupportMode,
  onFinishToVerification,
  onBackToSupportChoice,
  onEndToSummary,
}) => {
  const [draft, setDraft] = useState('');
  const t = TRANSLATIONS[locale].listen;
  const isZh = locale === 'zh';
  const activityDisplay = formatActivityDisplay(context, locale);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSending) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  return (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Bar: Context & Mode Switchers */}
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          {onBackToSupportChoice && (
            <button
              type="button"
              data-testid="listen-back-btn"
              onClick={onBackToSupportChoice}
              className="px-2.5 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isZh ? '上一环节' : 'Back'}</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-[#E6EFE8] border border-[#C5D6C8] flex items-center justify-center text-[#476652]">
            <MessageCircleHeart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-semibold text-[#283C33]">
              {t.title}
            </h1>
            <p className="text-xs text-[#617068]">
              {activityDisplay} · {context.currentTask}
            </p>
          </div>
        </div>

        {/* Switch support mode or finish */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="listen-switch-regulate-btn"
            onClick={() => onSwitchSupportMode('Regulate')}
            className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Wind className="w-3.5 h-3.5 text-[#4A3B5C]" />
            <span>{t.switchRegulate}</span>
          </button>

          <button
            type="button"
            data-testid="listen-switch-plan-btn"
            onClick={() => onSwitchSupportMode('Plan')}
            className="px-3 py-1.5 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#7A442A]" />
            <span>{t.switchPlan}</span>
          </button>

          <button
            type="button"
            data-testid="listen-finish-btn"
            onClick={onFinishToVerification}
            className="px-3.5 py-1.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{t.doneTalking}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onEndToSummary && (
            <button
              type="button"
              data-testid="listen-end-summary-btn"
              onClick={onEndToSummary}
              className="px-3 py-1.5 rounded-xl bg-[#F8EAE2] hover:bg-[#F3DDD4] text-[#7A442A] border border-[#E5C5B5] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Flag className="w-3 h-3" />
              <span>{isZh ? '提前结束' : 'End Early'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-mode Preference Bar: Just listen / Help me settle / Find a next step */}
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-4 space-y-2.5">
        <div className="text-xs font-medium text-[#617068]">{t.subModePrompt}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SUB_MODES.map((item) => {
            const active = subMode === item;
            return (
              <button
                key={item}
                type="button"
                data-testid={`listen-submode-${item.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => onChangeSubMode(item)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#476652] text-[#FFFEFA] border-[#476652]'
                    : 'bg-[#F7F5EF] text-[#283C33] border-[#DEE5DB] hover:border-[#7F9B87]'
                }`}
              >
                {t.subModes[item]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Conversation Container */}
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_10px_28px_-8px_rgba(40,60,51,0.06)]">
        <div
          data-testid="listen-chat-messages"
          className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#476652] text-[#FFFEFA]'
                      : 'bg-[#F7F5EF] text-[#283C33] border border-[#E5E9E2]'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] font-mono text-[#617068] mt-1 px-1">
                  {isUser ? t.youLabel : t.assistantLabel} · {msg.timestamp}
                </span>
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-start">
              <div className="bg-[#F7F5EF] text-[#617068] border border-[#E5E9E2] rounded-2xl px-4 py-2.5 text-xs animate-pulse">
                {t.listeningPulse}
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2.5 pt-2 border-t border-[#ECEFE9]">
          <input
            type="text"
            data-testid="listen-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.inputPlaceholder}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#D5DDD2] bg-[#F7F5EF] text-sm text-[#283C33] placeholder-[#8C9A92] focus:outline-none focus:border-[#476652] focus:bg-[#FFFEFA]"
          />
          <button
            type="submit"
            data-testid="listen-chat-send-btn"
            disabled={isSending}
            className="px-4 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] disabled:opacity-60 text-[#FFFEFA] text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.sendBtn}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
