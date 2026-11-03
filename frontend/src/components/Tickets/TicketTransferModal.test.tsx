import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TicketTransferModal } from './TicketTransferModal';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockTicket = {
  id: 'ticket-1',
  eventId: 'ev-1',
  seatId: 'seat-1',
  eventTitle: 'Concert 2026',
  eventDescription: 'Desc',
  eventDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  location: 'Hanoi',
  category: 'Music',
  imageUrl: '',
  row: 'A',
  number: 1,
  tier: 1,
  price: 500000,
  status: 'paid',
  orderCode: 123456,
  qrCodeSignature: 'SIG',
  refundCutoffHours: 24,
  canRefund: true,
};

describe('TicketTransferModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders modal when open with ticket details and warning', () => {
    render(
      <TicketTransferModal
        ticket={mockTicket}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Chuyển Nhượng Vé Chính Chủ/i)).toBeInTheDocument();
    expect(screen.getByText('Concert 2026')).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo an toàn chuyển nhượng/i)).toBeInTheDocument();
  });

  it('validates email format before submitting', async () => {
    render(
      <TicketTransferModal
        ticket={mockTicket}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const emailInput = screen.getByLabelText(/Email tài khoản người nhận/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitBtn = screen.getByRole('button', { name: /Xác Nhận Chuyển Nhượng/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Định dạng email không hợp lệ/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits valid email and triggers onSuccess and onClose', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Chuyển nhượng vé thành công!',
      },
    } as any);

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <TicketTransferModal
        ticket={mockTicket}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const emailInput = screen.getByLabelText(/Email tài khoản người nhận/i);
    fireEvent.change(emailInput, { target: { value: 'recipient@test.com' } });

    const submitBtn = screen.getByRole('button', { name: /Xác Nhận Chuyển Nhượng/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tickets/ticket-1/transfer', {
        recipientEmail: 'recipient@test.com',
        note: undefined,
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

