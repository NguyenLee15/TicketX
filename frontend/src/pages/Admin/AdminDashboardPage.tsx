import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { Stats } from './Dashboard/types';
import { adminDashboardStatsSchema } from '../../schemas/adminSchemas';
import { DashboardKpiGrid } from './Dashboard/DashboardKpiGrid';
import { DashboardRevenueChart } from './Dashboard/DashboardRevenueChart';
import { DashboardAttendanceHeatmap } from './Dashboard/DashboardAttendanceHeatmap';
import { DashboardTopEvents } from './Dashboard/DashboardTopEvents';
import { DashboardRecentTransactions } from './Dashboard/DashboardRecentTransactions';
import { AdminDashboardEmptyState } from './Dashboard/AdminDashboardEmptyState';

function isDashboardEmpty(stats: Stats): boolean {
  return stats.dailyStats.length === 0
    && stats.topEvents.length === 0
    && stats.recentTransactions.length === 0
    && stats.totalRevenue === 0
    && stats.totalTicketsSold === 0
    && stats.totalRefunded === 0;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const hasLoadedStatsRef = useRef(false);

  const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  const fetchStats = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      if (!hasLoadedStatsRef.current) setLoading(true);
      else setIsRefreshing(true);
      setError(false);
      const response = await api.get('/api/admin/stats', { signal: controller.signal });
      if (response.data?.success) {
        const parsed = adminDashboardStatsSchema.safeParse(response.data.data);
        if (parsed.success) {
          setStats(parsed.data as Stats);
          hasLoadedStatsRef.current = true;
          setLastUpdated(new Date());
        } else {
          setError(true);
          toast.error('Dữ liệu thống kê bảng điều khiển không đúng định dạng.');
        }
      } else {
        setError(true);
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return;
      setError(true);
      toast.error('Không thể tải dữ liệu thống kê bảng điều khiển');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
    return () => requestRef.current?.abort();
  }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchStats();
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStats]);

  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-label="Đang tải dữ liệu bảng điều khiển" className="space-y-6 pb-8 animate-pulse max-w-7xl mx-auto">
        <span className="sr-only">Đang tải dữ liệu bảng điều khiển...</span>
        <div className="h-24 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={`dash-skel-${i}`} className="h-32 bg-surface-2/40 rounded-2xl border border-border-subtle" />
          ))}
        </div>
        <div className="h-64 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-80 bg-surface-2/40 rounded-2xl border border-border-subtle" />
          <div className="lg:col-span-6 h-80 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div role="alert" className="surface-panel min-h-[40vh] flex flex-col items-center justify-center gap-4 p-8 text-center mt-6 max-w-4xl mx-auto">
        <p className="text-text-secondary">{error ? 'Không thể tải dữ liệu quản trị.' : 'Chưa có dữ liệu quản trị.'}</p>
        <button type="button" aria-label="Thử lại tải dữ liệu bảng điều khiển" onClick={fetchStats} className="min-h-11 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 active:scale-[0.98] transition-[background-color,transform] text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer">Thử lại</button>
      </div>
    );
  }

  if (isDashboardEmpty(stats)) {
    return <AdminDashboardEmptyState onRefresh={fetchStats} isRefreshing={isRefreshing} />;
  }

  return (
    <div className="space-y-6 pb-8 text-text-primary animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 w-fit mb-1.5 text-xs font-bold text-brand-primary">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            Bảng Điều Khiển Quản Trị Hệ Thống
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Tổng Quan Doanh Thu & Soát Vé
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Tổng tiền vé đã thanh toán, tiền đã hoàn và hoạt động soát vé từ hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-tertiary bg-surface-2 px-3 py-1.5 rounded-xl border border-border-subtle tabular-nums">
          <Clock className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
          <span aria-live="polite">Cập nhật: {lastUpdated ? dateTimeFormatter.format(lastUpdated) : '—'}</span>
          <button type="button" onClick={fetchStats} disabled={isRefreshing} aria-busy={isRefreshing} aria-label="Làm mới dữ liệu bảng điều khiển" className="min-w-11 min-h-11 p-2 inline-flex items-center justify-center rounded-xl hover:bg-surface-3 active:scale-[0.96] transition-[background-color,color,transform] text-text-secondary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      
      {/* KPI Cards Grid */}
      <DashboardKpiGrid stats={stats} />

      {/* 7-Day Revenue Chart Section */}
      <DashboardRevenueChart dailyStats={stats.dailyStats || []} />

      {/* Attendance & Heatmap Analytics */}
      <DashboardAttendanceHeatmap topEvents={stats.topEvents} />

      {/* Analytics & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <DashboardTopEvents topEvents={stats.topEvents} />
        <DashboardRecentTransactions recentTransactions={stats.recentTransactions} />
      </div>
    </div>
  );
}
