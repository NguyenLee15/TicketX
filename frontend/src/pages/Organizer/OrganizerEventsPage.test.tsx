import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrganizerEventsPage from './OrganizerEventsPage';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../utils/csvExportUtils', () => ({
  exportOrganizerEventTicketsCsv: vi.fn(),
}));

describe('OrganizerEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders events list with live check-in counter and handles ticket export', async () => {
    const mockEvents = [
      {
        id: 'evt-101',
        title: 'Hanoi Rock Fest 2026',
        date: '2026-12-15T19:00:00Z',
        endDate: '2026-12-15T23:00:00Z',
        location: 'Hà Nội',
        venueName: 'Sân Mỹ Đình',
        category: 'Rock',
        totalSeats: 500,
        soldTickets: 400,
        checkedInTickets: 320,
        grossRevenue: 200000000,
        status: 'Published',
      },
    ];

    const mockTickets = [
      {
        id: 'tick-1',
        orderCode: 123456,
        customerName: 'Trần Văn B',
        customerEmail: 'b@example.com',
        seatRow: 'A',
        seatNumber: 1,
        seatTier: 1,
        price: 500000,
        status: 3,
        paidAt: '2026-12-01T10:00:00Z',
        checkedInAt: '2026-12-15T18:30:00Z',
      },
    ];

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/api/organizer/events') {
        return Promise.resolve({
          data: {
            success: true,
            data: mockEvents,
          },
        });
      }
      if (url === '/api/organizer/events/evt-101/tickets') {
        return Promise.resolve({
          data: {
            success: true,
            data: mockTickets,
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <OrganizerEventsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Hanoi Rock Fest 2026')).toBeInTheDocument();
    });

    // Check Live Check-in text
    expect(screen.getByText(/Live Check-in/i)).toBeInTheDocument();
    expect(screen.getByText(/320 \/ 400 vé/i)).toBeInTheDocument();

    // Export button
    const exportBtn = screen.getByRole('button', { name: /Xuất danh sách vé cho sự kiện Hanoi Rock Fest 2026/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    const { exportOrganizerEventTicketsCsv } = await import('../../utils/csvExportUtils');
    await waitFor(() => {
      expect(exportOrganizerEventTicketsCsv).toHaveBeenCalledWith('Hanoi Rock Fest 2026', mockTickets);
    });
  });
});

