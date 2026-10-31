import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventDetailPage from './EventDetailPage';
import api from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

let signalRCallback: ((payload: any) => void) | null = null;

vi.mock('../hooks/useSeatSignalR', () => ({
  useSeatSignalR: (_eventId: string | undefined, onSeatStatusChanged: (data: any) => void) => {
    signalRCallback = onSeatStatusChanged;
    return {
      status: 'disconnected',
      retry: vi.fn(),
    };
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('EventDetailPage — Clock Skew Compensation & A11y (Round 35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', name: 'Customer', email: 'c@test.local', role: 'Customer' },
      token: null,
      isHydrating: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('FP-02 & FP-06: compensates when client clock is skewed +10 minutes ahead of serverTime on seat lock and renders 44px SignalR retry button', async () => {
    const serverNowMs = Date.now() - 10 * 60 * 1000; // Server is 10 minutes behind client clock
    const serverTimeIso = new Date(serverNowMs).toISOString();
    const expiresAtIso = new Date(serverNowMs + 5 * 60 * 1000).toISOString(); // 5 minutes after serverTime, which is Still 5 minutes in the PAST relative to raw client Date.now()!

    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Live Concert 2027',
          description: 'Description',
          date: '2027-12-01T19:00:00Z',
          endDate: '2027-12-01T22:00:00Z',
          location: 'HCMC',
          venueName: 'Stadium',
          totalSeats: 1,
          availableSeatsCount: 1,
          basePrice: 250000,
          status: 1,
          seats: [
            {
              id: '22222222-2222-2222-2222-222222222222',
              eventId: '11111111-1111-1111-1111-111111111111',
              row: 'A',
              number: 1,
              price: 250000,
              status: 0,
              tier: 0,
              version: 'AAAAAAAAAAAAAAAAAAAAAA==',
            },
          ],
        },
      },
    });

    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url.includes('/lock')) {
        return {
          data: {
            success: true,
            data: {
              ticketId: '33333333-3333-3333-3333-333333333333',
              expiresAt: expiresAtIso,
              serverTime: serverTimeIso,
            },
          },
        };
      }
      if (url.includes('/api/payments/create-link')) {
        return {
          data: {
            success: true,
            data: {
              orderCode: '998877',
              amount: 250000,
              checkoutUrl: '/mock-payos?orderCode=998877',
              qrCode: 'https://example.com/qr.png',
              accountNumber: '0123456789',
              accountName: 'TICKEX',
              bin: '970415',
              description: 'TICKEX 998877',
            },
          },
        };
      }
      return { data: { success: true } };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/events/11111111-1111-1111-1111-111111111111']}>
          <Routes>
            <Route path="/events/:id" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify SignalR retry button has min-h-11 and focus-visible:ring-2 (FP-06)
    const retryBtn = await screen.findByRole('button', { name: /Thử lại kết nối đồng bộ ghế/i });
    expect(retryBtn.className).toContain('min-h-11');
    expect(retryBtn.className).toContain('focus-visible:ring-2');

    // Select seat A1
    const seatBtn = await screen.findByRole('button', { name: /Hàng A, ghế 1/i });
    fireEvent.click(seatBtn);

    // Click book ticket button
    const bookBtn = await screen.findByRole('button', { name: /Khóa ghế hàng A số 1 và đặt vé/i });
    fireEvent.click(bookBtn);

    // CheckoutModal should open and show active countdown (~04:59 / 05:00) in both SelectedSeatPanel and CheckoutModal instead of expiring immediately due to client clock skew
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/5:00|4:59|4:58/).length).toBeGreaterThanOrEqual(2);
  });

  it('CUS-02: restores countdown timer when selecting an already locked seat by current user', async () => {
    const now = Date.now();
    const serverTime = new Date(now).toISOString();
    const expiresAt = new Date(now + 4 * 60 * 1000).toISOString(); // 4 minutes remaining

    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Live Concert 2027',
          description: 'Description',
          date: '2027-12-01T19:00:00Z',
          totalSeats: 1,
          availableSeatsCount: 0,
          basePrice: 250000,
          status: 1,
          serverTime,
          seats: [
            {
              id: '22222222-2222-2222-2222-222222222222',
              eventId: '11111111-1111-1111-1111-111111111111',
              row: 'A',
              number: 1,
              price: 250000,
              status: 1, // Locked
              tier: 0,
              version: 'AAAAAAAAAAAAAAAAAAAAAA==',
              isLockedByCurrentUser: true,
              lockExpiresAt: expiresAt,
            },
          ],
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/events/11111111-1111-1111-1111-111111111111']}>
          <Routes>
            <Route path="/events/:id" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Click locked seat A1
    const seatBtn = await screen.findByRole('button', { name: /Hàng A, ghế 1/i });
    fireEvent.click(seatBtn);

    // SelectedSeatPanel should display "Ghế Đang Giữ - Tiếp Tục Thanh Toán" and active countdown timer (~04:00 / 03:59)
    await waitFor(() => {
      expect(screen.getByText(/Ghế Đang Giữ - Tiếp Tục Thanh Toán/i)).toBeInTheDocument();
      expect(screen.getByText(/04:00|03:59|03:58/)).toBeInTheDocument();
    });
  });

  it('CUS-01: updates seat version and status upon SignalR event without dropping optimistic state', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Live Concert 2027',
          description: 'Description',
          date: '2027-12-01T19:00:00Z',
          totalSeats: 1,
          availableSeatsCount: 1,
          basePrice: 250000,
          status: 1,
          seats: [
            {
              id: '22222222-2222-2222-2222-222222222222',
              eventId: '11111111-1111-1111-1111-111111111111',
              row: 'A',
              number: 1,
              price: 250000,
              status: 0,
              tier: 0,
              version: 'AAAAAAAAAAAAAAAAAAAAAA==',
            },
          ],
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/events/11111111-1111-1111-1111-111111111111']}>
          <Routes>
            <Route path="/events/:id" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByRole('button', { name: /Hàng A, ghế 1/i });

    // Simulate SignalR status changed with new Version
    expect(signalRCallback).not.toBeNull();
    signalRCallback!({
      seatId: '22222222-2222-2222-2222-222222222222',
      status: 1,
      version: 'BBBBBBBBBBBBBBBBBBBBBB==',
      isLockedByCurrentUser: false,
    });

    // Check query cache directly: seat should now have status: 1 and version: 'BBBBBBBBBBBBBBBBBBBBBB=='
    await waitFor(() => {
      const cached = queryClient.getQueryData<any>(['events', 'detail', '11111111-1111-1111-1111-111111111111']);
      expect(cached?.seats[0].status).toBe(1);
      expect(cached?.seats[0].version).toBe('BBBBBBBBBBBBBBBBBBBBBB==');
    });

    // api.get should NOT have been called again (was called only once for initial load)
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

