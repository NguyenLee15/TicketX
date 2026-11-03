import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  PlusCircle,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ExternalLink,
  Landmark,
  MapPin,
  Clock
} from 'lucide-react';
import api from '../../services/api';
import { useModalAccessibility } from '../../components/Admin/useModalAccessibility';
import type { OrganizerEvent, ApiResponse } from '../../types';

export default function OrganizerEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isModalOpen, false, () => setIsModalOpen(false), modalRef);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Âm nhạc');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState(5);
  const [seatsPerRow, setSeatsPerRow] = useState(10);
  const [basePrice, setBasePrice] = useState(250000);
  const [imageUrl, setImageUrl] = useState('');

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<ApiResponse<OrganizerEvent[]>>('/api/organizer/events');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEvents(res.data.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách sự kiện';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Check if open modal from URL query param
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsModalOpen(true);
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!title.trim() || !venueName.trim() || !location.trim() || !date) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        venueName: venueName.trim(),
        location: location.trim(),
        category: category.trim(),
        date: new Date(date).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : new Date(new Date(date).getTime() + 3 * 3600 * 1000).toISOString(),
        rows: Number(rows),
        seatsPerRow: Number(seatsPerRow),
        basePrice: Number(basePrice),
        imageUrl: imageUrl.trim() || undefined,
      };

      const res = await api.post<ApiResponse<string>>('/api/organizer/events', payload);
      if (res.data?.success) {
        setFormSuccess('Sự kiện đã được khởi tạo thành công và sơ đồ chỗ ngồi đã được lập!');
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(null);
          // Reset form
          setTitle('');
          setDescription('');
          setVenueName('');
          setLocation('');
          setDate('');
          setEndDate('');
          setImageUrl('');
          loadEvents();
        }, 1200);
      } else {
        setFormError(res.data?.message || 'Không thể tạo sự kiện.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống khi gửi yêu cầu.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
            Quản Lý Sự Kiện Ban Tổ Chức
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Danh sách tất cả các sự kiện thuộc quyền sở hữu của bạn và tình trạng bán vé
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          <span>Tạo Sự Kiện Mới</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            type="text"
            placeholder="Tìm theo tên sự kiện, rạp, địa điểm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-1 border border-border-subtle rounded-xl text-sm text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 text-danger">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3" role="status" aria-busy="true">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" />
          <span className="text-sm text-text-secondary">Đang tải danh sách sự kiện...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-surface-1 border border-border-subtle space-y-4">
          <Calendar className="w-12 h-12 mx-auto text-text-tertiary/40" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-white">Chưa có sự kiện nào</h3>
            <p className="text-sm text-text-tertiary mt-1">
              {searchQuery ? 'Không tìm thấy sự kiện phù hợp từ khóa.' : 'Hãy tạo sự kiện đầu tiên để bắt đầu bán vé trên TickeX.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Tạo Sự Kiện Mới
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((evt) => {
            const occupancy = evt.totalSeats > 0 ? (evt.soldTickets / evt.totalSeats) * 100 : 0;
            return (
              <div
                key={evt.id}
                className="rounded-2xl bg-surface-1 border border-border-subtle p-5 flex flex-col justify-between hover:border-border-muted transition-colors group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 uppercase tracking-wide">
                      {evt.category || 'Sự kiện'}
                    </span>
                    <span className="text-xs text-text-tertiary tabular-nums">
                      {evt.soldTickets} / {evt.totalSeats} vé
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-brand-primary transition-colors line-clamp-2">
                    {evt.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-text-secondary">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                      <span>
                        {new Date(evt.date).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                      <span className="truncate">{evt.venueName} - {evt.location}</span>
                    </div>
                  </div>

                  {/* Occupancy Progress */}
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-xs text-text-tertiary">
                      <span>Tỷ lệ lấp đầy</span>
                      <span className="font-semibold text-white tabular-nums">{occupancy.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full bg-brand-primary rounded-full transition-all"
                        style={{ width: `${Math.min(occupancy, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-text-tertiary uppercase tracking-wider">Doanh thu</div>
                    <div className="text-base font-bold text-white tabular-nums">
                      {formatVnd(evt.grossRevenue)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/events/${evt.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-9 min-w-9 p-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white transition-colors"
                      title="Xem trên sàn TickeX"
                      aria-label={`Xem sự kiện ${evt.title} trên sàn`}
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to={`/organizer/settlements?eventId=${evt.id}`}
                      className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-semibold border border-brand-primary/20 transition-colors"
                      title="Yêu cầu quyết toán cho sự kiện này"
                    >
                      <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Quyết toán</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tạo Sự Kiện Mới */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-1/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            ref={modalRef}
            className="w-full max-w-2xl bg-surface-1 border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-pop"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <h2 id="modal-create-event-title" className="text-lg font-bold font-display text-white">
                Tạo Sự Kiện & Thiết Lập Sơ Đồ Ghế
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 min-w-11 p-2 rounded-lg text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-2.5 text-danger text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2.5 text-success text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="evt-title" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Tên sự kiện <span className="text-danger">*</span>
                </label>
                <input
                  id="evt-title"
                  type="text"
                  required
                  placeholder="Ví dụ: Đại Nhạc Hội Rock Storm 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="evt-venue" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Tên rạp / Trung tâm <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-venue"
                    type="text"
                    required
                    placeholder="Trung tâm Hội chợ SECC"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="evt-location" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Địa chỉ / Tỉnh thành <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-location"
                    type="text"
                    required
                    placeholder="Quận 7, TP. Hồ Chí Minh"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="evt-category" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Thể loại
                  </label>
                  <select
                    id="evt-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  >
                    <option value="Âm nhạc">Âm nhạc</option>
                    <option value="Thể thao">Thể thao</option>
                    <option value="Hội thảo">Hội thảo</option>
                    <option value="Nghệ thuật">Nghệ thuật</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="evt-date" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Thời gian bắt đầu <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-date"
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="evt-end-date" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Thời gian kết thúc
                  </label>
                  <input
                    id="evt-end-date"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  />
                </div>
              </div>

              {/* Sơ đồ ghế ma trận */}
              <div className="p-4 rounded-xl bg-surface-2/60 border border-border-subtle space-y-3">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  Ma Trận Chỗ Ngồi (Tự Động Sinh Vé)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="evt-rows" className="text-xs text-text-secondary">Số hàng ghế (A, B...)</label>
                    <input
                      id="evt-rows"
                      type="number"
                      min={1}
                      max={26}
                      value={rows}
                      onChange={(e) => setRows(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-3 border border-border-subtle rounded-lg text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="evt-seats" className="text-xs text-text-secondary">Số ghế mỗi hàng</label>
                    <input
                      id="evt-seats"
                      type="number"
                      min={1}
                      max={50}
                      value={seatsPerRow}
                      onChange={(e) => setSeatsPerRow(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-3 border border-border-subtle rounded-lg text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="evt-price" className="text-xs text-text-secondary">Giá vé cơ bản (VND)</label>
                    <input
                      id="evt-price"
                      type="number"
                      step={10000}
                      min={10000}
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-3 border border-border-subtle rounded-lg text-sm text-white"
                    />
                  </div>
                </div>
                <div className="text-xs text-text-tertiary">
                  Tổng quy mô: <strong className="text-white">{rows * seatsPerRow} ghế</strong>. Tiềm năng doanh thu: <strong className="text-success">{formatVnd(rows * seatsPerRow * basePrice)}</strong>.
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="evt-image" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Link ảnh Poster sự kiện (tùy chọn)
                </label>
                <input
                  id="evt-image"
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="evt-desc" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Mô tả chi tiết
                </label>
                <textarea
                  id="evt-desc"
                  rows={3}
                  placeholder="Thông tin nghệ sĩ tham gia, quy định độ tuổi, hướng dẫn vào cổng..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-sm transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{isSubmitting ? 'Đang khởi tạo...' : 'Tạo Sự Kiện Ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

