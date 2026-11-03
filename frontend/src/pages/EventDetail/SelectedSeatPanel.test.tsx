import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SelectedSeatPanel } from './SelectedSeatPanel';
import { Seat } from '../../types';

describe('SelectedSeatPanel — Multi-Seat Batch Selection UI', () => {
  const mockSeats: Seat[] = [
    {
      id: 'seat-1',
      eventId: 'ev-1',
      row: 'A',
      number: 1,
      tier: 1, // VIP
      price: 500000,
      status: 0,
      version: 'ver-1',
    },
    {
      id: 'seat-2',
      eventId: 'ev-1',
      row: 'A',
      number: 2,
      tier: 1, // VIP
      price: 500000,
      status: 0,
      version: 'ver-2',
    },
    {
      id: 'seat-3',
      eventId: 'ev-1',
      row: 'B',
      number: 10,
      tier: 2, // Economy
      price: 200000,
      status: 0,
      version: 'ver-3',
    },
  ];

  it('renders empty selection state guide when no seat is selected', () => {
    render(
      <MemoryRouter>
        <SelectedSeatPanel
          selectedSeats={[]}
          lockTimeLeft={null}
          locking={false}
          onBookTicket={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Chưa chọn ghế')).toBeInTheDocument();
    expect(screen.getByText(/Nhấp vào các ghế còn trống trên sơ đồ/i)).toBeInTheDocument();
  });

  it('renders multi-seat selection with total counter badge, summed price, and removes seat on remove click', () => {
    const handleRemove = vi.fn();
    const handleBook = vi.fn();

    render(
      <MemoryRouter>
        <SelectedSeatPanel
          selectedSeats={mockSeats}
          lockTimeLeft={null}
          locking={false}
          onBookTicket={handleBook}
          onRemoveSeat={handleRemove}
        />
      </MemoryRouter>
    );

    // Header badge
    expect(screen.getByText('3/4 ghế')).toBeInTheDocument();

    // Seat row & numbers
    expect(screen.getAllByText(/Hàng A/i).length).toBe(2);
    expect(screen.getByText(/Hàng B/i)).toBeInTheDocument();

    // Summed total price: 500k + 500k + 200k = 1,200,000đ
    expect(screen.getByText(/1.200.000/i)).toBeInTheDocument();

    // Multi-seat action button label
    const bookBtn = screen.getByRole('button', { name: /Khóa 3 ghế và đặt vé/i });
    expect(bookBtn).toBeInTheDocument();
    fireEvent.click(bookBtn);
    expect(handleBook).toHaveBeenCalledTimes(1);

    // Remove button
    const removeBtn = screen.getByRole('button', { name: /Bỏ chọn ghế hàng A số 1/i });
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledWith('seat-1');
  });

  it('renders locked countdown timer and resume payment link when seats are locked by user', () => {
    const lockedSeats: Seat[] = [
      {
        ...mockSeats[0],
        status: 1,
        isLockedByCurrentUser: true,
      },
      {
        ...mockSeats[1],
        status: 1,
        isLockedByCurrentUser: true,
      },
    ];

    render(
      <MemoryRouter>
        <SelectedSeatPanel
          selectedSeats={lockedSeats}
          lockTimeLeft={240}
          locking={false}
          onBookTicket={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('04:00')).toBeInTheDocument();
    expect(screen.getByText(/Đang khóa độc quyền/i)).toBeInTheDocument();

    const resumeLink = screen.getByRole('link', { name: /Tiếp tục thanh toán cho các ghế đang giữ/i });
    expect(resumeLink).toBeInTheDocument();
    expect(resumeLink).toHaveAttribute('href', '/my-tickets');
  });
});
