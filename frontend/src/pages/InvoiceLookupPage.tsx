import { useState } from 'react';
import { Search, FileText, AlertCircle, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import type { VatInvoiceData, ApiResponse } from '../types';

export default function InvoiceLookupPage() {
  const [lookupCode, setLookupCode] = useState('');
  const [invoice, setInvoice] = useState<VatInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = lookupCode.trim().toUpperCase();
    if (!code) return;

    try {
      setIsLoading(true);
      setError(null);
      setInvoice(null);
      const res = await api.get<ApiResponse<VatInvoiceData>>(`/api/invoices/lookup/${code}`);
      if (res.data?.success && res.data.data) {
        setInvoice(res.data.data);
      } else {
        setError('Không tìm thấy hóa đơn điện tử với mã tra cứu này.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tra cứu hóa đơn.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatVnd = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-text-primary">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/25 text-brand-primary text-xs font-bold uppercase tracking-wider shadow-sm">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cổng Tra Cứu Hóa Đơn Điện Tử Chính Thức</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          Tra Cứu Hóa Đơn GTGT TickeX
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
          Tra cứu và xác thực hóa đơn điện tử chính thức theo chuẩn Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleLookup} className="max-w-md mx-auto flex items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            required
            maxLength={16}
            placeholder="Nhập mã bí mật tra cứu (VD: TKX8A9B2)"
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 bg-surface-1 border border-border-subtle rounded-xl text-sm font-mono text-white tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !lookupCode.trim()}
          className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Tra cứu</span>
        </button>
      </form>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto p-4 rounded-xl bg-danger/10 border border-danger/25 flex items-center gap-3 text-danger text-sm shadow-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </motion.div>
      )}

      {/* E-Invoice Viewer (Decree 123 Luxury Certificate) */}
      <AnimatePresence>
        {invoice && (
          <motion.div
            key="invoice-card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="rounded-2xl bg-white text-gray-900 border border-amber-200/60 shadow-2xl p-6 sm:p-9 space-y-7 relative overflow-hidden"
          >
            {/* Top Certificate Golden Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-brand-primary to-amber-500" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-wider text-gray-900 flex items-center gap-2">
                  <span>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</span>
                </h2>
                <p className="text-xs text-gray-500 italic mt-0.5">
                  (Bản thể hiện của hóa đơn điện tử — Nghị định 123/2020/NĐ-CP)
                </p>
              </div>
              <div className="text-xs sm:text-right space-y-1 text-gray-600 bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-xl w-full sm:w-auto border sm:border-0 border-gray-200">
                <div>Ký hiệu (Series): <strong className="font-mono text-gray-900">1C26TXX</strong></div>
                <div>Số hóa đơn (No.): <strong className="font-mono text-gray-900">{invoice.invoiceNumber}</strong></div>
                <div>Ngày lập: <strong className="text-gray-900">{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('vi-VN') : '—'}</strong></div>
              </div>
            </div>

            {/* Seller & Buyer details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-gray-700">
              <div className="space-y-1.5 p-4 rounded-xl bg-gray-50/80 border border-gray-200 shadow-sm">
                <span className="font-black text-gray-900 uppercase tracking-wider block text-[11px] text-brand-primary">Đơn vị bán hàng (Seller):</span>
                <div className="font-bold text-gray-900 text-sm">CÔNG TY CỔ PHẦN NỀN TẢNG BÁN VÉ TICKEX</div>
                <div>Mã số thuế: <strong className="font-mono text-gray-900">0109988776</strong></div>
                <div>Địa chỉ: Tòa nhà TickeX Tower, Cầu Giấy, Hà Nội</div>
              </div>

              <div className="space-y-1.5 p-4 rounded-xl bg-gray-50/80 border border-gray-200 shadow-sm">
                <span className="font-black text-gray-900 uppercase tracking-wider block text-[11px] text-brand-primary">Đơn vị mua hàng (Buyer):</span>
                <div className="font-bold text-gray-900 text-sm">{invoice.companyName}</div>
                <div>Mã số thuế: <strong className="font-mono text-gray-900">{invoice.taxCode}</strong></div>
                <div>Địa chỉ: {invoice.companyAddress}</div>
                <div>Email nhận: {invoice.recipientEmail}</div>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/90 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="p-3.5">Nội dung hàng hóa / dịch vụ</th>
                    <th className="p-3.5 text-right">Đơn giá trước thuế</th>
                    <th className="p-3.5 text-right">Thuế suất GTGT</th>
                    <th className="p-3.5 text-right">Tiền thuế GTGT</th>
                    <th className="p-3.5 text-right">Tổng tiền thanh toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr>
                    <td className="p-3.5 font-medium">
                      Vé tham dự sự kiện (Đơn hàng #{invoice.orderCode})
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      {formatVnd(invoice.subTotal)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-semibold">
                      {(invoice.vatRate * 100).toFixed(0)}%
                    </td>
                    <td className="p-3.5 text-right font-mono text-gray-600">
                      {formatVnd(invoice.vatAmount)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-900 text-sm">
                      {formatVnd(invoice.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Digital Signature Badge & Actions */}
            <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-300 shadow-sm">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>
                  Hóa đơn đã được ký số điện tử hợp pháp bởi <strong>TickeX Authority CA</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>In Hóa Đơn</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
