import React, { useState } from 'react';
import {
  Activity,
  Camera,
  HeartPulse,
  Layers,
  Mic,
  Sparkles,
} from 'lucide-react';
import { Locale } from '../lib/i18n';
import { MultimodalTimelinePoint } from '../types/session';

interface MultimodalTimelineChartProps {
  locale: Locale;
  timeline: MultimodalTimelinePoint[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

type TrackFilter = 'all' | 'composite' | 'physio' | 'facial_voice';

export const MultimodalTimelineChart: React.FC<MultimodalTimelineChartProps> = ({
  locale,
  timeline,
  title,
  subtitle,
  compact = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<TrackFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(
    Math.max(0, timeline.length - 1)
  );

  const safeIndex = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, timeline.length - 1)
  );
  const activePoint = timeline[safeIndex] || timeline[timeline.length - 1];

  const isZh = locale === 'zh';
  const hasWearableBpm = timeline.some((pt) => pt.bpm > 0);

  const chartWidth = 680;
  const chartHeight = compact ? 185 : 220;
  const padLeft = 38;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const getX = (idx: number) => {
    if (timeline.length <= 1) return padLeft + innerW / 2;
    return padLeft + (idx / (timeline.length - 1)) * innerW;
  };

  // Map 0-100 score to SVG Y coordinate
  const getYScore = (score: number) => {
    const clamped = Math.max(0, Math.min(100, score));
    return padTop + innerH - (clamped / 100) * innerH;
  };

  // Map BPM (55-115) to 0-100 normalized scale for overlay
  const normalizeBpmTo100 = (bpm: number) => {
    if (bpm <= 0) return 25;
    return Math.max(8, Math.min(96, ((bpm - 55) / 55) * 100));
  };

  // Map HRV (15-85 ms) to 0-100 scale
  const normalizeHrvTo100 = (hrv: number) => {
    if (hrv <= 0) return 50;
    return Math.max(8, Math.min(94, ((hrv - 15) / 70) * 100));
  };

  const buildPolyline = (getter: (pt: MultimodalTimelinePoint) => number) =>
    timeline
      .map((pt, idx) => `${getX(idx)},${getYScore(getter(pt))}`)
      .join(' ');

  const buildAreaPath = (getter: (pt: MultimodalTimelinePoint) => number) => {
    if (timeline.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(timeline.length - 1);
    const baseY = padTop + innerH;
    const lineCoords = timeline
      .map((pt, idx) => `${getX(idx)},${getYScore(getter(pt))}`)
      .join(' L ');
    return `M ${firstX},${baseY} L ${lineCoords} L ${lastX},${baseY} Z`;
  };

  const compositePoints = buildPolyline((p) => p.compositeStressIndex);
  const compositeArea = buildAreaPath((p) => p.compositeStressIndex);
  const facialPoints = buildPolyline((p) => p.facialTensionScore);
  const voicePoints = buildPolyline((p) => p.voiceKeywordIntensity);
  const bpmPoints = buildPolyline((p) => normalizeBpmTo100(p.bpm));
  const hrvPoints = buildPolyline((p) => normalizeHrvTo100(p.hrvRmssdMs));

  const startStress = timeline[0]?.compositeStressIndex ?? 28;
  const peakStress =
    timeline.length > 0
      ? Math.max(...timeline.map((p) => p.compositeStressIndex))
      : 28;
  const endStress =
    timeline[timeline.length - 1]?.compositeStressIndex ?? 28;

  const formatSignalLabel = (level: MultimodalTimelinePoint['signalLevel']) => {
    if (isZh) {
      if (level === 'Settled') return '平稳状态';
      if (level === 'Signals rising') return '信号上升';
      return '明显升高';
    }
    return level;
  };

  return (
    <div
      data-testid="multimodal-timeline-chart"
      className="bg-[#FFFEFA] border border-[#DEE5DB] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
    >
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#476652]" />
            <h3 className="text-sm sm:text-base font-semibold text-[#283C33]">
              {title ||
                (isZh
                  ? '多模态状态变化可视化趋势图（观察周期全轨迹）'
                  : 'Multimodal State Trajectory Chart (Observation Timeline)')}
            </h3>
          </div>
          <p className="text-xs text-[#617068]">
            {subtitle ||
              (isZh
                ? '融合穿戴设备心率与变异性、摄像头面部微表情张力、语音文字情绪词频的实时演变曲线（点击节点可查看详情）'
                : 'Synthesizes wearable HR/HRV, camera facial micro-expression tension, and voice/text stress cues over time')}
          </p>
        </div>

        {/* Track Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F7F5EF] p-1 rounded-xl border border-[#E5E9E2]">
          <button
            type="button"
            data-testid="chart-filter-all"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#476652] text-[#FFFEFA]'
                : 'text-[#617068] hover:text-[#283C33]'
            }`}
          >
            {isZh ? '全部多模态轨迹' : 'All Tracks'}
          </button>
          <button
            type="button"
            data-testid="chart-filter-composite"
            onClick={() => setActiveFilter('composite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFilter === 'composite'
                ? 'bg-[#476652] text-[#FFFEFA]'
                : 'text-[#617068] hover:text-[#283C33]'
            }`}
          >
            {isZh ? '综合压力指数' : 'Composite Index'}
          </button>
          <button
            type="button"
            data-testid="chart-filter-physio"
            onClick={() => setActiveFilter('physio')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFilter === 'physio'
                ? 'bg-[#476652] text-[#FFFEFA]'
                : 'text-[#617068] hover:text-[#283C33]'
            }`}
          >
            {isZh ? '心率与变异性' : 'HR & HRV'}
          </button>
          <button
            type="button"
            data-testid="chart-filter-facial"
            onClick={() => setActiveFilter('facial_voice')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeFilter === 'facial_voice'
                ? 'bg-[#476652] text-[#FFFEFA]'
                : 'text-[#617068] hover:text-[#283C33]'
            }`}
          >
            {isZh ? '微表情与语音' : 'Facial & Voice'}
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-2.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2] flex items-center justify-between">
          <span className="text-[11px] text-[#617068]">
            {isZh ? '初始综合指数' : 'Initial Index'}
          </span>
          <span className="font-mono text-sm font-semibold text-[#283C33]">
            {startStress} / 100
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F8EAE2]/60 border border-[#E5C5B5] flex items-center justify-between">
          <span className="text-[11px] text-[#7A442A]">
            {isZh ? '观察期峰值状态' : 'Peak Tension'}
          </span>
          <span className="font-mono text-sm font-semibold text-[#843B22]">
            {peakStress} / 100
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#E6EFE8]/70 border border-[#C5D6C8] flex items-center justify-between">
          <span className="text-[11px] text-[#2F523B]">
            {isZh ? '当前/最新状态' : 'Latest State'}
          </span>
          <span className="font-mono text-sm font-semibold text-[#2F523B]">
            {endStress} / 100
          </span>
        </div>
      </div>

      {/* Main SVG Multi-Track Canvas */}
      <div className="relative bg-[#F7F5EF] border border-[#E5E9E2] rounded-xl p-2 sm:p-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-48 sm:h-56 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="compositeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B86B43" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#476652" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#476652" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Zone Bands: Elevated (>=68), Rising (42-67), Settled (<42) */}
          <rect
            x={padLeft}
            y={padTop}
            width={innerW}
            height={getYScore(68) - padTop}
            fill="#F3DDD4"
            opacity="0.32"
            rx="4"
          />
          <rect
            x={padLeft}
            y={getYScore(68)}
            width={innerW}
            height={getYScore(42) - getYScore(68)}
            fill="#F8EAE2"
            opacity="0.35"
          />
          <rect
            x={padLeft}
            y={getYScore(42)}
            width={innerW}
            height={padTop + innerH - getYScore(42)}
            fill="#E6EFE8"
            opacity="0.4"
            rx="4"
          />

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {[100, 68, 42, 0].map((val) => {
            const y = getYScore(val);
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + innerW}
                  y2={y}
                  stroke="#D5DDD2"
                  strokeDasharray={val === 68 || val === 42 ? '4 4' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-[#617068] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Zone Labels on Right Edge */}
          <text
            x={padLeft + innerW - 6}
            y={padTop + 12}
            textAnchor="end"
            className="text-[9px] fill-[#843B22] font-medium"
          >
            {isZh ? '明显升高区' : 'Elevated Zone'}
          </text>
          <text
            x={padLeft + innerW - 6}
            y={getYScore(55)}
            textAnchor="end"
            className="text-[9px] fill-[#7A442A] font-medium"
          >
            {isZh ? '信号上升区' : 'Rising Zone'}
          </text>
          <text
            x={padLeft + innerW - 6}
            y={padTop + innerH - 6}
            textAnchor="end"
            className="text-[9px] fill-[#2F523B] font-medium"
          >
            {isZh ? '平稳观察区' : 'Settled Zone'}
          </text>

          {/* Track: Composite Stress Index Area & Curve */}
          {(activeFilter === 'all' || activeFilter === 'composite') && (
            <>
              <path d={compositeArea} fill="url(#compositeAreaGrad)" />
              <polyline
                fill="none"
                stroke="#283C33"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={compositePoints}
              />
            </>
          )}

          {/* Track: Wearable Heart Rate BPM & HRV */}
          {(activeFilter === 'all' || activeFilter === 'physio') && hasWearableBpm && (
            <>
              <polyline
                fill="none"
                stroke="#B85D3B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={bpmPoints}
              />
              <polyline
                fill="none"
                stroke="#3B7A57"
                strokeWidth="2"
                strokeDasharray="5 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={hrvPoints}
              />
            </>
          )}

          {/* Track: Camera Facial Micro-Expression Tension */}
          {(activeFilter === 'all' || activeFilter === 'facial_voice') && (
            <>
              <polyline
                fill="none"
                stroke="#6C4F7D"
                strokeWidth="2"
                strokeDasharray="3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={facialPoints}
              />
              <polyline
                fill="none"
                stroke="#C27D38"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={voicePoints}
              />
            </>
          )}

          {/* Interactive Time Nodes & Event Pins */}
          {timeline.map((pt, idx) => {
            const x = getX(idx);
            const y = getYScore(pt.compositeStressIndex);
            const isSelected = idx === safeIndex;
            const eventLabel = isZh ? pt.eventTagZh : pt.eventTagEn;

            return (
              <g
                key={`${pt.timestamp}-${idx}`}
                className="cursor-pointer"
                onClick={() => setSelectedIndex(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {/* Vertical guide line on selected node */}
                {isSelected && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + innerH}
                    stroke="#476652"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Node Circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6 : 4.2}
                  fill={
                    pt.signalLevel === 'Elevated signals'
                      ? '#A63D21'
                      : pt.signalLevel === 'Signals rising'
                        ? '#B8653B'
                        : '#2F6B48'
                  }
                  stroke="#FFFEFA"
                  strokeWidth="2"
                />

                {/* Event Pin Label if present */}
                {eventLabel && (
                  <g transform={`translate(${x}, ${Math.max(padTop + 10, y - 14)})`}>
                    <rect
                      x="-44"
                      y="-12"
                      width="88"
                      height="15"
                      rx="4"
                      fill="#283C33"
                      opacity="0.9"
                    />
                    <text
                      x="0"
                      y="-2"
                      textAnchor="middle"
                      className="text-[8.5px] fill-[#FFFEFA] font-medium"
                    >
                      {eventLabel.slice(0, 12)}
                    </text>
                  </g>
                )}

                {/* X-Axis Timestamp */}
                <text
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    isSelected ? 'fill-[#283C33] font-bold' : 'fill-[#617068]'
                  }`}
                >
                  {pt.timestamp}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E9E2] text-[11px] text-[#617068]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-[#283C33]" />
              <span>{isZh ? '综合压力张力指数' : 'Composite Stress Index'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-[#B85D3B]" />
              <span>
                {isZh
                  ? hasWearableBpm
                    ? '实时心率曲线'
                    : '心率（连接穿戴设备后显示）'
                  : 'Heart Rate (BPM)'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-b-2 border-dashed border-[#3B7A57]" />
              <span>{isZh ? '心率变异性 (HRV)' : 'HRV Resilience'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-b-2 border-dotted border-[#6C4F7D]" />
              <span>{isZh ? '摄像头微表情张力' : 'Camera Facial Tension'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-[#C27D38]" />
              <span>{isZh ? '语音/文字情绪强度' : 'Voice/Text Cues'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Selected Time-Point Multimodal Inspector */}
      {activePoint && (
        <div
          data-testid="timeline-point-inspector"
          className="p-3.5 rounded-xl bg-[#F7F5EF] border border-[#DEE5DB] flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#476652]" />
            <span className="font-mono font-semibold text-[#283C33]">
              {isZh ? `时间节点 ${activePoint.timestamp}` : `Timestamp ${activePoint.timestamp}`}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                activePoint.signalLevel === 'Elevated signals'
                  ? 'bg-[#F3DDD4] text-[#843B22]'
                  : activePoint.signalLevel === 'Signals rising'
                    ? 'bg-[#F8EAE2] text-[#7A442A]'
                    : 'bg-[#E6EFE8] text-[#2F523B]'
              }`}
            >
              {formatSignalLabel(activePoint.signalLevel)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-[11px] text-[#283C33]">
            <span className="inline-flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#283C33]" />
              <span>
                {isZh ? '综合指数:' : 'Composite:'} <strong>{activePoint.compositeStressIndex}</strong>/100
              </span>
            </span>

            <span className="inline-flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5 text-[#B85D3B]" />
              <span>
                {isZh ? '心率/变异性:' : 'HR/HRV:'}{' '}
                <strong>
                  {activePoint.bpm > 0
                    ? `${activePoint.bpm} ${isZh ? '次/分' : 'bpm'} · ${activePoint.hrvRmssdMs} ${
                        isZh ? '毫秒' : 'ms'
                      }`
                    : isZh
                      ? '未连接设备'
                      : 'Unconnected'}
                </strong>
              </span>
            </span>

            <span className="inline-flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-[#6C4F7D]" />
              <span>
                {isZh ? '面部张力:' : 'Facial:'} <strong>{activePoint.facialTensionScore}%</strong>
              </span>
            </span>

            <span className="inline-flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 text-[#C27D38]" />
              <span>
                {isZh ? '语音张力:' : 'Voice:'} <strong>{activePoint.voiceKeywordIntensity}%</strong>
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
