import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VoucherDrawer } from '../VoucherDrawer';
import { api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
  default: {
    get: vi.fn(),
  },
}));

describe('VoucherDrawer Component', () => {
  const mockCoupons = [
    {
      id: 'c1',
      code: 'TICKEX10',
      description: 'Giảm 10% tối đa 100K cho đơn từ 200K',
      discountType: 1, // Percentage
      discountValue: 10,
      maxDiscountAmount: 100000,
      minOrderAmount: 200000,
      usageLimit: 1000,
      usedCount: 5,
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
      isActive: true,
    },
    {
      id: 'c2',
      code: 'CHAOBANMOI',
      description: 'Giảm 50.000₫ cho đơn từ 500K',
      discountType: 2, // Fixed
      discountValue: 50000,
      maxDiscountAmount: null,
      minOrderAmount: 500000,
      usageLimit: 500,
      usedCount: 10,
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <VoucherDrawer
        isOpen={false}
        onClose={vi.fn()}
        orderAmount={300000}
        onSelectCoupon={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches and renders coupon cards when open', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockCoupons },
    });

    render(
      <VoucherDrawer
        isOpen={true}
        onClose={vi.fn()}
        eventId="event-123"
        orderAmount={300000}
        onSelectCoupon={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Kho Mã Ưu Đãi')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('TICKEX10')).toBeInTheDocument();
      expect(screen.getByText('CHAOBANMOI')).toBeInTheDocument();
    });

    expect(api.get).toHaveBeenCalledWith('/api/coupons/active?eventId=event-123');
  });

  it('allows applying an eligible voucher and triggers callback', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockCoupons },
    });

    const onSelectCoupon = vi.fn();
    const onClose = vi.fn();

    render(
      <VoucherDrawer
        isOpen={true}
        onClose={onClose}
        orderAmount={300000}
        onSelectCoupon={onSelectCoupon}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TICKEX10')).toBeInTheDocument();
    });

    // TICKEX10 minOrder is 200k, order is 300k -> eligible
    const applyButtons = screen.getAllByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyButtons[0]);

    expect(onSelectCoupon).toHaveBeenCalledWith('TICKEX10');
    expect(onClose).toHaveBeenCalled();
  });

  it('disables apply button and shows warning when order amount is insufficient', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockCoupons },
    });

    render(
      <VoucherDrawer
        isOpen={true}
        onClose={vi.fn()}
        orderAmount={100000} // less than minOrder of both 200k and 500k
        onSelectCoupon={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TICKEX10')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Cần mua thêm/)).toHaveLength(2);
    const buttons = screen.getAllByRole('button', { name: 'Áp dụng' });
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('displays "Đang dùng" badge when voucher is already applied', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: mockCoupons },
    });

    render(
      <VoucherDrawer
        isOpen={true}
        onClose={vi.fn()}
        orderAmount={300000}
        appliedCouponCode="TICKEX10"
        onSelectCoupon={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TICKEX10')).toBeInTheDocument();
    });

    expect(screen.getByText('Đang dùng')).toBeInTheDocument();
  });
});
