import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Loader2, ArrowRight, ShieldAlert, Zap, X } from 'lucide-react';
import { Seat, SeatTier } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SelectedSeatPanelProps {
  selectedSeat?: Seat | null;
  selectedSeats?: Seat[];
  lockTimeLeft: number | null;
  locking: boolean;
  onBookTicket: () => void;
  onRemoveSeat?: (seatId: string) => void;
}

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getTierBadge = (tier: SeatTier) => {
  switch (tier) {
    case 1:
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">VIP</span>;
    case 2:
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Economy</span>;
    default:
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-subtle">Standard</span>;
  }
};

export const SelectedSeatPanel: React.FC<SelectedSeatPanelProps> = ({
  selectedSeat,
  selectedSeats,
  lockTimeLeft,
  locking,
  onBookTicket,
  onRemoveSeat,
}) => {
  const seats = selectedSeats && selectedSeats.length > 0
    ? selectedSeats
    : (selectedSeat ? [selectedSeat] : []);

  const totalPrice = seats.reduce((sum, s) => sum + s.price, 0);
  const hasLockedByMe = seats.some(s => Boolean(s.isLockedByCurrentUser || s.isLockedByMe));

  return (
    <div className="surface-panel p-5 sm:p-6 relative overflow-hidden shadow-xl border border-border-subtle/80 backdrop-blur-md">
      <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-surface-3 flex items-center justify-center text-brand-primary">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <span>Thông Tin Ghế Đang Chọn</span>
        </div>
        {seats.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
            {seats.length}/4 ghế
          </span>
        )}
      </h2>

      {seats.length > 0 ? (
        <div className="space-y-4 animate-slide-up">
          {/* List of selected seats */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {seats.map((seat) => (
              <div
                key={seat.id}
                className="flex justify-between items-center bg-surface-2/80 p-3 rounded-xl border border-brand-primary/30 shadow-inner relative overflow-hidden text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5">
                      <p className="font-extrabold text-white tracking-tight">
                        Hàng {seat.row} - Ghế <span className="tabular-nums">{seat.number}</span>
                      </p>
                      {getTierBadge(seat.tier)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-success tabular-nums">{formatCurrency(seat.price)}</p>
                  {onRemoveSeat && !locking && (
                    <button
                      type="button"
                      onClick={() => onRemoveSeat(seat.id)}
                      className="text-text-tertiary hover:text-danger p-1 rounded transition-colors cursor-pointer"
                      aria-label={`Bỏ chọn ghế hàng ${seat.row} số ${seat.number}`}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total Price Summary */}
          <div className="flex justify-between items-center bg-surface-3/60 px-4 py-2.5 rounded-lg border border-border-subtle">
            <span className="text-xs font-bold text-text-secondary uppercase">
              Tổng cộng ({seats.length} vé):
            </span>
            <span className="text-lg font-black text-success tabular-nums">
              {formatCurrency(totalPrice)}
            </span>
          </div>

          {/* Lock Countdown Timer Display */}
          {lockTimeLeft !== null && (
            <div className={`p-3 bg-surface-2 rounded-xl border flex items-center justify-between transition-colors ${
              lockTimeLeft <= 60 ? 'border-danger/60 shadow-md shadow-danger/10 animate-pulse' : 'border-warning/40'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  lockTimeLeft <= 60 ? 'bg-danger/20 border-danger/30 text-danger' : 'bg-warning/20 border-warning/30 text-warning'
                }`}>
                  <Clock className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">Thời gian giữ chỗ</p>
                  <p className={`text-[11px] font-bold transition-colors ${lockTimeLeft <= 60 ? 'text-danger' : 'text-warning'}`}>
                    {lockTimeLeft <= 60 ? 'Sắp hết thời gian' : 'Đang khóa độc quyền'}
                  </p>
                </div>
              </div>
              <span role="timer" aria-label={`Thời gian giữ chỗ còn ${formatTimer(lockTimeLeft)}`} className={`text-xl font-mono font-black px-2.5 py-0.5 rounded-lg border tabular-nums transition-colors ${
                lockTimeLeft <= 60 ? 'text-danger bg-danger/10 border-danger/30' : 'text-warning bg-warning/10 border-warning/20'
              }`}>
                {formatTimer(lockTimeLeft)}
              </span>
              <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {lockTimeLeft === 300 && "Thời gian giữ chỗ còn 5 phút."}
                {lockTimeLeft === 120 && "Thời gian giữ chỗ còn 2 phút."}
                {lockTimeLeft === 60 && "Cảnh báo: Thời gian giữ chỗ chỉ còn 1 phút."}
                {lockTimeLeft === 30 && "Thời gian giữ chỗ còn 30 giây."}
                {lockTimeLeft === 0 && "Thời gian giữ chỗ đã hết hạn."}
              </div>
            </div>
          )}

          {hasLockedByMe ? (
            <Link
              to="/my-tickets"
              aria-label={seats.length === 1 ? `Tiếp tục thanh toán cho ghế hàng ${seats[0].row} số ${seats[0].number}` : "Tiếp tục thanh toán cho các ghế đang giữ"}
              className="w-full min-h-11 py-3.5 bg-warning hover:bg-warning/90 text-surface-0 font-extrabold rounded-lg transition-[background-color,transform] flex items-center justify-center text-sm group relative overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning cursor-pointer"
            >
              <span>Ghế Đang Giữ - Tiếp Tục Thanh Toán</span>
              <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBookTicket}
              disabled={locking}
              aria-busy={locking}
              aria-label={seats.length === 1 ? `Khóa ghế hàng ${seats[0].row} số ${seats[0].number} và đặt vé` : `Khóa ${seats.length} ghế và đặt vé`}
              className="w-full min-h-11 py-3.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center text-sm group relative overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              {locking ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span>{seats.length > 1 ? `Khóa ${seats.length} Ghế & Đặt Vé` : 'Khóa Ghế & Đặt Vé'}</span>
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </>
              )}
            </button>
          )}

          <div className="flex items-start gap-2 bg-warning/10 p-3 rounded-lg border border-warning/20 text-warning text-[11px] font-medium leading-relaxed">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <p>Hệ thống tự động khóa giữ ghế độc quyền trong 5 phút. Mỗi tài khoản được đặt tối đa 4 ghế/lần.</p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="text-center p-6 border-2 border-dashed border-border-subtle rounded-xl bg-surface-2/30"
        >
          <div className="w-10 h-10 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-2 text-text-tertiary">
            <Zap className="w-5 h-5 text-brand-primary" aria-hidden="true" />
          </div>
          <p className="text-white font-bold text-xs sm:text-sm mb-0.5">Chưa chọn ghế</p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Nhấp vào các ghế còn trống trên sơ đồ khán đài để chọn tối đa 4 ghế và tiến hành giữ chỗ.
          </p>
        </div>
      )}
    </div>
  );
};
