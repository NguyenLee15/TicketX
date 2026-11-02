import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { adminRefundsPagedResponseSchema } from '../../schemas/adminSchemas';
import { createIdempotencyKey } from '../../utils/idempotency';

// Uses centralized adminRefundsPagedResponseSchema from adminSchemas.ts

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const refundStatusMap: Record<string, { label: string; className: string }> = {
  Pending: { label: 'Chờ xử lý', className: 'bg-surface-2 text-text-secondary border border-border-subtle' },
  Processing: { label: 'Đang xử lý', className: 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30' },
  Succeeded: { label: 'Thành công', className: 'bg-success/15 text-success border border-success/30' },
  Failed: { label: 'Thất bại', className: 'bg-danger/15 text-danger border border-danger/30' },
  NeedsReview: { label: 'Cần đối soát', className: 'bg-warning/15 text-warning border border-warning/30 font-semibold' },
};

export default function AdminRefundsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const setPage = (updater: number | ((prev: number) => number)) => {
    const nextPage = typeof updater === 'function' ? updater(page) : updater;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (nextPage > 1) {
        next.set('page', String(nextPage));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: true });
  };
  const [retrying, setRetrying] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const refundsQuery = useQuery({
    queryKey: ['admin', 'refunds', page],
    queryFn: async ({ signal }) => {
      const response = await api.get('/api/admin/refunds', { params: { page, pageSize: 25 }, signal });
      return adminRefundsPagedResponseSchema.parse(response.data.data);
    }
  });

  const retryRefund = async (id: string, expectedVersion?: string | null) => {
    setRetrying(id);
    try {
      await api.post(`/api/admin/refunds/${id}/retries`, null, {
        params: expectedVersion ? { expectedVersion } : undefined,
        headers: { 'Idempotency-Key': createIdempotencyKey() }
      });
      toast.success('Đã gửi yêu cầu đối soát và xử lý lại.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    } catch (error: unknown) {
      const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
      if (response?.status === 409) {
        toast.error('Yêu cầu hoàn tiền đã được xử lý bởi tác vụ khác. Đang làm mới dữ liệu...');
      } else {
        toast.error(response?.data?.message || 'PayOS chưa có trạng thái cuối để xử lý lại.');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    } finally { setRetrying(null); }
  };

  if (refundsQuery.isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Đang tải yêu cầu hoàn tiền" className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto animate-pulse">
        <span className="sr-only">Đang tải yêu cầu hoàn tiền...</span>
        <div className="h-24 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 space-y-4">
          <div className="h-10 bg-surface-2/60 rounded-xl" />
          {[...Array(5)].map((_, i) => (
            <div key={`refund-skel-${i}`} className="h-16 bg-surface-2/30 rounded-xl border border-border-subtle/50" />
          ))}
        </div>
      </div>
    );
  }

  if (refundsQuery.isError) {
    return (
      <section className="surface-panel m-6 p-6 text-center max-w-lg mx-auto">
        <p role="alert" className="mb-3 text-danger font-semibold">Không tải được danh sách hoàn tiền.</p>
        <button 
          type="button" 
          aria-label="Thử lại tải danh sách hoàn tiền" 
          className="min-h-11 rounded-xl bg-brand-primary px-5 py-2 text-white font-bold hover:bg-brand-primary/90 transition-[background-color,transform] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" 
          onClick={() => void refundsQuery.refetch()}
        >
          Thử lại
        </button>
      </section>
    );
  }

  const data = refundsQuery.data;
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in text-text-primary">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 w-fit mb-1.5 text-xs font-bold text-brand-primary">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Đối Soát & Xử Lý Hoàn Tiền
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">Hoàn Tiền Vé</h1>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">Theo dõi lệnh chi và xử lý các yêu cầu cần đối soát cổng thanh toán.</p>
        </div>
      </div>

      {/* Responsive Table View */}
      <div 
        role="region" 
        aria-label="Bảng yêu cầu hoàn tiền" 
        tabIndex={0} 
        className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1 shadow-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
      >
        <table aria-label="Danh sách yêu cầu hoàn tiền" className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-2/40 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th scope="col" className="p-3.5">Yêu cầu / Vé</th>
              <th scope="col" className="p-3.5 text-right">Số tiền</th>
              <th scope="col" className="p-3.5">Trạng thái</th>
              <th scope="col" className="p-3.5">PayOS</th>
              <th scope="col" className="p-3.5 text-right">Lần thử</th>
              <th scope="col" className="p-3.5">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/70">
            {data.items.map(refund => (
              <tr key={refund.id} className="hover:bg-surface-2/30 transition-colors align-top">
                <td className="p-3.5">
                  <div className="font-mono font-bold text-white text-xs">{refund.id.slice(0, 8)}</div>
                  <div className="text-xs text-text-secondary font-mono">Vé #{refund.ticketId.slice(0, 8)}</div>
                </td>
                <td className="whitespace-nowrap p-3.5 text-right tabular-nums font-mono font-bold text-white text-sm">
                  {money.format(refund.amount)}
                </td>
                <td className="p-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${refundStatusMap[refund.status]?.className || 'bg-surface-2 text-text-secondary'}`}>
                    {refundStatusMap[refund.status]?.label || refund.status}
                  </span>
                  {refund.lastError && (
                    <p className="mt-2 flex max-w-sm gap-1.5 text-xs text-warning">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{refund.lastError}</span>
                    </p>
                  )}
                </td>
                <td className="p-3.5 text-xs">
                  <span className="font-medium text-white">{refund.providerStatus ?? '—'}</span>
                  {refund.providerReference && (
                    <p className="mt-0.5 max-w-40 truncate text-[11px] text-text-secondary font-mono">{refund.providerReference}</p>
                  )}
                </td>
                <td className="p-3.5 text-right tabular-nums font-mono text-xs text-text-secondary">{refund.attempts}</td>
                <td className="p-3.5 whitespace-nowrap">
                  {refund.status === 'NeedsReview' && (
                    <button 
                      type="button" 
                      disabled={Boolean(retrying)} 
                      aria-busy={retrying === refund.id} 
                      aria-label={`Đối soát lại yêu cầu ${refund.id.slice(0, 8)}`} 
                      onClick={() => void retryRefund(refund.id, refund.version)} 
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-primary/40 bg-brand-primary/10 hover:bg-brand-primary/20 px-3 text-xs font-semibold text-brand-primary transition-[background-color,transform] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-60"
                    >
                      {retrying === refund.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>Đối soát / thử lại</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} role="status" className="p-10 text-center text-text-secondary text-xs sm:text-sm">
                  Chưa có yêu cầu hoàn tiền.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <nav aria-label="Phân trang yêu cầu hoàn tiền" className="flex items-center justify-between text-sm text-text-secondary">
        <span>{data.totalCount} yêu cầu · Trang {page}/{pages}</span>
        <div className="flex gap-2">
          <button 
            type="button" 
            aria-label="Trang trước" 
            disabled={page <= 1} 
            onClick={() => setPage(value => Math.max(1, value - 1))} 
            className="min-h-11 rounded-xl border border-border-subtle bg-surface-2 hover:bg-surface-3 active:scale-[0.98] px-4 text-white transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Trước
          </button>
          <button 
            type="button" 
            aria-label="Trang sau" 
            disabled={page >= pages} 
            onClick={() => setPage(value => Math.min(pages, value + 1))} 
            className="min-h-11 rounded-xl border border-border-subtle bg-surface-2 hover:bg-surface-3 active:scale-[0.98] px-4 text-white transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Sau
          </button>
        </div>
      </nav>
    </div>
  );
}
