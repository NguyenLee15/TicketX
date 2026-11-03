import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Ticket,
  TrendingUp,
  Landmark,
  Percent,
  PlusCircle,
  AlertCircle,
  ChevronRight,
  DollarSign,
  Download,
  QrCode
} from 'lucide-react';
import { motion } from 'motion/react';
import api from '../../services/api';
import { exportOrganizerFinancialSummaryCsv } from '../../utils/csvExportUtils';
import type { OrganizerMetrics, OrganizerEvent, ApiResponse } from '../../types';

export default function OrganizerDashboardPage() {
  const [metrics, setMetrics] = useState<OrganizerMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);
        const [metricsRes, eventsRes] = await Promise.all([
          api.get<ApiResponse<OrganizerMetrics>>('/api/organizer/metrics'),
          api.get<ApiResponse<OrganizerEvent[]>>('/api/organizer/events'),
        ]);

        if (!isMounted) return;

        if (metricsRes.data?.success && metricsRes.data.data) {
          setMetrics(metricsRes.data.data);
        }
        if (eventsRes.data?.success && Array.isArray(eventsRes.data.data)) {
          setRecentEvents(eventsRes.data.data.slice(0, 5));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu bảng điều khiển';
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const handleExportFinancialReport = () => {
    if (!metrics || recentEvents.length === 0) return;
    exportOrganizerFinancialSummaryCsv(metrics, recentEvents);
  };

  if (isLoading) {
    return (
      <div 
        className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-pulse" 
        role="status" 
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Đang tải chỉ số doanh thu ban tổ chức...</span>
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-surface-2/60 rounded-xl" />
            <div className="h-4 w-96 bg-surface-2/40 rounded-lg" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-36 bg-surface-2/60 rounded-xl" />
            <div className="h-11 w-28 bg-surface-2/60 rounded-xl" />
          </div>
        </div>

        {/* 4 Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={`org-kpi-skel-${i}`} className="p-5 rounded-2xl bg-surface-1/80 border border-border-subtle h-36 flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-surface-2 rounded" />
                <div className="w-9 h-9 rounded-xl bg-surface-2" />
              </div>
              <div className="space-y-2">
                <div className="h-7 w-32 bg-surface-2 rounded-lg" />
                <div className="h-3 w-40 bg-surface-2/60 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden p-6 space-y-4">
          <div className="h-6 w-48 bg-surface-2 rounded-lg" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={`org-row-skel-${i}`} className="h-14 bg-surface-2/40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="text-sm font-medium">Lỗi kết nối: {error}</div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Tổng Doanh Thu',
      value: formatVnd(metrics?.totalGrossRevenue ?? 0),
      desc: 'Doanh số bán vé tích lũy',
      icon: TrendingUp,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Doanh số gộp'
    },
    {
      title: 'Thực Nhận (95%)',
      value: formatVnd(metrics?.totalNetRevenueEstimated ?? 0),
      desc: 'Sau khi khấu trừ phí sàn 5%',
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
      badge: 'Thực nhận'
    },
    {
      title: 'Phí Nền Tảng (5%)',
      value: formatVnd(metrics?.totalCommissionEstimated ?? 0),
      desc: 'Chi phí dịch vụ sàn TickeX',
      icon: Percent,
      color: 'text-text-secondary',
      bg: 'bg-surface-2',
      border: 'border-border-subtle',
      badge: 'Hoa hồng sàn'
    },
    {
      title: 'Tỷ Lệ Lấp Đầy',
      value: `${(metrics?.averageOccupancyRate ?? 0).toFixed(1)}%`,
      desc: `Đã bán ${metrics?.totalTicketsSold ?? 0} / ${metrics?.totalSeats ?? 0} vé (${metrics?.totalEvents ?? 0} sự kiện)`,
      icon: Ticket,
      color: 'text-brand-primary-light',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Công suất vé'
    },
    {
      title: 'Live Check-in',
      value: `${(metrics?.liveCheckInRate ?? 0).toFixed(1)}%`,
      desc: `Đã vào cửa ${metrics?.totalCheckedInTickets ?? 0} / ${metrics?.totalTicketsSold ?? 0} vé`,
      icon: QrCode,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      badge: 'Soát vé'
    }
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in text-text-primary">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
            Bảng Điều Khiển Ban Tổ Chức
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Tổng quan doanh thu bán vé, số lượng vé đã xuất và tỷ lệ lấp đầy sự kiện của bạn
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleExportFinancialReport}
            disabled={recentEvents.length === 0}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            aria-label="Xuất báo cáo tài chính định dạng CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span>Xuất Báo Cáo (CSV)</span>
          </button>
          <Link
            to="/organizer/events?create=true"
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>Tạo Sự Kiện Mới</span>
          </Link>
          <Link
            to="/organizer/settlements"
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-white font-medium text-sm rounded-xl border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Landmark className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            <span>Quyết Toán</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid with Staggered Motion */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5"
      >
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.title}
            variants={{
              hidden: { opacity: 0, y: 14 },
              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 26 } }
            }}
            className="p-5 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col justify-between hover:border-border-default/80 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 relative overflow-hidden group"
          >
            {/* Ambient top reflection */}
            <div className="pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/[0.02] blur-xl" aria-hidden="true" />

            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{kpi.title}</span>
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} border ${kpi.border} flex items-center justify-center`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 relative z-10">
              <div className={`text-2xl font-bold font-display tabular-nums ${kpi.title.includes('Thực Nhận') ? 'text-success' : 'text-white'}`}>
                {kpi.value}
              </div>
              <p className="text-xs text-text-tertiary mt-1">{kpi.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Events Performance Table */}
      <div className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden shadow-lg">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-display text-white">Sự Kiện Gần Đây</h2>
            <p className="text-xs text-text-secondary mt-0.5">Tiến độ tiêu thụ vé theo từng sự kiện thuộc quyền quản lý</p>
          </div>
          <Link
            to="/organizer/events"
            className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 transition-colors"
          >
            <span>Xem tất cả ({metrics?.totalEvents ?? 0})</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-12 text-center text-text-tertiary space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-text-tertiary/50" aria-hidden="true" />
            <p className="text-sm">Bạn chưa tạo sự kiện nào.</p>
            <Link
              to="/organizer/events?create=true"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Tạo Sự Kiện Đầu Tiên
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Bảng sự kiện gần đây">
              <thead className="bg-surface-2 text-text-tertiary text-xs uppercase font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3">Tên sự kiện</th>
                  <th scope="col" className="px-5 py-3">Thời gian & Địa điểm</th>
                  <th scope="col" className="px-5 py-3 text-center">Vé đã bán</th>
                  <th scope="col" className="px-5 py-3">Tỷ lệ lấp đầy</th>
                  <th scope="col" className="px-5 py-3">Live Check-in</th>
                  <th scope="col" className="px-5 py-3 text-right">Doanh thu gộp</th>
                  <th scope="col" className="px-5 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentEvents.map((evt) => {
                  const occupancy = evt.totalSeats > 0 ? (evt.soldTickets / evt.totalSeats) * 100 : 0;
                  const checkInCount = evt.checkedInTickets ?? 0;
                  const checkInRate = evt.soldTickets > 0 ? (checkInCount / evt.soldTickets) * 100 : 0;
                  return (
                    <tr key={evt.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-white max-w-xs truncate">
                        {evt.title}
                      </td>
                      <td className="px-5 py-4 text-xs text-text-secondary whitespace-nowrap">
                        <div>
                          {new Date(evt.date).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-text-tertiary truncate max-w-[200px]">
                          {evt.venueName} - {evt.location}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center tabular-nums font-medium text-white whitespace-nowrap">
                        {evt.soldTickets} / {evt.totalSeats}
                      </td>
                      <td className="px-5 py-4 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-text-tertiary">
                            <span className="tabular-nums font-semibold text-white">{occupancy.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className="h-full bg-brand-primary rounded-full transition-[width] duration-500 ease-out"
                              style={{ width: `${Math.min(occupancy, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-text-tertiary">
                            <span>{checkInCount} / {evt.soldTickets}</span>
                            <span className="font-semibold text-emerald-400 tabular-nums">
                              {checkInRate.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-[width] duration-500 ease-out"
                              style={{ width: `${Math.min(checkInRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-bold text-white whitespace-nowrap">
                        {formatVnd(evt.grossRevenue)}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <Link
                          to={`/organizer/settlements?eventId=${evt.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-brand-primary transition-colors border border-border-subtle"
                        >
                          <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Quyết toán</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
