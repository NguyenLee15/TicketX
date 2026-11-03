import React, { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface DynamicQrResponse {
  success: boolean;
  data: {
    ticketId: string;
    qrToken: string;
    remainingSeconds: number;
    stepSeconds: number;
    expiresAt: string;
  };
}

interface DynamicQrCodeViewProps {
  ticketId: string;
  fallbackToken: string;
  isUsed?: boolean;
  ticketTitle?: string;
}

export const DynamicQrCodeView: React.FC<DynamicQrCodeViewProps> = ({
  ticketId,
  fallbackToken,
  isUsed = false,
  ticketTitle,
}) => {
  const [token, setToken] = useState<string>(fallbackToken);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [stepSeconds] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDynamicToken = useCallback(async () => {
    if (isUsed) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<DynamicQrResponse>(`/tickets/${ticketId}/dynamic-qr`);
      if (res.data?.success && res.data.data) {
        setToken(res.data.data.qrToken);
        setRemainingSeconds(res.data.data.remainingSeconds);
      }
    } catch (err: unknown) {
      // Graceful fallback to static QR signature
      console.warn('Failed to fetch dynamic QR token, falling back to static token.', err);
      setError('Đang sử dụng mã QR dự phòng');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, isUsed]);

  // Initial fetch on mount
  useEffect(() => {
    if (!isUsed) {
      fetchDynamicToken();
    }
  }, [fetchDynamicToken, isUsed]);

  // 1-second countdown timer
  useEffect(() => {
    if (isUsed) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          fetchDynamicToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchDynamicToken, isUsed]);

  const percentage = Math.max(0, Math.min(100, (remainingSeconds / stepSeconds) * 100));

  return (
    <div className="flex flex-col items-center space-y-2">
      <div 
        className="bg-white p-3 rounded-xl shadow-lg ring-1 ring-border-subtle relative group"
        role="img" 
        aria-label={`Mã QR vé điện tử ${ticketTitle || 'bảo mật động'}`}
      >
        <QRCodeSVG 
          id={`dynamic-qr-${ticketId}`} 
          value={token || fallbackToken} 
          size={135} 
          level="H" 
          aria-hidden="true" 
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl transition-opacity">
            <RefreshCw className="w-5 h-5 text-brand-primary animate-spin" />
          </div>
        )}
      </div>

      {!isUsed && (
        <div className="w-full flex flex-col items-center gap-1.5 px-2">
          {/* Progress bar with countdown */}
          <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                remainingSeconds <= 5 ? 'bg-danger' : 'bg-brand-primary'
              }`}
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={remainingSeconds}
              aria-valuemin={0}
              aria-valuemax={stepSeconds}
            />
          </div>

          <div className="flex items-center justify-between w-full text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1 text-success font-medium">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>QR Động Chống Gian Lận</span>
            </span>
            <span className="tabular-nums font-mono font-semibold text-text-secondary">
              {remainingSeconds}s
            </span>
          </div>

          {error && (
            <p className="text-[10px] text-warning flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{error}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
