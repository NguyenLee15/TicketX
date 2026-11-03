import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeCsvCell,
  downloadCsv,
  exportOrganizerFinancialSummaryCsv,
  exportOrganizerEventTicketsCsv,
} from './csvExportUtils';
import { OrganizerMetrics, OrganizerEvent, OrganizerTicketReportItem } from '../types';

describe('csvExportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('escapeCsvCell', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('returns simple strings and numbers as is', () => {
      expect(escapeCsvCell('Hello')).toBe('Hello');
      expect(escapeCsvCell(12345)).toBe('12345');
      expect(escapeCsvCell(true)).toBe('true');
    });

    it('wraps and escapes cells containing commas, double quotes, or newlines', () => {
      expect(escapeCsvCell('Hà Nội, Việt Nam')).toBe('"Hà Nội, Việt Nam"');
      expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
    });
  });

  describe('downloadCsv', () => {
    it('creates a blob with UTF-8 BOM and triggers download link click', () => {
      let createdBlob: Blob | null = null;
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlob = blob;
        return 'blob:mock-url';
      });
      URL.revokeObjectURL = vi.fn();

      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const el = document.createElementNS('http://www.w3.org/1999/xhtml', 'a') as HTMLAnchorElement;
          el.click = clickSpy;
          return el;
        }
        return document.createElement(tagName);
      });

      downloadCsv('test_export.csv', ['Tên', 'Địa chỉ'], [['Sự kiện 1', 'Hà Nội, VN']]);

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(createdBlob).not.toBeNull();
      expect(createdBlob!.type).toBe('text/csv;charset=utf-8;');

      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('exportOrganizerFinancialSummaryCsv & exportOrganizerEventTicketsCsv', () => {
    it('executes without throwing when passed valid data', () => {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();

      const mockMetrics: OrganizerMetrics = {
        totalEvents: 1,
        totalSeats: 100,
        totalTicketsSold: 80,
        totalCheckedInTickets: 60,
        totalGrossRevenue: 40000000,
        totalCommissionEstimated: 2000000,
        totalNetRevenueEstimated: 38000000,
        averageOccupancyRate: 80,
        liveCheckInRate: 75,
      };

      const mockEvents: OrganizerEvent[] = [
        {
          id: 'evt-1',
          title: 'Rock Storm 2026',
          date: '2026-12-01T19:00:00Z',
          endDate: '2026-12-01T22:00:00Z',
          location: 'Hà Nội',
          venueName: 'Sân vận động Mỹ Đình',
          category: 'Concert',
          totalSeats: 100,
          soldTickets: 80,
          checkedInTickets: 60,
          grossRevenue: 40000000,
          status: 'Published',
        },
      ];

      expect(() => exportOrganizerFinancialSummaryCsv(mockMetrics, mockEvents)).not.toThrow();

      const mockTickets: OrganizerTicketReportItem[] = [
        {
          id: 'tick-1',
          orderCode: 888999,
          customerName: 'Nguyễn Văn A',
          customerEmail: 'a@example.com',
          seatRow: 'A',
          seatNumber: 1,
          seatTier: 1,
          price: 500000,
          status: 3, // Used / Checked in
          paidAt: '2026-11-01T10:00:00Z',
          checkedInAt: '2026-12-01T18:45:00Z',
        },
      ];

      expect(() => exportOrganizerEventTicketsCsv('Rock Storm 2026', mockTickets)).not.toThrow();
    });
  });
});
