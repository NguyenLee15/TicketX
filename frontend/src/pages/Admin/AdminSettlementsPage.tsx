import { useState, useEffect, useRef } from 'react';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Check,
  Send,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useModalAccessibility } from '../../components/Admin/useModalAccessibility';
import type { SettlementItem, ApiResponse } from '../../types';

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');

  // Action Modals State
  const [activeItem, setActiveItem] = useState<SettlementItem | null>(null);
  const [actionType, setActionType] = useState<'complete' | 'reject' | null>(null);
  const [bankRef, setBankRef] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(!!actionType, false, () => setActionType(null), modalRef);

  const loadSettlements = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<ApiResponse<SettlementItem[]>>('/api/settlements');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setSettlements(res.data.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách quyết toán';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, []);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Xác nhận phê duyệt yêu cầu quyết toán này?')) return;
    try {
      setIsActionLoading(true);
      const res = await api.post<ApiResponse<string>>(`/api/settlements/${id}/approve`, {
        adminNote: 'Đã phê duyệt đối soát doanh thu bởi Admin',
      });
      if (res.data?.success) {
        await loadSettlements();
      } else {
        alert(res.data?.message || 'Không thể phê duyệt.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống khi phê duyệt.';
      alert(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !actionType) return;
    setActionError(null);

    try {
      setIsActionLoading(true);
      if (actionType === 'complete') {
        if (!bankRef.trim()) {
          setActionError('Vui lòng nhập Mã tham chiếu chuyển khoản ngân hàng.');
          return;
        }
        const res = await api.post<ApiResponse<string>>(`/api/settlements/${activeItem.id}/complete`, {
          bankTransactionReference: bankRef.trim(),
          adminNote: adminNote.trim() || undefined,
        });
        if (res.data?.success) {
          setActionType(null);
          setActiveItem(null);
          setBankRef('');
          setAdminNote('');
          await loadSettlements();
        } else {
          setActionError(res.data?.message || 'Không thể hoàn tất quyết toán.');
        }
      } else if (actionType === 'reject') {
        if (!adminNote.trim()) {
          setActionError('Vui lòng nêu rõ lý do từ chối quyết toán.');
          return;
        }
        const res = await api.post<ApiResponse<string>>(`/api/settlements/${activeItem.id}/reject`, {
          reason: adminNote.trim(),
        });
        if (res.data?.success) {
          setActionType(null);
          setActiveItem(null);
          setAdminNote('');
          await loadSettlements();
        } else {
          setActionError(res.data?.message || 'Không thể từ chối quyết toán.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống khi xử lý.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filtered = settlements.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const renderStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>Chờ duyệt</span>
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>Đã duyệt</span>
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            <span>Hoàn tất</span>
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
            <XCircle className="w-3 h-3" aria-hidden="true" />
            <span>Từ chối</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
            Quản Lý Quyết Toán Doanh Thu Sàn
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Đối soát doanh thu, khấu trừ phí nền tảng 5% và phê duyệt chi trả cho các Ban Tổ Chức
          </p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`min-h-9 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            statusFilter === 'all'
              ? 'bg-brand-primary text-white shadow-sm shadow-brand-glow'
              : 'bg-surface-1 hover:bg-surface-2 text-text-secondary border border-border-subtle'
          }`}
        >
          Tất cả ({settlements.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(1)}
          className={`min-h-9 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            statusFilter === 1
              ? 'bg-warning text-black shadow-sm'
              : 'bg-surface-1 hover:bg-surface-2 text-text-secondary border border-border-subtle'
          }`}
        >
          Chờ duyệt ({settlements.filter((s) => s.status === 1).length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(2)}
          className={`min-h-9 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            statusFilter === 2
              ? 'bg-brand-primary text-white shadow-sm'
              : 'bg-surface-1 hover:bg-surface-2 text-text-secondary border border-border-subtle'
          }`}
        >
          Đã duyệt ({settlements.filter((s) => s.status === 2).length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(3)}
          className={`min-h-9 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            statusFilter === 3
              ? 'bg-success text-white shadow-sm'
              : 'bg-surface-1 hover:bg-surface-2 text-text-secondary border border-border-subtle'
          }`}
        >
          Đã hoàn tất ({settlements.filter((s) => s.status === 3).length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(4)}
          className={`min-h-9 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            statusFilter === 4
              ? 'bg-danger text-white shadow-sm'
              : 'bg-surface-1 hover:bg-surface-2 text-text-secondary border border-border-subtle'
          }`}
        >
          Bị từ chối ({settlements.filter((s) => s.status === 4).length})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3" role="status" aria-busy="true">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" />
          <span className="text-sm text-text-secondary">Đang tải danh sách quyết toán...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-surface-1 border border-border-subtle space-y-3">
          <Landmark className="w-12 h-12 mx-auto text-text-tertiary/40" aria-hidden="true" />
          <p className="text-sm text-text-tertiary">Không có yêu cầu quyết toán nào trong mục này.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Bảng quản lý quyết toán admin">
              <thead className="bg-surface-2 text-text-tertiary text-xs uppercase font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3">Ban Tổ Chức & Sự Kiện</th>
                  <th scope="col" className="px-5 py-3 text-right">Doanh thu gộp</th>
                  <th scope="col" className="px-5 py-3 text-right">Phí sàn (5%)</th>
                  <th scope="col" className="px-5 py-3 text-right">Hoàn tiền</th>
                  <th scope="col" className="px-5 py-3 text-right">Thực chi</th>
                  <th scope="col" className="px-5 py-3">Tài khoản thụ hưởng</th>
                  <th scope="col" className="px-5 py-3 text-center">Trạng thái</th>
                  <th scope="col" className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-4 max-w-xs">
                      <div className="font-semibold text-white truncate">{item.organizerName}</div>
                      <div className="text-xs text-text-secondary truncate">{item.eventTitle}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">
                        {new Date(item.requestedAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-text-secondary whitespace-nowrap">
                      {formatVnd(item.grossRevenue)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-text-tertiary whitespace-nowrap">
                      {formatVnd(item.commissionAmount)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-danger whitespace-nowrap">
                      {item.refundDeduction > 0 ? `- ${formatVnd(item.refundDeduction)}` : '0 ₫'}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums font-bold text-success whitespace-nowrap text-base">
                      {formatVnd(item.netPayout)}
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap">
                      <div className="font-medium text-white">{item.bankName}</div>
                      <div className="text-text-tertiary font-mono">{item.bankAccountNumber}</div>
                      <div className="text-text-secondary uppercase">{item.accountHolder}</div>
                      {item.adminNote && (
                        <div className="text-[11px] text-danger mt-0.5">{item.adminNote}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {item.status === 1 && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(item.id)}
                            disabled={isActionLoading}
                            className="min-h-8 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Duyệt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveItem(item);
                              setActionType('reject');
                            }}
                            disabled={isActionLoading}
                            className="min-h-8 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 text-xs font-semibold transition-colors"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      )}
                      {item.status === 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItem(item);
                            setActionType('complete');
                          }}
                          disabled={isActionLoading}
                          className="min-h-8 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Chi tiền</span>
                        </button>
                      )}
                      {item.status === 3 && (
                        <span className="text-xs text-text-tertiary font-mono">Đã đối soát</span>
                      )}
                      {item.status === 4 && (
                        <span className="text-xs text-danger font-mono">Đã đóng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Xử Lý: Chi Tiền hoặc Từ Chối */}
      {actionType && activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-action-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-1/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            ref={modalRef}
            className="w-full max-w-md bg-surface-1 border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-modal-pop"
          >
            <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <h2 id="modal-action-title" className="text-base font-bold font-display text-white">
                {actionType === 'complete' ? 'Xác Nhận Đã Chuyển Khoản' : 'Từ Chối Quyết Toán'}
              </h2>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="min-h-9 min-w-9 p-1.5 rounded-lg text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs">
                  {actionError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle text-xs space-y-1">
                <div>Ban tổ chức: <strong className="text-white">{activeItem.organizerName}</strong></div>
                <div>Số tiền thực nhận: <strong className="text-success text-sm">{formatVnd(activeItem.netPayout)}</strong></div>
                <div>Số tài khoản: <strong className="text-white font-mono">{activeItem.bankName} - {activeItem.bankAccountNumber}</strong></div>
              </div>

              {actionType === 'complete' ? (
                <div className="space-y-1">
                  <label htmlFor="modal-bank-ref" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Mã Giao Dịch Chuyển Khoản Ngân Hàng <span className="text-danger">*</span>
                  </label>
                  <input
                    id="modal-bank-ref"
                    type="text"
                    required
                    placeholder="FT261103001882..."
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label htmlFor="modal-reject-note" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Lý do từ chối quyết toán <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="modal-reject-note"
                    rows={3}
                    required
                    placeholder="Sai lệch số tài khoản, chưa hết thời hạn khiếu nại vé..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="min-h-10 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className={`min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs transition-colors ${
                    actionType === 'complete'
                      ? 'bg-success hover:bg-success/90'
                      : 'bg-danger hover:bg-danger/90'
                  }`}
                >
                  {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{actionType === 'complete' ? 'Xác Nhận Hoàn Tất' : 'Xác Nhận Từ Chối'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
