import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrganizerDashboardPage from './OrganizerDashboardPage';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('OrganizerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <MemoryRouter>
        <OrganizerDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Đang tải chỉ số doanh thu ban tổ chức/i)).toBeInTheDocument();
  });

  it('renders KPI metrics and recent events when API call succeeds', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/api/organizer/metrics') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              totalEvents: 2,
              totalSeats: 200,
              totalTicketsSold: 150,
              totalCheckedInTickets: 120,
              totalGrossRevenue: 75000000,
              totalCommissionEstimated: 3750000,
              totalNetRevenueEstimated: 71250000,
              averageOccupancyRate: 75.0,
              liveCheckInRate: 80.0,
            },
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
                title: 'Concert Âm Nhạc Mùa Hè',
                date: '2026-12-01T19:00:00Z',
                endDate: '2026-12-01T22:00:00Z',
                location: 'Hà Nội',
                venueName: 'Cung Thể Thao Quần Ngựa',
                category: 'Âm nhạc',
                totalSeats: 100,
                soldTickets: 80,
                checkedInTickets: 60,
                grossRevenue: 40000000,
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
        <OrganizerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bảng Điều Khiển Ban Tổ Chức/i)).toBeInTheDocument();
    });

    // Check KPI elements
    expect(screen.getByText(/Thực Nhận \(95%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Phí Nền Tảng \(5%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/75.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/80.0%/i)).toBeInTheDocument(); // Live Check-in rate
    expect(screen.getByRole('button', { name: /Xuất báo cáo tài chính định dạng CSV/i })).toBeInTheDocument();

    // Check event row
    expect(screen.getByText('Concert Âm Nhạc Mùa Hè')).toBeInTheDocument();
    expect(screen.getByText(/Cung Thể Thao Quần Ngựa - Hà Nội/i)).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
    expect(screen.getByText('60 / 80')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Mạng bị gián đoạn'));

    render(
      <MemoryRouter>
        <OrganizerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Lỗi kết nối: Mạng bị gián đoạn/i)).toBeInTheDocument();
    });
  });
});
