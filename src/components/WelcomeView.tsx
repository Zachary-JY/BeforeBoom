import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bluetooth,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  HeartPulse,
  Mic,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Watch,
} from 'lucide-react';
import { computeOpticalRppgMetrics } from '../lib/beforeboomEngine';
import { Locale, PERSONA_PRESETS, TRANSLATIONS } from '../lib/i18n';
import {
  ActivityContext,
  HeartRatePoint,
  WearableDeviceState,
} from '../types/session';

interface WelcomeViewProps {
  locale: Locale;
  personaId: string;
  personaName: string;
  wearableDevice: WearableDeviceState;
  latestHr: HeartRatePoint;
  micPreconnected: boolean;
  cameraPreconnected: boolean;
  onChangePersonaName: (name: string) => void;
  onCyclePersona: () => {
    name: string;
    activity: ActivityContext;
    customActivity: string;
    task: string;
  };
  onConnectMicOnWelcome: () => Promise<boolean>;
  onConnectCameraOnWelcome: () => Promise<MediaStream | null>;
  onConnectBluetoothWearable: (scanAllDevices?: boolean) => Promise<void>;
  onEnableCameraRppgMode: (initialMetrics?: { bpm: number; delta: number; hrvRmssdMs: number }) => void;
  onPushCompanionWearableData: (payload: {
    deviceName: string;
    bpm: number;
    hrvRmssdMs: number;
  }) => Promise<void>;
  onDisconnectWearable: () => void;
  onStartCheckin: (params: {
    personaName: string;
    activity: ActivityContext;
    customActivityText: string;
    currentTask: string;
    plannedDurationMinutes: number;
    requestMic: boolean;
    requestCamera: boolean;
  }) => void;
  onStartDemo: () => void;
}

const ACTIVITIES: ActivityContext[] = ['Study', 'Work', 'Custom'];
const DURATION_OPTIONS = [10, 20, 30];

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  locale,
  personaId,
  personaName,
  wearableDevice,
  latestHr,
  micPreconnected,
  cameraPreconnected,
  onChangePersonaName,
  onCyclePersona,
  onConnectMicOnWelcome,
  onConnectCameraOnWelcome,
  onConnectBluetoothWearable,
  onEnableCameraRppgMode,
  onPushCompanionWearableData,
  onDisconnectWearable,
  onStartCheckin,
  onStartDemo,
}) => {
  const t = TRANSLATIONS[locale].welcome;
  const currentPreset =
    PERSONA_PRESETS.find((p) => p.id === personaId) || PERSONA_PRESETS[0];

  const [activity, setActivity] = useState<ActivityContext>(currentPreset.activity);
  const [customActivityText, setCustomActivityText] = useState<string>(
    locale === 'zh' ? currentPreset.customZh : currentPreset.customEn
  );
  const [currentTask, setCurrentTask] = useState<string>('');
  const [duration, setDuration] = useState<number>(20);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [connectingBle, setConnectingBle] = useState<boolean>(false);
  const [showCompanionPanel, setShowCompanionPanel] = useState<boolean>(false);
  const [companionDeviceName, setCompanionDeviceName] = useState<string>(
    locale === 'zh' ? '我的智能手表' : 'My Apple Watch'
  );
  const [companionBpm, setCompanionBpm] = useState<number>(84);
  const [companionHrv, setCompanionHrv] = useState<number>(36);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const audioAnimRef = useRef<number | null>(null);
  const rppgSamplesRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (audioAnimRef.current) {
        cancelAnimationFrame(audioAnimRef.current);
      }
    };
  }, []);

  // Real Camera Optical rPPG sampler when camera is active and rPPG mode is enabled
  useEffect(() => {
    if (
      !cameraPreconnected ||
      wearableDevice.status !== 'connected_camera_rppg'
    ) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    const timer = window.setInterval(() => {
      if (!previewVideoRef.current || !ctx) return;
      try {
        ctx.drawImage(previewVideoRef.current, 0, 0, 40, 40);
        const frame = ctx.getImageData(10, 10, 20, 20).data;
        let greenSum = 0;
        let count = 0;
        for (let i = 0; i < frame.length; i += 4) {
          greenSum += frame[i + 1];
          count++;
        }
        const avgGreen = count > 0 ? greenSum / count : 128;
        rppgSamplesRef.current = [...rppgSamplesRef.current.slice(-49), avgGreen];
        const computed = computeOpticalRppgMetrics(rppgSamplesRef.current, 10, 72, 58);
        if (computed) {
          onEnableCameraRppgMode(computed);
        }
      } catch (_e) {
        // ignore frame error
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [cameraPreconnected, wearableDevice.status, onEnableCameraRppgMode]);

  const handleSwitchPerson = () => {
    const next = onCyclePersona();
    setActivity(next.activity);
    setCustomActivityText(next.customActivity);
    setCurrentTask(next.task);
  };

  const handleEnableMicClick = async () => {
    await onConnectMicOnWelcome();
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(audioStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg =
              dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
            setMicLevel(Math.max(8, Math.min(100, Math.round(avg * 1.6))));
            audioAnimRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      }
    } catch (_e) {
      setMicLevel(0);
    }
  };

  const handleEnableCameraClick = async () => {
    const stream = await onConnectCameraOnWelcome();
    if (stream && previewVideoRef.current) {
      previewStreamRef.current = stream;
      previewVideoRef.current.srcObject = stream;
    }
  };

  const handleStartCameraRppg = async () => {
    if (!cameraPreconnected) {
      await handleEnableCameraClick();
    }
    onEnableCameraRppgMode();
  };

  const handleBleClick = async (scanAll: boolean) => {
    setConnectingBle(true);
    try {
      await onConnectBluetoothWearable(scanAll);
    } finally {
      setConnectingBle(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultTask =
      locale === 'zh' ? currentPreset.taskZh : currentPreset.taskEn;

    onStartCheckin({
      personaName:
        personaName.trim() ||
        (locale === 'zh' ? currentPreset.nameZh : currentPreset.nameEn),
      activity,
      customActivityText:
        activity === 'Custom'
          ? customActivityText.trim() ||
            (locale === 'zh' ? '自由创作与进度整理' : 'Independent creative project')
          : '',
      currentTask: currentTask.trim() || defaultTask,
      plannedDurationMinutes: duration,
      requestMic: micPreconnected,
      requestCamera: cameraPreconnected,
    });
  };

  const getActivityIcon = (item: ActivityContext) => {
    if (item === 'Study') return <GraduationCap className="w-4 h-4" />;
    if (item === 'Work') return <Briefcase className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  const isWearableConnected =
    wearableDevice.status !== 'disconnected' &&
    wearableDevice.status !== 'connecting';

  const standaloneUrl =
    typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000';

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Brand Value & Hardware-First Flow */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6EFE8] border border-[#C8D9CC] text-[#2F523B] text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.badge}</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] leading-[1.15] font-semibold text-[#283C33] tracking-tight">
              {t.heroTitle1}
              <span className="block text-[#476652] mt-1">{t.heroTitle2}</span>
            </h1>
            <p className="text-sm sm:text-base text-[#617068] leading-relaxed">
              {t.heroDesc}
            </p>
          </div>

          {/* 3-Step Visual Loop Preview */}
          <div className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-5 space-y-4 shadow-[0_8px_24px_-6px_rgba(40,60,51,0.05)]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#617068]">
              {t.loopTitle}
            </h2>
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-xs font-semibold text-[#476652] mb-0.5">{t.step1Title}</div>
                <p className="text-xs text-[#617068] leading-relaxed">{t.step1Desc}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-xs font-semibold text-[#476652] mb-0.5">{t.step2Title}</div>
                <p className="text-xs text-[#617068] leading-relaxed">{t.step2Desc}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                <div className="text-xs font-semibold text-[#476652] mb-0.5">{t.step3Title}</div>
                <p className="text-xs text-[#617068] leading-relaxed">{t.step3Desc}</p>
              </div>
            </div>
          </div>

          {/* Privacy, Microphone, Camera & Wearable Transparency Box */}
          <div
            data-testid="privacy-disclosure-box"
            className="bg-[#EFECE4]/80 border border-[#DCD8CD] rounded-2xl p-4 sm:p-5 space-y-2.5"
          >
            <div className="flex items-center gap-2 text-[#283C33] font-medium text-sm">
              <ShieldCheck className="w-4 h-4 text-[#476652] shrink-0" />
              <span>{t.privacyTitle}</span>
            </div>
            <ul className="text-xs text-[#617068] space-y-1.5 leading-relaxed list-disc pl-4">
              <li>{t.privacy1}</li>
              <li>{t.privacy2}</li>
              <li>{t.privacy3}</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Hardware Connection + Check-in Setup Card */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-6 sm:p-7 shadow-[0_12px_32px_-8px_rgba(40,60,51,0.07)] space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#ECEFE9] pb-4">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#283C33]">{t.cardTitle}</h2>
                <p className="text-xs text-[#617068] mt-0.5">{t.cardSubtitle}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#476652] bg-[#E6EFE8] px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                {duration} {t.minUnit}
              </span>
            </div>

            {/* STEP 1: Pre-Observation Hardware & Wearable Connection Hub */}
            <div
              data-testid="welcome-hardware-hub"
              className="p-4 rounded-2xl bg-[#F7F5EF] border-2 border-[#C5D6C8] space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2F523B] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#476652]" />
                  <span>{t.hardwareSectionTitle}</span>
                </span>
              </div>

              {/* 1A & 1B: Microphone & Camera Permission Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Microphone Permission & Live Waveform */}
                <div className="p-3 rounded-xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <button
                      type="button"
                      data-testid="welcome-connect-mic-btn"
                      onClick={handleEnableMicClick}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        micPreconnected
                          ? 'bg-[#E6EFE8] text-[#2F523B] border border-[#7F9B87]'
                          : 'bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA]'
                      }`}
                    >
                      {micPreconnected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6B48]" />
                          <span>{t.micConnectedBtn}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>{t.micConnectBtn}</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-[#617068] leading-snug">{t.micHint}</p>
                  </div>

                  {micPreconnected && (
                    <div className="pt-1">
                      <div className="w-full h-2 bg-[#EFECE4] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#476652] transition-all duration-150 rounded-full"
                          style={{ width: `${micLevel}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Permission & Live Video Preview */}
                <div className="p-3 rounded-xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <button
                      type="button"
                      data-testid="welcome-connect-camera-btn"
                      onClick={handleEnableCameraClick}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        cameraPreconnected
                          ? 'bg-[#E6EFE8] text-[#2F523B] border border-[#7F9B87]'
                          : 'bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA]'
                      }`}
                    >
                      {cameraPreconnected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6B48]" />
                          <span>{t.cameraConnectedBtn}</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>{t.cameraConnectBtn}</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-[#617068] leading-snug">{t.cameraHint}</p>
                  </div>

                  <video
                    ref={previewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-20 object-cover rounded-lg bg-[#1F2D26] ${
                      cameraPreconnected ? 'block' : 'hidden'
                    }`}
                  />
                </div>
              </div>

              {/* 1C: Real Wearable Device Connection (Web Bluetooth GATT + Camera Optical rPPG + Cross-Device Live Push) */}
              <div className="p-3.5 rounded-xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#283C33]">
                    <Watch className="w-3.5 h-3.5 text-[#476652]" />
                    <span>{t.wearableConnectTitle}</span>
                  </div>

                  {isWearableConnected ? (
                    <div
                      data-testid="welcome-wearable-connected-badge"
                      className="inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-lg bg-[#E6EFE8] border border-[#7F9B87] text-xs font-medium text-[#2F523B]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#2F6B48] animate-ping" />
                      <span>
                        {t.wearableConnectedPrefix} {wearableDevice.deviceName}
                      </span>
                      {wearableDevice.batteryLevel !== undefined && (
                        <span className="font-mono">({wearableDevice.batteryLevel}%)</span>
                      )}
                      {latestHr.bpm > 0 ? (
                        <span className="font-mono tabular-nums">
                          · {latestHr.bpm} {locale === 'zh' ? '次/分' : 'bpm'} /{' '}
                          {latestHr.hrvRmssdMs} {locale === 'zh' ? '毫秒' : 'ms'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#7A442A]">
                          ·{' '}
                          {locale === 'zh'
                            ? '已配对蓝牙，等待设备广播 0x180D 心率数据'
                            : 'Bluetooth paired, awaiting 0x180D heart rate broadcast'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={onDisconnectWearable}
                        className="text-[11px] underline text-[#476652] hover:text-[#283C33] ml-1 cursor-pointer"
                      >
                        {t.wearableDisconnectBtn}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#617068]">
                      {locale === 'zh' ? '当前状态：尚未连接设备' : 'Status: Not connected yet'}
                    </span>
                  )}
                </div>

                {/* Honest Error / Iframe Security Notice if Web Bluetooth is blocked by preview iframe */}
                {wearableDevice.errorMessage && (
                  <div
                    data-testid="ble-diagnostic-box"
                    className="p-3 rounded-xl bg-[#F8EAE2] border border-[#E5C5B5] text-xs text-[#7A442A] space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#843B22]" />
                      <span className="leading-relaxed">{wearableDevice.errorMessage}</span>
                    </div>
                    {wearableDevice.isIframeBlocked && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
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
                      </div>
                    )}
                  </div>
                )}

                {/* 3 Real Connection Methods */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="welcome-connect-ble-btn"
                    disabled={connectingBle}
                    onClick={() => handleBleClick(true)}
                    className="py-2 px-3 rounded-lg bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                    data-testid="welcome-connect-ble-hr-btn"
                    disabled={connectingBle}
                    onClick={() => handleBleClick(false)}
                    className="py-2 px-3 rounded-lg bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#283C33] border border-[#C5D6C8] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bluetooth className="w-3.5 h-3.5 text-[#476652]" />
                    <span>
                      {locale === 'zh'
                        ? '仅扫描心率广播设备（心率带/手环）'
                        : 'Scan BLE Heart Rate Broadcast Only'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="welcome-connect-rppg-btn"
                    onClick={handleStartCameraRppg}
                    className="py-2 px-3 rounded-lg bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#476652]" />
                    <span>
                      {locale === 'zh'
                        ? '开启摄像头光电脉搏波实时测心率'
                        : 'Use Camera Optical Pulse (rPPG)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="welcome-connect-watch-btn"
                    onClick={() => setShowCompanionPanel((prev) => !prev)}
                    className="py-2 px-3 rounded-lg bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-[#476652]" />
                    <span>
                      {locale === 'zh'
                        ? '手机与智能手表实时数据录入通道'
                        : 'Phone & Smart Watch Live Input Bridge'}
                    </span>
                  </button>
                </div>

                {/* Live Phone / Apple Watch Telemetry Push Panel */}
                {showCompanionPanel && (
                  <div
                    data-testid="companion-push-panel"
                    className="p-3 rounded-xl bg-[#F7F5EF] border border-[#D5DDD2] space-y-2.5 animate-in fade-in duration-200"
                  >
                    <div className="text-xs font-semibold text-[#283C33]">
                      {locale === 'zh'
                        ? '同步你的智能手表 / 手环实测数值（支持快捷指令接口直推或手动同步当前表盘读数）'
                        : 'Sync your live Smart Watch / Band readout (or POST to /api/wearable/push)'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#617068] mb-0.5">
                          {locale === 'zh' ? '穿戴设备名称' : 'Device Name'}
                        </label>
                        <input
                          type="text"
                          value={companionDeviceName}
                          onChange={(e) => setCompanionDeviceName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#D5DDD2] bg-[#FFFEFA] text-xs text-[#283C33]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#617068] mb-0.5">
                          {locale === 'zh' ? '手表当前心率 (次/分)' : 'Watch BPM'}
                        </label>
                        <input
                          type="number"
                          min={45}
                          max={190}
                          value={companionBpm}
                          onChange={(e) => setCompanionBpm(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#D5DDD2] bg-[#FFFEFA] text-xs font-mono text-[#283C33]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#617068] mb-0.5">
                          {locale === 'zh' ? '心率变异性 (毫秒)' : 'Watch HRV (ms)'}
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={140}
                          value={companionHrv}
                          onChange={(e) => setCompanionHrv(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#D5DDD2] bg-[#FFFEFA] text-xs font-mono text-[#283C33]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#617068]">
                        {locale === 'zh'
                          ? '快捷指令直推地址：/api/wearable/push'
                          : 'Webhook: POST /api/wearable/push'}
                      </span>
                      <button
                        type="button"
                        data-testid="companion-push-submit-btn"
                        onClick={() =>
                          onPushCompanionWearableData({
                            deviceName: companionDeviceName,
                            bpm: companionBpm,
                            hrvRmssdMs: companionHrv,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium cursor-pointer"
                      >
                        {locale === 'zh' ? '立即同步手表读数' : 'Sync Watch Reading Now'}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-[#617068] leading-snug">
                  {locale === 'zh'
                    ? '说明：浏览器蓝牙支持直接配对附近蓝牙设备（若在预览内嵌框中请点击“在新标签页打开”调用系统蓝牙）；苹果手表未开启心率广播时，可直接开启“摄像头光电脉搏波”或同步表盘读数。'
                    : 'Note: Web Bluetooth pairs directly with nearby BLE devices (open in a new tab if inside an iframe), or use Camera Optical Pulse (rPPG) / Watch Live Sync.'}
                </p>
              </div>
            </div>

            {/* Person / Name Selector & One-Click Switcher */}
            <div className="space-y-2 bg-[#F7F5EF] p-3.5 rounded-xl border border-[#E5E9E2]">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="persona-name-input"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#283C33]"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#476652]" />
                  <span>{t.personSectionLabel}</span>
                </label>
                <button
                  type="button"
                  data-testid="switch-person-btn"
                  onClick={handleSwitchPerson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E6EFE8] hover:bg-[#D5E5D9] text-[#283C33] text-xs font-medium border border-[#C5D6C8] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-[#476652]" />
                  <span>{t.switchPersonBtn}</span>
                </button>
              </div>
              <input
                id="persona-name-input"
                data-testid="persona-name-input"
                type="text"
                value={personaName}
                onChange={(e) => onChangePersonaName(e.target.value)}
                placeholder={t.customNamePlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-[#D5DDD2] bg-[#FFFEFA] text-sm text-[#283C33] placeholder-[#8C9A92] focus:outline-none focus:border-[#476652] transition-all"
              />
            </div>

            {/* Activity Context Selector: Study / Work / Custom */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#283C33]">
                {t.activityLabel}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {ACTIVITIES.map((item) => {
                  const active = activity === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      data-testid={`context-${item.toLowerCase()}`}
                      onClick={() => setActivity(item)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#476652] text-[#FFFEFA] border-[#476652] shadow-xs'
                          : 'bg-[#F7F5EF] text-[#283C33] border-[#DEE5DB] hover:border-[#7F9B87]'
                      }`}
                    >
                      {getActivityIcon(item)}
                      <span>{t.activities[item]}</span>
                    </button>
                  );
                })}
              </div>

              {activity === 'Custom' && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <label
                    htmlFor="custom-activity-input"
                    className="block text-xs font-medium text-[#476652] mb-1"
                  >
                    {t.customActivityLabel}
                  </label>
                  <input
                    id="custom-activity-input"
                    data-testid="custom-activity-input"
                    type="text"
                    value={customActivityText}
                    onChange={(e) => setCustomActivityText(e.target.value)}
                    placeholder={t.customActivityPlaceholder}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#476652] bg-[#F7F5EF] text-sm text-[#283C33] placeholder-[#8C9A92] focus:outline-none focus:ring-2 focus:ring-[#7F9B87]/25"
                  />
                </div>
              )}
            </div>

            {/* Most Pressing Task Input */}
            <div className="space-y-2">
              <label htmlFor="task-input" className="block text-sm font-medium text-[#283C33]">
                {t.taskLabel}
                <span className="text-xs font-normal text-[#617068] ml-1.5">{t.optional}</span>
              </label>
              <input
                id="task-input"
                data-testid="welcome-task-input"
                type="text"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                placeholder={t.taskPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5DDD2] bg-[#F7F5EF] text-sm text-[#283C33] placeholder-[#8C9A92] focus:outline-none focus:border-[#476652] focus:bg-[#FFFEFA] transition-all"
              />
            </div>

            {/* Observation Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#283C33]">{t.durationLabel}</label>
                <span className="text-xs text-[#617068]">{t.durationHint}</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {DURATION_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    data-testid={`duration-${mins}`}
                    onClick={() => setDuration(mins)}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-medium border transition-all cursor-pointer ${
                      duration === mins
                        ? 'bg-[#E6EFE8] text-[#283C33] border-[#476652] font-semibold'
                        : 'bg-[#F7F5EF] text-[#617068] border-[#DEE5DB] hover:border-[#B8C7BC]'
                    }`}
                  >
                    {mins} {t.minUnit} {mins === 20 ? t.defaultTag : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="pt-1 space-y-2.5">
              <button
                type="submit"
                data-testid="start-gentle-checkin-btn"
                className="w-full py-3.5 px-5 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <span>{t.startBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="try-demo-btn"
                onClick={onStartDemo}
                className="w-full py-3 px-4 rounded-xl bg-[#EFECE4] hover:bg-[#E4E0D5] text-[#283C33] border border-[#D5DDD2] font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <HeartPulse className="w-4 h-4 text-[#476652]" />
                <span>
                  {t.demoBtn} ({locale === 'zh' ? currentPreset.nameZh : currentPreset.nameEn})
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
