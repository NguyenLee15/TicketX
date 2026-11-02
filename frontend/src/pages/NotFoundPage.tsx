import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return <section aria-labelledby="not-found-title" className="surface-panel mx-auto max-w-xl p-10 text-center">
    <p className="font-mono text-brand-primary">404</p>
    <h1 id="not-found-title" className="mt-2 text-3xl font-display font-black text-white">Không Tìm Thấy Trang</h1>
    <p className="mt-3 text-text-secondary">Đường dẫn không tồn tại hoặc đã được thay đổi.</p>
    <Link to="/" aria-label="Xem danh sách sự kiện và trở về trang chủ" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-5 py-3 font-bold text-white hover:bg-brand-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-[background-color,transform]">Xem Sự Kiện</Link>
  </section>;
}
