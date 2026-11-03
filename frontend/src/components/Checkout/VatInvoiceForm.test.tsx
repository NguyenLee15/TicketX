import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VatInvoiceForm, VatInvoiceFormData } from './VatInvoiceForm';

describe('VatInvoiceForm', () => {
  it('toggles form visibility and updates fields', () => {
    let currentData: VatInvoiceFormData = {
      isRequested: false,
      taxCode: '',
      companyName: '',
      companyAddress: '',
      recipientEmail: '',
    };

    const handleChange = vi.fn((val: VatInvoiceFormData) => {
      currentData = val;
    });

    const { rerender } = render(<VatInvoiceForm value={currentData} onChange={handleChange} />);

    expect(screen.getByText(/Yêu cầu xuất hóa đơn điện tử GTGT/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Mã số thuế doanh nghiệp/i)).not.toBeInTheDocument();

    // Toggle checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ isRequested: true })
    );

    // Re-render with isRequested: true
    rerender(<VatInvoiceForm value={{ ...currentData, isRequested: true }} onChange={handleChange} />);

    // Fields should now be visible
    expect(screen.getByLabelText(/Mã số thuế doanh nghiệp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên công ty/i)).toBeInTheDocument();

    // Change tax code
    const taxCodeInput = screen.getByLabelText(/Mã số thuế doanh nghiệp/i);
    fireEvent.change(taxCodeInput, { target: { value: '0101234567' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ taxCode: '0101234567' })
    );
  });
});

