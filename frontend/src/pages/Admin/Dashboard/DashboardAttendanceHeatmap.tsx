import { useState, useEffect } from 'react';
import { Users, Flame, Clock, BarChart2 } from 'lucide-react';
import api from '../../../services/api';
import type { EventAttendanceAnalytics, ApiResponse } from '../../../types';

interface DashboardAttendanceHeatmapProps {
  topEvents?: { id: string; title: string }[];
}

export function DashboardAttendanceHeatmap({ topEvents = [] }: DashboardAttendanceHeatmapProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [analytics, setAnalytics] = useState<EventAttendanceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (topEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(topEvents[0].id);
    }
  }, [topEvents, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    let isMounted = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        const res = await api.get<ApiResponse<EventAttendanceAnalytics>>(
          `/api/analytics/events/${selectedEventId}/attendance`
        );
        if (isMounted && res.data?.success && res.data.data) {
          setAnalytics(res.data.data);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [selectedEventId]);

  if (!topEvents.length) return null;

  return (
    <div className="surface-panel p-5 sm:p-6 space-y-5 rounded-2xl border border-border-subtle bg-surface-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-brand-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Phân Tích Soát Vé Ngoại Trường & Heatmap Lưu Lượng
            </h2>
            <p className="text-xs text-text-tertiary">
              Tỷ lệ có mặt thực tế (Show-up Rate) và mật độ qua cổng theo khung 15 phút
            </p>
          </div>
        </div>

        {/* Event Selector */}
        {topEvents.length > 1 && (
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
            aria-label="Chọn sự kiện để phân tích lưu lượng"
          >
            {topEvents.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-text-tertiary animate-pulse">
          Đang tính toán biểu đồ nhiệt soát vé...
        </div>
      ) : !analytics ? (
        <div className="h-24 flex items-center justify-center text-xs text-text-tertiary">
          Chưa có dữ liệu soát vé cho sự kiện này.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 2 Metric Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Show-up Rate */}
            <div className="p-4 rounded-xl bg-surface-2/60 border border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase text-text-tertiary block">
                  Tỷ Lệ Có Mặt Thực Tế (Show-up Rate)
                </span>
                <div className="text-2xl font-bold font-display text-white mt-1 tabular-nums">
                  {analytics.showUpRate.toFixed(1)}%
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  Đã vào cổng: <strong className="text-white">{analytics.totalCheckedIn}</strong> / {analytics.totalTicketsSold} vé đã bán
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>

            {/* Peak Hour */}
            <div className="p-4 rounded-xl bg-surface-2/60 border border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase text-text-tertiary block">
                  Đỉnh Điểm Lưu Lượng Vào Cổng
                </span>
                <div className="text-lg font-bold font-display text-warning mt-1 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-warning" aria-hidden="true" />
                  <span>{analytics.peakInterval}</span>
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  Lưu lượng cao nhất: <strong className="text-white">{analytics.peakScanCount}</strong> lượt quét / 15 phút
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
                <Clock className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* 15-Minute Heatmap Bars */}
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
              Biểu Đồ Mật Độ Quét Vé 15 Phút (Check-in Heatmap)
            </span>

            <div className="space-y-2">
              {analytics.heatmapBuckets.map((b) => {
                const isPeak = b.scanCount > 0 && b.scanCount === analytics.peakScanCount;
                return (
                  <div key={b.timeLabel} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`font-mono ${isPeak ? 'text-warning font-bold' : 'text-text-secondary'}`}>
                        {b.timeLabel} {isPeak && '🔥 [Đỉnh điểm]'}
                      </span>
                      <span className="tabular-nums font-semibold text-white">
                        {b.scanCount} lượt ({b.percentageOfCheckedIn.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isPeak ? 'bg-warning shadow-sm shadow-warning/50' : 'bg-brand-primary'
                        }`}
                        style={{
                          width: `${Math.min(
                            analytics.peakScanCount > 0 ? (b.scanCount / analytics.peakScanCount) * 100 : 0,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
