import React from 'react';
import { Clock, Tag, Ticket } from 'lucide-react';
import { EventDetail, Seat, AppliedCoupon } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ResilientImage } from '../ResilientImage';

interface CheckoutInvoiceProps {
  event: EventDetail;
  seat: Seat;
  seats?: Seat[];
  timeLeft: number;
  formatTime: (seconds: number) => string;
  status: 'idle' | 'verifying' | 'success' | 'error';
  appliedCoupon?: AppliedCoupon | null;
  couponCodeInput?: string;
  onCouponCodeChange?: (code: string) => void;
  onApplyCoupon?: () => void;
  applyingCoupon?: boolean;
  onOpenVoucherDrawer?: () => void;
}

export const CheckoutInvoice: React.FC<CheckoutInvoiceProps> = React.memo(({
  event,
  seat,
  seats,
  timeLeft,
  formatTime,
  status,
  appliedCoupon,
  couponCodeInput,
  onCouponCodeChange,
  onApplyCoupon,
  applyingCoupon,
  onOpenVoucherDrawer,
}) => {
  const effectiveSeats = seats && seats.length > 0 ? seats : [seat];
  const totalPrice = effectiveSeats.reduce((sum, s) => sum + s.price, 0);
  const finalPayable = appliedCoupon ? appliedCoupon.finalAmount : totalPrice;

  const getTierName = (tier: number) => {
    if (tier === 1) return 'Hạng VIP';
    if (tier === 2) return 'Tiết Kiệm';
    return 'Tiêu Chuẩn';
  };

  return (
    <div className="space-y-4">
      {/* Event Meta Header */}
      <div className="flex gap-4 p-4 rounded-2xl bg-surface-2/40 border border-border-subtle items-center">
        {event.imageUrl ? (
          <ResilientImage
            src={event.imageUrl}
            alt={event.title}
            width="64"
            height="64"
            className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0"
            fallbackClassName="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center text-text-tertiary shrink-0 font-bold border border-border-subtle text-xs"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center text-text-tertiary shrink-0 font-bold">
            TICKEX
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-display font-bold text-sm truncate">{event.title}</h3>
          <p className="text-text-secondary text-xs truncate mt-0.5">{event.venueName || event.location}</p>
          <p className="text-text-tertiary text-[11px] mt-0.5 tabular-nums">
            {formatDate(event.date, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Countdown Timer Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2/60 border border-border-subtle text-xs">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4 text-warning animate-pulse" aria-hidden="true" />
          <span>Thời gian giữ chỗ còn lại:</span>
        </div>
        <span
          role="timer"
          aria-atomic="true"
          aria-live="polite"
          aria-label={`Thời gian giữ chỗ còn lại: ${status === 'error' ? 'Hết hạn' : formatTime(timeLeft)}`}
          className={`font-mono font-bold text-sm tabular-nums ${timeLeft < 60 ? 'text-danger animate-pulse' : 'text-warning'}`}
        >
          {status === 'error' ? 'Hết hạn' : formatTime(timeLeft)}
        </span>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {timeLeft === 300 && "Thời gian giữ chỗ còn 5 phút."}
          {timeLeft === 120 && "Thời gian giữ chỗ còn 2 phút."}
          {timeLeft === 60 && "Cảnh báo: Thời gian thanh toán chỉ còn 1 phút."}
          {timeLeft === 30 && "Thời gian thanh toán còn 30 giây."}
          {timeLeft === 0 && "Thời gian thanh toán đã hết hạn."}
        </div>
      </div>

      {/* Promo Code Input */}
      {onApplyCoupon && (
        <div className="p-3.5 rounded-2xl bg-surface-2/40 border border-border-subtle text-xs space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="coupon-input" className="text-text-secondary font-semibold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
              <span>Mã Giảm Giá / Khuyến Mãi</span>
            </label>
            {onOpenVoucherDrawer && (
              <button
                type="button"
                onClick={onOpenVoucherDrawer}
                className="text-brand-primary hover:text-brand-primary/80 font-bold inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Kho voucher</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              id="coupon-input"
              type="text"
              value={couponCodeInput ?? ''}
              onChange={(e) => onCouponCodeChange?.(e.target.value.toUpperCase())}
              placeholder="Nhập mã (ví dụ: SUMMER2026)"
              className="flex-1 bg-surface-3 border border-border-subtle rounded-xl px-3 py-2 text-white placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono text-xs uppercase"
              disabled={applyingCoupon || Boolean(appliedCoupon)}
            />
            <button
              type="button"
              onClick={onApplyCoupon}
              disabled={applyingCoupon || !couponCodeInput?.trim() || Boolean(appliedCoupon)}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
            >
              {applyingCoupon ? 'Đang kiểm tra...' : appliedCoupon ? 'Đã áp dụng' : 'Áp dụng'}
            </button>
          </div>
        </div>
      )}

      {/* Seat & Price Breakdown Card */}
      <div className="p-4 rounded-2xl bg-surface-2/40 border border-border-subtle space-y-2.5 text-xs">
        <div className="flex justify-between items-start text-text-secondary">
          <span>Vị trí ghế ({effectiveSeats.length}):</span>
          <div className="flex flex-wrap gap-1.5 justify-end max-w-[65%]">
            {effectiveSeats.map((s) => (
              <span key={s.id} className="font-bold text-white bg-surface-3 px-2 py-0.5 rounded-md border border-border-subtle">
                {s.row}{s.number} ({getTierName(s.tier)})
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center text-text-secondary">
          <span>Đơn giá vé:</span>
          <span className="text-white font-medium tabular-nums">
            {effectiveSeats.length === 1 
              ? formatCurrency(effectiveSeats[0].price)
              : `${formatCurrency(totalPrice)} (${effectiveSeats.length} vé)`}
          </span>
        </div>

        <div className="flex justify-between items-center text-text-secondary">
          <span>Phí dịch vụ & xuất vé:</span>
          <span className="text-success font-medium">Miễn phí</span>
        </div>

        {appliedCoupon && (
          <div className="flex justify-between items-center text-success font-medium pt-1 border-t border-border-subtle/40">
            <span>Mã giảm giá ({appliedCoupon.code}):</span>
            <span className="font-bold tabular-nums">-{formatCurrency(appliedCoupon.discountAmount)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-border-subtle/60 flex justify-between items-center">
          <span className="text-white font-bold text-sm">Tổng thanh toán:</span>
          <span className="text-brand-primary font-black text-base font-display tabular-nums">
            {formatCurrency(finalPayable)}
          </span>
        </div>
      </div>
    </div>
  );
});
