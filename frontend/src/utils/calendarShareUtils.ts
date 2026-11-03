/**
 * Tiện ích hỗ trợ Chỉ đường Google Maps, Tạo sự kiện Lịch (Google Calendar, iCalendar .ics) và Chia sẻ sự kiện
 */

export interface CalendarEventPayload {
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  venueName?: string;
  location?: string;
}

/**
 * Tạo URL mở Google Maps tìm kiếm địa điểm / nhà hát
 */
export function getGoogleMapsUrl(venueName?: string, location?: string): string {
  const parts = [venueName?.trim(), location?.trim()].filter(Boolean);
  const query = parts.length > 0 ? parts.join(', ') : 'Việt Nam';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Định dạng chuỗi ngày ISO sang định dạng chuẩn Google Calendar: YYYYMMDDTHHmmssZ
 */
export function formatToUtcCompact(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Tạo URL thêm sự kiện trực tiếp vào Google Calendar
 */
export function getGoogleCalendarUrl(event: CalendarEventPayload): string {
  const startDate = new Date(event.date);
  const validStart = !Number.isNaN(startDate.getTime()) ? startDate : new Date();

  let endDate: Date;
  if (event.endDate) {
    const parsedEnd = new Date(event.endDate);
    endDate = !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : new Date(validStart.getTime() + 2 * 60 * 60 * 1000);
  } else {
    // Mặc định kết thúc sau 2 tiếng nếu không có endDate
    endDate = new Date(validStart.getTime() + 2 * 60 * 60 * 1000);
  }

  const startUtc = formatToUtcCompact(validStart);
  const endUtc = formatToUtcCompact(endDate);

  const locationParts = [event.venueName?.trim(), event.location?.trim()].filter(Boolean);
  const locationStr = locationParts.join(', ');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startUtc}/${endUtc}`,
    details: event.description || `Vé xem sự kiện ${event.title} được phát hành bởi nền tảng TickeX.`,
    location: locationStr,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Tạo nội dung file chuẩn iCalendar (.ics) cho Apple Calendar, macOS và Outlook
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const startDate = new Date(event.date);
  const validStart = !Number.isNaN(startDate.getTime()) ? startDate : new Date();

  let endDate: Date;
  if (event.endDate) {
    const parsedEnd = new Date(event.endDate);
    endDate = !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : new Date(validStart.getTime() + 2 * 60 * 60 * 1000);
  } else {
    endDate = new Date(validStart.getTime() + 2 * 60 * 60 * 1000);
  }

  const startUtc = formatToUtcCompact(validStart);
  const endUtc = formatToUtcCompact(endDate);
  const nowUtc = formatToUtcCompact(new Date());

  const locationParts = [event.venueName?.trim(), event.location?.trim()].filter(Boolean);
  const locationStr = locationParts.join(', ');
  const cleanDescription = (event.description || '').replace(/\r?\n/g, '\\n');
  const uid = `tickex-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@tickex.vn`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TickeX//TickeX Events//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${locationStr}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Nhắc nhở: Sự kiện ${event.title} sẽ diễn ra sau 2 tiếng!`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Tải trực tiếp file .ics xuống thiết bị người dùng
 */
export function downloadIcsFile(event: CalendarEventPayload): void {
  const icsContent = generateIcsContent(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const sanitizedTitle = event.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
  link.download = `${sanitizedTitle || 'su_kien'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Chia sẻ sự kiện qua Web Share API (mobile) hoặc copy link (desktop)
 */
export async function shareEvent(payload: { title: string; description?: string; url?: string }): Promise<'shared' | 'copied' | 'failed'> {
  const shareUrl = payload.url || (typeof window !== 'undefined' ? window.location.href : '');
  
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.description ? `${payload.description.slice(0, 100)}...` : payload.title,
        url: shareUrl,
      });
      return 'shared';
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return 'failed';
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
