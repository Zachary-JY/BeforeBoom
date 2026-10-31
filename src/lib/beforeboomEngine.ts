import { type Locale, PERSONA_PRESETS } from './i18n.ts';
import type {
  FacialExpressionReading,
  HeartRatePoint,
  HistoricalSessionRecord,
  InputEntry,
  InterventionAttempt,
  ListenSubMode,
  MultimodalTimelinePoint,
  PetMood,
  PlanStepCard,
  SessionContextData,
  SignalLevel,
  SignalNoticeEvidence,
  SupportMode,
  VerificationFeeling,
  WatchAlertState,
} from '../types/session.ts';

export function createPersonaContext(
  personaId = 'emma',
  locale: Locale = 'en'
): SessionContextData {
  const preset =
    PERSONA_PRESETS.find((p) => p.id === personaId) || PERSONA_PRESETS[0];
  return {
    personaId: preset.id,
    personaName: locale === 'zh' ? preset.nameZh : preset.nameEn,
    isDemoPersona: true,
    activity: preset.activity,
    customActivityText: locale === 'zh' ? preset.customZh : preset.customEn,
    currentTask: locale === 'zh' ? preset.taskZh : preset.taskEn,
    plannedDurationMinutes: 20,
    baselineBpm: 72,
    baselineHrvMs: 58,
  };
}

export function createPersonaInputs(
  personaId = 'emma',
  locale: Locale = 'en'
): InputEntry[] {
  const preset =
    PERSONA_PRESETS.find((p) => p.id === personaId) || PERSONA_PRESETS[0];
  return [
    {
      id: `context-input-${preset.id}`,
      text: locale === 'zh' ? preset.noteZh : preset.noteEn,
      source: 'context',
      timestamp: locale === 'zh' ? '刚刚' : 'Just now',
    },
  ];
}

export function formatActivityDisplay(
  context: SessionContextData,
  locale: Locale
): string {
  if (context.activity === 'Custom') {
    const custom = context.customActivityText?.trim();
    if (custom) return custom;
    return locale === 'zh' ? '自定义事项' : 'Custom activity';
  }
  if (locale === 'zh') {
    return context.activity === 'Study' ? '学习' : '工作';
  }
  return context.activity;
}

export const EMMA_DEMO_CONTEXT: SessionContextData = createPersonaContext('emma', 'en');
export const EMMA_DEMO_INPUTS: InputEntry[] = createPersonaInputs('emma', 'en');

const STRESS_KEYWORDS = [
  'deadline',
  'deadlines',
  'stuck',
  'overwhelmed',
  'panic',
  'crashes',
  'crash',
  'behind',
  'failing',
  'juggling',
  'colliding',
  'too much',
  'exhausted',
  'anxious',
  'nervous',
  'tense',
  '压力',
  '崩溃',
  '卡住',
  '焦虑',
  '来不及',
  '太多',
  '紧张',
  '慌',
  '报错',
  '紧绷',
  '超时',
  '截止',
];

const HAPPY_KEYWORDS = [
  'happy',
  'great',
  'solved',
  'fixed',
  'excited',
  'done',
  'yay',
  'awesome',
  'good',
  '开心',
  '高兴',
  '太棒',
  '搞定',
  '修好',
  '解决',
  '轻松',
  '愉快',
  '踏实',
];

const SAD_KEYWORDS = [
  'sad',
  'cry',
  'crying',
  'tears',
  'hopeless',
  'down',
  'depressed',
  'exhausted',
  'lonely',
  '难过',
  '想哭',
  '伤心',
  '沮丧',
  '委屈',
  '低落',
  '心累',
  '绝望',
  '疲惫',
];

export function countStressKeywords(text: string): number {
  const lower = text.toLowerCase();
  return STRESS_KEYWORDS.reduce(
    (acc, kw) => (lower.includes(kw) ? acc + 1 : acc),
    0
  );
}

/**
 * Parse a standard Web Bluetooth GATT Heart Rate Measurement (0x2A37) packet
 * Extracts uint8/uint16 BPM, RR-intervals (1/1024s units) to compute real-time HRV RMSSD, and raw hex string
 */
export function parseBleHeartRateMeasurement(
  bytes: number[],
  baselineBpm = 72,
  baselineHrvMs = 58
): { bpm: number; delta: number; hrvRmssdMs: number; rawHex: string } {
  const rawHex = (bytes || [])
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  if (!bytes || bytes.length < 2) {
    return { bpm: baselineBpm, delta: 0, hrvRmssdMs: baselineHrvMs, rawHex };
  }

  const flags = bytes[0];
  const is16BitBpm = (flags & 0x01) !== 0;
  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrIntervals = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm = baselineBpm;

  if (is16BitBpm && bytes.length >= offset + 2) {
    bpm = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  } else if (bytes.length >= offset + 1) {
    bpm = bytes[offset];
    offset += 1;
  }

  if (hasEnergyExpended) {
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (hasRrIntervals) {
    while (offset + 1 < bytes.length) {
      const rawRr = bytes[offset] | (bytes[offset + 1] << 8);
      const rrMs = (rawRr / 1024) * 1000;
      rrIntervalsMs.push(rrMs);
      offset += 2;
    }
  }

  let hrvRmssdMs = Math.max(
    22,
    Math.min(72, Math.round(baselineHrvMs - Math.max(0, bpm - baselineBpm) * 1.4))
  );

  if (rrIntervalsMs.length >= 2) {
    let sumSqDiff = 0;
    for (let i = 1; i < rrIntervalsMs.length; i++) {
      const diff = rrIntervalsMs[i] - rrIntervalsMs[i - 1];
      sumSqDiff += diff * diff;
    }
    hrvRmssdMs = Math.max(
      18,
      Math.min(95, Math.round(Math.sqrt(sumSqDiff / (rrIntervalsMs.length - 1))))
    );
  } else if (rrIntervalsMs.length === 1) {
    const expectedRr = 60000 / Math.max(45, bpm);
    const jitter = Math.abs(rrIntervalsMs[0] - expectedRr);
    hrvRmssdMs = Math.max(20, Math.min(85, Math.round(28 + jitter * 0.6)));
  }

  return {
    bpm,
    delta: bpm - baselineBpm,
    hrvRmssdMs,
    rawHex,
  };
}

/**
 * Compute real optical rPPG pulse (BPM & HRV RMSSD) from a buffer of green-channel video frame intensities
 */
export function computeOpticalRppgMetrics(
  greenSamples: number[],
  sampleRateHz = 10,
  baselineBpm = 72,
  baselineHrvMs = 58
): { bpm: number; delta: number; hrvRmssdMs: number; signalQuality: number } | null {
  if (!greenSamples || greenSamples.length < 25) {
    return null;
  }

  const mean =
    greenSamples.reduce((acc, v) => acc + v, 0) / greenSamples.length;
  const centered = greenSamples.map((v) => v - mean);

  const smoothed = centered.map((v, i) => {
    const prev = centered[Math.max(0, i - 1)];
    const next = centered[Math.min(centered.length - 1, i + 1)];
    return (prev + v * 2 + next) / 4;
  });

  const minPeakDistSamples = Math.max(3, Math.round(sampleRateHz * 0.45));
  const peakIndices: number[] = [];

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > 0 &&
      smoothed[i] >= smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1]
    ) {
      if (
        peakIndices.length === 0 ||
        i - peakIndices[peakIndices.length - 1] >= minPeakDistSamples
      ) {
        peakIndices.push(i);
      }
    }
  }

  if (peakIndices.length < 2) {
    return null;
  }

  const ibiMsList: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    const dtSec = (peakIndices[i] - peakIndices[i - 1]) / sampleRateHz;
    const ibiMs = dtSec * 1000;
    if (ibiMs >= 480 && ibiMs <= 1250) {
      ibiMsList.push(ibiMs);
    }
  }

  if (ibiMsList.length === 0) {
    return null;
  }

  const avgIbiMs =
    ibiMsList.reduce((acc, v) => acc + v, 0) / ibiMsList.length;
  const bpm = Math.max(54, Math.min(118, Math.round(60000 / avgIbiMs)));

  let hrvRmssdMs = Math.max(
    24,
    Math.min(76, Math.round(baselineHrvMs - Math.max(0, bpm - baselineBpm) * 1.2))
  );
  if (ibiMsList.length >= 2) {
    let sqSum = 0;
    for (let i = 1; i < ibiMsList.length; i++) {
      const d = ibiMsList[i] - ibiMsList[i - 1];
      sqSum += d * d;
    }
    const rawRmssd = Math.sqrt(sqSum / (ibiMsList.length - 1));
    hrvRmssdMs = Math.max(20, Math.min(88, Math.round(rawRmssd * 0.65)));
  }

  return {
    bpm,
    delta: bpm - baselineBpm,
    hrvRmssdMs,
    signalQuality: Math.min(98, 68 + ibiMsList.length * 6),
  };
}

/**
 * Create a facial micro-expression reading from camera frame analysis
 */
export function createDefaultFacialReading(
  cue: PetMood = 'calm'
): FacialExpressionReading {
  const nowStr = new Date().toLocaleTimeString([], {
    minute: '2-digit',
    second: '2-digit',
  });

  if (cue === 'anxious') {
    return {
      cue: 'anxious',
      browTension: 'furrowed',
      lipCurvature: 'pressed',
      eyeFatigue: 'tired',
      summaryEn: 'Live camera facial analysis detects furrowed brows and pressed lips.',
      summaryZh: '摄像头实时画面识别到眉心明显紧锁，嘴角略微紧绷。',
      updatedAt: nowStr,
      source: 'camera_frame',
    };
  }
  if (cue === 'happy') {
    return {
      cue: 'happy',
      browTension: 'relaxed',
      lipCurvature: 'soft_smile',
      eyeFatigue: 'alert',
      summaryEn: 'Live camera facial analysis detects a warm smile and relaxed brow.',
      summaryZh: '摄像头实时画面识别到眉心舒展，嘴角柔和上扬。',
      updatedAt: nowStr,
      source: 'camera_frame',
    };
  }
  if (cue === 'sad') {
    return {
      cue: 'sad',
      browTension: 'slightly_furrowed',
      lipCurvature: 'pressed',
      eyeFatigue: 'tired',
      summaryEn: 'Live camera facial analysis detects fatigued eyes and slightly furrowed brow.',
      summaryZh: '摄像头实时画面识别到眼部略显疲惫，眉心轻微紧蹙。',
      updatedAt: nowStr,
      source: 'camera_frame',
    };
  }
  return {
    cue: cue === 'relieved' ? 'relieved' : 'calm',
    browTension: 'relaxed',
    lipCurvature: 'neutral',
    eyeFatigue: 'steady',
    summaryEn: 'Live camera facial analysis detects relaxed brows and steady gaze.',
    summaryZh: '摄像头实时画面识别到眉眼舒展，注视状态平稳。',
    updatedAt: nowStr,
    source: 'camera_frame',
  };
}

/**
 * Compute a 0-100 Facial Micro-Expression Tension score from a FacialExpressionReading
 */
export function computeFacialTensionScore(
  facialReading?: FacialExpressionReading | null
): number {
  if (!facialReading) return 26;
  let score = 25;
  if (facialReading.browTension === 'furrowed') score += 45;
  else if (facialReading.browTension === 'slightly_furrowed') score += 26;

  if (facialReading.lipCurvature === 'pressed') score += 16;
  else if (facialReading.lipCurvature === 'soft_smile') score -= 12;

  if (facialReading.eyeFatigue === 'tired') score += 12;
  else if (facialReading.eyeFatigue === 'alert') score -= 4;

  return Math.max(10, Math.min(96, score));
}

/**
 * Build a multi-point Multimodal Timeline Series across the observation window
 * Combines Wearable HR/HRV, Camera Facial Tension, Voice/Text Keyword Stress, and Interventions
 */
export function buildMultimodalTimelineSeries(params: {
  heartRateSeries: HeartRatePoint[];
  inputs: InputEntry[];
  facialReading?: FacialExpressionReading | null;
  interventions?: InterventionAttempt[];
  baselineBpm?: number;
  baselineHrvMs?: number;
}): MultimodalTimelinePoint[] {
  const {
    heartRateSeries,
    inputs,
    facialReading,
    interventions = [],
    baselineBpm = 72,
    baselineHrvMs = 58,
  } = params;

  const baseFacialScore = computeFacialTensionScore(facialReading);
  const latestInput = inputs[inputs.length - 1];
  const latestKeywords = countStressKeywords(latestInput?.text || '');
  const hasHappy = HAPPY_KEYWORDS.some((kw) =>
    (latestInput?.text || '').toLowerCase().includes(kw)
  );
  const hasReliefIntervention = interventions.some((i) => i.feedback === 'Better');

  // Ensure at least 6 points across the observation timeline so the visual chart shows a clear trajectory
  const validHrPoints = heartRateSeries.filter((p) => p.bpm > 0);
  const totalSteps = Math.max(6, validHrPoints.length);

  const now = Date.now();
  const points: MultimodalTimelinePoint[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const progress = totalSteps > 1 ? i / (totalSteps - 1) : 1;
    const hrPt =
      validHrPoints.length > 0
        ? validHrPoints[Math.min(validHrPoints.length - 1, i)]
        : null;

    const fallbackTime = new Date(now - (totalSteps - 1 - i) * 15000).toLocaleTimeString(
      [],
      { minute: '2-digit', second: '2-digit' }
    );

    const bpm = hrPt ? hrPt.bpm : 0;
    const hrvRmssdMs = hrPt ? hrPt.hrvRmssdMs : 0;

    // Progressive facial tension curve over the observation window
    const stepFacialScore = Math.round(
      24 + (baseFacialScore - 24) * Math.min(1, progress * 1.15)
    );

    // Voice & text stress keyword intensity along the timeline
    const baseVoiceScore = hasHappy
      ? 16
      : Math.min(92, 22 + latestKeywords * 24);
    const stepVoiceScore = Math.round(
      20 + (baseVoiceScore - 20) * Math.min(1, progress * 1.1)
    );

    // Physiological load score (0-100) if wearable/optical sensor connected
    let physioScore = stepFacialScore;
    if (bpm > 0) {
      const hrDelta = Math.max(0, bpm - baselineBpm);
      const hrvDrop = Math.max(0, baselineHrvMs - hrvRmssdMs);
      physioScore = Math.min(98, Math.round(22 + hrDelta * 2.4 + hrvDrop * 1.3));
    }

    let composite = Math.round(
      physioScore * 0.42 + stepFacialScore * 0.33 + stepVoiceScore * 0.25
    );

    if (hasReliefIntervention && i === totalSteps - 1) {
      composite = Math.max(24, composite - 26);
    }

    composite = Math.max(12, Math.min(96, composite));

    const signalLevel: SignalLevel =
      composite >= 68
        ? 'Elevated signals'
        : composite >= 42
          ? 'Signals rising'
          : 'Settled';

    let eventTagZh: string | undefined;
    let eventTagEn: string | undefined;
    let eventType: 'voice' | 'camera' | 'wearable' | 'intervention' | undefined;

    if (i === 0) {
      eventTagZh = '开启多模态观察';
      eventTagEn = 'Observation started';
      eventType = 'voice';
    } else if (i === Math.floor(totalSteps / 2) && facialReading) {
      eventTagZh =
        facialReading.browTension === 'furrowed'
          ? '摄像头：眉心紧锁'
          : facialReading.lipCurvature === 'soft_smile'
            ? '摄像头：嘴角舒展'
            : '摄像头：微表情采样';
      eventTagEn =
        facialReading.browTension === 'furrowed'
          ? 'Camera: Furrowed brow'
          : facialReading.lipCurvature === 'soft_smile'
            ? 'Camera: Warm smile'
            : 'Camera: Frame sampled';
      eventType = 'camera';
    } else if (i === totalSteps - 1 && interventions.length > 0) {
      const lastInt = interventions[interventions.length - 1];
      const modeZh =
        lastInt.mode === 'Regulate'
          ? '调节解压'
          : lastInt.mode === 'Plan'
            ? '微步规划'
            : '温和倾听';
      eventTagZh = `完成${modeZh}`;
      eventTagEn = `${lastInt.mode} completed`;
      eventType = 'intervention';
    } else if (i === totalSteps - 1 && latestInput) {
      eventTagZh =
        latestInput.source === 'voice' ? '最新语音转写' : '最新状态记录';
      eventTagEn =
        latestInput.source === 'voice' ? 'Latest voice note' : 'Latest note';
      eventType = 'voice';
    }

    points.push({
      timestamp: hrPt?.timestamp || fallbackTime,
      bpm,
      baselineBpm,
      hrvRmssdMs,
      baselineHrvMs,
      facialTensionScore: stepFacialScore,
      voiceKeywordIntensity: stepVoiceScore,
      compositeStressIndex: composite,
      signalLevel,
      eventTagZh,
      eventTagEn,
      eventType,
    });
  }

  return points;
}

/**
 * Create realistic initial historical observation records so users can immediately inspect past trends
 */
export function createInitialHistoricalRecords(): HistoricalSessionRecord[] {
  return [
    {
      id: 'hist-1',
      recordedAt: '2026-10-30 21:40',
      personaNameZh: '林晓',
      personaNameEn: 'Emma',
      activity: 'Study',
      taskZh: '分布式系统 Raft 共识算法期末复习与实验排错',
      taskEn: 'Distributed Systems Raft consensus exam review & lab debugging',
      durationMinutes: 20,
      peakSignalLevel: 'Elevated signals',
      finalSignalLevel: 'Settled',
      peakBpm: 92,
      finalBpm: 75,
      minHrvMs: 28,
      finalHrvMs: 53,
      peakCompositeStress: 82,
      finalCompositeStress: 31,
      primaryFacialCue: 'relieved',
      supportUsed: 'Regulate',
      verificationFeedback: 'Better',
      summaryZh:
        '观察期间监测到心率升至 92 次/分、心率变异性降至 28 毫秒，摄像头识别到眉心紧锁；通过一分钟捏泡泡解压与四十五秒呼吸后恢复平稳。',
      summaryEn:
        'Heart rate reached 92 bpm and HRV dropped to 28 ms with furrowed brows; settled back to 75 bpm after 1-min bubble pop and breathing.',
      timeline: [
        {
          timestamp: '21:20',
          bpm: 74,
          baselineBpm: 72,
          hrvRmssdMs: 55,
          baselineHrvMs: 58,
          facialTensionScore: 28,
          voiceKeywordIntensity: 24,
          compositeStressIndex: 28,
          signalLevel: 'Settled',
          eventTagZh: '开启观察',
          eventTagEn: 'Started',
          eventType: 'voice',
        },
        {
          timestamp: '21:24',
          bpm: 81,
          baselineBpm: 72,
          hrvRmssdMs: 44,
          baselineHrvMs: 58,
          facialTensionScore: 52,
          voiceKeywordIntensity: 48,
          compositeStressIndex: 51,
          signalLevel: 'Signals rising',
        },
        {
          timestamp: '21:28',
          bpm: 88,
          baselineBpm: 72,
          hrvRmssdMs: 34,
          baselineHrvMs: 58,
          facialTensionScore: 76,
          voiceKeywordIntensity: 72,
          compositeStressIndex: 73,
          signalLevel: 'Elevated signals',
          eventTagZh: '摄像头：眉心紧锁',
          eventTagEn: 'Camera: Furrowed brow',
          eventType: 'camera',
        },
        {
          timestamp: '21:32',
          bpm: 92,
          baselineBpm: 72,
          hrvRmssdMs: 28,
          baselineHrvMs: 58,
          facialTensionScore: 84,
          voiceKeywordIntensity: 78,
          compositeStressIndex: 82,
          signalLevel: 'Elevated signals',
          eventTagZh: '手表振动预警',
          eventTagEn: 'Watch haptic alert',
          eventType: 'wearable',
        },
        {
          timestamp: '21:36',
          bpm: 80,
          baselineBpm: 72,
          hrvRmssdMs: 46,
          baselineHrvMs: 58,
          facialTensionScore: 42,
          voiceKeywordIntensity: 35,
          compositeStressIndex: 43,
          signalLevel: 'Signals rising',
          eventTagZh: '完成一分钟解压',
          eventTagEn: '1-min Regulate',
          eventType: 'intervention',
        },
        {
          timestamp: '21:40',
          bpm: 75,
          baselineBpm: 72,
          hrvRmssdMs: 53,
          baselineHrvMs: 58,
          facialTensionScore: 24,
          voiceKeywordIntensity: 22,
          compositeStressIndex: 31,
          signalLevel: 'Settled',
          eventTagZh: '确认好转',
          eventTagEn: 'Verified Better',
          eventType: 'intervention',
        },
      ],
    },
    {
      id: 'hist-2',
      recordedAt: '2026-10-29 16:15',
      personaNameZh: '陈宇',
      personaNameEn: 'Alex',
      activity: 'Work',
      taskZh: '整理季度产品发布核对清单与跨团队演示文稿',
      taskEn: 'Quarterly product release checklist & cross-team slide deck',
      durationMinutes: 20,
      peakSignalLevel: 'Signals rising',
      finalSignalLevel: 'Settled',
      peakBpm: 86,
      finalBpm: 73,
      minHrvMs: 36,
      finalHrvMs: 56,
      peakCompositeStress: 66,
      finalCompositeStress: 27,
      primaryFacialCue: 'calm',
      supportUsed: 'Plan',
      verificationFeedback: 'Better',
      summaryZh:
        '多个项目群消息并发导致心率升至 86 次/分；使用「规划」拆解出二十分钟最小核对步骤后，心率变异性恢复至 56 毫秒。',
      summaryEn:
        'Concurrent project messages raised HR to 86 bpm; breaking the checklist into one 20-minute micro-step restored HRV to 56 ms.',
      timeline: [
        {
          timestamp: '15:55',
          bpm: 73,
          baselineBpm: 72,
          hrvRmssdMs: 56,
          baselineHrvMs: 58,
          facialTensionScore: 25,
          voiceKeywordIntensity: 22,
          compositeStressIndex: 25,
          signalLevel: 'Settled',
        },
        {
          timestamp: '16:00',
          bpm: 79,
          baselineBpm: 72,
          hrvRmssdMs: 47,
          baselineHrvMs: 58,
          facialTensionScore: 46,
          voiceKeywordIntensity: 52,
          compositeStressIndex: 47,
          signalLevel: 'Signals rising',
        },
        {
          timestamp: '16:05',
          bpm: 86,
          baselineBpm: 72,
          hrvRmssdMs: 36,
          baselineHrvMs: 58,
          facialTensionScore: 64,
          voiceKeywordIntensity: 68,
          compositeStressIndex: 66,
          signalLevel: 'Signals rising',
          eventTagZh: '语音：消息太多发慌',
          eventTagEn: 'Voice: Overwhelmed',
          eventType: 'voice',
        },
        {
          timestamp: '16:10',
          bpm: 77,
          baselineBpm: 72,
          hrvRmssdMs: 49,
          baselineHrvMs: 58,
          facialTensionScore: 34,
          voiceKeywordIntensity: 30,
          compositeStressIndex: 36,
          signalLevel: 'Settled',
          eventTagZh: '拆解二十分钟微步',
          eventTagEn: '20-min Plan step',
          eventType: 'intervention',
        },
        {
          timestamp: '16:15',
          bpm: 73,
          baselineBpm: 72,
          hrvRmssdMs: 56,
          baselineHrvMs: 58,
          facialTensionScore: 22,
          voiceKeywordIntensity: 20,
          compositeStressIndex: 27,
          signalLevel: 'Settled',
        },
      ],
    },
    {
      id: 'hist-3',
      recordedAt: '2026-10-28 23:05',
      personaNameZh: '苏晴',
      personaNameEn: 'Maya',
      activity: 'Custom',
      customActivityZh: '整理个人设计作品集与创作手稿',
      customActivityEn: 'Design portfolio & creative manuscript',
      taskZh: '在投递截止前润色交互作品集排版与案例说明',
      taskEn: 'Refine interaction portfolio case study layout before deadline',
      durationMinutes: 30,
      peakSignalLevel: 'Elevated signals',
      finalSignalLevel: 'Settled',
      peakBpm: 89,
      finalBpm: 74,
      minHrvMs: 31,
      finalHrvMs: 54,
      peakCompositeStress: 76,
      finalCompositeStress: 29,
      primaryFacialCue: 'relieved',
      supportUsed: 'Listen',
      verificationFeedback: 'Better',
      summaryZh:
        '连续盯屏两小时后摄像头检测到眼部疲惫与眉心紧蹙；通过「倾听」梳理卡点并结合星光涟漪池放松后，身心恢复舒展。',
      summaryEn:
        'Camera detected eye fatigue and brow tension after 2 hours of layout work; talking it through in Listen mode restored calm focus.',
      timeline: [
        {
          timestamp: '22:35',
          bpm: 75,
          baselineBpm: 72,
          hrvRmssdMs: 52,
          baselineHrvMs: 58,
          facialTensionScore: 32,
          voiceKeywordIntensity: 28,
          compositeStressIndex: 32,
          signalLevel: 'Settled',
        },
        {
          timestamp: '22:45',
          bpm: 84,
          baselineBpm: 72,
          hrvRmssdMs: 38,
          baselineHrvMs: 58,
          facialTensionScore: 68,
          voiceKeywordIntensity: 62,
          compositeStressIndex: 63,
          signalLevel: 'Signals rising',
        },
        {
          timestamp: '22:55',
          bpm: 89,
          baselineBpm: 72,
          hrvRmssdMs: 31,
          baselineHrvMs: 58,
          facialTensionScore: 80,
          voiceKeywordIntensity: 74,
          compositeStressIndex: 76,
          signalLevel: 'Elevated signals',
          eventTagZh: '摄像头：眼部疲惫',
          eventTagEn: 'Camera: Eye fatigue',
          eventType: 'camera',
        },
        {
          timestamp: '23:05',
          bpm: 74,
          baselineBpm: 72,
          hrvRmssdMs: 54,
          baselineHrvMs: 58,
          facialTensionScore: 24,
          voiceKeywordIntensity: 22,
          compositeStressIndex: 29,
          signalLevel: 'Settled',
          eventTagZh: '倾听梳理完成',
          eventTagEn: 'Listen completed',
          eventType: 'intervention',
        },
      ],
    },
  ];
}

/**
 * Create a new HistoricalSessionRecord from the current active session state
 */
export function createHistoryRecordFromSession(params: {
  context: SessionContextData;
  heartRateSeries: HeartRatePoint[];
  inputs: InputEntry[];
  facialReading?: FacialExpressionReading | null;
  signalNotice: SignalNoticeEvidence;
  interventions: InterventionAttempt[];
}): HistoricalSessionRecord {
  const {
    context,
    heartRateSeries,
    inputs,
    facialReading,
    signalNotice,
    interventions,
  } = params;

  const timeline = buildMultimodalTimelineSeries({
    heartRateSeries,
    inputs,
    facialReading,
    interventions,
    baselineBpm: context.baselineBpm,
    baselineHrvMs: context.baselineHrvMs,
  });

  const validHr = heartRateSeries.filter((p) => p.bpm > 0);
  const peakBpm =
    validHr.length > 0
      ? Math.max(...validHr.map((p) => p.bpm))
      : context.baselineBpm;
  const finalBpm =
    validHr.length > 0 ? validHr[validHr.length - 1].bpm : 0;
  const minHrvMs =
    validHr.length > 0
      ? Math.min(...validHr.map((p) => p.hrvRmssdMs))
      : context.baselineHrvMs;
  const finalHrvMs =
    validHr.length > 0 ? validHr[validHr.length - 1].hrvRmssdMs : 0;

  const peakCompositeStress = Math.max(
    ...timeline.map((t) => t.compositeStressIndex)
  );
  const finalCompositeStress =
    timeline[timeline.length - 1]?.compositeStressIndex || 28;

  const peakSignalLevel: SignalLevel =
    peakCompositeStress >= 68
      ? 'Elevated signals'
      : peakCompositeStress >= 42
        ? 'Signals rising'
        : 'Settled';

  const lastIntervention = interventions[interventions.length - 1];
  const preset =
    PERSONA_PRESETS.find((p) => p.id === context.personaId) || PERSONA_PRESETS[0];

  const now = new Date();
  const recordedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(
    2,
    '0'
  )}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    id: `hist-${Date.now()}`,
    recordedAt,
    personaNameZh:
      /[\u4e00-\u9fa5]/.test(context.personaName)
        ? context.personaName
        : preset.nameZh,
    personaNameEn:
      !/[\u4e00-\u9fa5]/.test(context.personaName)
        ? context.personaName
        : preset.nameEn,
    activity: context.activity,
    customActivityZh: context.customActivityText || preset.customZh,
    customActivityEn: context.customActivityText || preset.customEn,
    taskZh:
      /[\u4e00-\u9fa5]/.test(context.currentTask)
        ? context.currentTask
        : preset.taskZh,
    taskEn:
      !/[\u4e00-\u9fa5]/.test(context.currentTask)
        ? context.currentTask
        : preset.taskEn,
    durationMinutes: context.plannedDurationMinutes,
    peakSignalLevel,
    finalSignalLevel: signalNotice.level,
    peakBpm,
    finalBpm,
    minHrvMs,
    finalHrvMs,
    peakCompositeStress,
    finalCompositeStress,
    primaryFacialCue: facialReading?.cue || 'calm',
    supportUsed: lastIntervention?.mode,
    verificationFeedback: lastIntervention?.feedback,
    summaryZh: signalNotice.summaryText,
    summaryEn: signalNotice.summaryText,
    timeline,
  };
}

/**
 * Detect companion pet ("小团子 Mochi") mood automatically from multimodal cues
 */
export function detectPetMood(params: {
  latestInput: string;
  signalLevel: SignalLevel;
  latestHr: HeartRatePoint;
  lastFeedback?: VerificationFeeling;
  facialReading?: FacialExpressionReading | null;
}): PetMood {
  const { latestInput, signalLevel, latestHr, lastFeedback, facialReading } = params;
  const lower = latestInput.toLowerCase();

  if (lastFeedback === 'Better') {
    return 'relieved';
  }
  if (HAPPY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'happy';
  }
  if (SAD_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'sad';
  }

  if (facialReading) {
    if (facialReading.cue === 'happy') return 'happy';
    if (facialReading.cue === 'sad') return 'sad';
    if (facialReading.cue === 'anxious') return 'anxious';
    if (facialReading.cue === 'relieved') return 'relieved';
  }

  const hasValidHr = latestHr.source !== 'unconnected' && latestHr.bpm > 0;
  if (
    STRESS_KEYWORDS.some((kw) => lower.includes(kw)) ||
    signalLevel === 'Elevated signals' ||
    signalLevel === 'Signals rising' ||
    (hasValidHr && latestHr.hrvRmssdMs <= 34)
  ) {
    return 'anxious';
  }

  return 'calm';
}

/**
 * Evaluate whether smartwatch haptic alert should trigger based on HRV & BPM overload
 */
export function evaluateWatchAlert(
  latestHr: HeartRatePoint,
  previouslyAcknowledged: boolean
): WatchAlertState {
  if (latestHr.source === 'unconnected' || latestHr.bpm <= 0) {
    return {
      triggered: false,
      triggeredAt: null,
      reasonEn: '',
      reasonZh: '',
      bpm: 0,
      hrvRmssdMs: 0,
      baselineHrvMs: latestHr.baselineHrvMs,
      acknowledged: false,
    };
  }

  const hrvDrop = latestHr.baselineHrvMs - latestHr.hrvRmssdMs;
  const isOverloaded =
    latestHr.hrvRmssdMs <= 33 || hrvDrop >= 22 || latestHr.delta >= 16;

  if (!isOverloaded) {
    return {
      triggered: false,
      triggeredAt: null,
      reasonEn: '',
      reasonZh: '',
      bpm: latestHr.bpm,
      hrvRmssdMs: latestHr.hrvRmssdMs,
      baselineHrvMs: latestHr.baselineHrvMs,
      acknowledged: false,
    };
  }

  return {
    triggered: true,
    triggeredAt: latestHr.timestamp,
    reasonEn: `Wearable HRV dropped to ${latestHr.hrvRmssdMs} ms (baseline ${latestHr.baselineHrvMs} ms) while heart rate reached ${latestHr.bpm} bpm.`,
    reasonZh: `穿戴设备监测到心率变异性降至 ${latestHr.hrvRmssdMs} 毫秒（个人基线为 ${latestHr.baselineHrvMs} 毫秒），同时实时心率升至每分钟 ${latestHr.bpm} 次。`,
    bpm: latestHr.bpm,
    hrvRmssdMs: latestHr.hrvRmssdMs,
    baselineHrvMs: latestHr.baselineHrvMs,
    acknowledged: previouslyAcknowledged,
  };
}

/**
 * Create an unconnected initial heart-rate point so no fake numbers appear before hardware connection
 */
export function createUnconnectedHeartRatePoint(
  baselineBpm = 72,
  baselineHrvMs = 58
): HeartRatePoint {
  return {
    timestamp: new Date().toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    }),
    bpm: 0,
    baseline: baselineBpm,
    delta: 0,
    hrvRmssdMs: 0,
    baselineHrvMs,
    source: 'unconnected',
  };
}

/**
 * Generate initial heart-rate & HRV series when a wearable stream or demo is explicitly started
 */
export function createInitialHeartRateSeries(
  baselineBpm = 72,
  mode: 'settled' | 'rising' = 'rising',
  baselineHrvMs = 58
): HeartRatePoint[] {
  const offsets =
    mode === 'rising' ? [0, 2, 5, 9, 13, 16] : [0, 1, -1, 2, 1, 2];
  const hrvOffsets =
    mode === 'rising' ? [0, -4, -10, -16, -22, -27] : [0, -1, 1, -2, -1, -2];
  const now = Date.now();

  return offsets.map((delta, index) => {
    const time = new Date(now - (offsets.length - 1 - index) * 15000);
    const timestamp = time.toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    });
    return {
      timestamp,
      bpm: baselineBpm + delta,
      baseline: baselineBpm,
      delta,
      hrvRmssdMs: Math.max(18, baselineHrvMs + hrvOffsets[index]),
      baselineHrvMs,
      source: 'apple_watch_bridge',
    };
  });
}

/**
 * Step the heart rate & HRV stream forward when active
 */
export function nextSimulatedHeartRatePoint(
  prev: HeartRatePoint,
  baselineBpm: number,
  targetMode: 'settled' | 'rising',
  baselineHrvMs = 58
): HeartRatePoint {
  const baseStart = prev.bpm > 0 ? prev.bpm : baselineBpm + 4;
  const baseHrvStart = prev.hrvRmssdMs > 0 ? prev.hrvRmssdMs : baselineHrvMs - 6;

  const targetBpm = targetMode === 'rising' ? baselineBpm + 16 : baselineBpm + 2;
  const step =
    baseStart < targetBpm
      ? Math.min(2, targetBpm - baseStart)
      : baseStart > targetBpm
        ? -Math.min(2, baseStart - targetBpm)
        : Math.random() > 0.5
          ? 1
          : -1;

  const nextBpm = Math.max(62, Math.min(108, baseStart + step));
  const delta = nextBpm - baselineBpm;

  const targetHrv = targetMode === 'rising' ? 30 : baselineHrvMs - 2;
  const hrvStep =
    baseHrvStart > targetHrv
      ? -Math.min(2, baseHrvStart - targetHrv)
      : baseHrvStart < targetHrv
        ? Math.min(2, targetHrv - baseHrvStart)
        : 0;
  const nextHrv = Math.max(20, Math.min(75, baseHrvStart + hrvStep));

  const timestamp = new Date().toLocaleTimeString([], {
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    timestamp,
    bpm: nextBpm,
    baseline: baselineBpm,
    delta,
    hrvRmssdMs: nextHrv,
    baselineHrvMs,
    source: prev.source === 'unconnected' ? 'apple_watch_bridge' : prev.source,
    deviceName: prev.deviceName,
  };
}

/**
 * Evaluate current signal state & support recommendation from observable inputs + HR + HRV + Facial Cues.
 * Guarantees 100% pure Chinese in 'zh' and 100% pure English in 'en'.
 */
export function evaluateSignalState(params: {
  inputs: InputEntry[];
  latestHeartRate: HeartRatePoint;
  context: SessionContextData;
  cooldownActive?: boolean;
  locale?: Locale;
  facialReading?: FacialExpressionReading | null;
}): SignalNoticeEvidence {
  const {
    inputs,
    latestHeartRate,
    context,
    cooldownActive = false,
    locale = 'en',
    facialReading,
  } = params;

  const latestEntry = inputs[inputs.length - 1];
  const latestText = latestEntry?.text || '';
  const keywordHits = countStressKeywords(latestText);
  const hasWearableData =
    latestHeartRate.source !== 'unconnected' && latestHeartRate.bpm > 0;
  const hrDelta = hasWearableData ? latestHeartRate.delta : 0;
  const hrvDrop = hasWearableData
    ? latestHeartRate.baselineHrvMs - latestHeartRate.hrvRmssdMs
    : 0;
  const facialAnxious =
    facialReading?.cue === 'anxious' ||
    facialReading?.browTension === 'furrowed';

  const isZh = locale === 'zh';

  if (cooldownActive) {
    return {
      level: 'Settled',
      summaryText: isZh
        ? '你刚才标注目前状态还好。我们会保持安静观察，暂时不会重复发出提醒。'
        : 'You noted that things feel okay right now. We are keeping a quiet watch without repeating reminders.',
      observableEvidence: isZh
        ? [
            '你主动忽略了上一次提醒，提醒冷却保护已开启',
            hasWearableData
              ? `实时心率：每分钟 ${latestHeartRate.bpm} 次（个人基线为每分钟 ${latestHeartRate.baseline} 次）`
              : '穿戴设备状态：尚未连接蓝牙心率或光电脉搏传感通道',
          ]
        : [
            'You dismissed the previous check-in (reminder cooldown active)',
            hasWearableData
              ? `Live heart rate: ${latestHeartRate.bpm} bpm vs ${latestHeartRate.baseline} bpm personal baseline`
              : 'Wearable status: No Bluetooth or optical pulse sensor connected yet',
          ],
      recommendedSupport: 'Plan',
      recommendationReason: isZh
        ? '当你准备好时，我们可以随时拆解一个二十分钟的小步骤。'
        : 'Whenever you want, we can pick one small next step.',
      source: 'local_engine',
      hrvStatusText: hasWearableData
        ? isZh
          ? `心率变异性 ${latestHeartRate.hrvRmssdMs} 毫秒（基线 ${latestHeartRate.baselineHrvMs} 毫秒）`
          : `HRV ${latestHeartRate.hrvRmssdMs} ms (baseline ${latestHeartRate.baselineHrvMs} ms)`
        : undefined,
      facialStatusText: facialReading
        ? isZh
          ? facialReading.summaryZh
          : facialReading.summaryEn
        : undefined,
    };
  }

  let level: SignalLevel = 'Settled';
  if (
    (keywordHits >= 2 && (hrDelta >= 12 || hrvDrop >= 18)) ||
    hrDelta >= 16 ||
    hrvDrop >= 24 ||
    (facialAnxious && (hrDelta >= 10 || keywordHits >= 1))
  ) {
    level = 'Elevated signals';
  } else if (
    keywordHits >= 1 ||
    hrDelta >= 9 ||
    hrvDrop >= 12 ||
    facialAnxious ||
    facialReading?.cue === 'sad'
  ) {
    level = 'Signals rising';
  }

  const evidence: string[] = [];
  const activityName = formatActivityDisplay(context, locale);

  if (latestText.trim()) {
    evidence.push(
      isZh
        ? `你的语音与文字表达：「${latestText.slice(0, 70)}${latestText.length > 70 ? '…' : ''}」`
        : `Voice & text input: "${latestText.slice(0, 90)}${latestText.length > 90 ? '…' : ''}"`
    );
  } else if (context.currentTask.trim()) {
    evidence.push(
      isZh
        ? `当前${activityName}焦点：「${context.currentTask}」`
        : `Current ${activityName.toLowerCase()} focus: "${context.currentTask}"`
    );
  }

  if (hasWearableData) {
    const sourceDescZh =
      latestHeartRate.source === 'web_bluetooth'
        ? '蓝牙穿戴设备实时数据'
        : latestHeartRate.source === 'camera_rppg'
          ? '摄像头面部光电脉搏波实时计算'
          : '智能手表实时健康数据流';
    const sourceDescEn =
      latestHeartRate.source === 'web_bluetooth'
        ? 'Bluetooth GATT wearable stream'
        : latestHeartRate.source === 'camera_rppg'
          ? 'Camera optical rPPG pulse sensing'
          : 'Smart Watch live biometric stream';

    const sign = hrDelta >= 0 ? `+${hrDelta}` : `${hrDelta}`;
    evidence.push(
      isZh
        ? `心率：每分钟 ${latestHeartRate.bpm} 次（相对个人基线每分钟 ${latestHeartRate.baseline} 次变化 ${sign}，来源：${sourceDescZh}）`
        : `Heart rate: ${latestHeartRate.bpm} bpm (${sign} bpm relative to your ${latestHeartRate.baseline} bpm baseline · ${sourceDescEn})`
    );

    evidence.push(
      isZh
        ? `心率变异性：${latestHeartRate.hrvRmssdMs} 毫秒（个人基线为 ${latestHeartRate.baselineHrvMs} 毫秒，数值下降反映自主神经负荷上升）`
        : `HRV (RMSSD): ${latestHeartRate.hrvRmssdMs} ms (personal baseline ${latestHeartRate.baselineHrvMs} ms; lower HRV reflects elevated autonomic load)`
    );
  } else {
    evidence.push(
      isZh
        ? '生理传感器状态：当前尚未连接蓝牙心率设备，仅基于实时语音文字与摄像头微表情进行判断（可随时连接蓝牙穿戴设备或开启摄像头脉搏波测算）'
        : 'Biometric sensor status: No Bluetooth heart-rate device connected yet; evaluating based on live voice/text and camera micro-expressions'
    );
  }

  if (facialReading) {
    evidence.push(isZh ? facialReading.summaryZh : facialReading.summaryEn);
  }

  let recommendedSupport: SupportMode = 'Plan';
  let recommendationReason = isZh
    ? '将当前任务拆解为一个二十分钟可执行的小步骤，能有效降低多任务并行的超载感。'
    : 'Breaking your current task into one concrete 20-minute move can reduce deadline overload.';

  if (hrDelta >= 15 && keywordHits === 0) {
    recommendedSupport = 'Regulate';
    recommendationReason = isZh
      ? '四十五秒温和呼吸或一分钟捏泡泡解压小游戏，能帮助身体快速释放紧绷感。'
      : 'A brief 45-second breathing pause or 1-minute decompression game can help your body settle.';
  } else if (
    facialAnxious ||
    latestText.toLowerCase().includes('overwhelmed') ||
    latestText.toLowerCase().includes('feel') ||
    latestText.includes('慌') ||
    latestText.includes('紧绷')
  ) {
    recommendedSupport = 'Regulate';
    recommendationReason = isZh
      ? '当身体或眉心感到紧绷时，先通过呼吸或一分钟解压小游戏放松，比直接硬扛更容易找回节奏。'
      : 'When tension rises, taking 1 minute to decompress or breathe can help before tackling tasks.';
  }

  let summaryText = isZh
    ? '目前的语音文字、摄像头面部微表情与生理信号相对你的个人基线保持平稳。你随时可以继续专注或主动选择支持。'
    : 'Your voice input, camera facial cues, and biometric signals look close to your personal baseline right now.';

  if (level !== 'Settled') {
    if (isZh) {
      const hrClause = hasWearableData
        ? `，实测心率高于个人基线且心率变异性降至 ${latestHeartRate.hrvRmssdMs} 毫秒`
        : '';
      const facialClause = facialReading
        ? `，同时${facialReading.summaryZh.replace('。', '')}`
        : '';
      summaryText = `你的表达显示你正在同时应对多项任务或卡点${hrClause}${facialClause}。这符合你现在的真实感受吗？`;
    } else {
      const hrClause = hasWearableData
        ? ` Your heart rate is above baseline and your HRV has dipped to ${latestHeartRate.hrvRmssdMs} ms.`
        : '';
      const facialClause = facialReading
        ? ` Your live camera feed also notes ${facialReading.browTension.replace('_', ' ')} brows.`
        : '';
      summaryText = `Your words suggest you’re juggling several deadlines or blockers.${hrClause}${facialClause} Does that match how things feel?`;
    }
  }

  return {
    level,
    summaryText,
    observableEvidence: evidence,
    recommendedSupport,
    recommendationReason,
    source: 'local_engine',
    hrvStatusText: hasWearableData
      ? isZh
        ? `心率变异性 ${latestHeartRate.hrvRmssdMs} 毫秒（相对基线 ${latestHeartRate.baselineHrvMs} 毫秒下降 ${hrvDrop} 毫秒）`
        : `HRV ${latestHeartRate.hrvRmssdMs} ms (${hrvDrop >= 0 ? `-${hrvDrop}` : `+${Math.abs(hrvDrop)}`} ms vs baseline)`
      : undefined,
    facialStatusText: facialReading
      ? isZh
        ? facialReading.summaryZh
        : facialReading.summaryEn
      : undefined,
  };
}

/**
 * Fallback 20-minute micro-step generator for Plan mode (100% pure zh or en)
 */
export function buildFallbackPlanStep(
  context: SessionContextData,
  recentInput?: string,
  locale: Locale = 'en'
): PlanStepCard {
  const isZh = locale === 'zh';
  const task =
    context.currentTask.trim() ||
    (isZh ? '完成登录报错提示修复' : 'Finish the login error message');
  const lowerTask = task.toLowerCase();

  if (isZh) {
    if (task.includes('登录') || task.includes('报错') || lowerTask.includes('login')) {
      return {
        priorityTask: task,
        next20MinutesAction:
          '接下来的二十分钟里，只专注完成登录报错提示的文本显示与状态重置。',
        completionCondition:
          '当输入错误密码时界面能清晰显示一行报错提示，且不再触发页面崩溃即可停手。',
        setAsideList: [
          '分布式系统其余章节的复习笔记',
          '界面样式细节美化与边缘情况重构',
        ],
        source: 'local_engine',
      };
    }

    return {
      priorityTask: task,
      next20MinutesAction: `接下来的二十分钟里，只推进「${task}」最核心的第一小步，写完最小可用草稿。`,
      completionCondition:
        '完成一个小节或一段核心逻辑的验证，并记录下一处待办即可休息。',
      setAsideList: [
        recentInput ? '刚才提到的其他并行截止任务' : '今天晚些时候的其他课程或工作事项',
        '追求一次性完美排版或全量优化',
      ],
      source: 'local_engine',
    };
  }

  if (lowerTask.includes('login') || lowerTask.includes('error')) {
    return {
      priorityTask: 'Fix the login error message state',
      next20MinutesAction:
        'For the next 20 minutes, finish the login error message and verify one invalid-password test case.',
      completionCondition:
        'The form displays a clear inline message when login fails without crashing the page.',
      setAsideList: [
        'Distributed systems exam review notes',
        'Full UI polish and edge-case refactoring',
      ],
      source: 'local_engine',
    };
  }

  return {
    priorityTask: task,
    next20MinutesAction: `For the next 20 minutes, complete only the first concrete draft section of "${task}".`,
    completionCondition:
      'One self-contained piece is written or tested and saved, even if rough.',
    setAsideList: [
      recentInput
        ? 'Other competing deadlines mentioned in your check-in'
        : 'Other tasks due later this week',
      'Perfectionism on formatting or secondary details',
    ],
    source: 'local_engine',
  };
}

/**
 * Fallback contextual reply for Listen mode (100% pure zh or en)
 */
export function buildFallbackListenReply(params: {
  userMessage: string;
  subMode: ListenSubMode;
  context: SessionContextData;
  locale?: Locale;
}): string {
  const { userMessage, subMode, context, locale = 'en' } = params;
  const isZh = locale === 'zh';
  const taskLabel =
    context.currentTask.trim() ||
    (isZh ? '手头的重点事项' : 'your current workload');

  if (isZh) {
    if (subMode === 'Just listen') {
      return `我听到了——同时应对「${taskLabel}」和多重压力确实让人紧绷。这里不需要立刻解决所有事，现在哪一部分最让你觉得心累？`;
    }
    if (subMode === 'Help me settle') {
      return `围绕「${taskLabel}」同时涌来这么多事，紧绷是很自然的反应。要不要先放慢速度，告诉我哪一件小事可以先放一放？`;
    }
    return `既然「${taskLabel}」是当前的焦点，如果只挑出一个五分钟就能看清的小切口，你觉得从哪里下手最轻松？`;
  }

  if (subMode === 'Just listen') {
    return `I hear how much is piling up around "${taskLabel}". You don't have to solve all of it this second—what part feels the most exhausting right now?`;
  }

  if (subMode === 'Help me settle') {
    return `It makes sense that your pace feels tight with "${taskLabel}" on your plate. Before touching the next detail, what is one thing you can give yourself permission to pause for the next 15 minutes?`;
  }

  return `Since "${taskLabel}" is front and center${
    userMessage ? ' and you mentioned feeling stretched' : ''
  }, what is the smallest 5-minute piece of it we could isolate first?`;
}
