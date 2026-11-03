import React from 'react';
import { motion } from 'motion/react';

export const allowedTicketTabs = ['All', 'Pending', 'Paid', 'Used', 'RefundPending', 'Cancelled'] as const;
export type TicketTabType = (typeof allowedTicketTabs)[number];

interface TicketFilterTabsProps {
  currentTab: TicketTabType;
  onTabChange: (tab: TicketTabType) => void;
}

const TAB_LABELS: Record<TicketTabType, string> = {
  All: 'Tất cả',
  Pending: 'Chờ thanh toán',
  Paid: 'Còn hạn',
  Used: 'Đã qua cửa',
  RefundPending: 'Đang hoàn',
  Cancelled: 'Đã hủy',
};

export const TicketFilterTabs: React.FC<TicketFilterTabsProps> = React.memo(({
  currentTab,
  onTabChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Bộ lọc trạng thái vé"
      tabIndex={0}
      className="flex gap-1.5 bg-surface-1/90 p-1.5 rounded-xl border border-border-subtle self-start sm:self-center shrink-0 overflow-x-auto max-w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
    >
      {allowedTicketTabs.map((tab) => {
        const isActive = currentTab === tab;
        return (
          <button
            key={tab}
            type="button"
            aria-pressed={isActive}
            onClick={() => onTabChange(tab)}
            className={`relative min-h-11 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-[color,transform] duration-150 active:scale-[0.97] whitespace-nowrap cursor-pointer inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
              isActive
                ? 'text-white'
                : 'text-text-secondary hover:text-white hover:bg-surface-2/60'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTicketTabPill"
                className="absolute inset-0 rounded-lg bg-brand-primary shadow-md shadow-brand-glow ring-1 ring-brand-primary-light/40"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10">{TAB_LABELS[tab]}</span>
          </button>
        );
      })}
    </div>
  );
});
