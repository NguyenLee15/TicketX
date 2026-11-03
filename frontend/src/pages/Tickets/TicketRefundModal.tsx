import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import { formatCurrency } from '../../utils/formatters';
import { TicketItemData } from './TicketCard';

interface TicketRefundModalProps {
  candidate: TicketItemData | null;
  refundingId: string | null;
  refundError?: { code?: string; message?: string } | null;
  onClose: () => void;
  onConfirm: (candidate: TicketItemData) => Promise<void>;
}

export const TicketRefundModal: React.FC<TicketRefundModalProps> = React.memo(({
  candidate,
  refundingId,
  refundError,
  onClose,
  onConfirm,
}) => {
  const navigate = useNavigate();
  const isMissingBank = refundError?.code === 'REFUND_DESTINATION_REQUIRED';

  const hoursUntilEvent = candidate
    ? (new Date(candidate.eventDate).getTime() - Date.now()) / (1000 * 60 * 60)
    : 0;

  const isMoreThan48h = hoursUntilEvent >= 48;
  const refundRate = isMoreThan48h ? 1.0 : 0.7;
  const estimatedRefundAmount = candidate ? Math.round(candidate.price * refundRate) : 0;

  return (
    <ConfirmModal
      isOpen={Boolean(candidate)}
      onClose={() => { if (!refundingId) onClose(); }}
      onConfirm={async () => {
        if (!candidate) return;
        await onConfirm(candidate);
      }}
      isLoading={Boolean(refundingId)}
      title="Xác nhận yêu cầu hoàn vé"
      confirmText={isMissingBank ? "Thử lại hoàn vé" : "Gửi yêu cầu hoàn"}
      type="warning"
      message={candidate ? (
        <div className="space-y-3 text-xs text-left">
          <p>Bạn đang yêu cầu hoàn vé cho <strong>{candidate.eventTitle}</strong>, hàng {candidate.row} – ghế <span className="tabular-nums">{candidate.number}</span>.</p>
          
          <div className="p-3 bg-surface-2 rounded-xl border border-border-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Chính sách áp dụng:</span>
              <span className="font-semibold text-white">
                {isMoreThan48h ? 'Hoàn 100% (Trước sự kiện >= 48h)' : 'Hoàn 70% (Trước sự kiện 24h - 48h)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Số tiền hoàn dự kiến:</span>
              <strong className="text-success font-display font-bold tabular-nums text-sm">
                {formatCurrency(estimatedRefundAmount)}
              </strong>
            </div>
          </div>

          <p className="text-warning font-semibold">Vé sẽ chuyển sang trạng thái “Đang hoàn tiền” và chỉ hoàn tất sau khi cổng thanh toán xác nhận.</p>
          
          {isMissingBank && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-text-primary">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Chưa có thông tin nhận hoàn tiền</span>
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                Hệ thống cần số tài khoản ngân hàng để chuyển trả tiền hoàn vé. Vui lòng thiết lập tài khoản nhận tiền tại trang Hồ Sơ.
              </p>
              <button
                type="button"
                aria-label="Thiết lập tài khoản ngân hàng nhận tiền hoàn vé"
                onClick={() => {
                  onClose();
                  navigate('/profile?refundBankAccount=1');
                }}
                className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-[background-color,transform] shadow-sm cursor-pointer"
              >
                <span>Thiết lập tài khoản nhận tiền</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      ) : ''}
    />
  );
});
