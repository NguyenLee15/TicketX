import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrganizerSettlementsPage from './OrganizerSettlementsPage';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('OrganizerSettlementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders settlements history correctly', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/api/settlements') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'settle-1',
                eventId: 'evt-1',
                eventTitle: 'Lễ Hội Âm Nhạc EDM',
                organizerId: 'org-1',
                organizerName: 'Công ty Âm Nhạc Trẻ',
                grossRevenue: 100000000,
                commissionRate: 0.05,
                commissionAmount: 5000000,
                refundDeduction: 0,
                netPayout: 95000000,
                bankName: 'Vietcombank',
                bankAccountNumber: '987654321',
                accountHolder: 'CONG TY AM NHAC TRE',
                status: 1, // Pending
                requestedAt: '2026-11-03T10:00:00Z',
              },
            ],
          },
        });
      }
      if (url === '/api/organizer/events') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'evt-1',
                title: 'Lễ Hội Âm Nhạc EDM',
                date: '2026-12-01T19:00:00Z',
                grossRevenue: 100000000,
                totalSeats: 500,
                soldTickets: 400,
                status: 1,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <OrganizerSettlementsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Quyết Toán & Đối Soát Doanh Thu/i)).toBeInTheDocument();
    });

    // Verify settlement item rendered
    expect(screen.getByText('Lễ Hội Âm Nhạc EDM')).toBeInTheDocument();
    expect(screen.getByText('Chờ phê duyệt')).toBeInTheDocument();
    expect(screen.getByText('CONG TY AM NHAC TRE')).toBeInTheDocument();
    expect(screen.getByText('987654321')).toBeInTheDocument();
  });

  it('opens modal and submits new settlement request', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/api/settlements') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/api/organizer/events') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'evt-1',
                title: 'Hội Thảo Công Nghệ AI 2026',
                date: '2026-12-01T19:00:00Z',
                grossRevenue: 50000000,
                totalSeats: 200,
                soldTickets: 100,
                status: 1,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: 'settle-new-id' },
    });

    render(
      <MemoryRouter>
        <OrganizerSettlementsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yêu Cầu Quyết Toán Mới/i })).toBeInTheDocument();
    });

    // Click button to open modal
    const openBtn = screen.getByRole('button', { name: /Yêu Cầu Quyết Toán Mới/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole('heading', { name: /Yêu Cầu Quyết Toán Doanh Thu/i })).toBeInTheDocument();

    // Fill form
    const accNumberInput = screen.getByLabelText(/Số Tài Khoản Ngân Hàng/i);
    const accHolderInput = screen.getByLabelText(/Tên Chủ Tài Khoản/i);

    fireEvent.change(accNumberInput, { target: { value: '0123456789' } });
    fireEvent.change(accHolderInput, { target: { value: 'NGUYEN VAN A' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Gửi Yêu Cầu Quyết Toán/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/settlements/request',
        expect.objectContaining({
          eventId: 'evt-1',
          bankName: 'Vietcombank',
          bankAccountNumber: '0123456789',
          bankAccountHolder: 'NGUYEN VAN A',
        })
      );
    });
  });
});
