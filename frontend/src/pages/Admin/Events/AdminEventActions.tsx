import { Edit2, Trash2, XCircle } from 'lucide-react';
import { Event } from '../../../types';

interface AdminEventActionsProps {
  event: Event;
  onEdit: (event: Event) => void;
  onCancel: (event: Event) => void;
  onDelete: (event: Event) => void;
  compact?: boolean;
}

export function AdminEventActions({ event, onEdit, onCancel, onDelete, compact = false }: AdminEventActionsProps) {
  const isCancelled = String(event.status) === '3' || String(event.status).toLowerCase() === 'cancelled';
  const isCompleted = String(event.status) === '2' || String(event.status).toLowerCase() === 'completed';

  if (compact) {
    return (
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
        <button type="button" onClick={() => onEdit(event)} disabled={event.isDeleted || isCompleted || isCancelled} aria-label={`Chỉnh sửa sự kiện ${event.title}`} className="min-h-11 px-3.5 py-2 bg-surface-2 hover:bg-surface-3 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />Sửa
        </button>
        {!isCancelled && !isCompleted && (
          <button type="button" onClick={() => onCancel(event)} disabled={event.isDeleted} aria-label={`Hủy sự kiện ${event.title}`} className="min-h-11 px-3.5 py-2 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-black active:scale-[0.98] rounded-xl text-xs font-bold transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 border border-amber-500/30 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />Hủy
          </button>
        )}
        <button type="button" onClick={() => onDelete(event)} disabled={event.isDeleted} aria-label={`Xóa sự kiện ${event.title}`} className="min-h-11 px-3.5 py-2 bg-danger/15 text-danger hover:bg-danger hover:text-white active:scale-[0.98] rounded-xl text-xs font-bold transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger border border-danger/30 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />Xóa
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 shrink-0">
      <button type="button" onClick={() => onEdit(event)} disabled={event.isDeleted || isCompleted || isCancelled} aria-label={`Chỉnh sửa sự kiện ${event.title}`} className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 bg-surface-2 hover:bg-surface-3 active:scale-[0.96] text-text-secondary hover:text-white rounded-xl transition-[background-color,color,transform] border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer" title={isCancelled ? 'Không thể sửa sự kiện đã hủy' : isCompleted ? 'Không thể sửa sự kiện đã kết thúc' : 'Sửa sự kiện'}>
        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {!isCancelled && !isCompleted && (
        <button
          type="button"
          onClick={() => onCancel(event)}
          disabled={event.isDeleted}
          aria-label={`Hủy sự kiện & Hoàn tiền vé ${event.title}`}
          className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.96] text-amber-400 rounded-xl transition-[background-color,color,transform] border border-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
          title={event.isDeleted ? 'Không thể hủy sự kiện đã xóa' : 'Hủy sự kiện & Hoàn tiền vé'}
        >
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
      <button type="button" onClick={() => onDelete(event)} disabled={event.isDeleted} aria-label={`Xóa sự kiện ${event.title}`} className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 bg-danger/10 hover:bg-danger/20 active:scale-[0.96] text-danger rounded-xl transition-[background-color,color,transform] border border-danger/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger cursor-pointer" title="Xóa sự kiện">
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
