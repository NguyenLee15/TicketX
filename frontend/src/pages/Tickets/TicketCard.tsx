import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Loader2, Download, RotateCcw, Crown, CheckCircle2, XCircle, Clock, CreditCard, Ban } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export interface TicketItemData {
  id: string;
  eventId: string;
  seatId: string;
  eventTitle: string;
  eventDescription: string;
  eventDate: string;
  endDate: string;
  location: string;
  venueName?: string;
  category: string;
  imageUrl: string;
  row: string;
  number: number;
  tier: number;
  price: number;
  status: string;
  orderCode: string | number;
  qrCodeSignature: string;
  paidAt?: string;
  checkedInAt?: string;
  refundAmount?: number;
  refundedAt?: string;
  refundCutoffHours: number;
  canRefund: boolean;
}

interface TicketCardProps {
  ticket: TicketItemData;
  refundingId: string | null;
  onInitiateRefund: (ticket: TicketItemData) => void;
  onResumePayment?: (ticket: TicketItemData) => void;
  onReleaseReservation?: (ticket: TicketItemData) => void;
  isResuming?: boolean;
  isReleasing?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = React.memo(({
  ticket,
  refundingId,
  onInitiateRefund,
  onResumePayment,
  onReleaseReservation,
  isResuming = false,
  isReleasing = false,
}) => {
  const isVip = ticket.tier === 1;
  const hasSignedQr = Boolean(ticket.qrCodeSignature?.trim());
  const canShowQr = hasSignedQr && ['paid', 'used'].includes(ticket.status.toLowerCase());
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  const handleDownloadPdf = React.useCallback(async () => {
    if (!canShowQr || isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);
      const { generateTicketPdf } = await import('../../utils/ticketPdfGenerator');
      await generateTicketPdf(ticket as unknown as Parameters<typeof generateTicketPdf>[0]);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to generate ticket PDF', err);
      toast.error('Không thể tạo file PDF vé. Vui lòng thử lại.');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [canShowQr, isDownloadingPdf, ticket]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-success/15 text-success border border-success/30 uppercase tracking-wider whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Hợp Lệ
        </span>
      );
    }
    if (s === 'used') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Đã Qua Cửa
        </span>
      );
    }
    if (s === 'refundpending') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30 uppercase tracking-wider whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Đang Hoàn Tiền
          </span>
          <Link to="/profile?refundBankAccount=1" aria-label={`Kiểm tra tài khoản nhận tiền hoàn vé cho sự kiện ${ticket.eventTitle}`} className="text-xs font-semibold text-brand-primary underline underline-offset-4 hover:text-brand-secondary transition-colors">Kiểm tra tài khoản nhận tiền</Link>
        </div>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger/15 text-danger border border-danger/30 uppercase tracking-wider whitespace-nowrap shrink-0">
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Đã Hủy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30 uppercase tracking-wider whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Chờ Thanh Toán
      </span>
    );
  };

  return (
    <div 
      id={`ticket-${ticket.id}`} 
      className="surface-panel rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row relative group"
    >
      {/* Left: Concert Pass Information */}
      <div className="p-5 sm:p-6 flex-1 border-b md:border-b-0 md:border-r border-border-subtle border-dashed relative z-10 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {getStatusBadge(ticket.status)}

            {isVip && (
              <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 whitespace-nowrap shrink-0">
                <Crown className="w-3 h-3" aria-hidden="true" /> HẠNG VIP
              </span>
            )}
          </div>
          
          <h2 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight leading-snug">
            {ticket.eventTitle}
          </h2>
          
          <div className="flex flex-wrap items-center gap-2 text-text-secondary text-xs">
            <div className="flex items-center bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap tabular-nums">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand-secondary shrink-0" aria-hidden="true" />
              <span className="font-semibold text-white">
                {formatDate(ticket.eventDate, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap max-w-full">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-brand-primary shrink-0" aria-hidden="true" />
              <span className="font-semibold text-white truncate">{ticket.venueName || ticket.location}</span>
            </div>
          </div>
        </div>

        {/* Seat Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border-subtle/60 rounded-xl overflow-hidden border border-border-subtle/60 mt-1">
          <div className="bg-surface-2/60 p-2.5 text-center flex flex-col justify-center">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Hàng Ghế</div>
            <div className="font-black text-lg text-white font-display whitespace-nowrap">{ticket.row}</div>
          </div>
          <div className="bg-surface-2/60 p-2.5 text-center flex flex-col justify-center">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Số Ghế</div>
            <div className="font-black text-lg text-white font-display whitespace-nowrap tabular-nums">{ticket.number}</div>
          </div>
          <div className="bg-surface-2/60 p-2.5 text-center flex flex-col justify-center">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Hạng Vé</div>
            <div className="font-bold text-xs sm:text-sm text-brand-secondary font-display mt-0.5 whitespace-nowrap">
              {isVip ? 'VIP' : ticket.tier === 2 ? 'Tiết Kiệm' : 'Tiêu Chuẩn'}
            </div>
          </div>
          <div className="bg-surface-2/60 p-2.5 text-center flex flex-col justify-center">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Giá Vé</div>
            <div className="font-black text-xs sm:text-sm text-success font-display mt-0.5 whitespace-nowrap tabular-nums">
              {formatCurrency(ticket.price)}
            </div>
          </div>
        </div>

        {/* Pending Actions (Resume Checkout / Release Hold) */}
        {ticket.status.toLowerCase() === 'pending' && (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-t border-border-subtle/60 text-xs">
            <div className="text-warning flex items-start sm:items-center gap-1.5 text-[11px] leading-snug">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <span>Chưa hoàn tất thanh toán. Ghế đang được giữ tạm thời.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {onResumePayment && (
                <button
                  type="button"
                  onClick={() => onResumePayment(ticket)}
                  disabled={isResuming || isReleasing}
                  aria-busy={isResuming}
                  aria-label={`Tiếp tục thanh toán vé sự kiện ${ticket.eventTitle}`}
                  className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white font-bold transition-[background-color,transform] active:scale-[0.98] text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {isResuming ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>Tiếp Tục Thanh Toán</span>
                </button>
              )}

              {onReleaseReservation && (
                <button
                  type="button"
                  onClick={() => onReleaseReservation(ticket)}
                  disabled={isResuming || isReleasing}
                  aria-busy={isReleasing}
                  aria-label={`Hủy giữ chỗ vé sự kiện ${ticket.eventTitle}`}
                  className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-danger/20 text-text-secondary hover:text-danger border border-border-subtle hover:border-danger/40 font-bold transition-[background-color,border-color,color,transform] active:scale-[0.98] text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  {isReleasing ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Ban className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>Hủy Giữ Chỗ</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Refund Notice / Button */}
        {ticket.status.toLowerCase() === 'paid' && (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-t border-border-subtle/60 text-xs">
            <div className="text-text-tertiary flex items-center gap-1.5 text-[11px] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
              <span>Hạn hoàn vé: Trước giờ diễn {ticket.refundCutoffHours}h</span>
            </div>

            {ticket.canRefund ? (
              <button
                type="button"
                onClick={() => onInitiateRefund(ticket)}
                disabled={refundingId === ticket.id}
                aria-busy={refundingId === ticket.id}
                aria-label={`Yêu cầu hoàn vé sự kiện ${ticket.eventTitle}`}
                className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-bold transition-[background-color,transform] active:scale-[0.98] text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                {refundingId === ticket.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                )}
                <span>Yêu Cầu Hoàn Vé</span>
              </button>
            ) : (
              <span className="text-text-tertiary text-[11px] italic whitespace-nowrap">
                (Đã quá hạn hoàn vé)
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Right: Live QR Code & Download Box */}
      <div className="p-5 sm:p-6 flex flex-col items-center justify-center md:w-72 bg-surface-2 relative z-10 space-y-3 shrink-0">
        {canShowQr ? (
          <div className="bg-white p-3 rounded-xl shadow-lg ring-1 ring-border-subtle relative" role="img" aria-label={`Mã QR vé điện tử ${ticket.eventTitle}`}>
            <QRCodeSVG id={`qr-svg-${ticket.id}`} value={ticket.qrCodeSignature} size={135} level="H" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex h-[159px] w-[159px] items-center justify-center rounded-xl border border-border-subtle bg-surface-3 p-4 text-center text-xs text-text-tertiary">
            QR sẽ hiển thị sau khi thanh toán được xác nhận.
          </div>
        )}

        <div className="text-center">
          <p className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap tabular-nums">
            Mã đơn: #{ticket.orderCode}
          </p>
          <p className="text-[10px] text-text-tertiary whitespace-nowrap">
            {ticket.status.toLowerCase() === 'used' 
              ? `Đã soát vé lúc ${formatTime(ticket.checkedInAt || '')}` 
              : 'Xuất trình mã QR tại cổng soát vé'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!canShowQr || isDownloadingPdf}
          aria-busy={isDownloadingPdf}
          aria-label={`Tải file vé PDF chuẩn cho sự kiện ${ticket.eventTitle}`}
          className="flex items-center justify-center w-full min-h-11 py-2.5 bg-surface-3 hover:bg-surface-2 border border-border-subtle hover:border-brand-primary text-white text-xs font-bold rounded-xl transition-[background-color,border-color,opacity,transform] shadow-md group/btn active:scale-[0.98] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {isDownloadingPdf ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-brand-primary shrink-0" aria-hidden="true" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5 group-hover/btn:-translate-y-0.5 transition-transform text-brand-primary shrink-0" aria-hidden="true" />
          )}
          <span>{isDownloadingPdf ? 'Đang tạo file PDF...' : 'Tải File Vé PDF Chuẩn'}</span>
        </button>
      </div>
    </div>
  );
});
