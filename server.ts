import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildFallbackListenReply,
  buildFallbackPlanStep,
  createDefaultFacialReading,
  evaluateSignalState,
} from './src/lib/beforeboomEngine.ts';
import type { Locale } from './src/lib/i18n.ts';
import type {
  FacialExpressionReading,
  HeartRatePoint,
  InputEntry,
  ListenSubMode,
  MobileHealthSyncPayload,
  PetMood,
  PlanStepCard,
  SessionContextData,
  SignalNoticeEvidence,
  SupportMode,
} from './src/types/session.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hasValidGeminiApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

function getGeminiClient(): GoogleGenAI | null {
  if (!hasValidGeminiApiKey()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '6mb' }));

  let latestWearablePush: {
    deviceName: string;
    bpm: number;
    hrvRmssdMs: number;
    baselineHrvMs: number;
    batteryLevel?: number;
    rawHex?: string;
    syncedAt: string;
    seq: number;
  } | null = null;

  // 1. Health & AI capability status endpoint
  app.get('/api/health', (_req, res) => {
    const aiConfigured = hasValidGeminiApiKey();
    res.json({
      ok: true,
      aiConfigured,
      mode: aiConfigured ? 'live_ai' : 'demo_fallback',
      retentionPolicy: 'In-memory client session only. No persistent server database storage.',
    });
  });

  // 1B. Real Cross-Device Wearable Push & Poll Endpoints (Apple Watch Shortcut / Mobile Companion)
  app.post('/api/wearable/push', (req, res) => {
    const {
      deviceName = 'Apple Watch / Mobile Companion',
      bpm = 82,
      hrvRmssdMs = 38,
      baselineHrvMs = 58,
      batteryLevel,
      rawHex,
    } = req.body as {
      deviceName?: string;
      bpm?: number;
      hrvRmssdMs?: number;
      baselineHrvMs?: number;
      batteryLevel?: number;
      rawHex?: string;
    };

    const syncedAt = new Date().toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    });

    latestWearablePush = {
      deviceName,
      bpm: Number(bpm) || 82,
      hrvRmssdMs: Number(hrvRmssdMs) || 38,
      baselineHrvMs: Number(baselineHrvMs) || 58,
      batteryLevel,
      rawHex,
      syncedAt,
      seq: (latestWearablePush?.seq || 0) + 1,
    };

    return res.json({ ok: true, data: latestWearablePush });
  });

  app.get('/api/wearable/live', (_req, res) => {
    return res.json({ ok: true, data: latestWearablePush });
  });

  // 2. Wearable & Smart Watch Live Telemetry Bridge endpoint
  app.post('/api/health-data/sync', (req, res) => {
    const {
      platform = 'Apple Watch Live Bridge',
      stressScenario = 'elevated',
      customPayload,
    } = req.body as {
      platform?: 'Apple Watch Live Bridge' | 'Web Bluetooth GATT HRM' | 'Camera Optical rPPG';
      stressScenario?: 'settled' | 'rising' | 'elevated';
      customPayload?: Partial<MobileHealthSyncPayload>;
    };

    const nowStr = new Date().toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    });

    if (customPayload && typeof customPayload.bpm === 'number') {
      const payload: MobileHealthSyncPayload = {
        deviceName: customPayload.deviceName || 'Smart Watch S9',
        platform,
        bpm: customPayload.bpm,
        hrvRmssdMs: customPayload.hrvRmssdMs ?? 32,
        baselineHrvMs: customPayload.baselineHrvMs ?? 58,
        respiratoryRate: customPayload.respiratoryRate ?? 17,
        sleepRecoveryScore: customPayload.sleepRecoveryScore ?? 74,
        syncedAt: nowStr,
      };
      return res.json(payload);
    }

    const presets: Record<
      'settled' | 'rising' | 'elevated',
      Omit<MobileHealthSyncPayload, 'platform' | 'syncedAt'>
    > = {
      settled: {
        deviceName:
          platform === 'Web Bluetooth GATT HRM' ? 'BLE Heart Rate Band' : 'Apple Watch S9',
        bpm: 73,
        hrvRmssdMs: 56,
        baselineHrvMs: 58,
        respiratoryRate: 14,
        sleepRecoveryScore: 84,
      },
      rising: {
        deviceName:
          platform === 'Web Bluetooth GATT HRM' ? 'BLE Heart Rate Band' : 'Apple Watch S9',
        bpm: 84,
        hrvRmssdMs: 39,
        baselineHrvMs: 58,
        respiratoryRate: 17,
        sleepRecoveryScore: 71,
      },
      elevated: {
        deviceName:
          platform === 'Web Bluetooth GATT HRM' ? 'BLE Heart Rate Band' : 'Apple Watch S9',
        bpm: 91,
        hrvRmssdMs: 28,
        baselineHrvMs: 58,
        respiratoryRate: 19,
        sleepRecoveryScore: 62,
      },
    };

    const chosen = presets[stressScenario] || presets.elevated;
    const responsePayload: MobileHealthSyncPayload = {
      ...chosen,
      platform,
      syncedAt: nowStr,
    };

    return res.json(responsePayload);
  });

  // 3. Real Microphone Audio Snippet Transcription Endpoint
  app.post('/api/transcribe-audio', async (req, res) => {
    const { audioBase64, mimeType = 'audio/webm', locale = 'zh' } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      locale?: Locale;
    };

    const fallbackTranscript =
      locale === 'zh'
        ? '我刚刚通过麦克风录下了一段实时语音：手头这几项任务同时推进让我感觉节奏有些紧绷。'
        : 'I just recorded a live voice note via microphone: juggling these tasks together feels pretty intense right now.';

    const ai = getGeminiClient();
    if (!ai || !audioBase64) {
      return res.json({ transcript: fallbackTranscript, source: 'local_engine' });
    }

    try {
      const cleanBase64 = audioBase64.replace(/^data:audio\/[\w+-]+;base64,/, '');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text:
              locale === 'zh'
                ? '请准确转写这段语音的中文内容。如果语音较轻或只有呼吸环境声，请用一句简短纯中文描述检测到的实时语音或呼吸声状态，不要包含任何英文单词。'
                : 'Transcribe this spoken audio accurately in English. If the audio is very quiet or ambient breathing, briefly describe the detected voice/breathing state in 1 short sentence.',
          },
        ],
      });

      const text = (response.text ?? '').trim() || fallbackTranscript;
      return res.json({ transcript: text, source: 'live_ai' });
    } catch (_err) {
      return res.json({ transcript: fallbackTranscript, source: 'local_engine' });
    }
  });

  // 4. Camera Facial Micro-Expression Multimodal Endpoint
  app.post('/api/analyze-face', async (req, res) => {
    const { imageBase64, simulatedCue = 'anxious' } = req.body as {
      imageBase64?: string;
      simulatedCue?: PetMood;
      locale?: Locale;
    };

    const fallbackReading = createDefaultFacialReading(simulatedCue);

    const ai = getGeminiClient();
    if (!ai || !imageBase64) {
      return res.json(fallbackReading);
    }

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `Observe the person's facial micro-expressions from this live camera frame cautiously and non-diagnostically.
Return JSON with:
- cue: one of "calm", "happy", "anxious", "sad", "relieved"
- browTension: one of "relaxed", "slightly_furrowed", "furrowed"
- lipCurvature: one of "soft_smile", "neutral", "pressed"
- eyeFatigue: one of "alert", "steady", "tired"
- summaryEn: 1 short cautious English sentence describing observable facial cues (e.g., "Live camera facial analysis detects slightly furrowed brows and pressed lips.")
- summaryZh: 1 short pure Simplified Chinese sentence describing observable facial cues without any English words (e.g., "摄像头实时画面识别到眉心轻微紧锁，嘴角略微紧绷。")`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cue: { type: Type.STRING },
              browTension: { type: Type.STRING },
              lipCurvature: { type: Type.STRING },
              eyeFatigue: { type: Type.STRING },
              summaryEn: { type: Type.STRING },
              summaryZh: { type: Type.STRING },
            },
            required: [
              'cue',
              'browTension',
              'lipCurvature',
              'eyeFatigue',
              'summaryEn',
              'summaryZh',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validCues: PetMood[] = ['calm', 'happy', 'anxious', 'sad', 'relieved'];
      const reading: FacialExpressionReading = {
        cue: validCues.includes(parsed.cue) ? parsed.cue : fallbackReading.cue,
        browTension: parsed.browTension || fallbackReading.browTension,
        lipCurvature: parsed.lipCurvature || fallbackReading.lipCurvature,
        eyeFatigue: parsed.eyeFatigue || fallbackReading.eyeFatigue,
        summaryEn: parsed.summaryEn || fallbackReading.summaryEn,
        summaryZh: parsed.summaryZh || fallbackReading.summaryZh,
        updatedAt: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        source: 'camera_frame',
      };
      return res.json(reading);
    } catch (_err) {
      return res.json(fallbackReading);
    }
  });

  // 5. Analyze Signal endpoint (Signal + Support Router modules)
  app.post('/api/analyze-signal', async (req, res) => {
    const {
      inputs = [],
      latestHeartRate,
      context,
      cooldownActive = false,
      forceDemoFallback = false,
      locale = 'en',
      facialReading = null,
    } = req.body as {
      inputs: InputEntry[];
      latestHeartRate: HeartRatePoint;
      context: SessionContextData;
      cooldownActive?: boolean;
      forceDemoFallback?: boolean;
      locale?: Locale;
      facialReading?: FacialExpressionReading | null;
    };

    const safeHr: HeartRatePoint = latestHeartRate || {
      timestamp: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      bpm: 88,
      baseline: context?.baselineBpm || 72,
      delta: 16,
      hrvRmssdMs: 31,
      baselineHrvMs: context?.baselineHrvMs || 58,
      source: 'apple_watch_bridge',
    };

    const baselineEvaluation = evaluateSignalState({
      inputs,
      latestHeartRate: safeHr,
      context: context || {
        personaId: 'emma',
        personaName: locale === 'zh' ? '林晓' : 'Emma',
        isDemoPersona: false,
        activity: 'Study',
        customActivityText: '',
        currentTask: locale === 'zh' ? '完成登录报错提示修复与分布式系统复习' : 'Current task',
        plannedDurationMinutes: 20,
        baselineBpm: 72,
        baselineHrvMs: 58,
      },
      cooldownActive,
      locale,
      facialReading,
    });

    const ai = forceDemoFallback ? null : getGeminiClient();
    if (!ai || inputs.length === 0) {
      return res.json(baselineEvaluation);
    }

    try {
      const recentInputsText = inputs
        .slice(-3)
        .map((i) => `[${i.source}]: "${i.text}"`)
        .join('\n');

      const isZh = locale === 'zh';
      const langInstruction = isZh
        ? 'IMPORTANT: Write summaryText, observableEvidence, and recommendationReason in 100% pure Simplified Chinese (纯中文). Do NOT include ANY English words, abbreviations (like HR, HRV, bpm, ms), or simulation terms.'
        : 'IMPORTANT: Write summaryText, observableEvidence, and recommendationReason in 100% pure English. Do NOT include any Chinese characters.';

      const facialDesc = facialReading
        ? isZh
          ? `摄像头实时面部微表情线索：${facialReading.summaryZh}`
          : `Live camera facial micro-expression cue: ${facialReading.summaryEn}`
        : isZh
          ? '摄像头微表情待命'
          : 'Camera micro-expression standby';

      const prompt = `You are the cautious, warm Signal & Support Router for BeforeBoom.
${langInstruction}

Rules you MUST follow:
1. Use tentative, respectful phrasing ("possible stress signals" / "可能的压力信号", "shifted relative to your baseline" / "相对个人基线有所变化"). Never diagnose or claim to know the user's true emotion.
2. Only cite actual observable evidence provided below (the user's words, wearable heart rate relative to baseline, wearable heart rate variability relative to baseline, and live camera facial micro-expressions if provided). NEVER claim speech-rate analysis or invent confidence percentages.

User Context:
- Activity: ${context.activity} ${context.customActivityText || ''}
- Current Task: ${context.currentTask || 'Not specified'}
- Wearable Heart Rate: ${safeHr.bpm} (Personal baseline: ${safeHr.baseline}, delta: ${safeHr.delta >= 0 ? '+' : ''}${safeHr.delta})
- Wearable Heart Rate Variability: ${safeHr.hrvRmssdMs} (Personal baseline: ${safeHr.baselineHrvMs})
- ${facialDesc}
- Recent Input:
${recentInputsText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              level: {
                type: Type.STRING,
                description: 'One of: "Settled", "Signals rising", "Elevated signals"',
              },
              summaryText: {
                type: Type.STRING,
                description:
                  '2-sentence gentle explanation ending with a check-in question in the requested language.',
              },
              observableEvidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2-4 concise factual bullets in the requested language citing user words, wearable heart rate, wearable heart rate variability, and camera facial cues.',
              },
              recommendedSupport: {
                type: Type.STRING,
                description: 'One of: "Listen", "Regulate", "Plan"',
              },
              recommendationReason: {
                type: Type.STRING,
                description: '1 warm sentence in the requested language explaining why that support mode might help right now.',
              },
            },
            required: [
              'level',
              'summaryText',
              'observableEvidence',
              'recommendedSupport',
              'recommendationReason',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validLevels = ['Settled', 'Signals rising', 'Elevated signals'];
      const validModes: SupportMode[] = ['Listen', 'Regulate', 'Plan'];

      const hasAsciiLetters = /[a-zA-Z]{2,}/.test(parsed.summaryText || '');
      if (isZh && hasAsciiLetters) {
        return res.json(baselineEvaluation);
      }

      const result: SignalNoticeEvidence = {
        level: validLevels.includes(parsed.level) ? parsed.level : baselineEvaluation.level,
        summaryText: parsed.summaryText || baselineEvaluation.summaryText,
        observableEvidence:
          Array.isArray(parsed.observableEvidence) && parsed.observableEvidence.length > 0
            ? parsed.observableEvidence
            : baselineEvaluation.observableEvidence,
        recommendedSupport: validModes.includes(parsed.recommendedSupport)
          ? parsed.recommendedSupport
          : baselineEvaluation.recommendedSupport,
        recommendationReason:
          parsed.recommendationReason || baselineEvaluation.recommendationReason,
        source: 'live_ai',
        hrvStatusText: baselineEvaluation.hrvStatusText,
        facialStatusText: baselineEvaluation.facialStatusText,
      };

      return res.json(result);
    } catch (_err) {
      return res.json(baselineEvaluation);
    }
  });

  // 6. Generate 20-minute Plan Step endpoint
  app.post('/api/generate-plan', async (req, res) => {
    const {
      context,
      recentInput,
      variationIndex = 0,
      forceDemoFallback = false,
      locale = 'en',
    } = req.body as {
      context: SessionContextData;
      recentInput?: string;
      variationIndex?: number;
      forceDemoFallback?: boolean;
      locale?: Locale;
    };

    const safeContext = context || {
      personaId: 'emma',
      personaName: locale === 'zh' ? '林晓' : 'Emma',
      isDemoPersona: false,
      activity: 'Study',
      customActivityText: '',
      currentTask: locale === 'zh' ? '完成登录报错提示修复与分布式系统复习' : 'Finish the login error message',
      plannedDurationMinutes: 20,
      baselineBpm: 72,
      baselineHrvMs: 58,
    };

    const fallbackCard = buildFallbackPlanStep(safeContext, recentInput, locale);
    if (variationIndex > 0) {
      if (locale === 'zh') {
        fallbackCard.next20MinutesAction = `接下来的二十分钟里，先在草稿纸或注释里为「${fallbackCard.priorityTask}」列出三行最小清单，并只完成第一行。`;
        fallbackCard.completionCondition = '写好三行要点并完成第一小步即可停笔休息。';
      } else {
        fallbackCard.next20MinutesAction = `For the next 20 minutes, write a 3-line checklist in comments for "${fallbackCard.priorityTask}" and complete only line 1.`;
        fallbackCard.completionCondition =
          'When the 3-line comment is saved and the first small case runs without crashing.';
      }
    }

    const ai = forceDemoFallback ? null : getGeminiClient();
    if (!ai) {
      return res.json(fallbackCard);
    }

    try {
      const isZh = locale === 'zh';
      const prompt = `You are the "Plan" support module for BeforeBoom. Help a stressed person narrow their workload into ONE small, concrete, executable 20-minute step.
${
  isZh
    ? 'IMPORTANT: Respond in 100% pure Simplified Chinese (纯中文). Do NOT include any English words.'
    : 'IMPORTANT: Respond in 100% pure English. Do NOT include any Chinese characters.'
}
Activity: ${safeContext.activity} ${safeContext.customActivityText || ''}
Current Task: ${safeContext.currentTask}
Recent Note: ${recentInput || ''}
Variation request index: ${variationIndex} (if > 0, offer a gentler, even smaller starting angle).

Keep sentences brief, warm, and concrete.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priorityTask: { type: Type.STRING },
              next20MinutesAction: { type: Type.STRING },
              completionCondition: { type: Type.STRING },
              setAsideList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'priorityTask',
              'next20MinutesAction',
              'completionCondition',
              'setAsideList',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (isZh && /[a-zA-Z]{2,}/.test(parsed.next20MinutesAction || '')) {
        return res.json(fallbackCard);
      }

      const planCard: PlanStepCard = {
        priorityTask: parsed.priorityTask || fallbackCard.priorityTask,
        next20MinutesAction: parsed.next20MinutesAction || fallbackCard.next20MinutesAction,
        completionCondition: parsed.completionCondition || fallbackCard.completionCondition,
        setAsideList:
          Array.isArray(parsed.setAsideList) && parsed.setAsideList.length > 0
            ? parsed.setAsideList
            : fallbackCard.setAsideList,
        source: 'live_ai',
      };
      return res.json(planCard);
    } catch (_err) {
      return res.json(fallbackCard);
    }
  });

  // 7. Listen contextual chat reply endpoint
  app.post('/api/listen-reply', async (req, res) => {
    const {
      userMessage = '',
      subMode = 'Just listen',
      context,
      history = [],
      forceDemoFallback = false,
      locale = 'en',
    } = req.body as {
      userMessage: string;
      subMode: ListenSubMode;
      context: SessionContextData;
      history?: Array<{ role: string; text: string }>;
      forceDemoFallback?: boolean;
      locale?: Locale;
    };

    const safeContext = context || {
      personaId: 'emma',
      personaName: locale === 'zh' ? '林晓' : 'Emma',
      isDemoPersona: false,
      activity: 'Study',
      customActivityText: '',
      currentTask: locale === 'zh' ? '完成登录报错提示修复与分布式系统复习' : 'Finish the login error message',
      plannedDurationMinutes: 20,
      baselineBpm: 72,
      baselineHrvMs: 58,
    };

    const fallbackText = buildFallbackListenReply({
      userMessage,
      subMode,
      context: safeContext,
      locale,
    });

    const ai = forceDemoFallback ? null : getGeminiClient();
    if (!ai) {
      return res.json({
        reply: fallbackText,
        source: 'local_engine',
      });
    }

    try {
      const historyFormatted = history
        .slice(-4)
        .map((h) => `${h.role === 'user' ? 'User' : 'BeforeBoom'}: ${h.text}`)
        .join('\n');

      const isZh = locale === 'zh';
      const prompt = `You are the "Listen" support mode in BeforeBoom.
${
  isZh
    ? 'IMPORTANT: Reply in 100% pure Simplified Chinese (纯中文). Do NOT use any English words.'
    : 'IMPORTANT: Reply in 100% pure English. Do NOT use any Chinese characters.'
}
Current activity: ${safeContext.activity} ${safeContext.customActivityText || ''}
Current task: ${safeContext.currentTask || 'Not specified'}
Chosen conversation preference right now: "${subMode}"
Recent conversation:
${historyFormatted}
User just said: "${userMessage}"

Guidelines:
- Keep your response to 1 or 2 short, warm sentences (max 45 words).
- Ask at most ONE grounded question or offer ONE concrete reflection tied to their task/words.
- Do NOT repeat generic platitudes, do NOT diagnose, and do NOT claim to know their true feelings.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const replyText = (response.text ?? '').trim() || fallbackText;
      if (isZh && /[a-zA-Z]{2,}/.test(replyText)) {
        return res.json({
          reply: fallbackText,
          source: 'local_engine',
        });
      }

      return res.json({
        reply: replyText,
        source: 'live_ai',
      });
    } catch (_err) {
      return res.json({
        reply: fallbackText,
        source: 'local_engine',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeforeBoom server listening on http://localhost:${PORT}`);
  });
}

startServer();
