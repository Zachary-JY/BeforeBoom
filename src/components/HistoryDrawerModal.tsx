import React, { useState } from 'react';
import {
  Activity,
  BookmarkPlus,
  Calendar,
  CheckCircle2,
  Clock,
  HeartPulse,
  History,
  Sparkles,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { Locale } from '../lib/i18n';
import { HistoricalSessionRecord } from '../types/session';
import { MultimodalTimelineChart } from './MultimodalTimelineChart';

interface HistoryDrawerModalProps {
  isOpen: boolean;
  locale: Locale;
  records: HistoricalSessionRecord[];
  onClose: () => void;
  onSaveCurrentSnapshot: () => void;
  onDeleteRecord: (id: string) => void;
  onResetDefaultHistory: () => void;
}

export const HistoryDrawerModal: React.FC<HistoryDrawerModalProps> = ({
  isOpen,
  locale,
  records,
  onClose,
  onSaveCurrentSnapshot,
  onDeleteRecord,
  onResetDefaultHistory,
}) => {
  const [selectedId, setSelectedId] = useState<string>(records[0]?.id || '');
  const [justSavedToast, setJustSavedToast] = useState<boolean>(false);

  if (!isOpen) return null;

  const isZh = locale === 'zh';
  const activeRecord =
    records.find((r) => r.id === selectedId) || records[0] || null;

  // Cross-session analytics
  const totalSessions = records.length;
  const avgStressDrop =
    totalSessions > 0
      ? Math.round(
          records.reduce(
            (acc, r) =>
              acc + Math.max(0, r.peakCompositeStress - r.finalCompositeStress),
            0
          ) / totalSessions
        )
      : 0;

  const validHrvRecords = records.filter((r) => r.finalHrvMs > 0 && r.minHrvMs > 0);
  const avgHrvRecovery =
    validHrvRecords.length > 0
      ? Math.round(
          validHrvRecords.reduce(
            (acc, r) => acc + Math.max(0, r.finalHrvMs - r.minHrvMs),
            0
          ) / validHrvRecords.length
        )
      : 16;

  const formatActivity = (r: HistoricalSessionRecord) => {
    if (r.activity === 'Custom') {
      return isZh
        ? r.customActivityZh || '自定义事项'
        : r.customActivityEn || 'Custom';
    }
    if (isZh) {
      return r.activity === 'Study' ? '学习' : '工作';
    }
    return r.activity;
  };

  const formatSupportMode = (mode?: HistoricalSessionRecord['supportUsed']) => {
    if (!mode) return isZh ? '安静观察' : 'Quiet Observation';
    if (isZh) {
      if (mode === 'Listen') return '倾听梳理';
      if (mode === 'Regulate') return '呼吸与一分钟解压';
      return '二十分钟微步规划';
    }
    return mode;
  };

  const formatFeedback = (fb?: HistoricalSessionRecord['verificationFeedback']) => {
    if (!fb) return isZh ? '已完成观察' : 'Observed';
    if (isZh) {
      if (fb === 'Better') return '好转了一些';
      if (fb === 'Same') return '差不多';
      return '更紧绷了';
    }
    return fb;
  };

  const handleSaveSnapshotClick = () => {
    onSaveCurrentSnapshot();
    setJustSavedToast(true);
    window.setTimeout(() => setJustSavedToast(false), 2500);
  };

  return (
    <div
      data-testid="history-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#1B2A22]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        data-testid="history-modal"
        className="w-full max-w-[1040px] max-h-[90vh] bg-[#F7F5EF] border border-[#DEE5DB] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Modal Header */}
        <div className="px-5 sm:px-7 py-4 bg-[#FFFEFA] border-b border-[#DEE5DB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6EFE8] text-[#2F523B] flex items-center justify-center border border-[#C5D6C8]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-[#283C33]">
                {isZh
                  ? '多模态观察历史记录与个人趋势档案'
                  : 'Multimodal Observation History & Personal Trends'}
              </h2>
              <p className="text-xs text-[#617068]">
                {isZh
                  ? '回顾以往每次观察的心率变异性、面部微表情与压力缓解轨迹，了解什么支持方式最适合你'
                  : 'Review past heart rate variability, facial tension, and stress relief trajectories across sessions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="save-current-to-history-btn"
              onClick={handleSaveSnapshotClick}
              className="px-3.5 py-2 rounded-xl bg-[#476652] hover:bg-[#3A5443] text-[#FFFEFA] text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>
                {justSavedToast
                  ? isZh
                    ? '已保存当前会话记录 ✓'
                    : 'Saved current session ✓'
                  : isZh
                    ? '将当前观察存入历史记录'
                    : 'Save current session to history'}
              </span>
            </button>

            <button
              type="button"
              data-testid="close-history-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#F7F5EF] hover:bg-[#EFECE4] text-[#283C33] border border-[#DEE5DB] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* 1. Aggregate Historical Insights KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-1">
              <div className="text-[11px] text-[#617068] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#476652]" />
                <span>{isZh ? '累计观察记录' : 'Total Sessions'}</span>
              </div>
              <div className="font-mono text-xl font-semibold text-[#283C33]">
                {totalSessions} {isZh ? '次' : 'sessions'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-1">
              <div className="text-[11px] text-[#617068] flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-[#2F6B48]" />
                <span>{isZh ? '干预后平均压力下降' : 'Avg Stress Drop'}</span>
              </div>
              <div className="font-mono text-xl font-semibold text-[#2F6B48]">
                -{avgStressDrop} {isZh ? '分' : 'pts'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-1">
              <div className="text-[11px] text-[#617068] flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-[#B85D3B]" />
                <span>{isZh ? '平均心率变异性回升' : 'Avg HRV Recovery'}</span>
              </div>
              <div className="font-mono text-xl font-semibold text-[#283C33]">
                +{avgHrvRecovery} {isZh ? '毫秒' : 'ms'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-1">
              <div className="text-[11px] text-[#617068] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#476652]" />
                <span>{isZh ? '最常奏效支持方式' : 'Most Helpful Mode'}</span>
              </div>
              <div className="text-sm font-semibold text-[#283C33] pt-0.5 truncate">
                {isZh ? '呼吸解压与微步规划' : 'Regulate & Micro-Plan'}
              </div>
            </div>
          </div>

          {/* 2. Cross-Session Peak vs. Settled Comparison Bar Chart */}
          {records.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#283C33]">
                  <Activity className="w-3.5 h-3.5 text-[#476652]" />
                  <span>
                    {isZh
                      ? '历次观察「峰值压力指数 vs. 干预后恢复指数」对比图（点击柱状条可切换下方详情）'
                      : 'Cross-Session Peak Stress vs. Post-Support Settled Index'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#617068]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D88B68]" />
                    <span>{isZh ? '观察期峰值压力' : 'Peak Stress'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#476652]" />
                    <span>{isZh ? '支持干预后状态' : 'Post-Support State'}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                {records.slice(0, 6).map((rec) => {
                  const isSelected = activeRecord?.id === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedId(rec.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E6EFE8]/70 border-[#476652] shadow-2xs'
                          : 'bg-[#F7F5EF] border-[#E5E9E2] hover:border-[#B8C7BC]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#617068] font-mono mb-1.5">
                        <span>{rec.recordedAt.slice(5)}</span>
                        <span>{isZh ? rec.personaNameZh : rec.personaNameEn}</span>
                      </div>

                      {/* Dual Progress Bars */}
                      <div className="space-y-1">
                        <div className="w-full h-2 rounded-full bg-[#EFECE4] overflow-hidden">
                          <div
                            className="h-full bg-[#D88B68] rounded-full"
                            style={{ width: `${rec.peakCompositeStress}%` }}
                          />
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#EFECE4] overflow-hidden">
                          <div
                            className="h-full bg-[#476652] rounded-full"
                            style={{ width: `${rec.finalCompositeStress}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-[#843B22]">
                          {isZh ? '峰' : 'Pk'} {rec.peakCompositeStress}
                        </span>
                        <span className="text-[#2F523B] font-semibold">
                          → {rec.finalCompositeStress}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Master-Detail Split: Left Session List + Right Multimodal Trajectory Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Historical Sessions List */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#617068]">
                  {isZh ? '全部历史会话记录' : 'All Recorded Sessions'} ({records.length})
                </span>
                <button
                  type="button"
                  onClick={onResetDefaultHistory}
                  className="text-[11px] text-[#617068] hover:text-[#283C33] underline cursor-pointer"
                >
                  {isZh ? '恢复默认示例记录' : 'Reset sample records'}
                </button>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {records.map((rec) => {
                  const selected = activeRecord?.id === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-testid={`history-record-item-${rec.id}`}
                      onClick={() => setSelectedId(rec.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#FFFEFA] border-[#476652] ring-2 ring-[#476652]/15 shadow-xs'
                          : 'bg-[#FFFEFA]/80 border-[#DEE5DB] hover:border-[#7F9B87]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#283C33]">
                              {isZh ? rec.personaNameZh : rec.personaNameEn}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#E6EFE8] text-[#2F523B] font-medium">
                              {formatActivity(rec)}
                            </span>
                            <span className="text-[11px] font-mono text-[#617068] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {rec.recordedAt}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#283C33] line-clamp-1">
                            {isZh ? rec.taskZh : rec.taskEn}
                          </p>
                        </div>

                        {records.length > 1 && (
                          <button
                            type="button"
                            title={isZh ? '删除此条记录' : 'Delete record'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRecord(rec.id);
                            }}
                            className="p-1 rounded-lg text-[#8C9A92] hover:text-[#843B22] hover:bg-[#F8EAE2] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#ECEFE9] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="font-mono text-[#617068]">
                          {rec.peakBpm > 0 ? (
                            <span>
                              {isZh ? '峰值心率' : 'Peak HR'} {rec.peakBpm} → {rec.finalBpm || rec.peakBpm}{' '}
                              {isZh ? '次/分' : 'bpm'}
                            </span>
                          ) : (
                            <span>
                              {isZh ? '综合压力' : 'Stress'} {rec.peakCompositeStress} →{' '}
                              {rec.finalCompositeStress}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#F7F5EF] border border-[#DEE5DB] text-[#283C33] font-medium">
                            {formatSupportMode(rec.supportUsed)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#E6EFE8] text-[#2F523B] font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {formatFeedback(rec.verificationFeedback)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Historical Session Detail & Multimodal Chart */}
            <div className="lg:col-span-7 space-y-4">
              {activeRecord && (
                <>
                  <div className="p-5 rounded-2xl bg-[#FFFEFA] border border-[#DEE5DB] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono text-[#617068]">
                          {activeRecord.recordedAt} · {formatActivity(activeRecord)} ·{' '}
                          {activeRecord.durationMinutes} {isZh ? '分钟观察窗口' : 'min window'}
                        </span>
                        <h3 className="font-serif text-lg font-semibold text-[#283C33] mt-0.5">
                          {isZh ? activeRecord.taskZh : activeRecord.taskEn}
                        </h3>
                      </div>

                      <div className="px-3 py-1 rounded-xl bg-[#E6EFE8] text-[#2F523B] text-xs font-medium">
                        {formatSupportMode(activeRecord.supportUsed)} ·{' '}
                        {formatFeedback(activeRecord.verificationFeedback)}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#4A5A51] leading-relaxed bg-[#F7F5EF] p-3.5 rounded-xl border border-[#E5E9E2]">
                      {isZh ? activeRecord.summaryZh : activeRecord.summaryEn}
                    </p>

                    <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                        <span className="block text-[10px] text-[#617068]">
                          {isZh ? '心率变化轨迹' : 'Heart Rate Shift'}
                        </span>
                        <strong className="text-[#283C33]">
                          {activeRecord.peakBpm > 0
                            ? `${activeRecord.peakBpm} → ${activeRecord.finalBpm || activeRecord.peakBpm} ${
                                isZh ? '次/分' : 'bpm'
                              }`
                            : isZh
                              ? '未连接穿戴设备'
                              : 'Unconnected'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                        <span className="block text-[10px] text-[#617068]">
                          {isZh ? '心率变异性恢复' : 'HRV Resilience'}
                        </span>
                        <strong className="text-[#2F6B48]">
                          {activeRecord.minHrvMs > 0
                            ? `${activeRecord.minHrvMs} → ${activeRecord.finalHrvMs || activeRecord.minHrvMs} ${
                                isZh ? '毫秒' : 'ms'
                              }`
                            : '--'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F5EF] border border-[#E5E9E2]">
                        <span className="block text-[10px] text-[#617068]">
                          {isZh ? '综合压力指数变化' : 'Composite Stress'}
                        </span>
                        <strong className="text-[#283C33]">
                          {activeRecord.peakCompositeStress} → {activeRecord.finalCompositeStress} / 100
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Full Multimodal Timeline Chart for this historical session */}
                  <MultimodalTimelineChart
                    locale={locale}
                    timeline={activeRecord.timeline}
                    compact
                    title={
                      isZh
                        ? `「${activeRecord.recordedAt}」多模态状态变化曲线回放`
                        : `Multimodal Trajectory Replay (${activeRecord.recordedAt})`
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
