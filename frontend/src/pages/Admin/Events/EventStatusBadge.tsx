import { EventStatus } from '../../../types';

interface EventStatusBadgeProps {
  status: EventStatus | string | number;
  isDeleted?: boolean;
}

export function EventStatusBadge({ status, isDeleted = false }: EventStatusBadgeProps) {
  if (isDeleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" aria-hidden="true" />
        <span>Đã xóa</span>
      </span>
    );
  }

  const normalizedStatus = String(status).toLowerCase();
  if (normalizedStatus === 'published' || normalizedStatus === '1') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
        <span>Đang mở bán</span>
      </span>
    );
  }
  if (normalizedStatus === 'draft' || normalizedStatus === '0') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/15 text-brand-primary border border-brand-primary/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" aria-hidden="true" />
        <span>Bản nháp</span>
      </span>
    );
  }
  if (normalizedStatus === 'completed' || normalizedStatus === '2') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary" aria-hidden="true" />
        <span>Đã kết thúc</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger border border-danger/30 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-hidden="true" />
      <span>Đã hủy</span>
    </span>
  );
}
