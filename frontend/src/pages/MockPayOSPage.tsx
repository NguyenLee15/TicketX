import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { Loader2, ShieldCheck, CreditCard, Building2, Smartphone } from 'lucide-react';
import api from '../services/api';

export default function MockPayOSPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [amount, setAmount] = useState(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderCode = searchParams.get('orderCode');

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !orderCode) return;
    let isMounted = true;
    api
      .get(`/api/payments/status/${encodeURIComponent(orderCode)}`)
      .then(res => {
        if (isMounted) {
          setAmount(res.data?.data?.amount ?? res.data?.data?.price ?? 0);
        }
      })
      .catch(() => {
        // Ignore transient status lookup errors in sandbox view
      });
    return () => {
      isMounted = false;
    };
  }, [orderCode]);

  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-dvh bg-surface-0 flex items-center justify-center p-4">
        <div className="surface-panel p-8 text-center max-w-md w-full animate-modal-pop">
          <h1 className="text-xl font-bold text-danger mb-2">Không khả dụng</h1>
          <p className="text-text-secondary mb-6">Trang mô phỏng thanh toán này chỉ có sẵn trong môi trường phát triển.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full min-h-11 inline-flex items-center justify-center rounded-xl bg-brand-primary hover:bg-brand-primary/90 active:scale-[0.98] transition-[background-color,transform] text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            Trở Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  const handleSimulatePayment = async (isSuccess: boolean) => {
    setStatus('processing');
    
    try {
      if (isSuccess) await api.post(`/api/payments/simulate-success/${encodeURIComponent(orderCode || '')}`);

      // 2. Wait a bit for dramatic effect
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus(isSuccess ? 'success' : 'error');

      // 3. Redirect user back
      redirectTimerRef.current = setTimeout(() => {
        window.location.href = `/payment/result?orderCode=${encodeURIComponent(orderCode || '')}`;
      }, 1500);

    } catch {
      setStatus('error');
    }
  };

  if (!orderCode) {
    return (
      <div className="min-h-dvh bg-surface-0 flex items-center justify-center p-4">
        <div className="surface-panel p-8 text-center max-w-md w-full animate-modal-pop">
          <h1 className="text-xl font-bold text-danger mb-2">Phiên Giao Dịch Không Hợp Lệ</h1>
          <p className="text-text-secondary mb-6">Thiếu thông tin mã đơn hàng thanh toán.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full min-h-11 inline-flex items-center justify-center rounded-xl bg-brand-primary hover:bg-brand-primary/90 active:scale-[0.98] transition-[background-color,transform] text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            Trở Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-0 text-text-primary flex flex-col font-sans animate-fade-in">
      {/* Header */}
      <header className="bg-surface-1/90 backdrop-blur-md py-4 px-6 flex flex-wrap justify-between items-center gap-3 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-sm shadow-brand-glow">
            <span className="text-white font-display font-black text-xl">P</span>
          </div>
          <span className="font-display font-bold text-xl text-white">Cổng Thử Nghiệm PayOS</span>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary font-medium bg-surface-2 px-3 py-1.5 rounded-full border border-border-subtle">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
          Môi Trường Thử Nghiệm Sandbox
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="surface-panel max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
          
          {/* Left: QR/Payment Form */}
          <div className="p-6 sm:p-8 md:w-[60%] border-b md:border-b-0 md:border-r border-border-subtle flex flex-col">
            <div className="mb-6">
              <h1 className="text-2xl font-display font-bold text-white mb-1">Thanh toán đơn hàng</h1>
              <p className="text-text-secondary text-sm">Mã đơn: <span className="font-mono font-semibold text-brand-secondary tabular-nums">#{orderCode}</span></p>
            </div>

            {status === 'idle' ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border-default rounded-xl p-6 sm:p-8 bg-surface-1/60 relative overflow-hidden group">
                <div className="w-48 h-48 bg-white shadow-md border border-border-subtle rounded-xl flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-4 border border-brand-primary/20 rounded-lg" />
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=payos-sandbox" alt="Mã QR thanh toán PayOS bản thử nghiệm" width="150" height="150" className="w-[85%] h-[85%] opacity-60 grayscale mix-blend-multiply" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">CHẾ ĐỘ THỬ NGHIỆM</span>
                  </div>
                </div>
                
                <h2 className="font-display font-bold text-white text-lg mb-2">Quét mã để thanh toán</h2>
                <p className="text-text-secondary text-sm text-center mb-8 max-w-xs">Sử dụng Ứng dụng Ngân hàng hoặc Ví điện tử để quét mã này.</p>

                <div className="w-full space-y-3">
                  <button 
                    type="button"
                    onClick={() => handleSimulatePayment(true)}
                    className="w-full min-h-11 py-3.5 bg-success hover:bg-success/90 active:scale-[0.98] text-white font-bold rounded-xl transition-[background-color,transform] shadow-md shadow-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success cursor-pointer"
                  >
                    Mô phỏng: Thanh toán Thành công
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSimulatePayment(false)}
                    className="w-full min-h-11 py-3.5 bg-danger/10 hover:bg-danger/20 active:scale-[0.98] text-danger font-bold rounded-xl transition-[background-color,transform] border border-danger/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger cursor-pointer"
                  >
                    Mô phỏng: Hủy Thanh toán
                  </button>
                </div>
              </div>
            ) : (
              <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[360px]">
                {status === 'processing' && (
                  <>
                    <Loader2 className="w-16 h-16 text-brand-primary animate-spin mb-4" aria-hidden="true" />
                    <h3 className="text-xl font-display font-bold text-white mb-2">Đang xử lý giao dịch...</h3>
                    <p className="text-text-secondary">Hệ thống đang xác nhận thanh toán của bạn.</p>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <div className="w-20 h-20 bg-success/15 border border-success/30 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white mb-2">Thanh toán thành công!</h3>
                    <p className="text-text-secondary">Đang chuyển hướng về cửa hàng...</p>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <div className="w-20 h-20 bg-danger/15 border border-danger/30 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white mb-2">Thanh toán thất bại</h3>
                    <p className="text-text-secondary">Đang quay lại...</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="p-6 sm:p-8 md:w-[40%] bg-surface-1/80">
            <h2 className="text-text-tertiary font-semibold uppercase tracking-wider text-xs mb-6">Thông tin Đơn hàng</h2>
            
            <div className="space-y-4 mb-8 text-sm">
              <div className="flex justify-between items-center pb-4 border-b border-border-subtle border-dashed">
                <span className="text-text-secondary">Mã đơn hàng</span>
                <span className="font-mono font-semibold text-white tabular-nums">#{orderCode}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border-subtle border-dashed">
                <span className="text-text-secondary">Nhà cung cấp</span>
                <span className="font-bold text-white">TickeX Platform</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border-subtle border-dashed">
                <span className="text-text-secondary">Nội dung</span>
                <span className="font-medium text-white text-right max-w-[160px] truncate">Thanh toan ve TickeX</span>
              </div>
            </div>

            <div className="bg-brand-primary/10 rounded-xl p-5 border border-brand-primary/30 mb-8">
              <div className="flex justify-between items-center mb-1">
                <span className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Số tiền thanh toán</span>
              </div>
              <div className="text-3xl font-display font-black text-brand-secondary tabular-nums">
                {formatCurrency(amount)}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Hình thức thanh toán</h3>
              <div className="flex gap-2">
                <div className="w-12 h-10 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5 text-text-secondary" aria-hidden="true" />
                </div>
                <div className="w-12 h-10 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5 text-text-secondary" aria-hidden="true" />
                </div>
                <div className="w-12 h-10 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-center shadow-sm">
                  <Smartphone className="w-5 h-5 text-text-secondary" aria-hidden="true" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-text-tertiary text-xs sm:text-sm border-t border-border-subtle/50">
        <p>Cổng thanh toán giả lập dành cho TickeX Portfolio.</p>
      </footer>
    </div>
  );
}
