import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Ticket, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { AvailableCoupon } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useModalAccessibility } from '../Admin/useModalAccessibility';

interface VoucherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  orderAmount: number;
  appliedCouponCode?: string;
  onSelectCoupon: (code: string) => void;
  applying?: boolean;
}

export const VoucherDrawer: React.FC<VoucherDrawerProps> = React.memo(({
  isOpen,
  onClose,
  eventId,
  orderAmount,
  appliedCouponCode,
  onSelectCoupon,
  applying = false,
}) => {
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useModalAccessibility(isOpen, applying, onClose, drawerRef);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = eventId ? `/api/coupons/active?eventId=${eventId}` : '/api/coupons/active';
      const res = await api.get<{ success?: boolean; data?: AvailableCoupon[] }>(url);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCoupons(res.data.data);
      } else {
        setCoupons([]);
      }
    } catch {
      setError('Không thể tải danh sách mã giảm giá lúc này.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchCoupons();
    }
  }, [isOpen, eventId]);

  const getDiscountHeader = (c: AvailableCoupon) => {
    const isPercent = c.discountType === 1 || c.discountType === 'Percentage';
    if (isPercent) {
      return `Giảm ${c.discountValue}%`;
    }
    return `Giảm ${formatCurrency(c.discountValue)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="voucher-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-30 flex flex-col justify-end sm:justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voucher-drawer-title"
        >
          <motion.div
            key="voucher-drawer-card"
            ref={drawerRef}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-full sm:max-w-md mx-auto max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-surface-1 border border-border-subtle shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle bg-surface-2/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                  <Ticket className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="voucher-drawer-title" className="text-sm sm:text-base font-bold text-white font-display">
                    Kho Mã Ưu Đãi
                  </h3>
                  <p className="text-[11px] text-text-secondary">
                    Đơn hiện tại: <span className="font-semibold text-white tabular-nums">{formatCurrency(orderAmount)}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng danh sách mã ưu đãi"
                className="p-1.5 rounded-xl text-text-tertiary hover:text-white hover:bg-surface-3 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 max-h-[60vh] scrollbar-thin scrollbar-thumb-surface-3">
              {loading && (
                <div className="space-y-3" role="status" aria-label="Đang tải mã giảm giá...">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-surface-2/40 border border-border-subtle animate-pulse space-y-2"
                    >
                      <div className="h-4 bg-surface-3 rounded w-1/3" />
                      <div className="h-3 bg-surface-3 rounded w-2/3" />
                      <div className="h-3 bg-surface-3 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {error && !loading && (
                <div className="p-5 rounded-2xl bg-danger/10 border border-danger/20 text-center space-y-3">
                  <div className="inline-flex p-2.5 rounded-xl bg-danger/15 text-danger">
                    <AlertCircle className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-danger font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchCoupons()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-2 text-white text-xs font-semibold border border-border-subtle transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thử lại</span>
                  </button>
                </div>
              )}

              {!loading && !error && coupons.length === 0 && (
                <div className="py-8 text-center space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-surface-2 text-text-tertiary">
                    <Tag className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Chưa có mã giảm giá khả dụng</h4>
                  <p className="text-[11px] text-text-secondary max-w-xs mx-auto">
                    Hiện tại chưa có mã khuyến mãi nào áp dụng cho sự kiện này. Bạn vẫn có thể nhập mã thủ công nếu có!
                  </p>
                </div>
              )}

              {!loading && !error && coupons.map((coupon) => {
                const isSelected = appliedCouponCode?.toUpperCase() === coupon.code.toUpperCase();
                const isEligible = orderAmount >= coupon.minOrderAmount;
                const deficit = coupon.minOrderAmount - orderAmount;

                return (
                  <div
                    key={coupon.id}
                    className={`relative rounded-2xl border p-3.5 transition-all text-xs ${
                      isSelected
                        ? 'bg-brand-primary/10 border-brand-primary/40 shadow-sm shadow-brand-primary/10'
                        : isEligible
                        ? 'bg-surface-2/50 border-border-subtle hover:border-brand-primary/30'
                        : 'bg-surface-2/20 border-border-subtle/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded-lg bg-surface-3 text-brand-primary border border-brand-primary/20">
                            {coupon.code}
                          </span>
                          <span className="font-bold text-white text-xs">
                            {getDiscountHeader(coupon)}
                          </span>
                        </div>

                        <p className="text-text-secondary text-[11px] line-clamp-2 leading-relaxed">
                          {coupon.description}
                        </p>

                        <div className="flex items-center gap-2 pt-1 text-[10px] text-text-tertiary flex-wrap">
                          <span>Đơn từ {formatCurrency(coupon.minOrderAmount)}</span>
                          <span>•</span>
                          <span>HSD: {formatDate(coupon.validTo, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>

                        {!isEligible && (
                          <p className="text-[10px] text-warning font-medium pt-0.5">
                            Cần mua thêm {formatCurrency(deficit)} để áp dụng mã này
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-success/15 border border-success/30 text-success font-bold text-[11px]">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Đang dùng</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!isEligible || applying}
                            onClick={() => {
                              onSelectCoupon(coupon.code);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:bg-surface-3 disabled:text-text-tertiary disabled:cursor-not-allowed text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Áp dụng
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border-subtle bg-surface-2/40 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-surface-2 text-text-secondary hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

VoucherDrawer.displayName = 'VoucherDrawer';
