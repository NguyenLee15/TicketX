import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { EventDetail, Seat, SeatStatus, SeatStatusChangedPayload } from '../types';
import CheckoutModal from '../components/CheckoutModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useSeatSignalR } from '../hooks/useSeatSignalR';
import api from '../services/api';
import { EventInfoCard } from './EventDetail/EventInfoCard';
import { SeatMap } from './EventDetail/SeatMap';
import { SelectedSeatPanel } from './EventDetail/SelectedSeatPanel';
import { SkeletonSeatMap } from '../components/Skeletons/SkeletonSeatMap';
import { clearCheckoutState, shouldPreserveSeatSelection } from '../utils/customerState';
import { useReservationCountdown } from '../hooks/useReservationCountdown';
import { useEventDetailQuery } from '../hooks/useCustomerQueries';
import { createIdempotencyKey } from '../utils/idempotency';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    data: event,
    isLoading: loading,
    isError: loadError,
    refetch: refetchEvent,
  } = useEventDetailQuery(id);

  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const selectedSeat = selectedSeats[0] ?? null;

  const handleRemoveSeat = useCallback((seatId: string) => {
    setSelectedSeats(prev => prev.filter(s => s.id !== seatId));
  }, []);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [lockServerTime, setLockServerTime] = useState<string | null>(null);

  const { isAuthenticated, user, isHydrating } = useAuthStore();
  const navigate = useNavigate();
  const bookingIdempotencyKeyRef = useRef<string | null>(null);
  const lockingSeatRef = useRef<Seat | null>(null);
  const isCheckoutOpenRef = useRef(isCheckoutOpen);
  isCheckoutOpenRef.current = isCheckoutOpen;

  // Reset seat selection & checkout states when switching between event routes
  useEffect(() => {
    setSelectedSeats([]);
    setIsCheckoutOpen(false);
    bookingIdempotencyKeyRef.current = null;
    lockingSeatRef.current = null;
    const cleared = clearCheckoutState();
    setTicketId(cleared.ticketId);
    setLockExpiresAt(cleared.lockExpiresAt);
    setLockServerTime(null);
  }, [id]);

  // Lock expiration callback
  const handleLockExpire = useCallback(() => {
    toast.error('Hạn giữ chỗ 5 phút đã hết. Ghế đã được tự động mở khóa!', { duration: 5000 });
    lockingSeatRef.current = null;
    bookingIdempotencyKeyRef.current = null;
    const cleared = clearCheckoutState();
    setTicketId(cleared.ticketId);
    setLockExpiresAt(cleared.lockExpiresAt);
    setLockServerTime(null);
    if (!isCheckoutOpenRef.current) {
      setSelectedSeats([]);
      void refetchEvent();
    }
  }, [refetchEvent]);

  // Lock timer synchronized with server expiresAt & serverTime
  const { timeLeft: lockTimeLeft, setTimeLeft: setLockTimeLeft } = useReservationCountdown({
    lockExpiresAt,
    serverTime: lockServerTime,
    onExpire: handleLockExpire
  });

  // Handle Real-time Seat Status Updates from SignalR
  const handleSeatStatusChanged = useCallback((payload: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => {
    queryClient.setQueryData<EventDetail>(['events', 'detail', id], (prev) => {
      if (!prev) return prev;
      const seats = prev.seats ?? [];
      const isLockedByMe = payload.status === 1 && Boolean(
        payload.isLockedByCurrentUser ||
        payload.isLockedByMe ||
        lockingSeatRef.current?.id === payload.seatId ||
        (user?.id && (payload.reservationOwnerId === user.id || (payload as unknown as Record<string, unknown>).ReservationOwnerId === user.id))
      );
      const newSeats = seats.map(seat => 
        seat.id === payload.seatId
          ? {
              ...seat,
              status: payload.status,
              version: payload.version ?? seat.version,
              isLockedByMe,
              isLockedByCurrentUser: isLockedByMe,
              lockExpiresAt: isLockedByMe ? (payload.expiresAt ?? seat.lockExpiresAt) : null,
            }
          : seat
      );
      return { ...prev, seats: newSeats };
    });

    // If our currently selected seats were locked or bought by someone else
    setSelectedSeats(prev => {
      const match = prev.find(s => s.id === payload.seatId);
      if (!match) return prev;

      if (payload.status === 0) {
        return prev.map(s => s.id === payload.seatId ? { ...s, status: 0, isLockedByMe: false, isLockedByCurrentUser: false } : s);
      }

      const isMySeat = Boolean(
        lockingSeatRef.current?.id === payload.seatId ||
        match.isLockedByMe ||
        match.isLockedByCurrentUser ||
        shouldPreserveSeatSelection(match.id, payload, user?.id)
      );

      if (!isMySeat) {
        toast.error(`Ghế ${match.row}${match.number} vừa có người khác giữ chỗ.`);
        const remaining = prev.filter(s => s.id !== payload.seatId);
        if (remaining.length === 0) {
          setLockExpiresAt(null);
          setLockServerTime(null);
          setLockTimeLeft(null);
        }
        return remaining;
      }

      return prev.map(s => s.id === payload.seatId ? {
        ...s,
        status: payload.status,
        version: payload.version ?? s.version,
        isLockedByMe: true,
        isLockedByCurrentUser: true,
        lockExpiresAt: payload.expiresAt ?? s.lockExpiresAt,
      } : s);
    });
  }, [id, queryClient, user?.id, setLockTimeLeft]);

  const handleSeatReconnect = useCallback(() => {
    void refetchEvent();
  }, [refetchEvent]);

  const { status: seatConnectionStatus, retry: retrySeatConnection } = useSeatSignalR(
    id,
    handleSeatStatusChanged,
    handleSeatReconnect
  );

  const handleSeatClick = (seat: Seat) => {
    if (locking) return;
    const isLockedByMe = Boolean(seat.isLockedByCurrentUser || seat.isLockedByMe);
    if (seat.status !== 0 && !isLockedByMe) return; // Allow available seats or seats locked by current user
    if (isHydrating) return;
    if (!isAuthenticated()) {
      toast.error('Vui lòng đăng nhập để chọn ghế và đặt vé.');
      navigate('/login', { state: { from: location } });
      return;
    }
    
    bookingIdempotencyKeyRef.current = null;
    const maxCap = event?.maxTicketsPerUser ?? 4;
    const isAlreadySelected = selectedSeats.some(s => s.id === seat.id);

    if (isAlreadySelected) {
      const nextSeats = selectedSeats.filter(s => s.id !== seat.id);
      setSelectedSeats(nextSeats);
      if (nextSeats.length === 0) {
        setLockExpiresAt(null);
        setLockServerTime(null);
        setLockTimeLeft(null);
      }
    } else {
      if (selectedSeats.length >= maxCap) {
        toast.error(`Bạn chỉ được chọn tối đa ${maxCap} ghế cho mỗi lần đặt.`);
        return;
      }
      const nextSeats = [...selectedSeats, seat];
      setSelectedSeats(nextSeats);
      if (isLockedByMe && seat.lockExpiresAt) {
        setLockExpiresAt(seat.lockExpiresAt);
        setLockServerTime(event?.serverTime ?? null);
      }
    }
  };

  const handleBookTicket = async () => {
    if (selectedSeats.length === 0 || !event) return;
    setLocking(true);
    lockingSeatRef.current = selectedSeats[0];

    if (!bookingIdempotencyKeyRef.current) {
      bookingIdempotencyKeyRef.current = createIdempotencyKey();
    }

    try {
      let res;
      if (selectedSeats.length === 1) {
        const singleSeat = selectedSeats[0];
        res = await api.post(`/api/seats/${singleSeat.id}/lock`, {
          eventId: event.id,
          version: singleSeat.version
        }, {
          headers: {
            'Idempotency-Key': bookingIdempotencyKeyRef.current
          }
        });
      } else {
        res = await api.post(`/api/seats/batch-lock`, {
          eventId: event.id,
          seats: selectedSeats.map(s => ({
            seatId: s.id,
            version: s.version
          }))
        }, {
          headers: {
            'Idempotency-Key': bookingIdempotencyKeyRef.current
          }
        });
      }

      if (res.data.success) {
        bookingIdempotencyKeyRef.current = null;
        setTicketId(res.data.data.ticketId);
        
        setSelectedSeats(prev => prev.map(seat => ({
          ...seat,
          status: 1,
          isLockedByMe: true,
          isLockedByCurrentUser: true,
        })));
        
        // Sync timer with server expiresAt & serverTime (clock skew safe)
        if (res.data.data.expiresAt) {
          const expiresMs = new Date(res.data.data.expiresAt).getTime();
          const serverTimeStr = typeof res.data.data.serverTime === 'string' ? res.data.data.serverTime : null;
          const parsedServerMs = serverTimeStr ? new Date(serverTimeStr).getTime() : Number.NaN;
          const referenceNowMs = !Number.isNaN(parsedServerMs) ? parsedServerMs : Date.now();
          const remainingSecs = Math.floor((expiresMs - referenceNowMs) / 1000);
          if (remainingSecs <= 0) {
            setTicketId(null);
            setLockExpiresAt(null);
            setLockServerTime(null);
            setLockTimeLeft(0);
            setIsCheckoutOpen(false);
            toast.error('Thời gian giữ chỗ đã hết hạn. Vui lòng chọn lại ghế.');
            void refetchEvent();
            return;
          }
          setLockServerTime(serverTimeStr);
          setLockExpiresAt(res.data.data.expiresAt);
          setLockTimeLeft(remainingSecs);
        } else {
          setLockServerTime(null);
          setLockExpiresAt(null);
          setLockTimeLeft(300);
        }

        setIsCheckoutOpen(true);
        const seatNames = selectedSeats.map(s => `${s.row}${s.number}`).join(', ');
        toast.success(`Đã giữ ghế ${seatNames} thành công!`);
      } else {
        toast.error(res.data.message || 'Không thể giữ ghế này. Vui lòng chọn ghế khác.');
        void refetchEvent();
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Ghế vừa có người khác đặt trước hoặc đã xảy ra xung đột. Vui lòng chọn ghế khác!';
      toast.error(msg);
      void refetchEvent();
    } finally {
      setLocking(false);
    }
  };

  if (loading && !event) {
    return <SkeletonSeatMap />;
  }

  if (!event) {
    return (
      <div role={loadError ? "alert" : "status"} className="text-center p-16 surface-panel mt-8">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Info className="w-10 h-10 text-danger" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-bold text-white mb-2">{loadError ? 'Không thể tải sự kiện' : 'Không tìm thấy sự kiện'}</h1>
        <p className="text-text-secondary">Kiểm tra kết nối rồi thử lại.</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            aria-label="Thử lại tải sự kiện"
            onClick={() => void refetchEvent()}
            className="inline-flex min-h-11 items-center justify-center px-6 py-3 bg-brand-primary text-white rounded-xl font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer transition-colors"
          >
            Thử lại
          </button>
          <Link
            to="/"
            aria-label="Quay lại danh sách sự kiện"
            className="inline-flex min-h-11 items-center justify-center px-6 py-3 bg-surface-3 hover:bg-surface-2 text-white rounded-xl transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Quay lại danh sách sự kiện
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-12 relative text-text-primary max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link 
          to="/" 
          aria-label="Quay lại danh sách sự kiện"
          className="inline-flex min-h-11 items-center px-3.5 rounded-xl bg-surface-2 border border-border-subtle text-text-secondary hover:text-white hover:bg-surface-3 active:scale-[0.98] transition-[background-color,color,transform] text-xs sm:text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
          <span>Quay lại danh sách</span>
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border-subtle text-text-secondary text-xs font-semibold" role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${seatConnectionStatus === 'connected' ? 'bg-success' : seatConnectionStatus === 'connecting' || seatConnectionStatus === 'reconnecting' ? 'bg-warning' : 'bg-danger'}`} aria-hidden="true" />
          <span>{seatConnectionStatus === 'connected' ? 'Đã đồng bộ ghế' : seatConnectionStatus === 'connecting' || seatConnectionStatus === 'reconnecting' ? 'Đang kết nối ghế' : 'Chưa đồng bộ ghế'}</span>
          {seatConnectionStatus === 'disconnected' && <button type="button" onClick={retrySeatConnection} aria-label="Thử lại kết nối đồng bộ ghế" className="min-h-11 px-2 inline-flex items-center underline underline-offset-2 hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer">Thử lại</button>}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Event Details (Row 1 on desktop, order-1 on mobile) */}
        <div className="w-full lg:col-span-4 order-1">
          <EventInfoCard event={event} />
        </div>

        {/* Right Col: Interactive Auditorium Seat Map (Row 1..2 on desktop, order-2 on mobile) */}
        <div className="w-full lg:col-span-8 order-2 lg:row-span-2">
          <SeatMap 
            seats={event.seats} 
            selectedSeat={selectedSeat}
            selectedSeats={selectedSeats}
            onSeatClick={handleSeatClick} 
          />
        </div>

        {/* Left Col: Selected Seat Panel (Row 2 on desktop under EventInfoCard, order-3 on mobile) */}
        <div className={`w-full lg:col-span-4 order-3 ${selectedSeats.length > 0 ? 'sticky bottom-3 z-30 lg:static' : ''}`}>
          <SelectedSeatPanel
            selectedSeat={selectedSeat}
            selectedSeats={selectedSeats}
            lockTimeLeft={lockTimeLeft}
            locking={locking}
            onBookTicket={handleBookTicket}
            onRemoveSeat={handleRemoveSeat}
          />
        </div>
      </div>

      {isCheckoutOpen && selectedSeats.length > 0 && ticketId && (
        <CheckoutModal 
          seat={selectedSeats[0]}
          seats={selectedSeats}
          event={event}
          ticketId={ticketId}
          expiresAt={lockExpiresAt || undefined}
          serverTime={lockServerTime}
           onClose={() => {
            setIsCheckoutOpen(false);
            lockingSeatRef.current = null;
            const cleared = clearCheckoutState();
            setTicketId(cleared.ticketId);
            setLockExpiresAt(cleared.lockExpiresAt);
            setLockServerTime(null);
            setLockTimeLeft(cleared.lockTimeLeft);
            setSelectedSeats([]);
            void refetchEvent();
          }} 
        />
      )}
    </div>
  );
}
