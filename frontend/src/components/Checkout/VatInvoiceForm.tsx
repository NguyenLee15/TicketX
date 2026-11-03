import { useState } from 'react';
import { FileText, Building, Mail, MapPin, Hash, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface VatInvoiceFormData {
  isRequested: boolean;
  taxCode: string;
  companyName: string;
  companyAddress: string;
  recipientEmail: string;
}

interface VatInvoiceFormProps {
  value: VatInvoiceFormData;
  onChange: (val: VatInvoiceFormData) => void;
}

export function VatInvoiceForm({ value, onChange }: VatInvoiceFormProps) {
  const [isOpen, setIsOpen] = useState(value.isRequested);

  const handleToggle = (checked: boolean) => {
    setIsOpen(checked);
    onChange({
      ...value,
      isRequested: checked,
    });
  };

  return (
    <div className="p-4 rounded-xl bg-surface-2/90 border border-border-subtle shadow-sm space-y-3">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(e) => handleToggle(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            isOpen ? 'bg-brand-primary border-brand-primary text-white shadow-sm shadow-brand-glow' : 'border-border-muted bg-surface-3'
          }`}
          aria-hidden="true"
        >
          {isOpen && <Check className="w-3.5 h-3.5" />}
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-white">
            Yêu cầu xuất hóa đơn điện tử GTGT (VAT 10%)
          </span>
        </div>
      </label>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="vat-form-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3 border-t border-border-subtle">
              <div className="p-2.5 rounded-lg bg-surface-3 text-xs text-text-tertiary">
                Hóa đơn điện tử hợp lệ theo Nghị định 123/2020/NĐ-CP sẽ được gửi tự động qua email sau khi thanh toán thành công.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="vat-tax-code" className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                    <Hash className="w-3 h-3 text-text-tertiary" />
                    Mã số thuế doanh nghiệp <span className="text-danger">*</span>
                  </label>
                  <input
                    id="vat-tax-code"
                    type="text"
                    placeholder="0101234567"
                    value={value.taxCode}
                    onChange={(e) => onChange({ ...value, taxCode: e.target.value.trim() })}
                    className="w-full px-3 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    required={isOpen}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="vat-company-name" className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                    <Building className="w-3 h-3 text-text-tertiary" />
                    Tên công ty / Tổ chức <span className="text-danger">*</span>
                  </label>
                  <input
                    id="vat-company-name"
                    type="text"
                    placeholder="CÔNG TY CỔ PHẦN..."
                    value={value.companyName}
                    onChange={(e) => onChange({ ...value, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-white uppercase focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    required={isOpen}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="vat-address" className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-text-tertiary" />
                  Địa chỉ đăng ký kinh doanh <span className="text-danger">*</span>
                </label>
                <input
                  id="vat-address"
                  type="text"
                  placeholder="Số 10, Phố ABC, Phường XYZ, Hà Nội"
                  value={value.companyAddress}
                  onChange={(e) => onChange({ ...value, companyAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  required={isOpen}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="vat-email" className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                  <Mail className="w-3 h-3 text-text-tertiary" />
                  Email nhận hóa đơn điện tử <span className="text-danger">*</span>
                </label>
                <input
                  id="vat-email"
                  type="email"
                  placeholder="ketoan@company.com"
                  value={value.recipientEmail}
                  onChange={(e) => onChange({ ...value, recipientEmail: e.target.value.trim() })}
                  className="w-full px-3 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  required={isOpen}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
