import { describe, it, expect } from 'vitest';
import { findAdjacentSeats } from './seatSelectionUtils';
import { Seat, SeatTier, SeatStatus } from '../types';

describe('seatSelectionUtils - findAdjacentSeats', () => {
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

  it('returns null for empty or invalid seats array', () => {
    expect(findAdjacentSeats([], 2)).toBeNull();
    expect(findAdjacentSeats(null, 2)).toBeNull();
    expect(findAdjacentSeats(undefined, 2)).toBeNull();
    expect(findAdjacentSeats([createSeat('A', 1)], 0)).toBeNull();
  });

  it('finds a contiguous pair of available seats in the first row', () => {
    const seats: Seat[] = [
      createSeat('A', 1),
      createSeat('A', 2),
      createSeat('A', 3),
      createSeat('B', 1),
      createSeat('B', 2),
    ];

    const pair = findAdjacentSeats(seats, 2);
    expect(pair).not.toBeNull();
    expect(pair).toHaveLength(2);
    expect(pair![0].row).toBe('A');
    expect(pair![0].number).toBe(1);
    expect(pair![1].number).toBe(2);
  });

  it('skips sold or locked seats and finds the contiguous pair', () => {
    const seats: Seat[] = [
      createSeat('A', 1, 2), // Sold
      createSeat('A', 2, 0), // Available
      createSeat('A', 3, 1), // Locked
      createSeat('A', 4, 0), // Available
      createSeat('A', 5, 0), // Available
    ];

    const pair = findAdjacentSeats(seats, 2);
    expect(pair).not.toBeNull();
    expect(pair).toHaveLength(2);
    expect(pair![0].number).toBe(4);
    expect(pair![1].number).toBe(5);
  });

  it('finds a group of 4 contiguous seats', () => {
    const seats: Seat[] = [
      createSeat('A', 1, 0),
      createSeat('A', 2, 0),
      createSeat('A', 3, 0), // only 3 seats in row A
      createSeat('B', 1, 0),
      createSeat('B', 2, 0),
      createSeat('B', 3, 0),
      createSeat('B', 4, 0),
      createSeat('B', 5, 0),
    ];

    const group = findAdjacentSeats(seats, 4);
    expect(group).not.toBeNull();
    expect(group).toHaveLength(4);
    expect(group![0].row).toBe('B');
    expect(group![0].number).toBe(1);
    expect(group![3].number).toBe(4);
  });

  it('returns null if no row has enough contiguous seats', () => {
    const seats: Seat[] = [
      createSeat('A', 1, 0),
      createSeat('A', 3, 0), // gap between 1 and 3
      createSeat('A', 5, 0),
      createSeat('B', 1, 0),
      createSeat('B', 2, 2), // middle seat sold
      createSeat('B', 3, 0),
    ];

    expect(findAdjacentSeats(seats, 2)).toBeNull();
  });

  it('prioritizes preferredTier when requested', () => {
    const seats: Seat[] = [
      createSeat('A', 1, 0, 2), // Standard tier (2)
      createSeat('A', 2, 0, 2),
      createSeat('B', 1, 0, 1), // VIP tier (1)
      createSeat('B', 2, 0, 1),
    ];

    const vipPair = findAdjacentSeats(seats, 2, 1);
    expect(vipPair).not.toBeNull();
    expect(vipPair![0].row).toBe('B');
    expect(vipPair![0].tier).toBe(1);
  });

  it('includes seats locked by the current user as available for selection', () => {
    const seat1 = createSeat('A', 1, 1);
    seat1.isLockedByCurrentUser = true;
    const seat2 = createSeat('A', 2, 0);

    const pair = findAdjacentSeats([seat1, seat2], 2);
    expect(pair).not.toBeNull();
    expect(pair).toHaveLength(2);
  });
});
