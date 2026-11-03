import React from 'react';
import { Loader2, XCircle, CheckCircle2, Ticket } from 'lucide-react';

interface CheckoutStatusViewProps {
  status: 'idle' | 'verifying' | 'error' | 'success';
  onClose: () => void;
  orderCode?: string | number;
  onViewTickets?: () => void;
}

export const CheckoutStatusView: React.FC<CheckoutStatusViewProps> = ({
  status,
  onClose,
  orderCode,
  onViewTickets,
}) => {
  if (status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center py-10 space-y-4 text-center animate-fade-in"
      >
        <div className="relative">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500/40 text-emerald-400 shadow-xl shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" aria-hidden="true" />
          </div>
          <span className="absolute -inset-1 rounded-full bg-emerald-400/20 animate-ping opacity-40" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-black text-white">Thanh Toán Thành Công!</h3>
          <p className="text-emerald-400 text-xs font-semibold">
            Hệ thống đã khớp lệnh chuyển khoản VietQR PayOS
          </p>
        </div>

        {orderCode && (
          <div className="px-4 py-2 rounded-xl bg-surface-2 border border-border-subtle text-xs">
            <span className="text-text-secondary">Mã đơn hàng: </span>
            <span className="font-mono font-bold text-white tabular-nums">#{orderCode}</span>
          </div>
        )}

        <p className="text-text-secondary text-xs max-w-xs leading-relaxed">
          Vé điện tử có mã QR bảo mật đã được tạo và kích hoạt. Đang tự động chuyển hướng đến vé của bạn...
        </p>

        <div className="pt-2 w-full max-w-xs">
          <button
            type="button"
            onClick={onViewTickets || onClose}
            className="w-full min-h-11 px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-lg shadow-brand-glow cursor-pointer inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Ticket className="w-4 h-4" aria-hidden="true" />
            <span>Xem Vé Của Tôi Ngay</span>
          </button>
        </div>
      </div>
    );
  }

  if (status === 'verifying') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center py-16 space-y-4 text-center"
      >
        <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center border border-brand-primary/30">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-white">Đang Xác Nhận Giao Dịch</h3>
        <p className="text-text-secondary text-xs max-w-xs">
          Hệ thống đang đối soát mã đơn hàng và ký chữ ký số mã QR cho vé của bạn...
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center py-12 space-y-4 text-center"
      >
        <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center border border-danger/30 text-danger">
          <XCircle className="w-8 h-8" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-white">Hết Thời Gian Giữ Chỗ</h3>
        <p className="text-text-secondary text-xs max-w-xs leading-relaxed">
          Thời gian giữ chỗ trên hệ thống đã kết thúc. Ghế đã được giải phóng tự động để đảm bảo công bằng cho khán giả khác.
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thanh toán và quay lại sơ đồ ghế"
          className="min-h-11 px-6 py-3 bg-surface-2 hover:bg-surface-3 text-white text-xs font-bold rounded-xl transition-[background-color,transform] active:scale-[0.98] border border-border-subtle cursor-pointer inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Đóng & Quay Lại Sơ Đồ Ghế
        </button>
      </div>
    );
  }

  return null;
};
