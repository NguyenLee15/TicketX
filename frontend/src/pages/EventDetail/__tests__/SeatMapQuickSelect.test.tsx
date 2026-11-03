import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SeatMap } from '../SeatMap';
import { Seat, SeatTier, SeatStatus } from '../../../types';

afterEach(() => {
  cleanup();
});

describe('SeatMap - Quick Selection Toolbar', () => {
  const createSeat = (row: string, number: number, status: SeatStatus = 0, tier: SeatTier = 1): Seat => ({
    id: `seat-${row}-${number}`,
    eventId: 'event-1',
    row,
    number,
    tier,
    price: 500000,
    status,
    version: 'v1',
  });

  const mockSeats: Seat[] = [
    createSeat('A', 1, 0),
    createSeat('A', 2, 0),
    createSeat('A', 3, 0),
    createSeat('A', 4, 0),
    createSeat('B', 1, 0),
  ];

  it('renders quick selection buttons when onQuickSelectSeats is provided', () => {
    render(
      <SeatMap
        seats={mockSeats}
        onSeatClick={vi.fn()}
        onQuickSelectSeats={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Chọn nhanh 2 ghế liền kề/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chọn nhanh 4 ghế liền kề/i })).toBeInTheDocument();
  });

  it('selects 2 adjacent seats when "Cặp 2 ghế" button is clicked', () => {
    const onQuickSelect = vi.fn();
    render(
      <SeatMap
        seats={mockSeats}
        onSeatClick={vi.fn()}
        onQuickSelectSeats={onQuickSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Chọn nhanh 2 ghế liền kề/i }));

    expect(onQuickSelect).toHaveBeenCalledTimes(1);
    const selected = onQuickSelect.mock.calls[0][0] as Seat[];
    expect(selected).toHaveLength(2);
    expect(selected[0].number).toBe(1);
    expect(selected[1].number).toBe(2);
  });

  it('selects 4 adjacent seats when "Nhóm 4 ghế" button is clicked', () => {
    const onQuickSelect = vi.fn();
    render(
      <SeatMap
        seats={mockSeats}
        onSeatClick={vi.fn()}
        onQuickSelectSeats={onQuickSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Chọn nhanh 4 ghế liền kề/i }));

    expect(onQuickSelect).toHaveBeenCalledTimes(1);
    const selected = onQuickSelect.mock.calls[0][0] as Seat[];
    expect(selected).toHaveLength(4);
    expect(selected.map((s) => s.number)).toEqual([1, 2, 3, 4]);
  });

  it('renders "Bỏ chọn" button when seats are selected and triggers onClearSeats', () => {
    const onClearSeats = vi.fn();
    render(
      <SeatMap
        seats={mockSeats}
        selectedSeats={[mockSeats[0], mockSeats[1]]}
        onSeatClick={vi.fn()}
        onQuickSelectSeats={vi.fn()}
        onClearSeats={onClearSeats}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /Bỏ chọn tất cả ghế/i });
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveTextContent('Bỏ chọn (2)');

    fireEvent.click(clearBtn);
    expect(onClearSeats).toHaveBeenCalledTimes(1);
  });
});
