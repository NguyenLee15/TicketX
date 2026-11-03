import { useState, useCallback, useRef, useEffect } from 'react';
import { ShieldCheck, Volume2, Wifi, WifiOff, Download, RefreshCw, Database } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { scanTicketDataSchema } from '../../schemas/adminSchemas';
import { createIdempotencyKey } from '../../utils/idempotency';
import { ScanCameraPanel } from './Scan/ScanCameraPanel';
import { ScanResultDisplay, ScanResult } from './Scan/ScanResultDisplay';
import { RecentScansList } from './Scan/RecentScansList';
import { playAudioFeedback } from './Scan/scanAudioFeedback';
import { offlineDb } from '../../services/offlineDb';
import type { EventOfflineManifest, SyncOfflineCheckInsResult, ApiResponse } from '../../types';

interface EventOption {
  id: string;
  title: string;
  date: string;
}

export default function AdminScanTicketPage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const isProcessingRef = useRef(false);
  const queryClient = useQueryClient();

  // Offline Mode States
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [offlineCachedCount, setOfflineCachedCount] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load events for selection
  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await api.get<ApiResponse<EventOption[]>>('/api/events/admin-all');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setEvents(res.data.data);
          setSelectedEventId(res.data.data[0].id);
        }
      } catch {
        // May be offline on initial load
      }
    }
    loadEvents();
  }, []);

  // Update cached and pending count whenever selectedEventId changes
  const refreshOfflineCounts = useCallback(async (eventId: string) => {
    if (!eventId) return;
    try {
      const cached = await offlineDb.getOfflineTicketCount(eventId);
      const pending = await offlineDb.getPendingOfflineScans(eventId);
      setOfflineCachedCount(cached);
      setPendingSyncCount(pending.length);
    } catch {
      // IndexedDB not ready or error
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      refreshOfflineCounts(selectedEventId);
    }
  }, [selectedEventId, refreshOfflineCounts]);

  // Sync Offline Scans to Server
  const handleSyncOfflineScans = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      setIsSyncing(true);
      const pending = await offlineDb.getPendingOfflineScans(selectedEventId);
      if (pending.length === 0) {
        toast.success('Hàng đợi soát vé ngoại tuyến đã đồng bộ 100%.');
        return;
      }

      const payload = {
        eventId: selectedEventId,
        checkIns: pending.map((p) => ({
          ticketId: p.ticketId,
          scannedAtUtc: p.scannedAtUtc,
          gate: p.gate,
          staffId: p.staffId,
          deviceId: p.deviceId,
        })),
      };

      const res = await api.post<ApiResponse<SyncOfflineCheckInsResult>>(
        '/api/tickets/sync-offline-checkins',
        payload
      );

      if (res.data?.success && res.data.data) {
        const syncRes = res.data.data;
        const scanIds = pending.map((p) => p.id!).filter(Boolean);
        await offlineDb.clearOfflineScans(scanIds);
        await refreshOfflineCounts(selectedEventId);

        if (syncRes.duplicatesRejected > 0) {
          toast.error(
            `Đã đồng bộ ${syncRes.successful} vé. CẢNH BÁO: Phát hiện ${syncRes.duplicatesRejected} vé quét trùng lặp gian lận!`,
            { duration: 6000 }
          );
        } else {
          toast.success(`Đồng bộ thành công ${syncRes.successful} vé lên máy chủ.`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi đồng bộ dữ liệu';
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedEventId, refreshOfflineCounts]);

  // Online / Offline window events
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false);
      toast.success('Đã kết nối lại Internet. Tự động kiểm tra đồng bộ...');
      if (selectedEventId) {
        void handleSyncOfflineScans();
      }
    };
    const handleOffline = () => {
      setIsOfflineMode(true);
      toast.error('Mất kết nối mạng! Chuyển sang chế độ soát vé ngoại tuyến.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedEventId, handleSyncOfflineScans]);

  // Download Manifest into IndexedDB
  const handleDownloadManifest = async () => {
    if (!selectedEventId) {
      toast.error('Vui lòng chọn sự kiện trước khi tải dữ liệu.');
      return;
    }
    try {
      setIsDownloading(true);
      const res = await api.get<ApiResponse<EventOfflineManifest>>(
        `/api/tickets/events/${selectedEventId}/offline-manifest`
      );
      if (res.data?.success && res.data.data) {
        await offlineDb.saveEventManifest(selectedEventId, res.data.data.tickets);
        await refreshOfflineCounts(selectedEventId);
        toast.success(`Đã lưu ${res.data.data.totalTickets} vé vào bộ nhớ cục bộ sẵn sàng soát vé offline!`);
      } else {
        toast.error('Không thể tải manifest từ máy chủ.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu offline';
      toast.error(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const createScanId = () => `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const handleVerifyTicket = useCallback(async (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsVerifying(true);

    try {
      // Offline mode branch
      if (isOfflineMode || !navigator.onLine) {
        if (!selectedEventId) {
          toast.error('Vui lòng chọn sự kiện trước khi soát vé.');
          return;
        }

        const localResult = await offlineDb.verifyTicketLocally(selectedEventId, trimmed);
        if (localResult.success && localResult.ticket) {
          await offlineDb.enqueueOfflineScan(selectedEventId, localResult.ticket.ticketId, 'Gate A');
          await refreshOfflineCounts(selectedEventId);
          playAudioFeedback('success');

          const result: ScanResult = {
            id: createScanId(),
            status: 'valid',
            message: `[NGOẠI TUYẾN] ${localResult.message}`,
            ticket: {
              ticketId: localResult.ticket.ticketId,
              eventTitle: 'Sự kiện (Ngoại tuyến)',
              attendeeName: localResult.ticket.attendeeName,
              row: localResult.ticket.seatNumber.charAt(0) || 'A',
              number: parseInt(localResult.ticket.seatNumber.slice(1), 10) || 1,
              tier: 0,
            },
          };
          setScanResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
          toast.success(`[Offline] Cho phép vào: ${localResult.ticket.attendeeName}`);
        } else if (localResult.ticket?.isAlreadyUsed) {
          playAudioFeedback('warning');
          const result: ScanResult = {
            id: createScanId(),
            status: 'already_used',
            message: `[NGOẠI TUYẾN] ${localResult.message}`,
          };
          setScanResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
          toast.error(localResult.message, { duration: 4000 });
        } else {
          playAudioFeedback('failure');
          const result: ScanResult = {
            id: createScanId(),
            status: 'invalid',
            message: `[NGOẠI TUYẾN] ${localResult.message}`,
          };
          setScanResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
          toast.error(localResult.message);
        }
        return;
      }

      // Online mode branch
      if (!trimmed.includes('.')) {
        playAudioFeedback('failure');
        const result: ScanResult = {
          id: createScanId(),
          status: 'invalid',
          message: 'Mã vé không đúng định dạng chữ ký số (payload.signature).',
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error('Mã vé không đúng định dạng chữ ký số hợp lệ.');
        return;
      }

      const response = await api.post(
        '/api/tickets/check-in',
        { qrToken: trimmed },
        { headers: { 'Idempotency-Key': createIdempotencyKey() } }
      );

      if (response.data?.success) {
        const parsed = scanTicketDataSchema.safeParse(response.data.data);
        if (parsed.success) {
          playAudioFeedback('success');
          const data = parsed.data;
          const result: ScanResult = {
            id: createScanId(),
            status: 'valid',
            message: 'VÉ HỢP LỆ — XÁC NHẬN CHO VÀO CỬA SỰ KIỆN',
            ticket: data,
          };
          setScanResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
          toast.success(`Check-in thành công: ${data.attendeeName} - Ghế ${data.row}${data.number}`);
          void queryClient.invalidateQueries({ queryKey: ['tickets'] });
          void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
        } else {
          playAudioFeedback('failure');
          const result: ScanResult = {
            id: createScanId(),
            status: 'invalid',
            message: 'Dữ liệu vé từ máy chủ không đúng định dạng.',
          };
          setScanResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
          toast.error('Dữ liệu vé từ máy chủ không hợp lệ.');
        }
      } else {
        playAudioFeedback('failure');
        const failMsg = response.data?.message || 'Vé không hợp lệ hoặc đã bị hủy.';
        const result: ScanResult = {
          id: createScanId(),
          status: 'invalid',
          message: failMsg,
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error(failMsg);
      }
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { status?: number; data?: { message?: string; code?: string } };
        message?: string;
        code?: string;
      };
      const isNetworkError =
        !apiErr.response ||
        apiErr.message === 'Network Error' ||
        apiErr.code === 'ERR_NETWORK' ||
        apiErr.code === 'ECONNABORTED';

      if (isNetworkError) {
        playAudioFeedback('warning');
        const netMsg = 'Mất kết nối máy chủ khi soát vé. Hãy bật Chế độ Ngoại Tuyến để tiếp tục soát vé!';
        const result: ScanResult = {
          id: createScanId(),
          status: 'conflict',
          message: netMsg,
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error(netMsg, { duration: 5000 });
        setIsOfflineMode(true);
        return;
      }

      const code = apiErr.response?.data?.code;
      const msg = apiErr.response?.data?.message || 'Vé không hợp lệ hoặc đã bị hủy.';

      if (code === 'TICKET_ALREADY_USED') {
        playAudioFeedback('warning');
        const result: ScanResult = {
          id: createScanId(),
          status: 'already_used',
          message: msg,
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 4000 });
      } else if (code === 'CHECKIN_CONCURRENCY_CONFLICT' || apiErr.response?.status === 409) {
        playAudioFeedback('warning');
        const result: ScanResult = {
          id: createScanId(),
          status: 'conflict',
          message: msg,
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 5000 });
      } else {
        playAudioFeedback('failure');
        const result: ScanResult = {
          id: createScanId(),
          status: 'invalid',
          message: msg,
        };
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 4000 });
      }
    } finally {
      setIsVerifying(false);
      isProcessingRef.current = false;
    }
  }, [isOfflineMode, selectedEventId, queryClient, refreshOfflineCounts]);

  return (
    <div className="space-y-6 pb-8 animate-fade-in text-text-primary max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Trạm Soát Vé An Ninh Cổng
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Trạm Soát Vé Điện Tử</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Xác thực chữ ký số thời gian thực qua Camera WebRTC và hỗ trợ soát vé ngoại tuyến IndexedDB khi mất sóng.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-3 border border-border-subtle text-xs text-text-secondary shrink-0">
          <Volume2 className="w-4 h-4 text-brand-primary" aria-hidden="true" />
          <span>Âm thanh Web Audio Singleton</span>
        </div>
      </div>

      {/* Offline Mode Operations Toolbar */}
      <div className="p-4 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label htmlFor="scan-event-select" className="text-[11px] font-semibold uppercase text-text-tertiary block">
              Sự kiện trực chiến
            </label>
            <select
              id="scan-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="h-8 w-px bg-border-subtle hidden sm:block" />

          {/* Toggle offline mode */}
          <button
            type="button"
            onClick={() => setIsOfflineMode((prev) => !prev)}
            className={`min-h-9 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
              isOfflineMode
                ? 'bg-warning/15 text-warning border-warning/30'
                : 'bg-surface-2 text-text-secondary border-border-subtle hover:text-white'
            }`}
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5 text-warning" /> : <Wifi className="w-3.5 h-3.5 text-success" />}
            <span>{isOfflineMode ? 'Chế độ Ngoại Tuyến: BẬT' : 'Chế độ Trực Tuyến: BẬT'}</span>
          </button>

          {/* Cached count pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border-subtle text-xs text-text-secondary">
            <Database className="w-3.5 h-3.5 text-brand-primary" />
            <span>Kho offline: <strong className="text-white">{offlineCachedCount}</strong> vé</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadManifest}
            disabled={isDownloading || !selectedEventId}
            className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-white text-xs font-semibold border border-border-subtle transition-colors"
            title="Tải toàn bộ vé hợp lệ của sự kiện vào IndexedDB trên máy"
          >
            <Download className="w-3.5 h-3.5 text-brand-primary" />
            <span>{isDownloading ? 'Đang tải...' : 'Tải Data Offline'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncOfflineScans}
            disabled={isSyncing || pendingSyncCount === 0}
            className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-white text-xs font-semibold transition-colors shadow-sm shadow-brand-glow"
            title="Đồng bộ các lượt quét ngoại tuyến lên máy chủ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ ({pendingSyncCount})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Camera Scanner & Quick Input */}
        <div className="lg:col-span-7 space-y-5">
          <ScanCameraPanel onScanToken={handleVerifyTicket} isVerifying={isVerifying} />
        </div>

        {/* Right Column: Scan Result Card & Recent History */}
        <div className="lg:col-span-5 space-y-5">
          <ScanResultDisplay scanResult={scanResult} />
          <RecentScansList recentScans={recentScans} />
        </div>
      </div>
    </div>
  );
}
