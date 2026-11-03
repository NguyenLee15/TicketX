import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  getGoogleMapsUrl,
  getGoogleCalendarUrl,
  generateIcsContent,
  shareEvent,
} from '../../../utils/calendarShareUtils';
import { EventInfoCard } from '../EventInfoCard';
import { EventDetail } from '../../../types';

describe('calendarShareUtils', () => {
  afterEach(cleanup);

  const dummyEvent = {
    title: 'Hòa Nhạc Giao Hưởng Mùa Thu',
    description: 'Đêm nhạc giao hưởng đặc sắc tại Nhà hát Thành phố.',
    date: '2026-11-20T19:30:00Z',
    endDate: '2026-11-20T22:00:00Z',
    venueName: 'Nhà Hát Thành Phố',
    location: 'Quận 1, TP. Hồ Chí Minh',
  };

  it('generates accurate Google Maps search URL', () => {
    const mapsUrl = getGoogleMapsUrl(dummyEvent.venueName, dummyEvent.location);
    expect(mapsUrl).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(mapsUrl).toContain(encodeURIComponent('Nhà Hát Thành Phố, Quận 1, TP. Hồ Chí Minh'));
  });

  it('generates valid Google Calendar URL with correct date format and parameters', () => {
    const calendarUrl = getGoogleCalendarUrl(dummyEvent);
    const parsed = new URL(calendarUrl);
    expect(parsed.origin).toBe('https://calendar.google.com');
    expect(parsed.pathname).toBe('/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe(dummyEvent.title);
    expect(parsed.searchParams.get('dates')).toBe('20261120T193000Z/20261120T220000Z');
    expect(parsed.searchParams.get('location')).toBe('Nhà Hát Thành Phố, Quận 1, TP. Hồ Chí Minh');
  });

  it('generates standard iCalendar (.ics) content with alarm', () => {
    const ics = generateIcsContent(dummyEvent);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain(`SUMMARY:${dummyEvent.title}`);
    expect(ics).toContain('LOCATION:Nhà Hát Thành Phố, Quận 1, TP. Hồ Chí Minh');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('copies link to clipboard when navigator.share is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
      share: undefined,
    });

    const result = await shareEvent({
      title: dummyEvent.title,
      description: dummyEvent.description,
      url: 'http://localhost:5173/events/123',
    });

    expect(result).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('http://localhost:5173/events/123');
  });
});

describe('EventInfoCard Action Toolbar', () => {
  afterEach(cleanup);

  const dummyEventDetail: EventDetail = {
    id: 'test-event-uuid-1',
    title: 'Hòa Nhạc Giao Hưởng Mùa Thu',
    description: 'Đêm nhạc giao hưởng đặc sắc tại Nhà hát Thành phố.',
    date: '2026-11-20T19:30:00Z',
    endDate: '2026-11-20T22:00:00Z',
    venueName: 'Nhà Hát Thành Phố',
    location: 'Quận 1, TP. Hồ Chí Minh',
    category: 'Concert',
    basePrice: 500000,
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    status: 1,
    refundCutoffHours: 24,
    organizerName: 'TickeX Live',
    totalSeats: 60,
    availableSeatsCount: 50,
    minPrice: 500000,
    maxPrice: 1500000,
    seats: [],
  };

  it('renders Google Maps link, Calendar dropdown button and Share button', () => {
    render(<EventInfoCard event={dummyEventDetail} />);

    // Maps link
    const mapLinks = screen.getAllByRole('link', { name: /chỉ đường/i });
    expect(mapLinks.length).toBeGreaterThan(0);
    expect(mapLinks[0]).toHaveAttribute('href', expect.stringContaining('google.com/maps'));

    // Calendar button
    const calendarBtn = screen.getByRole('button', { name: /nhắc lịch/i });
    expect(calendarBtn).toBeInTheDocument();

    // Toggle calendar menu
    fireEvent.click(calendarBtn);
    expect(screen.getByText(/Google Calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/Tải file Lịch \(\.ics\)/i)).toBeInTheDocument();

    // Share button
    const shareBtn = screen.getByRole('button', { name: /chia sẻ/i });
    expect(shareBtn).toBeInTheDocument();
  });
});
