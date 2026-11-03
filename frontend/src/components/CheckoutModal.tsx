import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Zap } from 'lucide-react';
import { EventDetail, Seat, AppliedCoupon } from '../types';
import api from '../services/api';
import { CheckoutInvoice } from './Checkout/CheckoutInvoice';
import { CheckoutVietQrView, PaymentInfo } from './Checkout/CheckoutVietQrView';
import { CheckoutReleaseDialog } from './Checkout/CheckoutReleaseDialog';
import { CheckoutModalHeader } from './Checkout/CheckoutModalHeader';
import { CheckoutStatusView } from './Checkout/CheckoutStatusView';
import { useModalAccessibility } from './Admin/useModalAccessibility';
import { checkoutLinkResponseSchema } from '../schemas/customerSchemas';
import { createIdempotencyKey } from '../utils/idempotency';
import { VatInvoiceForm, VatInvoiceFormData } from './Checkout/VatInvoiceForm';

interface CheckoutModalProps {
  isOpen?: boolean;
  onClose: () => void;
  event: EventDetail;
  seat: Seat;
  seats?: Seat[];
  ticketId: string | null;
  expiresAt: string | null | undefined;
  serverTime?: string | null;
}

export default function CheckoutModal({
  isOpen = true,
  onClose,
  event,
  seat,
  seats,
  ticketId,
  expiresAt,
  serverTime,
}: CheckoutModalProps) {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<PaymentInfo | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentInitError, setPaymentInitError] = useState<string | null>(null);
  const [paymentRetryKey, setPaymentRetryKey] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [vatData, setVatData] = useState<VatInvoiceFormData>({
    isRequested: false,
    taxCode: '',
    companyName: '',
    companyAddress: '',
    recipientEmail: '',
  });

  const clockOffsetMsRef = useRef<number>(0);
  if (serverTime) {
    const serverMs = new Date(serverTime).getTime();
    if (!Number.isNaN(serverMs)) {
      clockOffsetMsRef.current = serverMs - Date.now();
    }
  }

  const calculateRemaining = useCallback((target: string | null | undefined) => {
    if (!target) return 0;
    const now = Date.now() + clockOffsetMsRef.current;
    const diff = Math.floor((new Date(target).getTime() - now) / 1000);
    return diff > 0 ? diff : 0;
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => calculateRemaining(expiresAt));
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const simulateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleModalClose = useCallback(() => {
    if (status === 'verifying') return;
    if (status === 'error' || status === 'success') {
      onClose();
    } else {
      setShowCloseConfirm(true);
    }
  }, [status, onClose]);

  useModalAccessibility(Boolean(isOpen), releasing || loadingPayment || status === 'verifying', handleModalClose, modalRef);

  // Sync timeLeft when expiresAt or serverTime changes
  useEffect(() => {
    setTimeLeft(calculateRemaining(expiresAt));
  }, [expiresAt, serverTime, calculateRemaining]);

  // Fetch payment link from backend
  useEffect(() => {
    if (!isOpen || !ticketId) return;
    let isMounted = true;
    const controller = new AbortController();

    const initPayment = async () => {
      try {
        setLoadingPayment(true);
        setPaymentInitError(null);
        
        const response = await api.post('/api/payments/create-link', {
          ticketId,
        }, {
          signal: controller.signal,
          headers: { 'Idempotency-Key': createIdempotencyKey() },
        });

        if (isMounted && response.data.success) {
          const parsed = checkoutLinkResponseSchema.safeParse(response.data.data);
          if (parsed.success) {
            setPaymentData(parsed.data as PaymentInfo);
          } else {
            const msg = 'Dữ liệu thông tin thanh toán không hợp lệ.';
            setPaymentInitError(msg);
            toast.error(msg);
          }
        } else if (isMounted) {
          const msg = response.data?.message || 'Không thể tạo liên kết thanh toán.';
          setPaymentInitError(msg);
          toast.error(msg);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr = err as { response?: { data?: { message?: string } } };
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          const msg = apiErr.response?.data?.message || 'Không thể tạo mã thanh toán lúc này. Vui lòng thử lại.';
          setPaymentInitError(msg);
          toast.error(msg);
        }
      } finally {
        if (isMounted) setLoadingPayment(false);
      }
    };

    void initPayment();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, ticketId, paymentRetryKey]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || status !== 'idle') return;
    
    const timer = setInterval(() => {
      const remaining = calculateRemaining(expiresAt);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        setStatus('error');
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status, expiresAt, calculateRemaining]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (simulateTimerRef.current) clearTimeout(simulateTimerRef.current);
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, []);

  const handlePaymentSuccess = useCallback(async (orderCode: string | number) => {
    setStatus('success');
    toast.success('Thanh toán thành công qua chuyển khoản ngân hàng!');
    try {
      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#BA4F2D'],
      });
    } catch { /* ignore optional confetti */ }

    successRedirectTimerRef.current = setTimeout(() => {
      navigate(`/payment/result?orderCode=${orderCode}&status=PAID`);
    }, 1800);
  }, [navigate]);

  const checkPaymentStatus = useCallback(async (manual = false) => {
    const orderCode = paymentData?.orderCode;
    if (!orderCode || status !== 'idle') return;

    if (manual) setCheckingStatus(true);
    try {
      const res = await api.get<{ success?: boolean; data?: { status?: string } }>(`/api/payments/status/${orderCode}`);
      const rawStatus = res.data?.data?.status?.toUpperCase();
      if (rawStatus === 'PAID') {
        await handlePaymentSuccess(orderCode);
      } else if (manual) {
        toast('Chưa nhận được giao dịch chuyển khoản. Vui lòng kiểm tra lại sau ít giây.', { icon: '⏳' });
      }
    } catch (err: unknown) {
      if (manual) {
        const apiErr = err as { response?: { data?: { message?: string } } };
        toast.error(apiErr.response?.data?.message || 'Không thể kiểm tra trạng thái lúc này.');
      }
    } finally {
      if (manual) setCheckingStatus(false);
    }
  }, [paymentData?.orderCode, status, handlePaymentSuccess]);

  // Auto-polling payment status every 2.5 seconds
  useEffect(() => {
    const orderCode = paymentData?.orderCode;
    if (!isOpen || status !== 'idle' || !orderCode) return;

    const pollInterval = setInterval(() => {
      void checkPaymentStatus(false);
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [isOpen, status, paymentData?.orderCode, checkPaymentStatus]);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error(`Không thể sao chép ${fieldName}.`);
      return;
    }
    void navigator.clipboard.writeText(text)
      .then(() => toast.success(`Đã sao chép ${fieldName}!`))
      .catch(() => toast.error(`Không thể sao chép ${fieldName}.`));
  };

  const handleProceedPayOS = () => {
    if (!paymentData?.checkoutUrl) return;
    try {
      const parsedUrl = new URL(paymentData.checkoutUrl, window.location.origin);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        if (paymentData.checkoutUrl.startsWith('http://') || paymentData.checkoutUrl.startsWith('https://')) {
          window.location.href = paymentData.checkoutUrl;
        } else {
          navigate(parsedUrl.pathname + parsedUrl.search + parsedUrl.hash);
        }
        return;
      }
    } catch {
      if (paymentData.checkoutUrl.startsWith('/') && !paymentData.checkoutUrl.startsWith('//')) {
        navigate(paymentData.checkoutUrl);
        return;
      }
    }
    toast.error('Đường dẫn thanh toán không hợp lệ.');
  };

  const handleReleaseAndClose = async () => {
    if (releasing || status !== 'idle' || !ticketId) return;
    setReleasing(true);
    setReleaseError('');
    try {
      await api.post(`/api/reservations/${ticketId}/release`, {
        reason: 'CustomerClosedCheckout',
      }, {
        headers: { 'Idempotency-Key': createIdempotencyKey() },
      });
      setShowCloseConfirm(false);
      onClose();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setReleaseError(apiError.response?.data?.message ?? 'Không thể trả ghế lúc này. Vui lòng thử lại.');
    } finally {
      setReleasing(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (status === 'verifying' || !paymentData?.orderCode) return;
    setStatus('verifying');
    try {
      await api.post(`/api/payments/simulate-success/${paymentData.orderCode}`);
      if (vatData.isRequested && vatData.taxCode) {
        try {
          await api.post('/api/invoices/request', {
            orderCode: paymentData.orderCode,
            taxCode: vatData.taxCode,
            companyName: vatData.companyName,
            companyAddress: vatData.companyAddress,
            recipientEmail: vatData.recipientEmail,
          });
        } catch { /* invoice request logged */ }
      }
      toast.success('Mô phỏng thanh toán thành công!');
      simulateTimerRef.current = setTimeout(() => {
        navigate(`/payment/result?orderCode=${paymentData.orderCode}&status=PAID`);
      }, 700);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Mô phỏng thanh toán thất bại.');
      setStatus('idle');
    }
  };

  const effectiveSeats = seats && seats.length > 0 ? seats : [seat];
  const totalPrice = effectiveSeats.reduce((sum, s) => sum + s.price, 0);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || applyingCoupon) return;
    setApplyingCoupon(true);
    try {
      const res = await api.post('/api/coupons/apply', {
        code: couponCode.trim(),
        orderAmount: totalPrice,
        eventId: event.id,
      });
      if (res.data?.success) {
        setAppliedCoupon(res.data.data);
        toast.success(res.data.message || 'Áp dụng mã giảm giá thành công!');
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 45,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#BA4F2D', '#D9A26C', '#10B981'],
          });
        } catch { /* ignore optional confetti on unsupported environments */ }
        setPaymentRetryKey(k => k + 1);
      } else {
        toast.error(res.data?.message || 'Mã giảm giá không hợp lệ.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể áp dụng mã giảm giá lúc này.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isSimulating = status === 'verifying';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-backdrop-in" onClick={() => !isSimulating && setShowCloseConfirm(true)} aria-hidden="true" />

      <div ref={modalRef} className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface-1 border border-border-subtle shadow-2xl p-6 sm:p-7 space-y-5 animate-modal-pop text-text-primary z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <CheckoutModalHeader onRequestClose={() => !isSimulating && setShowCloseConfirm(true)} />

        {/* Content Body */}
        {status === 'idle' && (
          <div className="space-y-4">
            <CheckoutInvoice
              event={event}
              seat={seat}
              seats={seats}
              timeLeft={timeLeft}
              formatTime={formatTime}
              status={status}
              appliedCoupon={appliedCoupon}
              couponCodeInput={couponCode}
              onCouponCodeChange={setCouponCode}
              onApplyCoupon={handleApplyCoupon}
              applyingCoupon={applyingCoupon}
            />

            <VatInvoiceForm value={vatData} onChange={setVatData} />

            <CheckoutVietQrView
              loadingPayment={loadingPayment}
              paymentInitError={paymentInitError}
              paymentData={paymentData}
              onRetryPayment={() => setPaymentRetryKey(k => k + 1)}
              onProceedPayOS={handleProceedPayOS}
              copyToClipboard={copyToClipboard}
              onManualCheckStatus={() => void checkPaymentStatus(true)}
              checkingStatus={checkingStatus}
            />

            {/* Dev Simulate & Cancel Actions */}
            <div className="space-y-2 pt-1">
              {import.meta.env.DEV && paymentData?.checkoutUrl && (
                <button 
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isSimulating}
                  aria-busy={isSimulating}
                  className="w-full min-h-11 py-2.5 bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-xs font-bold rounded-xl transition-[background-color,transform] active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                >
                  {isSimulating ? 'Đang xác nhận thanh toán…' : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                      <span>[DEV] Giả lập Thanh Toán Thành Công</span>
                    </>
                  )}
                </button>
              )}

              <button 
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                disabled={releasing}
                aria-busy={releasing}
                className="w-full min-h-11 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-xs font-semibold rounded-xl transition-[background-color,transform] active:scale-[0.98] border border-border-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {releasing ? 'Đang trả ghế…' : 'Trả Ghế & Quay Lại'}
              </button>
            </div>
          </div>
        )}

        <CheckoutStatusView
          status={status}
          onClose={onClose}
          orderCode={paymentData?.orderCode}
          onViewTickets={() => {
            if (paymentData?.orderCode) {
              navigate(`/payment/result?orderCode=${paymentData.orderCode}&status=PAID`);
            } else {
              onClose();
            }
          }}
        />

        {/* Release Confirmation Dialog */}
        <CheckoutReleaseDialog
          isOpen={showCloseConfirm && status === 'idle'}
          releasing={releasing}
          releaseError={releaseError}
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={handleReleaseAndClose}
        />
      </div>
    </div>
  );
}
