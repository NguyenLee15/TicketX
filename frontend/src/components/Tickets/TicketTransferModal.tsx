import React, { useState, useRef } from 'react';
import { Send, AlertTriangle, Loader2, X } from 'lucide-react';
import { useModalAccessibility } from '../Admin/useModalAccessibility';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { TicketItemData } from '../../pages/Tickets/TicketCard';

interface TicketTransferModalProps {
  ticket: TicketItemData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TicketTransferModal: React.FC<TicketTransferModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalAccessibility(isOpen, isSubmitting, onClose, modalRef);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Vui lòng nhập email người nhận.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Định dạng email không hợp lệ.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await api.post(`/tickets/${ticket.id}/transfer`, {
        recipientEmail: cleanEmail,
        note: note.trim() || undefined,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Chuyển nhượng vé thành công!');
        setEmail('');
        setNote('');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể chuyển nhượng vé. Vui lòng thử lại.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-1/95 backdrop-blur-sm animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-surface-1 border border-border-subtle p-6 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto overscroll-contain space-y-4 shadow-2xl relative animate-modal-pop"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-full text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-40"
          aria-label="Đóng hộp thoại chuyển nhượng vé"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-brand-primary/10 text-brand-primary border-brand-primary/30"
          >
            <Send className="w-5 h-5" />
          </div>
          <h2 id="transfer-modal-title" className="text-lg font-bold text-white">
            Chuyển Nhượng Vé Chính Chủ
          </h2>
        </div>

        <div className="p-3 bg-surface-2 rounded-xl text-xs space-y-1 border border-border-subtle">
          <p className="font-semibold text-white">{ticket.eventTitle}</p>
          <p className="text-text-secondary">
            Hàng ghế: <strong className="text-white">{ticket.row}</strong> - Số ghế:{' '}
            <strong className="text-white tabular-nums">{ticket.number}</strong>
          </p>
          <p className="text-text-tertiary font-mono text-[11px] tabular-nums">
            Mã đơn: #{ticket.orderCode}
          </p>
        </div>

        {/* Warning Callout */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-300">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Cảnh báo an toàn chuyển nhượng</span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Sau khi chuyển nhượng, vé và mã QR cũ của bạn sẽ bị vô hiệu hóa ngay lập tức. Người nhận
            sở hữu vé vĩnh viễn trên tài khoản TickeX của họ. Hành động này không thể hoàn tác.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label htmlFor="recipient-email" className="block text-xs font-semibold text-text-secondary">
              Email tài khoản người nhận <span className="text-danger">*</span>
            </label>
            <input
              id="recipient-email"
              type="email"
              required
              placeholder="nguoinhan@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-xs text-white placeholder-text-tertiary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="transfer-note" className="block text-xs font-semibold text-text-secondary">
              Lời nhắn gửi kèm (tùy chọn)
            </label>
            <input
              id="transfer-note"
              type="text"
              maxLength={200}
              placeholder="Tặng bạn vé đi xem cùng mình nhé!"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-xs text-white placeholder-text-tertiary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-danger flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-xs font-bold border border-border-subtle transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold transition-[background-color,transform] active:scale-[0.98] shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang chuyển...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Xác Nhận Chuyển Nhượng</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
