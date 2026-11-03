import { OrganizerMetrics, OrganizerEvent, OrganizerTicketReportItem } from '../types';

/**
 * Escapes a cell value for standard RFC 4180 CSV compliance:
 * - Doubles any internal double-quotes.
 * - Wraps value in quotes if it contains commas, quotes, or newlines.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts headers and rows to a UTF-8 BOM CSV string and initiates a browser file download.
 * Prepends \uFEFF to guarantee Microsoft Excel opens Vietnamese text without mojibake.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports financial summary and per-event breakdown to CSV.
 */
export function exportOrganizerFinancialSummaryCsv(metrics: OrganizerMetrics, events: OrganizerEvent[]): void {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `TickeX_BaoCaoTaiChinh_${dateStr}.csv`;

  const headers = [
    'Mã sự kiện',
    'Tên sự kiện',
    'Ngày bắt đầu',
    'Địa điểm',
    'Tổng số ghế',
    'Vé đã bán',
    'Vé đã check-in',
    'Tỷ lệ check-in (%)',
    'Doanh thu gộp (VNĐ)',
    'Phí nền tảng 5% (VNĐ)',
    'Thực nhận 95% (VNĐ)',
  ];

  const rows = events.map((e) => {
    const sold = e.soldTickets ?? 0;
    const checkedIn = e.checkedInTickets ?? 0;
    const checkInRate = sold > 0 ? ((checkedIn / sold) * 100).toFixed(1) : '0.0';
    const gross = e.grossRevenue ?? 0;
    const commission = Math.round(gross * 0.05);
    const net = gross - commission;

    return [
      e.id,
      e.title,
      new Date(e.date).toLocaleDateString('vi-VN'),
      `${e.venueName} - ${e.location}`,
      e.totalSeats,
      sold,
      checkedIn,
      `${checkInRate}%`,
      gross,
      commission,
      net,
    ];
  });

  if (events.length > 0) {
    rows.push([
      '---',
      'TỔNG CỘNG',
      '-',
      '-',
      metrics.totalSeats,
      metrics.totalTicketsSold,
      metrics.totalCheckedInTickets ?? 0,
      `${(metrics.liveCheckInRate ?? 0).toFixed(1)}%`,
      metrics.totalGrossRevenue,
      metrics.totalCommissionEstimated,
      metrics.totalNetRevenueEstimated,
    ]);
  }

  downloadCsv(filename, headers, rows);
}

/**
 * Exports full attendee & ticket list for a single event.
 */
export function exportOrganizerEventTicketsCsv(eventTitle: string, tickets: OrganizerTicketReportItem[]): void {
  const cleanTitle = eventTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `TickeX_Ve_${cleanTitle}_${dateStr}.csv`;

  const headers = [
    'STT',
    'Mã đơn hàng',
    'Tên khách hàng',
    'Email liên hệ',
    'Hàng ghế',
    'Số ghế',
    'Hạng vé',
    'Giá vé (VNĐ)',
    'Trạng thái vé',
    'Thời gian check-in',
  ];

  const rows = tickets.map((t, idx) => {
    const tierName = t.seatTier === 1 ? 'VIP' : t.seatTier === 2 ? 'Economy' : 'Standard';
    const statusLabel = t.status === 3 ? 'Đã check-in' : t.status === 1 ? 'Đã thanh toán' : 'Khác';
    const checkInTime = t.checkedInAt ? new Date(t.checkedInAt).toLocaleString('vi-VN') : 'Chưa check-in';

    return [
      idx + 1,
      t.orderCode,
      t.customerName,
      t.customerEmail,
      t.seatRow,
      t.seatNumber,
      tierName,
      t.price,
      statusLabel,
      checkInTime,
    ];
  });

  downloadCsv(filename, headers, rows);
}
