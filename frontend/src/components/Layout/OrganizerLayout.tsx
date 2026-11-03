import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, LogOut, Ticket, Menu, X, Landmark, ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/useAuthStore';
import { useModalAccessibility } from '../Admin/useModalAccessibility';
import { ResilientImage } from '../ResilientImage';
import api from '../../services/api';

export default function OrganizerLayout() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { logout, user } = useAuthStore();
  const handleLogout = async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* ignore session cleanup errors */ }
    queryClient.clear();
    logout();
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isMobileMenuOpen, false, () => setIsMobileMenuOpen(false), mobileDrawerRef);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { name: 'Tổng quan & KPI', href: '/organizer', icon: LayoutDashboard },
    { name: 'Sự kiện của tôi', href: '/organizer/events', icon: Calendar },
    { name: 'Quyết toán doanh thu', href: '/organizer/settlements', icon: Landmark },
  ];

  return (
    <div className="min-h-dvh bg-surface-0 flex flex-col md:flex-row text-text-primary relative overflow-hidden">
      <a
        href="#organizer-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg"
      >
        Bỏ qua đến nội dung chính
      </a>

      {/* Mobile Top Header (< md) */}
      <header className="md:hidden h-16 bg-surface-1 border-b border-border-subtle px-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <Link to="/organizer" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
            <Ticket className="w-4 h-4 text-brand-primary" aria-hidden="true" />
          </div>
          <span className="text-base font-display font-bold tracking-tight text-white">
            Kênh Ban Tổ Chức
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="min-h-11 min-w-11 p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white transition-colors border border-border-subtle"
          aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-controls="organizer-mobile-navigation"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Đóng menu ban tổ chức"
          className="fixed inset-0 z-50 bg-surface-1/75 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        id="organizer-mobile-navigation"
        ref={mobileDrawerRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen || undefined}
        aria-label="Thanh điều hướng ban tổ chức di động"
        className={`fixed top-0 left-0 bottom-0 w-72 bg-surface-1 border-r border-border-subtle z-50 flex flex-col md:hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            </div>
            <span className="text-base font-display font-bold tracking-tight text-white">
              TickeX Organizer
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Đóng menu"
            className="min-h-11 min-w-11 p-1.5 rounded-lg text-text-tertiary hover:text-white hover:bg-surface-2"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Thanh điều hướng ban tổ chức di động" className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`min-h-11 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                    : 'text-text-secondary hover:text-white hover:bg-surface-2'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-primary' : 'text-text-tertiary'}`} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-subtle space-y-2">
          <Link
            to="/"
            className="min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-white hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span>Về trang người mua</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Desktop Sidebar (>= md) */}
      <aside className="hidden md:flex w-64 bg-surface-1 border-r border-border-subtle flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border-subtle">
          <Link to="/organizer" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-base tracking-tight block">TickeX Partner</span>
              <span className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider block">Kênh Ban Tổ Chức</span>
            </div>
          </Link>
        </div>

        <nav aria-label="Thanh điều hướng ban tổ chức" className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-primary/10 text-brand-primary font-semibold shadow-sm'
                    : 'text-text-secondary hover:text-white hover:bg-surface-2'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-primary' : 'text-text-tertiary'}`} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile & footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-1/50 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1.5">
            {user?.avatarUrl ? (
              <ResilientImage
                src={user.avatarUrl}
                alt={user.name || 'Organizer'}
                width="36"
                height="36"
                className="w-9 h-9 rounded-full object-cover border border-border-subtle"
                fallbackClassName="w-9 h-9 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center text-text-tertiary text-xs font-bold"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary text-sm font-bold">
                {user?.name?.charAt(0) || 'O'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name || 'Ban Tổ Chức'}</p>
              <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
          </div>

          <Link
            to="/"
            className="min-h-11 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-white hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
            <span>Về trang bán vé</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="organizer-main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 overflow-y-auto outline-none">
        <Outlet />
      </main>
    </div>
  );
}

