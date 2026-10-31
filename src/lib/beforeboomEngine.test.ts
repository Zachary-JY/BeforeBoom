import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMMA_DEMO_CONTEXT,
  EMMA_DEMO_INPUTS,
  buildFallbackListenReply,
  buildFallbackPlanStep,
  buildMultimodalTimelineSeries,
  computeFacialTensionScore,
  computeOpticalRppgMetrics,
  countStressKeywords,
  createDefaultFacialReading,
  createHistoryRecordFromSession,
  createInitialHeartRateSeries,
  createInitialHistoricalRecords,
  createPersonaContext,
  createUnconnectedHeartRatePoint,
  detectPetMood,
  evaluateSignalState,
  evaluateWatchAlert,
  formatActivityDisplay,
  parseBleHeartRateMeasurement,
} from './beforeboomEngine';

test('countStressKeywords detects stress phrases in English and Chinese', () => {
  const hitsEn = countStressKeywords(
    'I have three deadlines colliding tonight and the handler crashes.'
  );
  assert.ok(hitsEn >= 2, 'Expected at least 2 stress keywords in English');

  const hitsZh = countStressKeywords('今天有三个截止日期，代码报错让我压力很大很焦虑');
  assert.ok(hitsZh >= 3, 'Expected at least 3 stress keywords in Chinese');
});

test('parseBleHeartRateMeasurement parses GATT 0x2A37 BPM, RR-intervals, and rawHex', () => {
  const packet = [0x10, 86, 0xcd, 0x02, 0xec, 0x02];
  const parsed = parseBleHeartRateMeasurement(packet, 72, 58);
  assert.equal(parsed.bpm, 86);
  assert.equal(parsed.delta, 14);
  assert.ok(parsed.hrvRmssdMs >= 18 && parsed.hrvRmssdMs <= 95);
  assert.equal(parsed.rawHex, '10 56 CD 02 EC 02');
});

test('computeOpticalRppgMetrics computes real optical pulse BPM and HRV from green-channel wave', () => {
  const samples = Array.from({ length: 40 }, (_, i) => {
    const t = i / 10;
    return 128 + 4 * Math.sin(2 * Math.PI * 1.25 * t);
  });
  const metrics = computeOpticalRppgMetrics(samples, 10, 72, 58);
  assert.ok(metrics !== null, 'Expected valid rPPG metrics from 4s optical pulse wave');
  assert.ok(metrics.bpm >= 68 && metrics.bpm <= 82, `Expected ~75 BPM, got ${metrics.bpm}`);
});

test('Unconnected sensor state does not fabricate heart rate numbers', () => {
  const unconnectedHr = createUnconnectedHeartRatePoint(72, 58);
  assert.equal(unconnectedHr.bpm, 0);
  const evalZh = evaluateSignalState({
    inputs: [
      {
        id: '1',
        text: '正在整理复习笔记',
        source: 'text',
        timestamp: '刚刚',
      },
    ],
    latestHeartRate: unconnectedHr,
    context: createPersonaContext('emma', 'zh'),
    locale: 'zh',
  });
  assert.ok(
    evalZh.observableEvidence.some((e) => e.includes('尚未连接蓝牙心率设备')),
    'Should honestly report unconnected sensor status'
  );
});

test('computeFacialTensionScore and buildMultimodalTimelineSeries generate accurate multimodal trajectory', () => {
  const anxiousFacial = createDefaultFacialReading('anxious');
  const calmFacial = createDefaultFacialReading('calm');
  assert.ok(
    computeFacialTensionScore(anxiousFacial) > computeFacialTensionScore(calmFacial),
    'Anxious facial micro-expression should produce higher tension score than calm'
  );

  const hrSeries = createInitialHeartRateSeries(72, 'rising', 58);
  const timeline = buildMultimodalTimelineSeries({
    heartRateSeries: hrSeries,
    inputs: EMMA_DEMO_INPUTS,
    facialReading: anxiousFacial,
    interventions: [{ mode: 'Regulate', timestamp: '12:05', feedback: 'Better' }],
  });

  assert.ok(timeline.length >= 6, 'Timeline should have at least 6 multimodal points');
  const peakStress = Math.max(...timeline.map((p) => p.compositeStressIndex));
  const finalStress = timeline[timeline.length - 1].compositeStressIndex;
  assert.ok(
    finalStress < peakStress,
    'Final stress should drop after a "Better" Regulate intervention'
  );
});

test('createInitialHistoricalRecords and createHistoryRecordFromSession build complete history records', () => {
  const initialRecords = createInitialHistoricalRecords();
  assert.ok(initialRecords.length >= 3, 'Should provide rich initial history records');
  assert.ok(initialRecords[0].timeline.length >= 4, 'Each record has multimodal timeline');

  const ctx = createPersonaContext('emma', 'zh');
  const hrSeries = createInitialHeartRateSeries(72, 'rising', 58);
  const notice = evaluateSignalState({
    inputs: EMMA_DEMO_INPUTS,
    latestHeartRate: hrSeries[hrSeries.length - 1],
    context: ctx,
    locale: 'zh',
  });
  const savedRecord = createHistoryRecordFromSession({
    context: ctx,
    heartRateSeries: hrSeries,
    inputs: EMMA_DEMO_INPUTS,
    facialReading: createDefaultFacialReading('anxious'),
    signalNotice: notice,
    interventions: [{ mode: 'Plan', timestamp: '12:10', feedback: 'Better' }],
  });
  assert.equal(savedRecord.personaNameZh, '林晓');
  assert.equal(savedRecord.supportUsed, 'Plan');
  assert.equal(savedRecord.verificationFeedback, 'Better');
});

test('createPersonaContext and formatActivityDisplay support switching people and Study/Work/Custom contexts', () => {
  const mayaZh = createPersonaContext('maya', 'zh');
  assert.equal(mayaZh.personaName, '苏晴');
  assert.equal(mayaZh.activity, 'Custom');
  assert.equal(
    formatActivityDisplay(mayaZh, 'zh'),
    '整理个人设计作品集与创作手稿'
  );

  const alexEn = createPersonaContext('alex', 'en');
  assert.equal(alexEn.personaName, 'Alex');
  assert.equal(alexEn.activity, 'Work');
  assert.equal(formatActivityDisplay(alexEn, 'en'), 'Work');
});

test('evaluateSignalState produces 100% pure Chinese in zh and pure English in en with real camera and wearable cues', () => {
  const hrSeries = createInitialHeartRateSeries(72, 'rising', 58);
  const latestHr = hrSeries[hrSeries.length - 1];
  const anxiousFace = createDefaultFacialReading('anxious');

  const resultZh = evaluateSignalState({
    inputs: [
      {
        id: '1',
        text: '今晚有三项截止任务撞在一起，登录报错提示也还在崩溃。',
        source: 'voice',
        timestamp: '刚刚',
      },
    ],
    latestHeartRate: latestHr,
    context: createPersonaContext('emma', 'zh'),
    locale: 'zh',
    facialReading: anxiousFace,
  });

  assert.equal(resultZh.level, 'Elevated signals');
  assert.ok(
    !/[a-zA-Z]/.test(resultZh.summaryText),
    `Expected pure Chinese summaryText without English letters, got: ${resultZh.summaryText}`
  );
  assert.ok(
    resultZh.observableEvidence.some((e) => e.includes('眉心明显紧锁')),
    'Expected facial micro-expression evidence in Chinese'
  );

  const resultEn = evaluateSignalState({
    inputs: EMMA_DEMO_INPUTS,
    latestHeartRate: latestHr,
    context: EMMA_DEMO_CONTEXT,
    locale: 'en',
    facialReading: anxiousFace,
  });

  assert.equal(resultEn.level, 'Elevated signals');
  assert.ok(resultEn.summaryText.includes('Does that match how things feel?'));
});

test('evaluateWatchAlert triggers smartwatch alert when HRV drops sharply below baseline', () => {
  const stressedHr = {
    timestamp: '12:00',
    bpm: 91,
    baseline: 72,
    delta: 19,
    hrvRmssdMs: 28,
    baselineHrvMs: 58,
    source: 'web_bluetooth' as const,
  };

  const alert = evaluateWatchAlert(stressedHr, false);
  assert.equal(alert.triggered, true);
  assert.ok(alert.reasonEn.includes('28 ms'));
  assert.ok(!/[a-zA-Z]/.test(alert.reasonZh));
});

test('detectPetMood automatically reflects camera facial micro-expressions, words, and HRV', () => {
  const normalHr = {
    timestamp: '12:00',
    bpm: 74,
    baseline: 72,
    delta: 2,
    hrvRmssdMs: 55,
    baselineHrvMs: 58,
    source: 'web_bluetooth' as const,
  };

  assert.equal(
    detectPetMood({
      latestInput: '正在看文档',
      signalLevel: 'Settled',
      latestHr: normalHr,
      facialReading: createDefaultFacialReading('happy'),
    }),
    'happy'
  );

  assert.equal(
    detectPetMood({
      latestInput: '正在看文档',
      signalLevel: 'Settled',
      latestHr: normalHr,
      facialReading: createDefaultFacialReading('sad'),
    }),
    'sad'
  );

  assert.equal(
    detectPetMood({
      latestInput: '压力很大',
      signalLevel: 'Elevated signals',
      latestHr: normalHr,
      lastFeedback: 'Better',
    }),
    'relieved'
  );
});

test('buildFallbackPlanStep and buildFallbackListenReply maintain strict language purity', () => {
  const ctxZh = createPersonaContext('emma', 'zh');
  const planZh = buildFallbackPlanStep(ctxZh, '任务太多了', 'zh');
  assert.ok(!/[a-zA-Z]/.test(planZh.next20MinutesAction));

  const replyZh = buildFallbackListenReply({
    userMessage: '我觉得很难集中注意力',
    subMode: 'Help me settle',
    context: ctxZh,
    locale: 'zh',
  });
  assert.ok(!/[a-zA-Z]/.test(replyZh));
});
