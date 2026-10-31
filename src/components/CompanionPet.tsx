import React, { useState } from 'react';
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronUp,
  Heart,
  Mic,
  Sparkles,
  Watch,
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import {
  FacialExpressionReading,
  HeartRatePoint,
  PetMood,
  WearableDeviceState,
} from '../types/session';

interface CompanionPetProps {
  mood: PetMood;
  locale: Locale;
  latestHr: HeartRatePoint;
  facialReading?: FacialExpressionReading | null;
  cameraActive?: boolean;
  micActive?: boolean;
  wearableDevice?: WearableDeviceState;
}

export const CompanionPet: React.FC<CompanionPetProps> = ({
  mood,
  locale,
  latestHr,
  facialReading,
  cameraActive = false,
  micActive = false,
  wearableDevice,
}) => {
  const [minimized, setMinimized] = useState(false);
  const t = TRANSLATIONS[locale].pet;

  const moodDescriptionMap: Record<PetMood, string> = {
    calm: t.calm,
    happy: t.happy,
    anxious: t.anxious,
    sad: t.sad,
    relieved: t.relieved,
  };

  const moodLabelMap: Record<PetMood, string> = {
    calm: t.moodCalm,
    happy: t.moodHappy,
    anxious: t.moodAnxious,
    sad: t.moodSad,
    relieved: t.moodRelieved,
  };

  const moodColorMap: Record<PetMood, string> = {
    calm: 'bg-[#EEF3EC] border-[#C5D6C8] text-[#2F523B]',
    happy: 'bg-[#FFF5D6] border-[#F0D78C] text-[#7A5912]',
    anxious: 'bg-[#F8EAE2] border-[#E5C5B5] text-[#84452B]',
    sad: 'bg-[#E9EEF6] border-[#C4D3E8] text-[#354E73]',
    relieved: 'bg-[#EFEAF6] border-[#D3C6E6] text-[#4A3869]',
  };

  const isWearableConnected =
    wearableDevice && wearableDevice.status !== 'disconnected';

  return (
    <div
      data-testid="companion-pet-widget"
      className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-3 select-none"
    >
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl shadow-[0_6px_20px_-8px_rgba(40,60,51,0.08)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Original Cute Chubby White Mochi ("小团子") with Leaf Sprout */}
          <div className="relative w-14 h-14 rounded-2xl bg-[#F7F5EF] border border-[#E5E9E2] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            <svg
              viewBox="0 0 100 100"
              className={`w-13 h-13 transition-transform duration-500 ${
                mood === 'happy'
                  ? 'animate-spin'
                  : mood === 'anxious'
                    ? 'animate-bounce'
                    : mood === 'relieved'
                      ? 'scale-105'
                      : 'scale-100'
              }`}
              style={{
                animationDuration:
                  mood === 'happy' ? '2.8s' : mood === 'anxious' ? '0.45s' : '3.2s',
              }}
            >
              {/* Soft glowing aura behind Mochi */}
              <circle
                cx="50"
                cy="56"
                r="40"
                fill={
                  mood === 'happy'
                    ? '#FDE68A'
                    : mood === 'anxious'
                      ? '#F5CBA7'
                      : mood === 'sad'
                        ? '#BFDBFE'
                        : mood === 'relieved'
                          ? '#DDD6FE'
                          : '#D5E5D9'
                }
                opacity="0.55"
              />

              {/* Cute ground shadow */}
              <ellipse cx="50" cy="86" rx="24" ry="4.5" fill="#C8D2C8" opacity="0.55" />

              {/* Adorable Green Sprout on top of Mochi's head */}
              <path
                d="M50 28 Q50 18 50 15"
                stroke="#476652"
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M50 18 C40 12 36 20 48 23 Z"
                fill="#7F9B87"
                stroke="#476652"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M50 18 C60 11 64 19 52 23 Z"
                fill="#9BC0A4"
                stroke="#476652"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Squishy Chubby Creamy-White Mochi Dango Body */}
              <path
                d="M17 60 C16 38 31 27 50 27 C69 27 84 38 83 60 C83 76 71 84 50 84 C29 84 17 76 17 60 Z"
                fill="#FFFDF9"
                stroke="#476652"
                strokeWidth="2.8"
              />

              {/* Soft inner cream shading at bottom of Mochi */}
              <path
                d="M22 65 C25 77 36 81 50 81 C64 81 75 77 78 65"
                fill="none"
                stroke="#EFECE4"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Cute Tiny Stubby Mochi Paws */}
              <ellipse
                cx="20"
                cy="62"
                rx="5.5"
                ry="4"
                fill="#FFFDF9"
                stroke="#476652"
                strokeWidth="2.2"
                transform={mood === 'happy' ? 'rotate(-25 20 62)' : 'rotate(10 20 62)'}
              />
              <ellipse
                cx="80"
                cy="62"
                rx="5.5"
                ry="4"
                fill="#FFFDF9"
                stroke="#476652"
                strokeWidth="2.2"
                transform={mood === 'happy' ? 'rotate(25 80 62)' : 'rotate(-10 80 62)'}
              />

              {/* Rosy Pink Kawaii Cheeks */}
              <ellipse cx="29" cy="59" rx="6" ry="3.4" fill="#F59E9E" opacity="0.75" />
              <ellipse cx="71" cy="59" rx="6" ry="3.4" fill="#F59E9E" opacity="0.75" />

              {/* Expressive Kawaii Eyes */}
              {mood === 'happy' || mood === 'relieved' ? (
                <>
                  <path
                    d="M33 52 Q38 45 43 52"
                    stroke="#283C33"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M57 52 Q62 45 67 52"
                    stroke="#283C33"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Happy Sparkles */}
                  <circle cx="22" cy="34" r="2.2" fill="#F59E0B" />
                  <circle cx="79" cy="34" r="2.2" fill="#F59E0B" />
                </>
              ) : mood === 'anxious' ? (
                <>
                  {/* Wide worried eyes with little eyebrows */}
                  <path
                    d="M32 45 L42 48"
                    stroke="#283C33"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M68 45 L58 48"
                    stroke="#283C33"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <circle cx="38" cy="53" r="4.2" fill="#283C33" />
                  <circle cx="36.8" cy="51.5" r="1.5" fill="#FFFFFF" />
                  <circle cx="62" cy="53" r="4.2" fill="#283C33" />
                  <circle cx="60.8" cy="51.5" r="1.5" fill="#FFFFFF" />
                  {/* Blue sweat drop */}
                  <path d="M77 37 Q81 44 77 47 Q73 44 77 37 Z" fill="#60A5FA" />
                </>
              ) : mood === 'sad' ? (
                <>
                  <circle cx="38" cy="53" r="4" fill="#283C33" />
                  <circle cx="37" cy="51.5" r="1.4" fill="#FFFFFF" />
                  <circle cx="62" cy="53" r="4" fill="#283C33" />
                  <circle cx="61" cy="51.5" r="1.4" fill="#FFFFFF" />
                  {/* Cute watery teardrops */}
                  <path d="M34 57 Q31 64 34 66 Q37 64 34 57 Z" fill="#60A5FA" />
                  <path d="M66 57 Q63 64 66 66 Q69 64 66 57 Z" fill="#60A5FA" />
                </>
              ) : (
                <>
                  {/* Calm shiny kawaii eyes */}
                  <circle cx="38" cy="53" r="4.2" fill="#283C33" />
                  <circle cx="36.6" cy="51.4" r="1.6" fill="#FFFFFF" />
                  <circle cx="62" cy="53" r="4.2" fill="#283C33" />
                  <circle cx="60.6" cy="51.4" r="1.6" fill="#FFFFFF" />
                </>
              )}

              {/* Cute Mochi Mouth (w-shaped cat/mochi smile or worried wave) */}
              {mood === 'happy' ? (
                <path
                  d="M44 58 Q50 66 56 58 Z"
                  fill="#E57373"
                  stroke="#283C33"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              ) : mood === 'anxious' ? (
                <path
                  d="M43 61 Q46.5 58 50 61 Q53.5 64 57 61"
                  stroke="#283C33"
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : mood === 'sad' ? (
                <path
                  d="M45 63 Q50 58 55 63"
                  stroke="#283C33"
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M45 58 Q47.5 61 50 58 Q52.5 61 55 58"
                  stroke="#283C33"
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#476652] shrink-0" />
              <span className="text-xs font-semibold text-[#283C33]">{t.name}</span>
              <span
                data-testid="companion-pet-mood-badge"
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${moodColorMap[mood]}`}
              >
                {moodLabelMap[mood]}
              </span>
              <span className="text-[11px] text-[#617068] hidden md:inline">
                · {t.autoSensingBadge}
              </span>
            </div>
            {!minimized && (
              <p
                data-testid="companion-pet-status"
                className="text-xs text-[#617068] leading-snug mt-1"
              >
                {moodDescriptionMap[mood]}
              </p>
            )}
          </div>
        </div>

        {/* Live Automatic Multimodal Hardware Stream Indicators */}
        <div className="flex items-center gap-2">
          {!minimized && (
            <div
              data-testid="companion-pet-multimodal-channels"
              className="hidden sm:flex items-center gap-2 bg-[#F7F5EF] px-3 py-1.5 rounded-xl border border-[#E5E9E2] text-[11px] text-[#4E5E56]"
              title={t.multimodalStreamLabel}
            >
              <span className="inline-flex items-center gap-1">
                <Mic
                  className={`w-3.5 h-3.5 ${
                    micActive ? 'text-[#2F6B48] animate-pulse' : 'text-[#8C9A92]'
                  }`}
                />
                <span>
                  {locale === 'zh'
                    ? micActive
                      ? '麦克风收音中'
                      : '麦克风就绪'
                    : micActive
                      ? 'Mic active'
                      : 'Mic ready'}
                </span>
              </span>
              <span className="text-[#C5D6C8]">·</span>
              <span className="inline-flex items-center gap-1">
                <Camera
                  className={`w-3.5 h-3.5 ${
                    cameraActive || facialReading ? 'text-[#2F6B48]' : 'text-[#8C9A92]'
                  }`}
                />
                <span>
                  {locale === 'zh'
                    ? cameraActive
                      ? '视频微表情采集中'
                      : facialReading
                        ? '微表情已融合'
                        : '摄像头就绪'
                    : cameraActive
                      ? 'Video active'
                      : facialReading
                        ? 'Facial cue active'
                        : 'Camera ready'}
                </span>
              </span>
              <span className="text-[#C5D6C8]">·</span>
              <span className="inline-flex items-center gap-1">
                <Watch
                  className={`w-3.5 h-3.5 ${
                    isWearableConnected ? 'text-[#2F6B48]' : 'text-[#476652]'
                  }`}
                />
                <span>
                  {isWearableConnected
                    ? wearableDevice?.deviceName
                    : locale === 'zh'
                      ? '穿戴设备流'
                      : 'Wearable'}
                </span>
              </span>
              <span className="text-[#C5D6C8]">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Heart className="w-3 h-3 text-[#B85D3B]" />
                <span>{latestHr.bpm > 0 ? latestHr.bpm : '--'}</span>
              </span>
              <span className="text-[#C5D6C8]">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Activity className="w-3 h-3 text-[#476652]" />
                <span>{latestHr.hrvRmssdMs > 0 ? latestHr.hrvRmssdMs : '--'}</span>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMinimized((prev) => !prev)}
            className="text-[#617068] hover:text-[#283C33] p-1.5 rounded-lg hover:bg-[#EFECE4] transition-colors cursor-pointer"
            aria-label="Toggle companion details"
          >
            {minimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
