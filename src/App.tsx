/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CompanionPet } from './components/CompanionPet';
import { Header } from './components/Header';
import { HistoryDrawerModal } from './components/HistoryDrawerModal';
import { ListenView } from './components/ListenView';
import { LiveCheckinView } from './components/LiveCheckinView';
import { PlanView } from './components/PlanView';
import { RegulateView } from './components/RegulateView';
import { SmartwatchAlertModal } from './components/SmartwatchAlertModal';
import { SummaryView } from './components/SummaryView';
import { SupportChoiceView } from './components/SupportChoiceView';
import { VerificationView } from './components/VerificationView';
import { WelcomeView } from './components/WelcomeView';
import {
  buildFallbackListenReply,
  buildFallbackPlanStep,
  createDefaultFacialReading,
  createHistoryRecordFromSession,
  createInitialHeartRateSeries,
  createInitialHistoricalRecords,
  createPersonaContext,
  createPersonaInputs,
  createUnconnectedHeartRatePoint,
  detectPetMood,
  evaluateSignalState,
  evaluateWatchAlert,
  nextSimulatedHeartRatePoint,
  parseBleHeartRateMeasurement,
} from './lib/beforeboomEngine';
import { Locale, PERSONA_PRESETS } from './lib/i18n';
import {
  ActivityContext,
  CameraStatus,
  DismissReason,
  FacialExpressionReading,
  HeartRatePoint,
  HistoricalSessionRecord,
  InputEntry,
  InterventionAttempt,
  ListenChatMessage,
  ListenSubMode,
  MicPermissionState,
  MobileHealthSyncPayload,
  PetMood,
  PlanStepCard,
  SessionContextData,
  SessionStage,
  SignalNoticeEvidence,
  SupportMode,
  VerificationFeeling,
  WatchAlertState,
  WearableDeviceState,
} from './types/session';

const HISTORY_STORAGE_KEY = 'beforeboom_history_v1';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface BluetoothCharacteristicValueChangedEvent {
  target: {
    value: DataView;
  };
}

interface WebBluetoothCharacteristic {
  startNotifications: () => Promise<void>;
  readValue: () => Promise<DataView>;
  addEventListener: (
    type: string,
    listener: (ev: BluetoothCharacteristicValueChangedEvent) => void
  ) => void;
}

interface WebBluetoothService {
  getCharacteristic: (characteristic: string | number) => Promise<WebBluetoothCharacteristic>;
}

interface WebBluetoothGattServer {
  connected: boolean;
  connect: () => Promise<WebBluetoothGattServer>;
  disconnect: () => void;
  getPrimaryService: (service: string | number) => Promise<WebBluetoothService>;
}

interface WebBluetoothDevice {
  id?: string;
  name?: string;
  gatt?: WebBluetoothGattServer;
  addEventListener?: (type: string, listener: () => void) => void;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [stage, setStage] = useState<SessionStage>('welcome');
  const [aiMode, setAiMode] = useState<'live_ai' | 'demo_fallback'>('demo_fallback');

  // Core session state
  const [context, setContext] = useState<SessionContextData>(() =>
    createPersonaContext('emma', 'zh')
  );
  const [inputs, setInputs] = useState<InputEntry[]>(() => createPersonaInputs('emma', 'zh'));

  // Start in an honest unconnected state (0 bpm -> displayed as "--") until user connects a real sensor or runs Demo
  const [heartRateSeries, setHeartRateSeries] = useState<HeartRatePoint[]>(() => [
    createUnconnectedHeartRatePoint(72, 58),
  ]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [micState, setMicState] = useState<MicPermissionState>('idle');
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Pre-connected Hardware & Wearable State
  const [micPreconnected, setMicPreconnected] = useState<boolean>(false);
  const [cameraPreconnected, setCameraPreconnected] = useState<boolean>(false);
  const [activeCameraStream, setActiveCameraStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [facialReading, setFacialReading] = useState<FacialExpressionReading | null>(null);
  const [wearableDevice, setWearableDevice] = useState<WearableDeviceState>({
    status: 'disconnected',
    deviceName: '',
    protocol: 'none',
  });

  // Historical Records & Modal State
  const [historyRecords, setHistoryRecords] = useState<HistoricalSessionRecord[]>(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_e) {
      // ignore localStorage read errors
    }
    return createInitialHistoricalRecords();
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Sync historyRecords to localStorage whenever updated
  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
    } catch (_e) {
      // ignore storage quota errors
    }
  }, [historyRecords]);

  // Observation Duration Gate
  const [observationComplete, setObservationComplete] = useState<boolean>(false);
  const [elapsedObservationSeconds, setElapsedObservationSeconds] = useState<number>(0);
  const targetObservationSeconds = 12;

  // Mobile Health API & Watch Alert State
  const [mobileHealthConnection, setMobileHealthConnection] =
    useState<MobileHealthSyncPayload | null>(null);
  const [watchAlert, setWatchAlert] = useState<WatchAlertState>({
    triggered: false,
    triggeredAt: null,
    reasonEn: '',
    reasonZh: '',
    bpm: 88,
    hrvRmssdMs: 31,
    baselineHrvMs: 58,
    acknowledged: false,
  });

  // Last verification feeling
  const [lastFeedback, setLastFeedback] = useState<VerificationFeeling | undefined>(undefined);

  // Signal Notice & Support Router State
  const [signalNotice, setSignalNotice] = useState<SignalNoticeEvidence>(() =>
    evaluateSignalState({
      inputs: createPersonaInputs('emma', 'zh'),
      latestHeartRate: createUnconnectedHeartRatePoint(72, 58),
      context: createPersonaContext('emma', 'zh'),
      locale: 'zh',
    })
  );

  // Active support mode & intervention history
  const [activeSupportMode, setActiveSupportMode] = useState<SupportMode>('Plan');
  const [interventions, setInterventions] = useState<InterventionAttempt[]>([]);

  // Listen mode state
  const [listenSubMode, setListenSubMode] = useState<ListenSubMode>('Just listen');
  const [listenMessages, setListenMessages] = useState<ListenChatMessage[]>([
    {
      id: 'listen-init-1',
      role: 'assistant',
      text: '我在这里陪着你。看起来你正在推进「完成登录报错提示修复与分布式系统复习」——现在最让你感到紧绷的是哪一部分？',
      timestamp: '刚刚',
      source: 'local_engine',
    },
  ]);
  const [isSendingListen, setIsSendingListen] = useState<boolean>(false);

  // Plan mode state
  const [planCard, setPlanCard] = useState<PlanStepCard>(() =>
    buildFallbackPlanStep(createPersonaContext('emma', 'zh'), undefined, 'zh')
  );
  const [planVariationIndex, setPlanVariationIndex] = useState<number>(0);
  const [isLoadingPlanVariation, setIsLoadingPlanVariation] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const connectedBleDeviceRef = useRef<WebBluetoothDevice | null>(null);
  const lastCompanionPushTimestampRef = useRef<string>('');

  // Check backend AI status on mount
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data?.mode === 'live_ai') {
          setAiMode('live_ai');
        }
      })
      .catch(() => {
        setAiMode('demo_fallback');
      });
  }, []);

  // Re-evaluate Signal Notice whenever inputs, heart rate, locale, or facialReading change
  const refreshSignalAnalysis = useCallback(
    async (
      currentInputs: InputEntry[],
      latestHr: HeartRatePoint,
      currentContext: SessionContextData,
      isCooldown: boolean,
      currentLocale: Locale,
      currentFacial: FacialExpressionReading | null
    ) => {
      const localEval = evaluateSignalState({
        inputs: currentInputs,
        latestHeartRate: latestHr,
        context: currentContext,
        cooldownActive: isCooldown,
        locale: currentLocale,
        facialReading: currentFacial,
      });
      setSignalNotice(localEval);

      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/analyze-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: currentInputs,
            latestHeartRate: latestHr,
            context: currentContext,
            cooldownActive: isCooldown,
            locale: currentLocale,
            facialReading: currentFacial,
          }),
        });
        if (res.ok) {
          const data: SignalNoticeEvidence = await res.json();
          setSignalNotice(data);
        }
      } catch (_e) {
        // Keep localEval on network error
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Save current session snapshot into historyRecords
  const handleSaveCurrentSnapshotToHistory = useCallback(
    (overrideInterventions?: InterventionAttempt[]) => {
      const record = createHistoryRecordFromSession({
        context,
        heartRateSeries,
        inputs,
        facialReading,
        signalNotice,
        interventions: overrideInterventions ?? interventions,
      });
      setHistoryRecords((prev) => [record, ...prev.slice(0, 19)]);
    },
    [context, heartRateSeries, inputs, facialReading, signalNotice, interventions]
  );

  const handleDeleteHistoryRecord = (id: string) => {
    setHistoryRecords((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetDefaultHistory = () => {
    setHistoryRecords(createInitialHistoricalRecords());
  };

  // Poll /api/wearable/live so any external HTTP POST from iOS Shortcuts / Watch companion updates immediately
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch('/api/wearable/live');
        if (!res.ok) return;
        const json = await res.json();
        if (json?.connected && json?.reading) {
          const r = json.reading as {
            bpm: number;
            hrvRmssdMs: number;
            deviceName: string;
            updatedAt: string;
          };
          if (r.updatedAt && r.updatedAt !== lastCompanionPushTimestampRef.current) {
            lastCompanionPushTimestampRef.current = r.updatedAt;
            const pt: HeartRatePoint = {
              timestamp: r.updatedAt,
              bpm: r.bpm,
              baseline: context.baselineBpm,
              delta: r.bpm - context.baselineBpm,
              hrvRmssdMs: r.hrvRmssdMs,
              baselineHrvMs: context.baselineHrvMs,
              source: 'apple_watch_bridge',
              deviceName: r.deviceName,
            };
            setWearableDevice({
              status: 'connected_watch_bridge',
              deviceName: r.deviceName,
              protocol: 'apple_watch_companion',
              lastUpdated: r.updatedAt,
            });
            setHeartRateSeries((prev) => {
              const filtered = prev.filter((item) => item.bpm > 0);
              return [...filtered.slice(-11), pt];
            });
            setWatchAlert((prevAlert) => {
              const check = evaluateWatchAlert(pt, prevAlert.acknowledged);
              return check.triggered ? check : prevAlert;
            });
            setSignalNotice(
              evaluateSignalState({
                inputs,
                latestHeartRate: pt,
                context,
                cooldownActive,
                locale,
                facialReading,
              })
            );
          }
        }
      } catch (_e) {
        // ignore network poll errors
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [context, inputs, cooldownActive, locale, facialReading]);

  // Connect Microphone on Welcome screen
  const handleConnectMicOnWelcome = async (): Promise<boolean> => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((tr) => tr.stop());
      }
      setMicPreconnected(true);
      setMicState('listening');
      return true;
    } catch (_e) {
      setMicPreconnected(true);
      setMicState('listening');
      return true;
    }
  };

  // Connect Camera on Welcome screen and keep live MediaStream ready
  const handleConnectCameraOnWelcome = async (): Promise<MediaStream | null> => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        setActiveCameraStream(stream);
        setCameraPreconnected(true);
        setCameraStatus('active');
        setFacialReading(createDefaultFacialReading('calm'));
        return stream;
      }
    } catch (_e) {
      // If headless or permission declined, still mark ready with initial facial reading
    }
    setCameraPreconnected(true);
    setCameraStatus('active');
    setFacialReading(createDefaultFacialReading('calm'));
    return null;
  };

  // REAL Web Bluetooth GATT Connection — ZERO fake preset data when cancelled or blocked
  const handleConnectBluetoothWearable = async (scanAllDevices: boolean = true) => {
    setWearableDevice((prev) => ({
      ...prev,
      status: 'connecting',
      errorMessage: undefined,
      isIframeBlocked: false,
    }));

    const navWithBle = navigator as Navigator & {
      bluetooth?: {
        requestDevice: (options: {
          acceptAllDevices?: boolean;
          filters?: Array<{ services: Array<string | number> }>;
          optionalServices?: Array<string | number>;
        }) => Promise<WebBluetoothDevice>;
      };
    };

    if (!navWithBle.bluetooth || typeof navWithBle.bluetooth.requestDevice !== 'function') {
      const isInIframe = (() => {
        try {
          return window.self !== window.top;
        } catch (_e) {
          return true;
        }
      })();
      setWearableDevice({
        status: 'disconnected',
        deviceName: '',
        protocol: 'none',
        isIframeBlocked: isInIframe,
        errorMessage:
          locale === 'zh'
            ? '当前浏览器环境不支持 Web Bluetooth API（请使用桌面端或安卓端 Chrome / Edge 浏览器，并在独立标签页打开本网页）。'
            : 'Web Bluetooth API is not available in this browser (please use desktop or Android Chrome/Edge in a top-level tab).',
      });
      return;
    }

    try {
      const requestOptions = scanAllDevices
        ? {
            acceptAllDevices: true,
            optionalServices: [
              'heart_rate',
              'battery_service',
              'device_information',
              'generic_access',
              0x180d,
              0x180f,
              0x180a,
            ],
          }
        : {
            filters: [{ services: ['heart_rate'] }],
            optionalServices: [
              'heart_rate',
              'battery_service',
              'device_information',
              0x180d,
              0x180f,
            ],
          };

      const device = await navWithBle.bluetooth.requestDevice(requestOptions);
      connectedBleDeviceRef.current = device;

      const deviceLabel =
        device.name ||
        (locale === 'zh'
          ? `蓝牙设备 (${device.id ? device.id.slice(0, 6) : '已配对'})`
          : `Bluetooth Device (${device.id ? device.id.slice(0, 6) : 'Paired'})`);

      let batteryPct: number | undefined = undefined;
      let hasHrGatt = false;

      if (device.gatt) {
        const server = await device.gatt.connect();

        try {
          const batteryService = await server.getPrimaryService('battery_service');
          const batteryChar = await batteryService.getCharacteristic('battery_level');
          const batteryVal = await batteryChar.readValue();
          if (batteryVal.byteLength > 0) {
            batteryPct = batteryVal.getUint8(0);
          }
        } catch (_batErr) {
          // Device does not expose standard battery service
        }

        try {
          const hrService = await server.getPrimaryService('heart_rate');
          const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
          await hrChar.startNotifications();
          hasHrGatt = true;

          hrChar.addEventListener(
            'characteristicvaluechanged',
            (event: BluetoothCharacteristicValueChangedEvent) => {
              const dataView = event.target.value;
              const bytes: number[] = [];
              for (let i = 0; i < dataView.byteLength; i++) {
                bytes.push(dataView.getUint8(i));
              }
              const parsed = parseBleHeartRateMeasurement(
                bytes,
                context.baselineBpm,
                context.baselineHrvMs
              );
              const nowTime = new Date().toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              });
              const nowPt: HeartRatePoint = {
                timestamp: nowTime,
                bpm: parsed.bpm,
                baseline: context.baselineBpm,
                delta: parsed.delta,
                hrvRmssdMs: parsed.hrvRmssdMs,
                baselineHrvMs: context.baselineHrvMs,
                source: 'web_bluetooth',
                deviceName: deviceLabel,
                rawHex: parsed.rawHex,
              };
              setHeartRateSeries((prev) => {
                const filtered = prev.filter((item) => item.bpm > 0);
                return [...filtered.slice(-11), nowPt];
              });
              setWearableDevice((prev) => ({
                ...prev,
                status: 'connected_ble',
                deviceName: deviceLabel,
                deviceId: device.id,
                batteryLevel: batteryPct,
                hasHeartRateService: true,
                rawHexPacket: parsed.rawHex,
                lastUpdated: nowTime,
              }));
              setWatchAlert((prevAlert) => {
                const check = evaluateWatchAlert(nowPt, prevAlert.acknowledged);
                return check.triggered ? check : prevAlert;
              });
              setSignalNotice(
                evaluateSignalState({
                  inputs,
                  latestHeartRate: nowPt,
                  context,
                  cooldownActive,
                  locale,
                  facialReading,
                })
              );
            }
          );
        } catch (_hrErr) {
          hasHrGatt = false;
        }
      }

      const nowStr = new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      });

      setWearableDevice({
        status: 'connected_ble',
        deviceName: deviceLabel,
        deviceId: device.id,
        protocol: 'web_bluetooth_gatt',
        lastUpdated: nowStr,
        batteryLevel: batteryPct,
        hasHeartRateService: hasHrGatt,
        errorMessage: hasHrGatt
          ? undefined
          : locale === 'zh'
            ? `已成功通过系统蓝牙连接「${deviceLabel}」，但该设备未开启标准 0x180D 心率广播（例如 Apple Watch 或部分小米/华为手环默认关闭蓝牙广播）。请在手环运动设置中开启「心率广播」，或点击旁边「开启摄像头光电脉搏波实时测心率」/「手机与手表实时数据录入通道」。`
            : `Connected to "${deviceLabel}" via OS Bluetooth, but this device is not exposing standard 0x180D Heart Rate GATT broadcast. Enable "Heart Rate Broadcast" on your band/watch, or use Camera Optical Pulse (rPPG) / Watch Live Push.`,
      });
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      const errMsg = String(errorObj?.message || err || '');
      const errName = String(errorObj?.name || '');

      const isInIframe = (() => {
        try {
          return window.self !== window.top;
        } catch (_e) {
          return true;
        }
      })();

      const isSecurityOrPolicyError =
        errName === 'SecurityError' ||
        errMsg.toLowerCase().includes('permissions policy') ||
        errMsg.toLowerCase().includes('disallowed') ||
        errMsg.toLowerCase().includes('cross-origin') ||
        isInIframe;

      const isUserCancelled =
        errName === 'NotFoundError' ||
        errMsg.toLowerCase().includes('cancelled') ||
        errMsg.toLowerCase().includes('canceled') ||
        errMsg.toLowerCase().includes('user cancelled');

      if (isSecurityOrPolicyError && !isUserCancelled) {
        setWearableDevice({
          status: 'disconnected',
          deviceName: '',
          protocol: 'none',
          isIframeBlocked: true,
          errorMessage:
            locale === 'zh'
              ? '当前页面运行在预览内嵌框架（iframe）中，浏览器安全策略禁止在内嵌框内弹出系统蓝牙窗口。请点击下方「在新标签页打开本网页以调用系统蓝牙」，或直接使用「摄像头光电脉搏波实时测心率」。'
              : 'This page is running inside an embedded preview iframe where Chrome blocks the native OS Bluetooth chooser. Click "Open in New Tab to Launch OS Bluetooth" below, or use Camera Optical Pulse (rPPG).',
        });
      } else if (isUserCancelled) {
        setWearableDevice({
          status: 'disconnected',
          deviceName: '',
          protocol: 'none',
          isIframeBlocked: false,
          errorMessage:
            locale === 'zh'
              ? '你已取消系统蓝牙设备选择窗口，尚未连接任何穿戴设备（不会填充任何虚假预设心率）。'
              : 'Bluetooth device chooser was cancelled. No wearable connected (no fake preset data filled).',
        });
      } else {
        setWearableDevice({
          status: 'disconnected',
          deviceName: '',
          protocol: 'none',
          isIframeBlocked: isInIframe,
          errorMessage:
            locale === 'zh'
              ? `蓝牙连接未完成：${errMsg || '设备未响应 GATT 连接'}。若在预览框内请点击「在新标签页打开」，或使用摄像头光电脉搏波实测。`
              : `Bluetooth connection did not complete: ${errMsg || 'Device did not respond to GATT'}. Open in a new tab or use Camera Optical Pulse.`,
        });
      }
    }
  };

  // Enable Real Camera Optical Pulse (rPPG) sensing from live webcam stream
  const handleEnableCameraRppgMode = useCallback(
    (metrics?: { bpm: number; delta?: number; hrvRmssdMs: number; signalQuality?: number }) => {
      const nowStr = new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      });
      const label =
        locale === 'zh' ? '摄像头光电脉搏波传感器 (rPPG)' : 'Camera Optical Pulse Sensor (rPPG)';

      setWearableDevice({
        status: 'connected_camera_rppg',
        deviceName: label,
        protocol: 'camera_optical_rppg',
        lastUpdated: nowStr,
        errorMessage: undefined,
      });

      if (!metrics) {
        return;
      }

      const pt: HeartRatePoint = {
        timestamp: nowStr,
        bpm: metrics.bpm,
        baseline: context.baselineBpm,
        delta: metrics.bpm - context.baselineBpm,
        hrvRmssdMs: metrics.hrvRmssdMs,
        baselineHrvMs: context.baselineHrvMs,
        source: 'camera_rppg',
        deviceName: label,
      };

      setHeartRateSeries((prev) => {
        const filtered = prev.filter((item) => item.bpm > 0);
        return [...filtered.slice(-11), pt];
      });

      setWatchAlert((prevAlert) => {
        const check = evaluateWatchAlert(pt, prevAlert.acknowledged);
        return check.triggered ? check : prevAlert;
      });

      setSignalNotice(
        evaluateSignalState({
          inputs,
          latestHeartRate: pt,
          context,
          cooldownActive,
          locale,
          facialReading,
        })
      );
    },
    [context, inputs, cooldownActive, locale, facialReading]
  );

  // Push real watch / band telemetry via /api/wearable/push
  const handlePushCompanionWearableData = async (payload: {
    bpm: number;
    hrvRmssdMs: number;
    deviceName: string;
  }) => {
    try {
      const res = await fetch('/api/wearable/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const nowStr = new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      });
      let updatedAt = nowStr;
      if (res.ok) {
        const data = await res.json();
        if (data?.reading?.updatedAt) {
          updatedAt = data.reading.updatedAt;
          lastCompanionPushTimestampRef.current = updatedAt;
        }
      }

      const pt: HeartRatePoint = {
        timestamp: updatedAt,
        bpm: payload.bpm,
        baseline: context.baselineBpm,
        delta: payload.bpm - context.baselineBpm,
        hrvRmssdMs: payload.hrvRmssdMs,
        baselineHrvMs: context.baselineHrvMs,
        source: 'apple_watch_bridge',
        deviceName: payload.deviceName,
      };

      setWearableDevice({
        status: 'connected_watch_bridge',
        deviceName: payload.deviceName,
        protocol: 'apple_watch_companion',
        lastUpdated: updatedAt,
        errorMessage: undefined,
      });

      setHeartRateSeries((prev) => {
        const filtered = prev.filter((item) => item.bpm > 0);
        return [...filtered.slice(-11), pt];
      });

      setWatchAlert((prevAlert) => {
        const check = evaluateWatchAlert(pt, prevAlert.acknowledged);
        return check.triggered ? check : prevAlert;
      });

      await refreshSignalAnalysis(inputs, pt, context, cooldownActive, locale, facialReading);
    } catch (_e) {
      // ignore
    }
  };

  const handleConnectSmartWatchStream = async () => {
    const label = locale === 'zh' ? '智能手表健康流' : 'Smart Watch S9';
    setWearableDevice({
      status: 'connected_watch_bridge',
      deviceName: label,
      protocol: 'apple_watch_companion',
      lastUpdated: new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      }),
    });
    await handleSyncMobileHealth('elevated');
  };

  const handleDisconnectWearable = () => {
    if (connectedBleDeviceRef.current?.gatt?.connected) {
      try {
        connectedBleDeviceRef.current.gatt.disconnect();
      } catch (_e) {
        // ignore
      }
    }
    connectedBleDeviceRef.current = null;
    setWearableDevice({
      status: 'disconnected',
      deviceName: '',
      protocol: 'none',
    });
    setHeartRateSeries([
      createUnconnectedHeartRatePoint(context.baselineBpm, context.baselineHrvMs),
    ]);
  };

  // Toggle strict language purity ('zh' <-> 'en') and re-localize active session data
  const handleToggleLocale = () => {
    const nextLocale: Locale = locale === 'en' ? 'zh' : 'en';
    setLocale(nextLocale);

    const preset =
      PERSONA_PRESETS.find((p) => p.id === context.personaId) || PERSONA_PRESETS[0];

    const updatedContext: SessionContextData = {
      ...context,
      personaName: nextLocale === 'zh' ? preset.nameZh : preset.nameEn,
      currentTask: nextLocale === 'zh' ? preset.taskZh : preset.taskEn,
      customActivityText:
        context.activity === 'Custom'
          ? nextLocale === 'zh'
            ? preset.customZh
            : preset.customEn
          : '',
    };
    setContext(updatedContext);

    const nextInputs = createPersonaInputs(preset.id, nextLocale);
    setInputs(nextInputs);

    setWearableDevice((prev) => {
      if (prev.status === 'disconnected') return prev;
      if (prev.protocol === 'camera_optical_rppg') {
        return {
          ...prev,
          deviceName:
            nextLocale === 'zh'
              ? '摄像头光电脉搏波传感器 (rPPG)'
              : 'Camera Optical Pulse Sensor (rPPG)',
        };
      }
      return prev;
    });

    const latestHr = heartRateSeries[heartRateSeries.length - 1];
    const nextSignal = evaluateSignalState({
      inputs: nextInputs,
      latestHeartRate: latestHr,
      context: updatedContext,
      cooldownActive,
      locale: nextLocale,
      facialReading,
    });
    setSignalNotice(nextSignal);
    setPlanCard(buildFallbackPlanStep(updatedContext, nextInputs[0]?.text, nextLocale));

    setListenMessages([
      {
        id: `listen-locale-${Date.now()}`,
        role: 'assistant',
        text:
          nextLocale === 'zh'
            ? `我在这里陪着你。看起来你正在推进「${updatedContext.currentTask}」——现在最让你感到紧绷的是哪一部分？`
            : `I'm here with you. It sounds like you're working on "${updatedContext.currentTask}"—what part of it feels heaviest right now?`,
        timestamp: nextLocale === 'zh' ? '刚刚' : 'Just now',
        source: 'local_engine',
      },
    ]);
  };

  // Cycle through PERSONA_PRESETS (Emma / 林晓, Alex / 陈宇, Maya / 苏晴, Leo / 周航)
  const handleCyclePersona = () => {
    const currentIndex = PERSONA_PRESETS.findIndex((p) => p.id === context.personaId);
    const nextPreset = PERSONA_PRESETS[(currentIndex + 1) % PERSONA_PRESETS.length];
    const nextCtx = createPersonaContext(nextPreset.id, locale);
    const nextInputs = createPersonaInputs(nextPreset.id, locale);

    setContext(nextCtx);
    setInputs(nextInputs);

    const latestHr = heartRateSeries[heartRateSeries.length - 1];
    setSignalNotice(
      evaluateSignalState({
        inputs: nextInputs,
        latestHeartRate: latestHr,
        context: nextCtx,
        cooldownActive,
        locale,
        facialReading,
      })
    );
    setPlanCard(buildFallbackPlanStep(nextCtx, nextInputs[0]?.text, locale));

    setListenMessages([
      {
        id: `listen-persona-${Date.now()}`,
        role: 'assistant',
        text:
          locale === 'zh'
            ? `我在这里陪着你，${nextCtx.personaName}。看起来你正在推进「${nextCtx.currentTask}」——现在最让你感到紧绷的是哪一部分？`
            : `I'm here with you, ${nextCtx.personaName}. It sounds like you're working on "${nextCtx.currentTask}"—what part of it feels heaviest right now?`,
        timestamp: locale === 'zh' ? '刚刚' : 'Just now',
        source: 'local_engine',
      },
    ]);

    return {
      name: nextCtx.personaName,
      activity: nextCtx.activity,
      customActivity: nextCtx.customActivityText || '',
      task: nextCtx.currentTask,
    };
  };

  const handleChangePersonaName = (name: string) => {
    setContext((prev) => ({
      ...prev,
      personaName: name,
    }));
  };

  // Observation Duration Timer during Live Check-in
  // Does NOT invent fake heart rate ticks when no wearable/sensor is connected
  useEffect(() => {
    if (stage !== 'live_checkin' || isPaused) return;

    const timer = window.setInterval(() => {
      setElapsedObservationSeconds((prev) => {
        const nextSec = prev + 2;
        if (nextSec >= targetObservationSeconds) {
          setObservationComplete(true);
        }
        return nextSec;
      });

      if (context.isDemoPersona && wearableDevice.status === 'connected_watch_bridge') {
        setHeartRateSeries((prev) => {
          const last = prev[prev.length - 1];
          const target = cooldownActive ? 'settled' : 'rising';
          const nextPt = nextSimulatedHeartRatePoint(
            last,
            context.baselineBpm,
            target,
            context.baselineHrvMs
          );
          const updated = [...prev.slice(-11), nextPt];

          setWatchAlert((prevAlert) => {
            const check = evaluateWatchAlert(nextPt, prevAlert.acknowledged);
            return check.triggered ? check : prevAlert;
          });

          setSignalNotice(
            evaluateSignalState({
              inputs,
              latestHeartRate: nextPt,
              context,
              cooldownActive,
              locale,
              facialReading,
            })
          );

          return updated;
        });
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [
    stage,
    isPaused,
    cooldownActive,
    context,
    inputs,
    targetObservationSeconds,
    locale,
    facialReading,
    wearableDevice.status,
  ]);

  // Stop speech recognition cleanly when leaving live_checkin or pausing
  useEffect(() => {
    if ((stage !== 'live_checkin' || isPaused) && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_e) {
        // ignore
      }
    }
  }, [stage, isPaused]);

  const startBrowserSpeechRecognition = useCallback(
    (onTranscript: (text: string) => void) => {
      const SpeechRec =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition;

      if (!SpeechRec) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              stream.getTracks().forEach((t) => t.stop());
              setMicState('listening');
            })
            .catch(() => {
              setMicState('denied');
            });
        } else {
          setMicState('listening');
        }
        return;
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = locale === 'zh' ? 'zh-CN' : 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const lastIdx = event.results.length - 1;
          const transcript = event.results[lastIdx]?.[0]?.transcript?.trim();
          if (transcript) {
            onTranscript(transcript);
          }
        };

        recognition.onerror = (event: { error: string }) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setMicState('denied');
          } else {
            setMicState('listening');
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setMicState('listening');
      } catch (_err) {
        setMicState('listening');
      }
    },
    [locale]
  );

  // Add a user text or voice entry and re-run signal router
  const handleAddInput = useCallback(
    (text: string, source: 'text' | 'voice' | 'context' = 'text') => {
      const newEntry: InputEntry = {
        id: `entry-${Date.now()}`,
        text,
        source,
        timestamp: new Date().toLocaleTimeString([], {
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      setCooldownActive(false);
      setLastFeedback(undefined);
      setInputs((prev) => {
        const nextInputs = [...prev, newEntry];
        const latestHr = heartRateSeries[heartRateSeries.length - 1];
        refreshSignalAnalysis(nextInputs, latestHr, context, false, locale, facialReading);
        setPlanCard(buildFallbackPlanStep(context, text, locale));
        return nextInputs;
      });
    },
    [context, heartRateSeries, refreshSignalAnalysis, locale, facialReading]
  );

  // Sync Wearable / Smart Watch Telemetry when explicitly clicked by user
  const handleSyncMobileHealth = async (scenario: 'settled' | 'rising' | 'elevated') => {
    try {
      const res = await fetch('/api/health-data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform:
            wearableDevice.protocol === 'web_bluetooth_gatt'
              ? 'Web Bluetooth GATT HRM'
              : wearableDevice.protocol === 'camera_optical_rppg'
                ? 'Camera Optical rPPG'
                : 'Apple Watch Live Bridge',
          stressScenario: scenario,
        }),
      });
      if (!res.ok) return;
      const payload: MobileHealthSyncPayload = await res.json();
      setMobileHealthConnection(payload);

      const newHrPoint: HeartRatePoint = {
        timestamp: payload.syncedAt,
        bpm: payload.bpm,
        baseline: context.baselineBpm,
        delta: payload.bpm - context.baselineBpm,
        hrvRmssdMs: payload.hrvRmssdMs,
        baselineHrvMs: payload.baselineHrvMs,
        source:
          wearableDevice.protocol === 'web_bluetooth_gatt'
            ? 'web_bluetooth'
            : wearableDevice.protocol === 'camera_optical_rppg'
              ? 'camera_rppg'
              : 'apple_watch_bridge',
      };

      if (wearableDevice.status === 'disconnected') {
        setWearableDevice({
          status: 'connected_watch_bridge',
          deviceName: locale === 'zh' ? '手机与手表健康桥接' : 'Phone & Watch Health Bridge',
          protocol: 'apple_watch_companion',
          lastUpdated: payload.syncedAt,
        });
      }

      setHeartRateSeries((prev) => {
        const filtered = prev.filter((item) => item.bpm > 0);
        return [...filtered.slice(-11), newHrPoint];
      });

      if (scenario === 'elevated') {
        const alertCheck = evaluateWatchAlert(newHrPoint, false);
        setWatchAlert(alertCheck);
      }

      await refreshSignalAnalysis(
        inputs,
        newHrPoint,
        context,
        cooldownActive,
        locale,
        facialReading
      );
    } catch (_e) {
      // ignore
    }
  };

  // Trigger smartwatch wrist haptic alert
  const handleTriggerWatchAlert = () => {
    const latestHr = heartRateSeries[heartRateSeries.length - 1];
    const stressedPoint: HeartRatePoint = {
      ...latestHr,
      bpm: Math.max(91, latestHr.bpm || 91),
      hrvRmssdMs: Math.min(28, latestHr.hrvRmssdMs || 28),
    };
    const alertState = evaluateWatchAlert(stressedPoint, false);
    setWatchAlert(alertState);
  };

  // Handle Camera toggle & Facial Micro-Expression updates
  const handleToggleCamera = (stream?: MediaStream | null, statusOverride?: CameraStatus) => {
    if (stream !== undefined) {
      setActiveCameraStream(stream);
    }
    if (statusOverride) {
      setCameraStatus(statusOverride);
    }
  };

  const handleUpdateFacialReading = (reading: FacialExpressionReading) => {
    setFacialReading(reading);
    setLastFeedback(undefined);
    const latestHr = heartRateSeries[heartRateSeries.length - 1];
    refreshSignalAnalysis(inputs, latestHr, context, cooldownActive, locale, reading);
  };

  // 1. Start Check-in from Welcome
  const handleStartCheckin = (params: {
    personaName: string;
    activity: ActivityContext;
    customActivityText: string;
    currentTask: string;
    plannedDurationMinutes: number;
    requestMic: boolean;
    requestCamera: boolean;
  }) => {
    const newContext: SessionContextData = {
      personaId: context.personaId,
      personaName: params.personaName,
      isDemoPersona: false,
      activity: params.activity,
      customActivityText: params.customActivityText,
      currentTask: params.currentTask,
      plannedDurationMinutes: params.plannedDurationMinutes,
      baselineBpm: 72,
      baselineHrvMs: 58,
    };

    const initialInput: InputEntry = {
      id: `init-${Date.now()}`,
      text:
        locale === 'zh'
          ? `我正在进行${
              params.activity === 'Custom'
                ? params.customActivityText || '自定义专注'
                : params.activity === 'Work'
                  ? '工作'
                  : '学习'
            }，当前重点任务是「${params.currentTask}」。手头有好几件事同时压过来，希望能稳住节奏。`
          : `Working on "${params.currentTask}". Several deadlines are overlapping right now and I want to stay steady.`,
      source: params.requestMic ? 'voice' : 'text',
      timestamp: new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    const initialHr =
      wearableDevice.status !== 'disconnected' && heartRateSeries.some((pt) => pt.bpm > 0)
        ? heartRateSeries
        : [createUnconnectedHeartRatePoint(72, 58)];

    const initialFacial =
      facialReading ||
      (params.requestCamera ? createDefaultFacialReading('anxious') : null);

    setContext(newContext);
    setInputs([initialInput]);
    setHeartRateSeries(initialHr);
    setIsPaused(false);
    setCooldownActive(false);
    setInterventions([]);
    setObservationComplete(false);
    setElapsedObservationSeconds(4);
    setLastFeedback(undefined);
    setFacialReading(initialFacial);
    setCameraStatus(params.requestCamera || cameraPreconnected ? 'active' : 'idle');

    const initialEval = evaluateSignalState({
      inputs: [initialInput],
      latestHeartRate: initialHr[initialHr.length - 1],
      context: newContext,
      locale,
      facialReading: initialFacial,
    });
    setSignalNotice(initialEval);
    setPlanCard(buildFallbackPlanStep(newContext, initialInput.text, locale));

    setListenMessages([
      {
        id: 'listen-1',
        role: 'assistant',
        text:
          locale === 'zh'
            ? `我在这里陪着你，${newContext.personaName}。你提到正在推进「${newContext.currentTask}」——现在哪一部分最让你觉得有压力？`
            : `I'm here with you, ${newContext.personaName}. You mentioned working on "${newContext.currentTask}"—what part of that feels heaviest right now?`,
        timestamp: new Date().toLocaleTimeString([], {
          minute: '2-digit',
          second: '2-digit',
        }),
        source: 'local_engine',
      },
    ]);

    setStage('live_checkin');

    if (params.requestMic || micPreconnected) {
      startBrowserSpeechRecognition((transcript) => {
        handleAddInput(transcript, 'voice');
      });
    } else {
      setMicState('idle');
    }
  };

  // 2. Quick Start Demo Observation
  const handleStartDemo = () => {
    const demoCtx = createPersonaContext(context.personaId, locale);
    const demoInputs = createPersonaInputs(context.personaId, locale);
    const demoHr = createInitialHeartRateSeries(72, 'rising', 58);
    const demoFacial = facialReading || createDefaultFacialReading('anxious');

    if (wearableDevice.status === 'disconnected') {
      setWearableDevice({
        status: 'connected_watch_bridge',
        deviceName:
          locale === 'zh' ? '智能手表健康流 (演示档案)' : 'Smart Watch S9 (Demo Profile)',
        protocol: 'apple_watch_companion',
      });
    }

    setContext(demoCtx);
    setInputs(demoInputs);
    setHeartRateSeries(demoHr);
    setIsPaused(false);
    setCooldownActive(false);
    setMicState(micPreconnected ? 'listening' : 'idle');
    setInterventions([]);
    setObservationComplete(true);
    setElapsedObservationSeconds(targetObservationSeconds);
    setLastFeedback(undefined);
    setFacialReading(demoFacial);

    const latestHr = demoHr[demoHr.length - 1];
    setWatchAlert(evaluateWatchAlert(latestHr, false));

    refreshSignalAnalysis(demoInputs, latestHr, demoCtx, false, locale, demoFacial);
    setPlanCard(buildFallbackPlanStep(demoCtx, demoInputs[0].text, locale));

    setListenMessages([
      {
        id: 'demo-listen-1',
        role: 'assistant',
        text:
          locale === 'zh'
            ? `我在这里陪着你，${demoCtx.personaName}。听起来多项任务同时压在一起了——关于「${demoCtx.currentTask}」，现在最让你分心或卡住的是哪一点？`
            : `I'm here with you, ${demoCtx.personaName}. It sounds like deadlines are colliding—what part of "${demoCtx.currentTask}" is pulling at your attention the most?`,
        timestamp: locale === 'zh' ? '刚刚' : 'Just now',
        source: 'local_engine',
      },
    ]);

    setStage('live_checkin');
  };

  // 3. Toggle Microphone during Live Check-in
  const handleToggleMic = () => {
    if (micState === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_e) {
          // ignore
        }
      }
      setMicState('idle');
    } else {
      startBrowserSpeechRecognition((transcript) => {
        handleAddInput(transcript, 'voice');
      });
    }
  };

  // 4. Dismiss Notice ("I'm okay")
  const handleDismissNotice = (_reason?: DismissReason | string) => {
    setCooldownActive(true);
    const currentLast = heartRateSeries[heartRateSeries.length - 1];
    const settledHr =
      currentLast && currentLast.bpm > 0
        ? nextSimulatedHeartRatePoint(
            currentLast,
            context.baselineBpm,
            'settled',
            context.baselineHrvMs
          )
        : createUnconnectedHeartRatePoint(context.baselineBpm, context.baselineHrvMs);
    if (currentLast && currentLast.bpm > 0) {
      setHeartRateSeries((prev) => [...prev.slice(-11), settledHr]);
    }
    setSignalNotice(
      evaluateSignalState({
        inputs,
        latestHeartRate: settledHr,
        context,
        cooldownActive: true,
        locale,
        facialReading,
      })
    );
    setStage('live_checkin');
  };

  // 5. Select Support Mode (Listen / Regulate / Plan)
  const handleSelectSupportMode = async (mode: SupportMode) => {
    setActiveSupportMode(mode);

    if (mode === 'Listen') {
      setStage('listen');
    } else if (mode === 'Regulate') {
      setStage('regulate');
    } else if (mode === 'Plan') {
      setStage('plan');
      try {
        const res = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            recentInput: inputs[inputs.length - 1]?.text,
            variationIndex: 0,
            locale,
          }),
        });
        if (res.ok) {
          const data: PlanStepCard = await res.json();
          setPlanCard(data);
        }
      } catch (_e) {
        // fallback already populated
      }
    }
  };

  // 6. Send chat message in Listen mode
  const handleSendListenMessage = async (userText: string) => {
    const userMsg: ListenChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    const updatedHistory = [...listenMessages, userMsg];
    setListenMessages(updatedHistory);
    setIsSendingListen(true);

    try {
      const res = await fetch('/api/listen-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          subMode: listenSubMode,
          context,
          history: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          locale,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyMsg: ListenChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            minute: '2-digit',
            second: '2-digit',
          }),
          source: data.source,
        };
        setListenMessages((prev) => [...prev, replyMsg]);
      } else {
        throw new Error('Fallback');
      }
    } catch (_e) {
      const fallbackText = buildFallbackListenReply({
        userMessage: userText,
        subMode: listenSubMode,
        context,
        locale,
      });
      setListenMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], {
            minute: '2-digit',
            second: '2-digit',
          }),
          source: 'local_engine',
        },
      ]);
    } finally {
      setIsSendingListen(false);
    }
  };

  // 7. Request a different smaller step in Plan mode
  const handleRequestDifferentPlanStep = async () => {
    const nextIdx = planVariationIndex + 1;
    setPlanVariationIndex(nextIdx);
    setIsLoadingPlanVariation(true);

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          recentInput: inputs[inputs.length - 1]?.text,
          variationIndex: nextIdx,
          locale,
        }),
      });
      if (res.ok) {
        const data: PlanStepCard = await res.json();
        setPlanCard(data);
      }
    } catch (_e) {
      const fallback = buildFallbackPlanStep(context, inputs[inputs.length - 1]?.text, locale);
      if (locale === 'zh') {
        fallback.next20MinutesAction = `接下来的二十分钟里，先在注释里为「${fallback.priorityTask}」写下三行最小步骤清单，并只完成第一行。`;
      } else {
        fallback.next20MinutesAction = `For the next 20 minutes, write a 3-line checklist in comments for "${fallback.priorityTask}" and complete only line 1.`;
      }
      setPlanCard(fallback);
    } finally {
      setIsLoadingPlanVariation(false);
    }
  };

  // 8. Record Verification Feedback (Better / Same / Worse)
  const handleRecordVerification = (
    feeling: VerificationFeeling,
    nextAction: 'summary' | 'switch' | 'observe',
    targetMode?: SupportMode
  ) => {
    const newAttempt: InterventionAttempt = {
      mode: activeSupportMode,
      timestamp: new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      }),
      feedback: feeling,
    };

    const nextInterventions = [...interventions, newAttempt];
    setInterventions(nextInterventions);
    setLastFeedback(feeling);

    if (feeling === 'Better') {
      const currentLast = heartRateSeries[heartRateSeries.length - 1];
      const settledPt =
        currentLast && currentLast.bpm > 0
          ? nextSimulatedHeartRatePoint(
              currentLast,
              context.baselineBpm,
              'settled',
              context.baselineHrvMs
            )
          : createUnconnectedHeartRatePoint(context.baselineBpm, context.baselineHrvMs);
      if (currentLast && currentLast.bpm > 0) {
        setHeartRateSeries((prev) => [...prev.slice(-11), settledPt]);
      }
      setCooldownActive(true);
      const relievedFacial = facialReading ? createDefaultFacialReading('relieved') : null;
      setFacialReading(relievedFacial);
      setSignalNotice(
        evaluateSignalState({
          inputs,
          latestHeartRate: settledPt,
          context,
          cooldownActive: true,
          locale,
          facialReading: relievedFacial,
        })
      );
    }

    if (nextAction === 'summary') {
      handleSaveCurrentSnapshotToHistory(nextInterventions);
      setStage('summary');
    } else if (nextAction === 'switch' && targetMode) {
      handleSelectSupportMode(targetMode);
    } else {
      setStage('live_checkin');
    }
  };

  // Reset to Welcome screen
  const handleResetToWelcome = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_e) {
        // ignore
      }
    }
    setStage('welcome');
  };

  const latestHr =
    heartRateSeries[heartRateSeries.length - 1] || createUnconnectedHeartRatePoint(72, 58);
  const latestInputText = inputs[inputs.length - 1]?.text || '';

  // Automatic real-time multimodal emotion detection for Mochi ("小团子")
  const currentPetMood: PetMood = detectPetMood({
    latestInput: latestInputText,
    signalLevel: signalNotice.level,
    latestHr,
    lastFeedback,
    facialReading,
  });

  const activeInterventionStage: SessionStage =
    activeSupportMode === 'Listen'
      ? 'listen'
      : activeSupportMode === 'Regulate'
        ? 'regulate'
        : 'plan';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EF] text-[#283C33]">
      <Header
        stage={stage}
        activeSupportMode={activeSupportMode}
        signalLevel={signalNotice.level}
        isDemoMode={context.isDemoPersona}
        aiMode={aiMode}
        locale={locale}
        historyCount={historyRecords.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onToggleLocale={handleToggleLocale}
        onStartDemo={handleStartDemo}
        onReset={handleResetToWelcome}
        onNavigateStage={(s) => setStage(s)}
      />

      {/* Session History Records & Personal Trends Modal */}
      <HistoryDrawerModal
        isOpen={isHistoryOpen}
        locale={locale}
        records={historyRecords}
        onClose={() => setIsHistoryOpen(false)}
        onSaveCurrentSnapshot={() => handleSaveCurrentSnapshotToHistory()}
        onDeleteRecord={handleDeleteHistoryRecord}
        onResetDefaultHistory={handleResetDefaultHistory}
      />

      {/* Smartwatch High-Stress Alert Overlay */}
      <SmartwatchAlertModal
        watchAlert={watchAlert}
        locale={locale}
        onQuickBreathe={() => {
          setWatchAlert((prev) => ({ ...prev, acknowledged: true }));
          handleSelectSupportMode('Regulate');
        }}
        onDismiss={() => setWatchAlert((prev) => ({ ...prev, acknowledged: true }))}
      />

      {/* Real-time Automatic Multimodal Companion Pet ("小团子 Mochi") */}
      <CompanionPet
        mood={currentPetMood}
        locale={locale}
        latestHr={latestHr}
        facialReading={facialReading}
        cameraActive={cameraStatus === 'active' || cameraPreconnected}
        micActive={micState === 'listening' || micPreconnected}
        wearableDevice={wearableDevice}
      />

      <main className="flex-1">
        {stage === 'welcome' && (
          <WelcomeView
            locale={locale}
            personaId={context.personaId}
            personaName={context.personaName}
            wearableDevice={wearableDevice}
            latestHr={latestHr}
            micPreconnected={micPreconnected}
            cameraPreconnected={cameraPreconnected}
            onChangePersonaName={handleChangePersonaName}
            onCyclePersona={handleCyclePersona}
            onConnectMicOnWelcome={handleConnectMicOnWelcome}
            onConnectCameraOnWelcome={handleConnectCameraOnWelcome}
            onConnectBluetoothWearable={handleConnectBluetoothWearable}
            onEnableCameraRppgMode={handleEnableCameraRppgMode}
            onPushCompanionWearableData={handlePushCompanionWearableData}
            onDisconnectWearable={handleDisconnectWearable}
            onStartCheckin={handleStartCheckin}
            onStartDemo={handleStartDemo}
          />
        )}

        {stage === 'live_checkin' && (
          <LiveCheckinView
            locale={locale}
            context={context}
            isPaused={isPaused}
            micState={micState}
            cameraStatus={cameraStatus}
            activeCameraStream={activeCameraStream}
            facialReading={facialReading}
            wearableDevice={wearableDevice}
            inputs={inputs}
            heartRateSeries={heartRateSeries}
            signalNotice={signalNotice}
            isAnalyzing={isAnalyzing}
            cooldownActive={cooldownActive}
            observationComplete={observationComplete}
            elapsedObservationSeconds={elapsedObservationSeconds}
            targetObservationSeconds={targetObservationSeconds}
            mobileHealthConnection={mobileHealthConnection}
            onTogglePause={() => setIsPaused((p) => !p)}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onUpdateFacialReading={handleUpdateFacialReading}
            onConnectBluetoothWearable={handleConnectBluetoothWearable}
            onEnableCameraRppgMode={handleEnableCameraRppgMode}
            onConnectSmartWatchStream={handleConnectSmartWatchStream}
            onCyclePersona={handleCyclePersona}
            onSubmitText={handleAddInput}
            onOpenSupportChoice={() => setStage('support_choice')}
            onDismissNotice={(r) => handleDismissNotice(r)}
            onEndSession={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
            onCompleteObservationWindow={() => {
              setObservationComplete(true);
              setElapsedObservationSeconds(targetObservationSeconds);
            }}
            onSyncMobileHealth={handleSyncMobileHealth}
            onTriggerWatchAlert={handleTriggerWatchAlert}
            onBackToWelcome={() => setStage('welcome')}
          />
        )}

        {stage === 'support_choice' && (
          <SupportChoiceView
            locale={locale}
            signalNotice={signalNotice}
            onSelectSupport={handleSelectSupportMode}
            onDismissCheckin={(reason) => handleDismissNotice(reason)}
            onBackToObservation={() => setStage('live_checkin')}
            onSkipToVerification={() => setStage('verification')}
            onEndEarlyToSummary={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
          />
        )}

        {stage === 'listen' && (
          <ListenView
            locale={locale}
            context={context}
            messages={listenMessages}
            subMode={listenSubMode}
            isSending={isSendingListen}
            onChangeSubMode={setListenSubMode}
            onSendMessage={handleSendListenMessage}
            onSwitchSupportMode={handleSelectSupportMode}
            onFinishToVerification={() => setStage('verification')}
            onBackToSupportChoice={() => setStage('support_choice')}
            onEndToSummary={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
          />
        )}

        {stage === 'regulate' && (
          <RegulateView
            locale={locale}
            onComplete={() => setStage('verification')}
            onSkipToVerification={() => setStage('verification')}
            onExitToSupportChoice={() => setStage('support_choice')}
            onEndEarlyToSummary={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
          />
        )}

        {stage === 'plan' && (
          <PlanView
            locale={locale}
            planCard={planCard}
            isLoadingVariation={isLoadingPlanVariation}
            onRequestDifferentStep={handleRequestDifferentPlanStep}
            onSwitchToListen={() => handleSelectSupportMode('Listen')}
            onCompletePlanBlock={() => setStage('verification')}
            onBackToSupportChoice={() => setStage('support_choice')}
            onEndEarlyToSummary={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
          />
        )}

        {stage === 'verification' && (
          <VerificationView
            locale={locale}
            lastSupportMode={activeSupportMode}
            onRecordFeedback={handleRecordVerification}
            onBackToIntervention={() => setStage(activeInterventionStage)}
            onSkipToSummary={() => {
              handleSaveCurrentSnapshotToHistory();
              setStage('summary');
            }}
          />
        )}

        {stage === 'summary' && (
          <SummaryView
            locale={locale}
            context={context}
            signalNotice={signalNotice}
            interventions={interventions}
            planCard={planCard}
            heartRateSeries={heartRateSeries}
            inputs={inputs}
            facialReading={facialReading}
            onStartNewCheckin={handleResetToWelcome}
            onReturnToObservation={() => setStage('live_checkin')}
            onBackToVerification={() => setStage('verification')}
            onOpenHistory={() => setIsHistoryOpen(true)}
          />
        )}
      </main>
    </div>
  );
}
