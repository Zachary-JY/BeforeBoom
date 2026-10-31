import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bluetooth,
  Camera,
  CameraOff,
  CheckCircle2,
  ExternalLink,
  Eye,
  Heart,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Watch,
} from 'lucide-react';
import {
  buildMultimodalTimelineSeries,
  computeOpticalRppgMetrics,
  formatActivityDisplay,
} from '../lib/beforeboomEngine';
import { Locale, TRANSLATIONS } from '../lib/i18n';
import { MultimodalTimelineChart } from './MultimodalTimelineChart';
import {
  CameraStatus,
  FacialExpressionReading,
  HeartRatePoint,
  InputEntry,
  MicPermissionState,
  MobileHealthSyncPayload,
  PetMood,
  SessionContextData,
  SignalNoticeEvidence,
  WearableDeviceState,
} from '../types/session';

interface LiveCheckinViewProps {
  locale: Locale;
  context: SessionContextData;
  isPaused: boolean;
  micState: MicPermissionState;
  cameraStatus: CameraStatus;
  activeCameraStream: MediaStream | null;
  facialReading: FacialExpressionReading | null;
  wearableDevice: WearableDeviceState;
  inputs: InputEntry[];
  heartRateSeries: HeartRatePoint[];
  signalNotice: SignalNoticeEvidence;
  isAnalyzing: boolean;
  cooldownActive: boolean;
  observationComplete: boolean;
  elapsedObservationSeconds: number;
  targetObservationSeconds: number;
  mobileHealthConnection: MobileHealthSyncPayload | null;
  onTogglePause: () => void;
  onToggleMic: () => void;
  onToggleCamera: (stream?: MediaStream | null, statusOverride?: CameraStatus) => void;
  onUpdateFacialReading: (reading: FacialExpressionReading) => void;
  onConnectBluetoothWearable: (scanAllDevices?: boolean) => Promise<void>;
  onEnableCameraRppgMode: (metrics?: { bpm: number; delta: number; hrvRmssdMs: number }) => void;
  onConnectSmartWatchStream: () => Promise<void>;
  onCyclePersona: () => void;
  onSubmitText: (text: string, source?: 'text' | 'voice' | 'context') => void;
  onOpenSupportChoice: () => void;
  onDismissNotice: (reason?: string) => void;
  onEndSession: () => void;
  onCompleteObservationWindow: () => void;
  onSyncMobileHealth: (scenario: 'settled' | 'rising' | 'elevated') => Promise<void>;
  onTriggerWatchAlert: () => void;
  onBackToWelcome?: () => void;
}

export const LiveCheckinView: React.FC<LiveCheckinViewProps> = ({
  locale,
  context,
  isPaused,
  micState,
  cameraStatus,
  activeCameraStream,
  facialReading,
  wearableDevice,
  inputs,
  heartRateSeries,
  signalNotice,
  isAnalyzing,
  cooldownActive,
  observationComplete,
  elapsedObservationSeconds,
  targetObservationSeconds,
  mobileHealthConnection,
  onTogglePause,
  onToggleMic,
  onToggleCamera,
  onUpdateFacialReading,
  onConnectBluetoothWearable,
  onEnableCameraRppgMode,
  onConnectSmartWatchStream,
  onCyclePersona,
  onSubmitText,
  onOpenSupportChoice,
  onDismissNotice,
  onEndSession,
  onCompleteObservationWindow,
  onSyncMobileHealth,
  onTriggerWatchAlert,
  onBackToWelcome,
}) => {
  const [textValue, setTextValue] = useState('');
  const [syncingHealth, setSyncingHealth] = useState(false);
  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [isTranscribingClip, setIsTranscribingClip] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(activeCameraStream);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const rppgBufferRef = useRef<number[]>([]);

  const t = TRANSLATIONS[locale].live;
  const th = TRANSLATIONS[locale].header;

  const latestHr = heartRateSeries[heartRateSeries.length - 1] || {
    timestamp: '00:00',
    bpm: 0,
    baseline: context.baselineBpm,
    delta: 0,
    hrvRmssdMs: 0,
    baselineHrvMs: context.baselineHrvMs,
    source: 'unconnected' as const,
  };

  // Attach pre-connected camera stream if passed from WelcomeView
  useEffect(() => {
    if (activeCameraStream && videoRef.current) {
      streamRef.current = activeCameraStream;
      videoRef.current.srcObject = activeCameraStream;
    }
  }, [activeCameraStream]);

  // Real-time Camera Optical rPPG (10Hz green-channel blood volume pulse extraction) when camera is active
  useEffect(() => {
    if (
      cameraStatus !== 'active' ||
      isPaused ||
      wearableDevice.status === 'connected_ble_hr'
    ) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    const intervalId = window.setInterval(() => {
      if (!videoRef.current || !ctx) return;
      try {
        ctx.drawImage(videoRef.current, 0, 0, 40, 40);
        const data = ctx.getImageData(10, 10, 20, 20).data;
        let greenSum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          greenSum += data[i + 1];
          count++;
        }
        if (count > 0) {
          const avgG = greenSum / count;
          rppgBufferRef.current = [...rppgBufferRef.current.slice(-59), avgG];
          if (rppgBufferRef.current.length % 20 === 0) {
            const metrics = computeOpticalRppgMetrics(
              rppgBufferRef.current,
              10,
              context.baselineBpm,
              context.baselineHrvMs
            );
            if (metrics) {
              onEnableCameraRppgMode(metrics);
            }
          }
        }
      } catch (_e) {
        // ignore
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [
    cameraStatus,
    isPaused,
    wearableDevice.status,
    context.baselineBpm,
    context.baselineHrvMs,
    onEnableCameraRppgMode,
  ]);

  const handleCaptureCameraFrame = useCallback(async () => {
    setAnalyzingFace(true);
    try {
      let imageBase64: string | undefined;
      if (videoRef.current && cameraStatus === 'active') {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.75);
        }
      }

      const res = await fetch('/api/analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          simulatedCue: facialReading?.cue || 'anxious',
          locale,
        }),
      });
      if (res.ok) {
        const data: FacialExpressionReading = await res.json();
        onUpdateFacialReading(data);
      }
    } finally {
      setAnalyzingFace(false);
    }
  }, [cameraStatus, facialReading?.cue, locale, onUpdateFacialReading]);

  // Auto-sample live camera frames every 8 seconds when camera is active
  useEffect(() => {
    if (cameraStatus !== 'active' || isPaused) return;
    const intervalId = window.setInterval(() => {
      handleCaptureCameraFrame();
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [cameraStatus, isPaused, handleCaptureCameraFrame]);

  const handleCameraToggleClick = async () => {
    if (cameraStatus === 'active') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
      onToggleCamera(null, 'idle');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onToggleCamera(null, 'unavailable');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      onToggleCamera(mediaStream, 'active');
      await handleCaptureCameraFrame();
    } catch (_err) {
      onToggleCamera(null, 'denied');
    }
  };

  // Real Microphone Audio Recording & Transcription via MediaRecorder + /api/transcribe-audio
  const handleRecordVoiceClip = async () => {
    if (isRecordingClip && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingClip(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onSubmitText(
        locale === 'zh'
          ? '我刚刚通过语音录入：手头任务时间很紧，希望能先稳住呼吸节奏。'
          : 'Recorded via voice note: deadlines feel tight right now and I want to stay steady.',
        'voice'
      );
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        audioStream.getTracks().forEach((tr) => tr.stop());
        setIsTranscribingClip(true);
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
              const res = await fetch('/api/transcribe-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64,
                  mimeType: blob.type || 'audio/webm',
                  locale,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.transcript) {
                  onSubmitText(data.transcript, 'voice');
                }
              }
            } finally {
              setIsTranscribingClip(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch (_e) {
          setIsTranscribingClip(false);
        }
      };

      recorder.start();
      setIsRecordingClip(true);
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecordingClip(false);
        }
      }, 4000);
    } catch (_err) {
      onSubmitText(
        locale === 'zh'
          ? '我刚刚通过语音录入：多项任务并行让我有些分心，想先梳理最重要的一步。'
          : 'Voice note logged: juggling multiple tasks right now, looking for one clear next step.',
        'voice'
      );
    }
  };

  const handleTriggerFacialCue = async (cue: PetMood) => {
    setAnalyzingFace(true);
    try {
      const res = await fetch('/api/analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulatedCue: cue,
          locale,
        }),
      });
      if (res.ok) {
        const data: FacialExpressionReading = await res.json();
        onUpdateFacialReading(data);
      }
    } finally {
      setAnalyzingFace(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textValue.trim()) return;
    onSubmitText(textValue.trim(), 'text');
    setTextValue('');
  };

  const handleHealthSyncClick = async (scenario: 'settled' | 'rising' | 'elevated') => {
    setSyncingHealth(true);
    try {
      await onSyncMobileHealth(scenario);
    } finally {
      setSyncingHealth(false);
    }
  };

  const quickPrompts =
    locale === 'zh'
      ? [
          '我同时卡在好几个截止任务里，登录报错还没修完，心跳有点快。',
          '我终于定位到核心问题了，现在感觉踏实开心多了！',
          '今天任务太多了，感觉有点沮丧和难过。',
        ]
      : [
          'I have three deadlines colliding tonight and the login error still crashes.',
          'I finally fixed the main bug and feel happy and relieved!',
          'Feeling exhausted and down looking at everything left to study.',
        ];

  const progressPercent = Math.min(
    100,
    Math.round((elapsedObservationSeconds / Math.max(1, targetObservationSeconds)) * 100)
  );

  // Build SVG polyline points for valid heart rate points
  const chartWidth = 460;
  const chartHeight = 105;
  const minBpm = 60;
  const maxBpm = 110;

  const validHrPoints = heartRateSeries.filter((p) => p.bpm > 0);

  const pointsString = validHrPoints
    .map((pt, idx) => {
      const x =
        validHrPoints.length <= 1
          ? chartWidth / 2
          : (idx / (validHrPoints.length - 1)) * (chartWidth - 24) + 12;
      const clampedBpm = Math.max(minBpm, Math.min(maxBpm, pt.bpm));
      const y =
        chartHeight -
        14 -
        ((clampedBpm - minBpm) / (maxBpm - minBpm)) * (chartHeight - 28);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const baselineY =
    chartHeight -
    14 -
    ((context.baselineBpm - minBpm) / (maxBpm - minBpm)) * (chartHeight - 28);

  const statusBadgeStyle =
    signalNotice.level === 'Settled'
      ? 'bg-[#E6EFE8] text-[#2F523B] border-[#C5D6C8]'
      : signalNotice.level === 'Signals rising'
        ? 'bg-[#F8EAE2] text-[#7A442A] border-[#E5C5B5]'
        : 'bg-[#F3DDD4] text-[#843B22] border-[#DFB6A5]';

  const localizedSignalLevel =
    signalNotice.level === 'Settled'
      ? th.settled
      : signalNotice.level === 'Signals rising'
        ? th.rising
        : th.elevated;

  const activityDisplay = formatActivityDisplay(context, locale);
  const standaloneUrl =
    typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000';

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Session Control Bar */}
      <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span
            data-testid="live-signal-badge"
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${statusBadgeStyle}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {localizedSignalLevel}
          </span>

          <div className="text-xs text-[#617068] flex flex-wrap items-center gap-2">
            <span
              data-testid="live-persona-name"
              className="font-semibold text-[#283C33] bg-[#E6EFE8] px-2.5 py-1 rounded-lg border border-[#C5D6C8]"
            >
              {context.personaName}
            </span>
            <button
              type="button"
              data-testid="live-switch-person-btn"
              onClick={onCyclePersona}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#476652] border border-[#DEE5DB] text-[11px] font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{locale === 'zh' ? '切换使用者' : 'Switch user'}</span>
            </button>
            <span className="font-medium text-[#283C33] bg-[#F7F5EF] px-2.5 py-1 rounded-lg border border-[#E5E9E2]">
              {activityDisplay}
            </span>
            <span className="truncate max-w-[240px] sm:max-w-[340px]" title={context.currentTask}>
              {t.focusPrefix} <strong className="text-[#283C33]">{context.currentTask}</strong>
            </span>
          </div>
        </div>

        {/* Mic, Voice Clip Recorder, Pause & End Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="mic-toggle-btn"
            onClick={onToggleMic}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              micState === 'listening'
                ? 'bg-[#E6EFE8] text-[#2F523B] border-[#7F9B87]'
                : micState === 'denied'
                  ? 'bg-[#F8EAE2] text-[#7A442A] border-[#E5C5B5]'
                  : 'bg-[#F7F5EF] text-[#283C33] border-[#DEE5DB] hover:bg-[#EFECE4]'
            }`}
          >
            {micState === 'listening' ? (
              <>
                <Mic className="w-3.5 h-3.5 text-[#3D6B4E] animate-pulse" />
                <span>{t.micListening}</span>
              </>
            ) : micState === 'denied' ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-[#843B22]" />
                <span>{t.micDenied}</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-[#476652]" />
                <span>{t.enableVoice}</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="record-voice-clip-btn"
            disabled={isTranscribingClip}
            onClick={handleRecordVoiceClip}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              isRecordingClip
                ? 'bg-[#B85D3B] text-white border-[#B85D3B] animate-pulse'
                : 'bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border-[#C5D6C8]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {isTranscribingClip
                ? t.transcribingAudio
                : isRecordingClip
                  ? t.recordingClipBtn
                  : t.recordClipBtn}
            </span>
          </button>

          <button
            type="button"
            data-testid="pause-observation-btn"
            onClick={onTogglePause}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? t.resume : t.pause}</span>
          </button>

          <button
            type="button"
            data-testid="end-observation-btn"
            onClick={onEndSession}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#F7F5EF] hover:bg-[#F3DDD4] text-[#617068] hover:text-[#843B22] border border-[#DEE5DB] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>{t.end}</span>
          </button>
        </div>
      </div>

      {/* Observation Window Continuous Progress Banner */}
      <div
        data-testid="observation-window-banner"
        className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
      >
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#476652]">
            <Sparkles className="w-4 h-4" />
            <span>
              {observationComplete ? t.observationCompleteBadge : t.observationWindowTitle}
            </span>
            <span className="font-mono tabular-nums text-[#617068]">
              ({elapsedObservationSeconds}
              {locale === 'zh' ? '秒' : 's'} / {targetObservationSeconds}
              {locale === 'zh' ? '秒' : 's'} · {progressPercent}%)
            </span>
          </div>
          <p className="text-xs text-[#617068] leading-relaxed">{t.observationWindowSub}</p>
          <div className="w-full h-2 bg-[#EFECE4] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#476652] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onBackToWelcome && (
            <button
              type="button"
              data-testid="live-back-to-welcome-btn"
              onClick={onBackToWelcome}
              className="px-3 py-2 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] text-xs font-medium transition-colors cursor-pointer"
            >
              {locale === 'zh' ? '← 返回上一环节' : '← Previous Step'}
            </button>
          )}

          {!observationComplete && (
            <button
              type="button"
              data-testid="complete-observation-now-btn"
              onClick={onCompleteObservationWindow}
              className="px-3.5 py-2 rounded-xl bg-[#E6EFE8] hover:bg-[#D7E6DB] text-[#283C33] border border-[#B8C7BC] text-xs font-medium transition-colors cursor-pointer"
            >
              {t.completeWindowNowBtn}
            </button>
          )}

          <button
            type="button"
            data-testid="live-skip-to-support-btn"
            onClick={onOpenSupportChoice}
            className="px-3.5 py-2 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <span>
              {locale === 'zh'
                ? '不等待计时 · 直接进入选择支持 →'
                : 'Skip Timer · Go to Support Choice →'}
            </span>
          </button>
        </div>
      </div>

      {/* Real-Time Multimodal State Trajectory Visualization Chart */}
      <MultimodalTimelineChart
        locale={locale}
        timeline={buildMultimodalTimelineSeries({
          heartRateSeries,
          inputs,
          facialReading,
          baselineBpm: context.baselineBpm,
          baselineHrvMs: context.baselineHrvMs,
        })}
      />

      {/* Main 2-Column Observation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): What We Noticed + Live Voice Transcript & Notes */}
        <div className="lg:col-span-7 space-y-6">
          {!observationComplete ? (
            <div
              data-testid="continuous-analysis-card"
              className="bg-[#FFFEFA] border-2 border-dashed border-[#C5D6C8] rounded-2xl p-5 sm:p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#476652] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#476652] animate-ping" />
                  {t.whatWeNoticed}
                </span>
                <span className="text-xs font-mono text-[#617068]">
                  {inputs.length} {locale === 'zh' ? '条多模态记录已采集' : 'entries logged'}
                </span>
              </div>
              <p className="font-serif text-base sm:text-lg text-[#283C33] leading-relaxed">
                {t.continuousAnalysisPending}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onCompleteObservationWindow}
                  className="px-3.5 py-2 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#2F523B] border border-[#C5D6C8] text-xs font-medium transition-colors cursor-pointer"
                >
                  {locale === 'zh' ? '立即跳过观察倒计时并查看评估' : 'Skip Timer & Unlock Feedback Now'}
                </button>
                <button
                  type="button"
                  onClick={onOpenSupportChoice}
                  className="px-3.5 py-2 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium transition-colors cursor-pointer"
                >
                  {locale === 'zh' ? '直接跳到下一环节：选择支持 →' : 'Jump to Next Step: Support Choice →'}
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="what-we-noticed-card"
              className="bg-[#FFFEFA] border-2 border-[#C5D6C8] rounded-2xl p-5 sm:p-6 shadow-[0_12px_28px_-8px_rgba(40,60,51,0.08)] space-y-4 animate-in fade-in duration-300"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#476652]" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#476652]">
                    {t.whatWeNoticed}
                  </h2>
                </div>
                {isAnalyzing && (
                  <span className="text-xs text-[#617068] animate-pulse">{t.updatingSignal}</span>
                )}
              </div>

              <p
                data-testid="what-we-noticed-summary"
                className="font-serif text-lg sm:text-xl text-[#283C33] leading-relaxed"
              >
                “{signalNotice.summaryText}”
              </p>

              {/* Observable Evidence Bullets */}
              <div className="bg-[#F7F5EF] border border-[#E5E9E2] rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-[#617068] uppercase tracking-wider">
                  {t.observableBasis}
                </div>
                <ul className="space-y-1.5 text-xs text-[#283C33]">
                  {signalNotice.observableEvidence.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#476652] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Row */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid="choose-support-btn"
                  onClick={onOpenSupportChoice}
                  className="px-5 py-3 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-sm font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>{t.chooseSupportBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  data-testid="quick-dismiss-notice-btn"
                  onClick={() => onDismissNotice('Dismissed from live check-in')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] text-xs font-medium transition-colors cursor-pointer"
                >
                  {cooldownActive ? t.PauseRemindersActive : t.imOkayKeepObserving}
                </button>
              </div>
            </div>
          )}

          {/* Card 2: Live Voice Transcript & User Notes */}
          <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-[#283C33]">
                {t.recentTranscriptTitle}
              </h3>
              <span className="text-xs text-[#617068]">{t.transcriptHint}</span>
            </div>

            {micState === 'denied' && (
              <div className="p-3 rounded-xl bg-[#F8EAE2] border border-[#E5C5B5] text-xs text-[#7A442A] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {locale === 'zh'
                    ? '麦克风权限未开启，可随时使用下方文字输入框记录。'
                    : 'Microphone permission declined. Text input below works identically.'}
                </span>
              </div>
            )}

            <div
              data-testid="transcript-feed"
              className="space-y-2.5 max-h-[210px] overflow-y-auto pr-1"
            >
              {inputs.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2] text-sm text-[#283C33] space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#617068]">
                    <span className="font-medium uppercase tracking-wider">
                      {entry.source === 'voice'
                        ? t.sourceVoice
                        : entry.source === 'context'
                          ? t.sourceDemo
                          : t.sourceNote}
                    </span>
                    <span className="font-mono tabular-nums">{entry.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{entry.text}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] text-[#617068]">{t.quickInputLabel}</div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((sample, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`quick-thought-${i}`}
                    onClick={() => onSubmitText(sample, 'voice')}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#DCD8CD] transition-colors cursor-pointer"
                  >
                    + “{sample.slice(0, 32)}…”
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="flex gap-2 pt-1">
              <input
                type="text"
                data-testid="live-checkin-text-input"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={t.inputPlaceholder}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#D5DDD2] bg-[#F7F5EF] text-sm text-[#283C33] placeholder-[#8C9A92] focus:outline-none focus:border-[#476652] focus:bg-[#FFFEFA]"
              />
              <button
                type="submit"
                data-testid="live-checkin-send-btn"
                className="px-4 py-2.5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t.addNoteBtn}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): Live Camera Video Feed + Connected Wearable Telemetry */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Live Camera Video & Facial Micro-Expression + Optical Pulse Sensing */}
          <div
            data-testid="camera-sensing-card"
            className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#476652]" />
                <h3 className="font-serif text-base font-semibold text-[#283C33]">
                  {t.cameraCardTitle}
                </h3>
              </div>
              <span
                data-testid="camera-status-badge"
                className="px-2.5 py-1 rounded-md bg-[#E6EFE8] border border-[#C5D6C8] text-[11px] font-medium text-[#2F523B]"
              >
                {cameraStatus === 'active' ? t.cameraActiveBadge : t.cameraStandbyBadge}
              </span>
            </div>

            <p className="text-xs text-[#617068] leading-relaxed">{t.cameraCardSub}</p>

            {/* Live Camera Video Element */}
            <div className="relative rounded-xl overflow-hidden bg-[#1F2D26] border border-[#364B40] aspect-[16/9] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  cameraStatus === 'active' ? 'block' : 'hidden'
                }`}
              />
              {cameraStatus === 'active' && (
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-[#15241E]/80 text-[#E6EFE8] text-[10px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-ping" />
                  <span>{t.autoSamplingLabel}</span>
                </div>
              )}
              {cameraStatus !== 'active' && (
                <div className="text-center px-4 py-5 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#2C3E35] text-[#A7C4B0] flex items-center justify-center mx-auto">
                    <Eye className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-[#D5E2D9]">
                    {facialReading
                      ? locale === 'zh'
                        ? facialReading.summaryZh
                        : facialReading.summaryEn
                      : locale === 'zh'
                        ? '点击下方按钮开启实时摄像头画面，自动捕捉并识别面部微表情与光电脉搏波'
                        : 'Click below to turn on your live camera feed for automatic micro-expression & optical pulse analysis'}
                  </p>
                </div>
              )}
            </div>

            {/* 3 Micro-Expression Feature Pills (Brow / Lip / Eye) */}
            {facialReading && (
              <div
                data-testid="facial-metrics-grid"
                className="grid grid-cols-3 gap-2 text-center"
              >
                <div className="p-2 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                  <div className="text-[10px] text-[#617068]">{t.browLabel}</div>
                  <div className="text-xs font-semibold text-[#283C33] mt-0.5">
                    {t.browValues[facialReading.browTension]}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                  <div className="text-[10px] text-[#617068]">{t.lipLabel}</div>
                  <div className="text-xs font-semibold text-[#283C33] mt-0.5">
                    {t.lipValues[facialReading.lipCurvature]}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                  <div className="text-[10px] text-[#617068]">{t.eyeLabel}</div>
                  <div className="text-xs font-semibold text-[#283C33] mt-0.5">
                    {t.eyeValues[facialReading.eyeFatigue]}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="toggle-camera-btn"
                onClick={handleCameraToggleClick}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {cameraStatus === 'active' ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>{t.disableCameraBtn}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t.enableCameraBtn}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="capture-frame-btn"
                disabled={analyzingFace}
                onClick={handleCaptureCameraFrame}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#283C33] border border-[#C5D6C8] transition-colors cursor-pointer"
              >
                {t.analyzeFrameBtn}
              </button>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-[#ECEFE9]">
              <div className="text-[11px] font-medium text-[#617068]">
                {t.calibrationLabel}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="cue-anxious-btn"
                  disabled={analyzingFace}
                  onClick={() => handleTriggerFacialCue('anxious')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    facialReading?.cue === 'anxious'
                      ? 'bg-[#F8EAE2] border-[#B85D3B] text-[#7A442A]'
                      : 'bg-[#F7F5EF] border-[#DEE5DB] text-[#283C33] hover:bg-[#EFECE4]'
                  }`}
                >
                  {t.cueAnxiousBtn}
                </button>
                <button
                  type="button"
                  data-testid="cue-happy-btn"
                  disabled={analyzingFace}
                  onClick={() => handleTriggerFacialCue('happy')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    facialReading?.cue === 'happy'
                      ? 'bg-[#FFF5D6] border-[#D9A726] text-[#7A5912]'
                      : 'bg-[#F7F5EF] border-[#DEE5DB] text-[#283C33] hover:bg-[#EFECE4]'
                  }`}
                >
                  {t.cueHappyBtn}
                </button>
                <button
                  type="button"
                  data-testid="cue-sad-btn"
                  disabled={analyzingFace}
                  onClick={() => handleTriggerFacialCue('sad')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    facialReading?.cue === 'sad'
                      ? 'bg-[#E9EEF6] border-[#6B8EB8] text-[#354E73]'
                      : 'bg-[#F7F5EF] border-[#DEE5DB] text-[#283C33] hover:bg-[#EFECE4]'
                  }`}
                >
                  {t.cueSadBtn}
                </button>
                <button
                  type="button"
                  data-testid="cue-calm-btn"
                  disabled={analyzingFace}
                  onClick={() => handleTriggerFacialCue('calm')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    facialReading?.cue === 'calm'
                      ? 'bg-[#E6EFE8] border-[#476652] text-[#2F523B]'
                      : 'bg-[#F7F5EF] border-[#DEE5DB] text-[#283C33] hover:bg-[#EFECE4]'
                  }`}
                >
                  {t.cueCalmBtn}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Connected Wearable Biometrics (Bluetooth GATT / Camera Optical rPPG / Smart Watch) */}
          <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#B85D3B]" />
                <h3 className="font-serif text-base font-semibold text-[#283C33]">
                  {t.physioTitle}
                </h3>
              </div>

              <span
                data-testid="wearable-status-badge"
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                  wearableDevice.status === 'disconnected'
                    ? 'bg-[#F8EAE2] border-[#E5C5B5] text-[#7A442A]'
                    : 'bg-[#E6EFE8] border-[#C5D6C8] text-[#2F523B]'
                }`}
              >
                {wearableDevice.status === 'disconnected'
                  ? locale === 'zh'
                    ? '待连接蓝牙穿戴设备或开启摄像头脉搏'
                    : 'Awaiting Bluetooth or Optical Sensor'
                  : `${wearableDevice.deviceName}`}
              </span>
            </div>

            {/* Honest Iframe / Bluetooth Error Banner */}
            {wearableDevice.errorMessage && (
              <div
                data-testid="live-ble-diagnostic-box"
                className="p-3 rounded-xl bg-[#F8EAE2] border border-[#E5C5B5] text-xs text-[#7A442A] space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#843B22]" />
                  <span className="leading-relaxed">{wearableDevice.errorMessage}</span>
                </div>
                {wearableDevice.isIframeBlocked && (
                  <a
                    href={standaloneUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium shadow-2xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'zh'
                        ? '在新标签页打开本网页以调用系统蓝牙窗口'
                        : 'Open in new tab to launch OS Bluetooth chooser'}
                    </span>
                  </a>
                )}
              </div>
            )}

            {/* Raw BLE Packet / Hardware Metadata Bar when connected via Web Bluetooth */}
            {wearableDevice.rawHexPacket && (
              <div className="px-3 py-1.5 rounded-lg bg-[#1F2D26] text-[#A7C4B0] font-mono text-[11px] flex items-center justify-between">
                <span>
                  {locale === 'zh' ? '蓝牙实时数据包：' : 'BLE Packet:'}{' '}
                  {wearableDevice.rawHexPacket}
                </span>
                {wearableDevice.batteryLevel !== undefined && (
                  <span>
                    {locale === 'zh' ? '电量：' : 'Battery:'} {wearableDevice.batteryLevel}%
                  </span>
                )}
              </div>
            )}

            {/* 4-Metric Grid: Current HR, Baseline HR, Current HRV, Baseline HRV */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-[11px] text-[#617068]">{t.currentHr}</div>
                <div
                  data-testid="current-bpm-value"
                  className="text-lg font-mono font-semibold text-[#283C33] tabular-nums mt-0.5"
                >
                  {latestHr.bpm > 0 ? latestHr.bpm : '--'}{' '}
                  <span className="text-[10px] font-normal text-[#617068]">
                    {locale === 'zh' ? '次/分' : 'bpm'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-[11px] text-[#617068]">{t.personalBaseline}</div>
                <div className="text-lg font-mono font-semibold text-[#283C33] tabular-nums mt-0.5">
                  {context.baselineBpm}{' '}
                  <span className="text-[10px] font-normal text-[#617068]">
                    {locale === 'zh' ? '次/分' : 'bpm'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-[11px] text-[#617068]">{t.hrvRmssd}</div>
                <div
                  data-testid="current-hrv-value"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 ${
                    latestHr.hrvRmssdMs > 0 && latestHr.hrvRmssdMs <= 34
                      ? 'text-[#A63D21]'
                      : 'text-[#283C33]'
                  }`}
                >
                  {latestHr.hrvRmssdMs > 0 ? latestHr.hrvRmssdMs : '--'}{' '}
                  <span className="text-[10px] font-normal text-[#617068]">
                    {locale === 'zh' ? '毫秒' : 'ms'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-[11px] text-[#617068]">{t.baselineHrv}</div>
                <div className="text-lg font-mono font-semibold text-[#283C33] tabular-nums mt-0.5">
                  {context.baselineHrvMs}{' '}
                  <span className="text-[10px] font-normal text-[#617068]">
                    {locale === 'zh' ? '毫秒' : 'ms'}
                  </span>
                </div>
              </div>
            </div>

            {/* Clean SVG Trend Line Chart */}
            <div className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#617068]">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-[#476652]" />
                  {t.signalTrendLabel}
                </span>
                <span className="font-mono">
                  {t.baselineLineLabel}: {context.baselineBpm}{' '}
                  {locale === 'zh' ? '次/分' : 'bpm'}
                </span>
              </div>

              {validHrPoints.length > 0 ? (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-24 overflow-visible"
                  role="img"
                  aria-label="Heart rate trend chart"
                >
                  <line
                    x1="8"
                    y1={baselineY}
                    x2={chartWidth - 8}
                    y2={baselineY}
                    stroke="#95A79B"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  {validHrPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#476652"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsString}
                    />
                  )}
                </svg>
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-[#617068]">
                  {locale === 'zh'
                    ? '尚未接收到心率波形数据——请点击下方按钮连接蓝牙穿戴设备或开启摄像头脉搏波'
                    : 'No heart-rate stream yet—connect a Bluetooth device or enable Camera Optical Pulse below'}
                </div>
              )}
            </div>

            {/* Wearable Bluetooth & Optical rPPG Connection Panel */}
            <div
              data-testid="mobile-health-api-card"
              className="p-4 rounded-xl bg-[#F7F5EF] border border-[#DEE5DB] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#283C33]">
                  <Watch className="w-4 h-4 text-[#476652]" />
                  <span>{t.wearablePanelTitle}</span>
                </div>
                {(mobileHealthConnection || wearableDevice.status !== 'disconnected') && (
                  <span className="text-[11px] font-mono text-[#2F523B] bg-[#E6EFE8] px-2 py-0.5 rounded">
                    {wearableDevice.deviceName || mobileHealthConnection?.deviceName}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#617068] leading-relaxed">{t.wearablePanelSub}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="live-pair-ble-btn"
                  onClick={() => onConnectBluetoothWearable(true)}
                  className="py-2 px-3 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>
                    {locale === 'zh'
                      ? '蓝牙搜索附近所有穿戴设备'
                      : 'Scan All Nearby Bluetooth Devices'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="live-enable-rppg-btn"
                  onClick={() => onEnableCameraRppgMode()}
                  className="py-2 px-3 rounded-xl bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#283C33] border border-[#C5D6C8] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-[#476652]" />
                  <span>
                    {locale === 'zh'
                      ? '开启摄像头光电脉搏波测心率'
                      : 'Use Camera Optical Pulse (rPPG)'}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  data-testid="sync-mobile-health-elevated-btn"
                  disabled={syncingHealth}
                  onClick={() => handleHealthSyncClick('elevated')}
                  className="px-3 py-1.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium transition-colors cursor-pointer"
                >
                  {t.syncElevatedTelemetryBtn}
                </button>
                <button
                  type="button"
                  data-testid="sync-mobile-health-settled-btn"
                  disabled={syncingHealth}
                  onClick={() => handleHealthSyncClick('settled')}
                  className="px-3 py-1.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium transition-colors cursor-pointer"
                >
                  {t.syncRecoveryTelemetryBtn}
                </button>
                <button
                  type="button"
                  data-testid="manual-watch-alert-btn"
                  onClick={onTriggerWatchAlert}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Watch className="w-3.5 h-3.5 text-[#476652]" />
                  <span>{TRANSLATIONS[locale].watch.testPushBtn}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
