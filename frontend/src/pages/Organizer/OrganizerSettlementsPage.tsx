import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Landmark,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Building,
  User,
  Info
} from 'lucide-react';
import api from '../../services/api';
import { useModalAccessibility } from '../../components/Admin/useModalAccessibility';
import type { SettlementItem, OrganizerEvent, ApiResponse } from '../../types';

export default function OrganizerSettlementsPage() {
  const [searchParams] = useSearchParams();
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isModalOpen, false, () => setIsModalOpen(false), modalRef);

  // Form Fields
  const [selectedEventId, setSelectedEventId] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [settleRes, eventsRes] = await Promise.all([
        api.get<ApiResponse<SettlementItem[]>>('/api/settlements'),
        api.get<ApiResponse<OrganizerEvent[]>>('/api/organizer/events'),
      ]);

      if (settleRes.data?.success && Array.isArray(settleRes.data.data)) {
        setSettlements(settleRes.data.data);
      }
      if (eventsRes.data?.success && Array.isArray(eventsRes.data.data)) {
        setEvents(eventsRes.data.data);
        if (eventsRes.data.data.length > 0 && !selectedEventId) {
          const preselect = searchParams.get('eventId');
          const found = eventsRes.data.data.find((e) => e.id === preselect);
          setSelectedEventId(found ? found.id : eventsRes.data.data[0].id);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu quyết toán';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchParams.get('eventId')) {
      setSelectedEventId(searchParams.get('eventId')!);
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const handleRequestSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedEventId || !bankName.trim() || !bankAccountNumber.trim() || !accountHolder.trim()) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        eventId: selectedEventId,
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountHolder: accountHolder.trim().toUpperCase(),
      };

      const res = await api.post<ApiResponse<string>>('/api/settlements/request', payload);
      if (res.data?.success) {
        setFormSuccess('Yêu cầu quyết toán đã được gửi tới Ban Quản Trị TickeX phê duyệt!');
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(null);
          loadData();
        }, 1200);
      } else {
        setFormError(res.data?.message || 'Không thể gửi yêu cầu quyết toán.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống khi gửi yêu cầu quyết toán.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const renderStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Chờ phê duyệt</span>
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đã duyệt (Chờ chuyển tiền)</span>
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đã hoàn tất</span>
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Từ chối</span>
          </span>
        );
      default:
        return <span className="text-xs text-text-tertiary">Không xác định</span>;
    }
  };

  const selectedEventObj = events.find((e) => e.id === selectedEventId);
  const estimatedGross = selectedEventObj?.grossRevenue || 0;
  const estimatedCommission = estimatedGross * 0.05;
  const estimatedNet = estimatedGross - estimatedCommission;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
            Quyết Toán & Đối Soát Doanh Thu
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Minh bạch dòng tiền: Hoa hồng sàn TickeX cố định 5%, nhận 95% sau khi khấu trừ hoàn tiền
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          <span>Yêu Cầu Quyết Toán Mới</span>
        </button>
      </div>

      {/* Policy banner */}
      <div className="p-4 rounded-xl bg-surface-1 border border-border-subtle flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-text-secondary space-y-1">
          <p className="font-semibold text-white">Quy chuẩn quyết toán tự động trên Sàn TickeX:</p>
          <p>
            1. <strong>Công thức:</strong> Thực Nhận = Tổng Doanh Thu Vé - Phí Sàn (5%) - Các Khoản Hoàn Tiền Vé Đã Duyệt.
          </p>
          <p>
            2. <strong>Thời gian xử lý:</strong> Sau khi gửi yêu cầu, ban quản trị TickeX sẽ kiểm tra đối soát và chuyển khoản trong vòng 24-48 giờ làm việc.
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Settlements Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3" role="status" aria-busy="true">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" />
          <span className="text-sm text-text-secondary">Đang tải lịch sử quyết toán...</span>
        </div>
      ) : settlements.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-surface-1 border border-border-subtle space-y-4">
          <Landmark className="w-12 h-12 mx-auto text-text-tertiary/40" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-white">Chưa có yêu cầu quyết toán nào</h3>
            <p className="text-sm text-text-tertiary mt-1">
              Bạn có thể gửi yêu cầu thanh toán cho các sự kiện đã có doanh thu bán vé.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            Tạo Yêu Cầu Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Bảng danh sách quyết toán">
              <thead className="bg-surface-2 text-text-tertiary text-xs uppercase font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3">Sự kiện & Ngày gửi</th>
                  <th scope="col" className="px-5 py-3 text-right">Doanh thu gộp</th>
                  <th scope="col" className="px-5 py-3 text-right">Phí sàn (5%)</th>
                  <th scope="col" className="px-5 py-3 text-right">Hoàn tiền</th>
                  <th scope="col" className="px-5 py-3 text-right">Thực nhận</th>
                  <th scope="col" className="px-5 py-3">Tài khoản nhận tiền</th>
                  <th scope="col" className="px-5 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {settlements.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-4 max-w-xs">
                      <div className="font-semibold text-white truncate">{item.eventTitle}</div>
                      <div className="text-xs text-text-tertiary">
                        {new Date(item.requestedAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-text-secondary whitespace-nowrap font-medium">
                      {formatVnd(item.grossRevenue)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-text-tertiary whitespace-nowrap">
                      - {formatVnd(item.commissionAmount)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-danger whitespace-nowrap">
                      {item.refundDeduction > 0 ? `- ${formatVnd(item.refundDeduction)}` : '0 ₫'}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums font-bold text-success whitespace-nowrap text-base">
                      {formatVnd(item.netPayout)}
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap">
                      <div className="font-medium text-white">{item.bankName}</div>
                      <div className="text-text-tertiary tabular-nums font-mono">{item.bankAccountNumber}</div>
                      <div className="text-text-secondary uppercase">{item.accountHolder}</div>
                      {item.adminNote && (
                        <div className="mt-1 text-danger font-medium text-[11px]">Ghi chú: {item.adminNote}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Yêu Cầu Quyết Toán */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-settle-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-1/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg bg-surface-1 border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-modal-pop"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                </div>
                <h2 id="modal-settle-title" className="text-lg font-bold font-display text-white">
                  Yêu Cầu Quyết Toán Doanh Thu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 min-w-11 p-2 rounded-lg text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRequestSettlement} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-2.5 text-danger text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2.5 text-success text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="settle-event" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Chọn Sự Kiện Quyết Toán <span className="text-danger">*</span>
                </label>
                <select
                  id="settle-event"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  required
                >
                  {events.length === 0 ? (
                    <option value="">Không có sự kiện nào</option>
                  ) : (
                    events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} (Doanh thu: {formatVnd(e.grossRevenue)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Real-time calculation estimate */}
              {selectedEventObj && (
                <div className="p-4 rounded-xl bg-surface-2/60 border border-border-subtle space-y-2 text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span>Doanh thu gộp tích lũy:</span>
                    <span className="font-semibold text-white tabular-nums">{formatVnd(estimatedGross)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Phí hoa hồng sàn TickeX (5%):</span>
                    <span className="text-text-tertiary tabular-nums">- {formatVnd(estimatedCommission)}</span>
                  </div>
                  <div className="pt-2 border-t border-border-subtle flex justify-between font-bold text-sm">
                    <span className="text-white">Ước tính thực nhận (95%):</span>
                    <span className="text-success tabular-nums">{formatVnd(estimatedNet)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="settle-bank-name" className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                  Tên Ngân Hàng <span className="text-danger">*</span>
                </label>
                <input
                  id="settle-bank-name"
                  type="text"
                  required
                  placeholder="Vietcombank / Techcombank / MB Bank..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="settle-bank-acc" className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                  Số Tài Khoản Ngân Hàng <span className="text-danger">*</span>
                </label>
                <input
                  id="settle-bank-acc"
                  type="text"
                  required
                  placeholder="01234567890"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="settle-acc-holder" className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                  Tên Chủ Tài Khoản (In hoa không dấu) <span className="text-danger">*</span>
                </label>
                <input
                  id="settle-acc-holder"
                  type="text"
                  required
                  placeholder="NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedEventId}
                  className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-sm transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Quyết Toán'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

