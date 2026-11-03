import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import InvoiceLookupPage from './InvoiceLookupPage';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('InvoiceLookupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders lookup form initially', () => {
    render(<InvoiceLookupPage />);
    expect(screen.getByText(/Tra Cứu Hóa Đơn GTGT TickeX/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập mã bí mật tra cứu/i)).toBeInTheDocument();
  });

  it('searches and displays valid VAT invoice details', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'inv-1',
          orderCode: 20261103001,
          taxCode: '0101234567',
          companyName: 'TẬP ĐOÀN CÔNG NGHỆ FPT',
          companyAddress: 'Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội',
          recipientEmail: 'ketoan@fpt.com',
          subTotal: 1000000,
          vatRate: 0.1,
          vatAmount: 100000,
          totalAmount: 1100000,
          invoiceNumber: 'HD20261103-998877',
          invoiceLookupCode: 'TKX8A9B2',
          status: 'Issued',
          issuedAt: '2026-11-03T10:00:00Z',
        },
      },
    });

    render(<InvoiceLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập mã bí mật tra cứu/i);
    fireEvent.change(input, { target: { value: 'TKX8A9B2' } });

    const submitBtn = screen.getByRole('button', { name: /Tra cứu/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/HÓA ĐƠN GIÁ TRỊ GIA TĂNG/i)).toBeInTheDocument();
      expect(screen.getByText('TẬP ĐOÀN CÔNG NGHỆ FPT')).toBeInTheDocument();
      expect(screen.getByText('0101234567')).toBeInTheDocument();
      expect(screen.getByText(/HD20261103-998877/i)).toBeInTheDocument();
    });
  });

  it('shows error when invoice is not found', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: false,
        message: 'Không tìm thấy hóa đơn với mã tra cứu đã nhập.',
      },
    });

    render(<InvoiceLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập mã bí mật tra cứu/i);
    fireEvent.change(input, { target: { value: 'UNKNOWN9' } });

    const submitBtn = screen.getByRole('button', { name: /Tra cứu/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy hóa đơn/i)).toBeInTheDocument();
    });
  });
});

