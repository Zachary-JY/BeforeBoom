export type SessionStage =
  | 'welcome'
  | 'live_checkin'
  | 'support_choice'
  | 'listen'
  | 'regulate'
  | 'plan'
  | 'verification'
  | 'summary';

export type ActivityContext = 'Study' | 'Work' | 'Custom';

export type SignalLevel = 'Settled' | 'Signals rising' | 'Elevated signals';

export type SupportMode = 'Listen' | 'Regulate' | 'Plan';

export type RegulateActivityType =
  | 'breathing'
  | 'bubble_pop'
  | 'ripple_canvas'
  | 'sensory_grounding';

export type ListenSubMode =
  | 'Just listen'
  | 'Help me settle'
  | 'Find a next step';

export type DismissReason =
  | 'Just excited'
  | 'Just exercised'
  | "Doesn't feel accurate";

export type VerificationFeeling = 'Better' | 'Same' | 'Worse';

export type MicPermissionState =
  | 'idle'
  | 'listening'
  | 'paused'
  | 'denied'
  | 'unavailable';

export type CameraStatus = 'idle' | 'active' | 'denied' | 'unavailable';

export type WearableConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected_ble'
  | 'connected_watch_bridge'
  | 'connected_camera_rppg'
  | 'connected_ble_hr'
  | 'connected_ble_general'
  | 'connected_watch_live';

export interface WearableDeviceState {
  status: WearableConnectionStatus;
  deviceName: string;
  deviceId?: string;
  protocol:
    | 'web_bluetooth_gatt'
    | 'apple_watch_companion'
    | 'camera_optical_rppg'
    | 'apple_watch_live_push'
    | 'camera_rppg_optical'
    | 'none';
  batteryLevel?: number;
  rawHexPacket?: string;
  hasHeartRateService?: boolean;
  lastUpdated?: string;
  errorMessage?: string;
  isIframeBlocked?: boolean;
}

export type PetMood = 'calm' | 'happy' | 'anxious' | 'sad' | 'relieved';

export type HealthDataSource =
  | 'web_bluetooth'
  | 'apple_watch_bridge'
  | 'camera_rppg'
  | 'unconnected';

export interface FacialExpressionReading {
  cue: PetMood;
  browTension: 'relaxed' | 'slightly_furrowed' | 'furrowed';
  lipCurvature: 'soft_smile' | 'neutral' | 'pressed';
  eyeFatigue: 'alert' | 'steady' | 'tired';
  summaryEn: string;
  summaryZh: string;
  updatedAt: string;
  source: 'camera_frame';
}

export interface HeartRatePoint {
  timestamp: string;
  bpm: number;
  baseline: number;
  delta: number;
  hrvRmssdMs: number;
  baselineHrvMs: number;
  source: HealthDataSource;
  deviceName?: string;
  rawHex?: string;
}

export interface MultimodalTimelinePoint {
  timestamp: string;
  bpm: number;
  baselineBpm: number;
  hrvRmssdMs: number;
  baselineHrvMs: number;
  facialTensionScore: number; // 0-100
  voiceKeywordIntensity: number; // 0-100
  compositeStressIndex: number; // 0-100
  signalLevel: SignalLevel;
  eventTagZh?: string;
  eventTagEn?: string;
  eventType?: 'voice' | 'camera' | 'wearable' | 'intervention';
}

export interface HistoricalSessionRecord {
  id: string;
  recordedAt: string;
  personaNameZh: string;
  personaNameEn: string;
  activity: ActivityContext;
  customActivityZh?: string;
  customActivityEn?: string;
  taskZh: string;
  taskEn: string;
  durationMinutes: number;
  peakSignalLevel: SignalLevel;
  finalSignalLevel: SignalLevel;
  peakBpm: number;
  finalBpm: number;
  minHrvMs: number;
  finalHrvMs: number;
  peakCompositeStress: number;
  finalCompositeStress: number;
  primaryFacialCue: PetMood;
  supportUsed?: SupportMode;
  verificationFeedback?: VerificationFeeling;
  summaryZh: string;
  summaryEn: string;
  timeline: MultimodalTimelinePoint[];
}

export interface MobileHealthSyncPayload {
  deviceName: string;
  platform: 'Apple Watch Live Bridge' | 'Web Bluetooth GATT HRM' | 'Camera Optical rPPG';
  bpm: number;
  hrvRmssdMs: number;
  baselineHrvMs: number;
  respiratoryRate: number;
  sleepRecoveryScore: number;
  syncedAt: string;
  rawHex?: string;
}

export interface WatchAlertState {
  triggered: boolean;
  triggeredAt: string | null;
  reasonEn: string;
  reasonZh: string;
  bpm: number;
  hrvRmssdMs: number;
  baselineHrvMs: number;
  acknowledged: boolean;
}

export interface InputEntry {
  id: string;
  text: string;
  source: 'voice' | 'text' | 'context';
  timestamp: string;
}

export interface SignalNoticeEvidence {
  level: SignalLevel;
  summaryText: string;
  observableEvidence: string[];
  recommendedSupport: SupportMode;
  recommendationReason: string;
  source: 'live_ai' | 'local_engine';
  hrvStatusText?: string;
  facialStatusText?: string;
}

export interface PlanStepCard {
  priorityTask: string;
  next20MinutesAction: string;
  completionCondition: string;
  setAsideList: string[];
  source: 'live_ai' | 'local_engine';
}

export interface ListenChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'live_ai' | 'local_engine';
}

export interface InterventionAttempt {
  mode: SupportMode;
  timestamp: string;
  feedback?: VerificationFeeling;
  notes?: string;
}

export interface SessionContextData {
  personaId: string;
  personaName: string;
  isDemoPersona: boolean;
  activity: ActivityContext;
  customActivityText?: string;
  currentTask: string;
  plannedDurationMinutes: number;
  baselineBpm: number;
  baselineHrvMs: number;
}
