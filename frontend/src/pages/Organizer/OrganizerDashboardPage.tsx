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
  Loader2,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';
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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3" role="status" aria-busy="true">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" />
        <span className="text-sm text-text-secondary">Đang tải chỉ số doanh thu ban tổ chức...</span>
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in">
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
        <div className="flex items-center gap-3">
          <Link
            to="/organizer/events?create=true"
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>Tạo Sự Kiện Mới</span>
          </Link>
          <Link
            to="/organizer/settlements"
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-white font-medium text-sm rounded-xl border border-border-subtle transition-colors"
          >
            <Landmark className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            <span>Quyết Toán</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Doanh thu tổng */}
        <div className="p-5 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Tổng Doanh Thu</span>
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-display text-white tabular-nums">
              {formatVnd(metrics?.totalGrossRevenue ?? 0)}
            </div>
            <p className="text-xs text-text-tertiary mt-1">Doanh số bán vé tích lũy</p>
          </div>
        </div>

        {/* Thực nhận ước tính */}
        <div className="p-5 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Thực Nhận (95%)</span>
            <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-success" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-display text-success tabular-nums">
              {formatVnd(metrics?.totalNetRevenueEstimated ?? 0)}
            </div>
            <p className="text-xs text-text-tertiary mt-1">Sau khi khấu trừ phí sàn 5%</p>
          </div>
        </div>

        {/* Phí sàn */}
        <div className="p-5 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Phí Nền Tảng (5%)</span>
            <div className="w-9 h-9 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center">
              <Percent className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-display text-text-secondary tabular-nums">
              {formatVnd(metrics?.totalCommissionEstimated ?? 0)}
            </div>
            <p className="text-xs text-text-tertiary mt-1">Chi phí dịch vụ sàn TickeX</p>
          </div>
        </div>

        {/* Tỷ lệ lấp đầy & Vé */}
        <div className="p-5 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Tỷ Lệ Lấp Đầy</span>
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-display text-white tabular-nums">
              {(metrics?.averageOccupancyRate ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              Đã bán {metrics?.totalTicketsSold ?? 0} / {metrics?.totalSeats ?? 0} vé ({metrics?.totalEvents ?? 0} sự kiện)
            </p>
          </div>
        </div>
      </div>

      {/* Events Performance Table */}
      <div className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary/90"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Tạo sự kiện đầu tiên
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Bảng hiệu suất sự kiện">
              <thead className="bg-surface-2 text-text-tertiary text-xs uppercase font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3">Sự kiện</th>
                  <th scope="col" className="px-5 py-3">Thời gian</th>
                  <th scope="col" className="px-5 py-3 text-right">Vé đã bán</th>
                  <th scope="col" className="px-5 py-3 text-right">Tỷ lệ lấp đầy</th>
                  <th scope="col" className="px-5 py-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentEvents.map((evt) => {
                  const occupancy = evt.totalSeats > 0 ? (evt.soldTickets / evt.totalSeats) * 100 : 0;
                  return (
                    <tr key={evt.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-white max-w-xs truncate">
                        <div className="font-semibold">{evt.title}</div>
                        <div className="text-xs text-text-tertiary truncate">{evt.venueName} - {evt.location}</div>
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-xs whitespace-nowrap">
                        {new Date(evt.date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-4 text-right text-text-primary tabular-nums whitespace-nowrap font-medium">
                        {evt.soldTickets} / {evt.totalSeats}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-16 h-2 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className="h-full bg-brand-primary rounded-full transition-all"
                              style={{ width: `${Math.min(occupancy, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary tabular-nums w-10 text-right font-medium">
                            {occupancy.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-white tabular-nums whitespace-nowrap">
                        {formatVnd(evt.grossRevenue)}
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
