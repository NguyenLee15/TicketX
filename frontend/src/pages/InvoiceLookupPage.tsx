import { useState } from 'react';
import { Search, FileText, AlertCircle, Loader2, Printer, ShieldCheck } from 'lucide-react';
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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-semibold uppercase">
          <FileText className="w-3.5 h-3.5" />
          Cổng Tra Cứu Hóa Đơn Điện Tử
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Tra Cứu Hóa Đơn GTGT TickeX
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto">
          Tra cứu và xác thực hóa đơn điện tử chính thức theo chuẩn Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleLookup} className="max-w-md mx-auto flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            required
            maxLength={16}
            placeholder="Nhập mã bí mật tra cứu (VD: TKX8A9B2)"
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 bg-surface-1 border border-border-subtle rounded-xl text-sm font-mono text-white tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !lookupCode.trim()}
          className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-[background-color,transform] active:scale-[0.98] shadow-sm shadow-brand-glow"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Tra cứu</span>
        </button>
      </form>

      {/* Error State */}
      {error && (
        <div className="max-w-md mx-auto p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-3 text-danger text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* E-Invoice Viewer (Decree 123 Compliance) */}
      {invoice && (
        <div className="rounded-2xl bg-white text-gray-900 border border-gray-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-modal-pop">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display uppercase tracking-wider text-gray-900">
                HÓA ĐƠN GIÁ TRỊ GIA TĂNG
              </h2>
              <p className="text-xs text-gray-500 italic mt-0.5">
                (Bản thể hiện của hóa đơn điện tử — Nghị định 123/2020/NĐ-CP)
              </p>
            </div>
            <div className="text-xs sm:text-right space-y-1 text-gray-600">
              <div>Ký hiệu (Series): <strong className="font-mono text-gray-900">1C26TXX</strong></div>
              <div>Số hóa đơn (No.): <strong className="font-mono text-gray-900">{invoice.invoiceNumber}</strong></div>
              <div>Ngày lập: <strong className="text-gray-900">{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('vi-VN') : '—'}</strong></div>
            </div>
          </div>

          {/* Seller & Buyer details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-700">
            <div className="space-y-1.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase block">Đơn vị bán hàng (Seller):</span>
              <div className="font-semibold text-gray-900">CÔNG TY CỔ PHẦN NỀN TẢNG BÁN VÉ TICKEX</div>
              <div>Mã số thuế: <strong className="font-mono text-gray-900">0109988776</strong></div>
              <div>Địa chỉ: Tòa nhà TickeX Tower, Cầu Giấy, Hà Nội</div>
            </div>

            <div className="space-y-1.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase block">Đơn vị mua hàng (Buyer):</span>
              <div className="font-semibold text-gray-900">{invoice.companyName}</div>
              <div>Mã số thuế: <strong className="font-mono text-gray-900">{invoice.taxCode}</strong></div>
              <div>Địa chỉ: {invoice.companyAddress}</div>
              <div>Email nhận: {invoice.recipientEmail}</div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-gray-200">
              <thead className="bg-gray-100 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="p-3 border-b border-gray-200">Nội dung hàng hóa / dịch vụ</th>
                  <th className="p-3 border-b border-gray-200 text-right">Đơn giá trước thuế</th>
                  <th className="p-3 border-b border-gray-200 text-right">Thuế suất GTGT</th>
                  <th className="p-3 border-b border-gray-200 text-right">Tiền thuế GTGT</th>
                  <th className="p-3 border-b border-gray-200 text-right">Tổng tiền thanh toán</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border-b border-gray-200 font-medium">
                    Vé tham dự sự kiện (Đơn hàng #{invoice.orderCode})
                  </td>
                  <td className="p-3 border-b border-gray-200 text-right font-mono">
                    {formatVnd(invoice.subTotal)}
                  </td>
                  <td className="p-3 border-b border-gray-200 text-right font-mono">
                    {(invoice.vatRate * 100).toFixed(0)}%
                  </td>
                  <td className="p-3 border-b border-gray-200 text-right font-mono text-gray-600">
                    {formatVnd(invoice.vatAmount)}
                  </td>
                  <td className="p-3 border-b border-gray-200 text-right font-mono font-bold text-gray-900">
                    {formatVnd(invoice.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Digital Signature Badge & Actions */}
          <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Hóa đơn đã được ký số điện tử hợp pháp bởi <strong>TickeX Authority CA</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>In Hóa Đơn</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
