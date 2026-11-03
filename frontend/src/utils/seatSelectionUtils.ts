import { Seat } from '../types';

/**
 * Searches for a sequence of adjacent (contiguous) available seats in the same row.
 * A seat is considered available if seat.status === 0 or is already locked by the current user.
 *
 * @param seats All seats in the event
 * @param count Number of consecutive seats requested (e.g. 2 for pair, 4 for group)
 * @param preferredTier Optional tier preference (e.g. 1 for VIP)
 * @returns Array of contiguous seats, or null if no qualifying run is found
 */
export function findAdjacentSeats(
  seats: Seat[] | undefined | null,
  count: number,
  preferredTier?: number
): Seat[] | null {
  if (!seats || seats.length === 0 || count <= 0) {
    return null;
  }

  // Group seats by row
  const rows = seats.reduce((acc, seat) => {
    if (!acc[seat.row]) {
      acc[seat.row] = [];
    }
    acc[seat.row].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

  const sortedRowKeys = Object.keys(rows).sort();

  // Helper to scan a given row for contiguous available seats
  const scanRow = (rowSeats: Seat[], tierFilter?: number): Seat[] | null => {
    const sorted = [...rowSeats].sort((a, b) => a.number - b.number);

    for (let i = 0; i <= sorted.length - count; i++) {
      let isContiguous = true;
      const candidate: Seat[] = [];

      for (let j = 0; j < count; j++) {
        const current = sorted[i + j];
        const isAvailable = current.status === 0 || Boolean(current.isLockedByCurrentUser || current.isLockedByMe);

        if (!isAvailable) {
          isContiguous = false;
          break;
        }

        if (tierFilter !== undefined && current.tier !== tierFilter) {
          isContiguous = false;
          break;
        }

        if (j > 0) {
          const prev = sorted[i + j - 1];
          if (current.number !== prev.number + 1) {
            isContiguous = false;
            break;
          }
        }

        candidate.push(current);
      }

      if (isContiguous && candidate.length === count) {
        return candidate;
      }
    }

    return null;
  };

  // If preferredTier is specified, try searching that tier first
  if (preferredTier !== undefined) {
    for (const rowKey of sortedRowKeys) {
      const match = scanRow(rows[rowKey], preferredTier);
      if (match) return match;
    }
  }

  // General search across all rows from front (A, B, C...) to back
  for (const rowKey of sortedRowKeys) {
    const match = scanRow(rows[rowKey]);
    if (match) return match;
  }

  return null;
}
