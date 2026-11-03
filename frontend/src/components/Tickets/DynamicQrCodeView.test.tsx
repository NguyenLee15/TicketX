import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { DynamicQrCodeView } from './DynamicQrCodeView';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('DynamicQrCodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders fallback token initially and fetches dynamic QR', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          ticketId: 'ticket-123',
          qrToken: 'TICKEX-TOTP:ticket-123:123456:abcd',
          remainingSeconds: 28,
          stepSeconds: 30,
          expiresAt: new Date().toISOString(),
        },
      },
    } as any);

    render(
      <DynamicQrCodeView
        ticketId="ticket-123"
        fallbackToken="STATIC-HMAC-FALLBACK"
        isUsed={false}
      />
    );

    expect(screen.getByRole('img', { name: /mã qr vé điện tử/i })).toBeInTheDocument();
    expect(screen.getByText(/QR Động Chống Gian Lận/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/tickets/ticket-123/dynamic-qr');
      expect(screen.getByText('28s')).toBeInTheDocument();
    });
  });

  it('does not fetch or show countdown when ticket is already used', () => {
    render(
      <DynamicQrCodeView
        ticketId="ticket-used"
        fallbackToken="STATIC-USED"
        isUsed={true}
      />
    );

    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/QR Động Chống Gian Lận/i)).not.toBeInTheDocument();
  });
});
