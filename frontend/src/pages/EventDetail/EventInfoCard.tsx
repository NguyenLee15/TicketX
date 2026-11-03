import React, { useState } from 'react';
import { Calendar, MapPin, Sparkles, Navigation, CalendarPlus, Share2, ExternalLink, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EventDetail } from '../../types';
import { formatDate } from '../../utils/formatters';
import { ResilientImage } from '../../components/ResilientImage';
import { getGoogleMapsUrl, getGoogleCalendarUrl, downloadIcsFile, shareEvent } from '../../utils/calendarShareUtils';

interface EventInfoCardProps {
  event: EventDetail;
}

export const EventInfoCard: React.FC<EventInfoCardProps> = ({ event }) => {
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  const handleShare = async () => {
    const result = await shareEvent({
      title: event.title,
      description: event.description,
    });
    if (result === 'copied') {
      toast.success('Đã sao chép liên kết sự kiện vào bộ nhớ tạm!');
    } else if (result === 'shared') {
      toast.success('Đã mở chia sẻ sự kiện!');
    }
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(event);
    setShowCalendarMenu(false);
    toast.success('Đã tải file lịch (.ics) thành công!');
  };

  return (
    <div className="surface-panel p-5 sm:p-6 relative overflow-hidden space-y-4">
      {event.imageUrl && (
        <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-border-subtle bg-surface-2 shadow-md">
          <ResilientImage
            src={event.imageUrl}
            alt={`Hình ảnh sự kiện ${event.title}`}
            className="w-full h-full object-cover"
            fallbackClassName="w-full h-full flex items-center justify-center bg-surface-3 text-text-tertiary"
          />
        </div>
      )}
      
      <div className="relative z-10 space-y-3.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/20 border border-brand-primary/30">
          <Sparkles className="w-3 h-3 text-brand-primary-light" aria-hidden="true" />
          <span className="text-[11px] font-bold text-brand-primary-light uppercase tracking-wider">{event.category}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-display font-black text-white leading-snug tracking-tight">
          {event.title}
        </h1>
        <p className="text-text-secondary text-xs sm:text-sm leading-relaxed line-clamp-3 font-light">
          {event.description}
        </p>
        
        <div className="space-y-2.5 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-border-subtle">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Thời Gian</p>
              <p className="font-bold text-white text-xs sm:text-sm tabular-nums">
                {formatDate(event.date, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[11px] text-brand-secondary font-semibold tabular-nums">
                {formatDate(event.date, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          
          <a
            href={getGoogleMapsUrl(event.venueName, event.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-3/80 border border-border-subtle hover:border-brand-primary/40 transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary block"
            title="Mở Google Maps chỉ đường"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 text-brand-secondary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Địa Điểm</p>
                <span className="text-[10px] text-brand-primary flex items-center gap-0.5 font-medium group-hover:underline">
                  Chỉ đường <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                </span>
              </div>
              <p className="font-bold text-white text-xs sm:text-sm truncate">{event.venueName || event.location}</p>
              {event.venueName && <p className="text-[11px] text-text-secondary truncate">{event.location}</p>}
            </div>
          </a>
        </div>

        {/* Action Toolbar: Google Maps, Calendar, Share */}
        <div className="pt-2 border-t border-border-subtle/80 flex items-center gap-2 flex-wrap relative">
          <a
            href={getGoogleMapsUrl(event.venueName, event.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[105px] min-h-9 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white border border-border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
            title="Mở chỉ đường trên Google Maps"
          >
            <Navigation className="w-3.5 h-3.5 text-brand-secondary" aria-hidden="true" />
            <span>Chỉ đường</span>
          </a>

          <div className="relative flex-1 min-w-[105px]">
            <button
              type="button"
              onClick={() => setShowCalendarMenu(prev => !prev)}
              className="w-full min-h-9 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white border border-border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="Tùy chọn nhắc lịch"
              aria-expanded={showCalendarMenu}
            >
              <CalendarPlus className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
              <span>Nhắc lịch</span>
            </button>

            {showCalendarMenu && (
              <div className="absolute bottom-full mb-1 left-0 right-0 sm:w-48 bg-surface-1 border border-border-subtle rounded-xl shadow-xl p-1 z-30 space-y-1 animate-scale-in text-xs">
                <a
                  href={getGoogleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendarMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-2 text-text-primary hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
                  <span>Google Calendar</span>
                </a>
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-2 text-text-primary hover:text-white transition-colors text-left cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-brand-secondary" aria-hidden="true" />
                  <span>Tải file Lịch (.ics)</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleShare()}
            className="min-h-9 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white border border-border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Chia sẻ sự kiện"
            aria-label="Chia sẻ sự kiện"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="hidden sm:inline">Chia sẻ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
