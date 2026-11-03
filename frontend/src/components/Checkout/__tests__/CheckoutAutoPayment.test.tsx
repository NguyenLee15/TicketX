import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckoutStatusView } from '../CheckoutStatusView';
import { CheckoutVietQrView, PaymentInfo } from '../CheckoutVietQrView';

describe('CheckoutStatusView - Success State', () => {
  it('renders success state with order code and action button', () => {
    const handleClose = vi.fn();
    const handleViewTickets = vi.fn();

    render(
      <CheckoutStatusView
        status="success"
        onClose={handleClose}
        orderCode="8829104"
        onViewTickets={handleViewTickets}
      />
    );

    expect(screen.getByText(/Thanh Toán Thành Công!/i)).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống đã khớp lệnh chuyển khoản VietQR PayOS/i)).toBeInTheDocument();
    expect(screen.getByText(/#8829104/i)).toBeInTheDocument();

    const viewButton = screen.getByRole('button', { name: /Xem Vé Của Tôi Ngay/i });
    expect(viewButton).toBeInTheDocument();
    fireEvent.click(viewButton);
    expect(handleViewTickets).toHaveBeenCalledTimes(1);
  });
});

describe('CheckoutVietQrView - Live Radar & Manual Check', () => {
  const dummyPaymentData: PaymentInfo = {
    orderCode: 9918273,
    amount: 500000,
    checkoutUrl: 'https://pay.payos.vn/web/test',
    accountNumber: '0987654321',
    accountName: 'CONG TY TICKEX',
    bankName: 'MBBank',
    bin: '970422',
    description: 'TICKEX 9918273',
  };

  it('renders live radar waiting indicator and manual check button', () => {
    const handleManualCheck = vi.fn();
    const handleRetry = vi.fn();
    const handleProceed = vi.fn();
    const handleCopy = vi.fn();

    const { rerender } = render(
      <CheckoutVietQrView
        loadingPayment={false}
        paymentInitError={null}
        paymentData={dummyPaymentData}
        onRetryPayment={handleRetry}
        onProceedPayOS={handleProceed}
        copyToClipboard={handleCopy}
        onManualCheckStatus={handleManualCheck}
        checkingStatus={false}
      />
    );

    expect(screen.getByText(/Đang chờ chuyển khoản ngân hàng/i)).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống tự động phát vé ngay khi bạn chuyển tiền xong/i)).toBeInTheDocument();

    const checkButton = screen.getByRole('button', { name: /Kiểm tra ngay/i });
    expect(checkButton).toBeInTheDocument();
    fireEvent.click(checkButton);
    expect(handleManualCheck).toHaveBeenCalledTimes(1);

    // Rerender with checkingStatus: true
    rerender(
      <CheckoutVietQrView
        loadingPayment={false}
        paymentInitError={null}
        paymentData={dummyPaymentData}
        onRetryPayment={handleRetry}
        onProceedPayOS={handleProceed}
        copyToClipboard={handleCopy}
        onManualCheckStatus={handleManualCheck}
        checkingStatus={true}
      />
    );

    expect(screen.getByText(/Đang kiểm tra.../i)).toBeInTheDocument();
  });
});

