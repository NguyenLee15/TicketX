import React, { useMemo } from 'react';
import { Lock, X, Crown, Check } from 'lucide-react';
import { Seat } from '../../types';
import { SeatLegend } from './SeatLegend';
import { formatCurrency } from '../../utils/formatters';

interface SeatMapProps {
  seats: Seat[];
  selectedSeat?: Seat | null;
  selectedSeats?: Seat[];
  onSeatClick: (seat: Seat) => void;
}

export const SeatMap: React.FC<SeatMapProps> = React.memo(({ seats, selectedSeat, selectedSeats, onSeatClick }) => {
  const formatVND = (price: number) => {
    return formatCurrency(price);
  };

  const getSeatTierInfo = (seat: Seat) => {
    if (seat.tier === 1) {
      return { name: 'VIP', color: 'amber', isVip: true };
    }
    if (seat.tier === 2) {
      return { name: 'Economy (Tiết kiệm)', color: 'emerald', isVip: false };
    }
    return { name: 'Standard (Tiêu chuẩn)', color: 'indigo', isVip: false };
  };

  const getSeatColor = (seat: Seat, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-brand-primary border-brand-primary text-white z-20 ring-2 ring-brand-accent shadow-lg shadow-brand-glow scale-[1.03]';
    }
    const isLockedByMe = seat.isLockedByCurrentUser || seat.isLockedByMe;
    if (isLockedByMe) {
      return 'bg-warning/25 border-warning text-warning hover:border-warning hover:bg-warning/35 cursor-pointer ring-1 ring-warning/50 shadow-sm';
    }
    if (seat.status === 1) {
      return 'bg-warning/20 border-warning/50 text-warning/50 cursor-not-allowed opacity-60'; // Locked
    }
    if (seat.status === 2) {
      return 'bg-danger/20 border-danger/50 text-danger/50 cursor-not-allowed opacity-40'; // Sold
    }

    // Available seat styles by tier with tactile optical depth
    const tier = getSeatTierInfo(seat);
    if (tier.isVip) {
      return 'bg-amber-500/20 border-amber-400/80 hover:border-amber-300 hover:bg-amber-500/35 text-amber-200 cursor-pointer shadow-sm shadow-amber-500/10 hover:shadow-amber-500/25';
    }
    if (tier.name.includes('Economy')) {
      return 'bg-emerald-500/20 border-emerald-400/80 hover:border-emerald-300 hover:bg-emerald-500/35 text-emerald-200 cursor-pointer shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/25';
    }

    return 'bg-surface-2 border-border-subtle hover:border-brand-primary hover:bg-brand-primary/25 text-text-primary cursor-pointer hover:shadow-sm hover:shadow-brand-glow/20';
  };

  // Group seats by row using useMemo to prevent unnecessary recalculations on re-renders
  const rows = useMemo(() => {
    return (seats || []).reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  const sortedRowKeys = useMemo(() => Object.keys(rows).sort(), [rows]);

  return (
    <div className="surface-panel p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden min-h-[480px] lg:min-h-[540px] flex flex-col justify-between border border-border-subtle/80">
      <h2 className="sr-only">Sơ đồ chọn ghế</h2>
      
      {/* Curved Stage Header with Spotlight Ambient Arc */}
      <div className="mb-8 text-center relative z-10 pt-2">
        <div className="w-3/4 max-w-lg mx-auto relative flex flex-col items-center">
          {/* Spotlight Cone Glow */}
          <div className="absolute -top-6 inset-x-0 h-24 stage-spotlight-arch pointer-events-none rounded-t-full opacity-80" aria-hidden="true" />
          {/* Curved Stage Arc */}
          <div className="w-full h-2.5 rounded-full stage-glow-bar relative z-10 mb-3 shadow-lg" />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-3/90 border border-brand-primary/40 shadow-md relative z-10">
            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" aria-hidden="true" />
            <p className="text-xs font-black text-brand-primary-light uppercase tracking-[0.22em]">
              Sân khấu trung tâm
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Scroll Hint */}
      <div className="block md:hidden text-center pb-2 text-xs text-text-tertiary font-medium">
        Vuốt ngang để xem toàn bộ sơ đồ ghế
      </div>

      {/* Seat Matrix Grid */}
      <div role="region" aria-label="Sơ đồ ghế ngồi" tabIndex={0} className="w-full flex-1 justify-center relative z-10 overflow-x-auto pb-4 max-md:hide-scrollbar focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary">
        <div className="min-w-max mx-auto px-4 flex flex-col gap-3 sm:gap-3.5 items-center">
        {sortedRowKeys.map(rowName => {
          const rowSeats = rows[rowName] || [];
          const isVipRow = rowSeats.some(s => s.tier === 1);
          return (
            <div key={rowName} className="flex gap-2.5 sm:gap-4 items-center group/row">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shadow-inner ${
                isVipRow ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-amber-500/10' : 'bg-surface-3 text-text-secondary border border-border-subtle'
              }`}>
                {rowName}
              </div>
              
              <div className="flex gap-1.5 sm:gap-2 md:gap-2.5">
                {[...rowSeats].sort((a, b) => a.number - b.number).map((seat) => {
                  const isSelected = selectedSeats && selectedSeats.length > 0 
                    ? selectedSeats.some(s => s.id === seat.id) 
                    : selectedSeat?.id === seat.id;
                  const isLockedByMe = Boolean(seat.isLockedByCurrentUser || seat.isLockedByMe);
                  const isClickable = seat.status === 0 || isLockedByMe;
                  const tierInfo = getSeatTierInfo(seat);
                  const statusLabel = isSelected
                    ? 'đang chọn'
                    : isLockedByMe
                      ? 'đang được bạn giữ chỗ'
                      : seat.status === 0
                        ? 'còn trống'
                        : seat.status === 1
                          ? 'đang được người khác giữ'
                          : 'đã bán';
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => onSeatClick(seat)}
                      disabled={!isClickable}
                      aria-pressed={isSelected}
                      aria-label={`Hàng ${seat.row}, ghế ${seat.number}, hạng ${tierInfo.name}, ${statusLabel}, giá ${formatVND(seat.price)}`}
                      className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center text-xs font-black transition-[opacity,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.92] relative group/seat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 ${getSeatColor(seat, isSelected)}`}
                    >
                      {/* Subtle status indicator for color-blind accessibility */}
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 text-white absolute -top-1 -right-1" aria-hidden="true" />
                      )}
                      {!isSelected && isLockedByMe && (
                        <Lock className="w-2.5 h-2.5 text-warning absolute -top-1 -right-1" aria-hidden="true" />
                      )}
                      {!isSelected && !isLockedByMe && seat.status === 1 && (
                        <Lock className="w-2.5 h-2.5 text-warning/80 absolute -top-1 -right-1" aria-hidden="true" />
                      )}
                      {!isSelected && seat.status === 2 && (
                        <X className="w-2.5 h-2.5 text-danger/80 absolute -top-1 -right-1" aria-hidden="true" />
                      )}
                      {!isSelected && seat.status === 0 && tierInfo.isVip && (
                        <Crown className="w-2 h-2 text-amber-400 absolute -top-0.5 -right-0.5" aria-hidden="true" />
                      )}
                      <span className="tabular-nums">{seat.number}</span>
                    </button>
                  );
                })}
              </div>

              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shadow-inner ${
                isVipRow ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-amber-500/10' : 'bg-surface-3 text-text-secondary border border-border-subtle'
              }`}>
                {rowName}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Enhanced Seat Legend */}
      <SeatLegend />
    </div>
  );
});
