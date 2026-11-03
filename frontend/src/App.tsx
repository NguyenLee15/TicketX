import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from './services/api';
import { useAuthStore } from './stores/useAuthStore';

// Layouts
import StandardLayout from './components/Layout/StandardLayout';
import AdminLayout from './components/Layout/AdminLayout';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Layout/AdminRoute';
import OrganizerLayout from './components/Layout/OrganizerLayout';
import OrganizerRoute from './components/Layout/OrganizerRoute';

// Standard Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const MyTicketsPage = lazy(() => import('./pages/Tickets/MyTicketsPage'));
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('./pages/Admin/AdminDashboardPage'));
const AdminEventsPage = lazy(() => import('./pages/Admin/AdminEventsPage'));
const AdminUsersPage = lazy(() => import('./pages/Admin/AdminUsersPage'));
const AdminRefundsPage = lazy(() => import('./pages/Admin/AdminRefundsPage'));
const AdminScanTicketPage = lazy(() => import('./pages/Admin/AdminScanTicketPage'));
const AdminSettlementsPage = lazy(() => import('./pages/Admin/AdminSettlementsPage'));

// Organizer Pages
const OrganizerDashboardPage = lazy(() => import('./pages/Organizer/OrganizerDashboardPage'));
const OrganizerEventsPage = lazy(() => import('./pages/Organizer/OrganizerEventsPage'));
const OrganizerSettlementsPage = lazy(() => import('./pages/Organizer/OrganizerSettlementsPage'));

// Mock Pages (Development Only)
const MockPayOSPage = import.meta.env.DEV
  ? lazy(() => import('./pages/MockPayOSPage'))
  : null;

import { ErrorBoundary } from './components/ErrorBoundary';
import { authRefreshResponseSchema } from './schemas/customerSchemas';

function App() {
  const setAuth = useAuthStore(state => state.setAuth);
  const logout = useAuthStore(state => state.logout);
  const setHydrating = useAuthStore(state => state.setHydrating);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    const existingUser = useAuthStore.getState().user;
    if (!existingUser) {
      setHydrating(false);
      return;
    }

    
    api.post('/api/auth/refresh', {})
      .then(response => {
        if (!response.data?.success) {
          setHydrating(false);
          return;
        }
        const parsed = authRefreshResponseSchema.safeParse(response.data.data);
        if (!parsed.success) {
          if (useAuthStore.getState().user) logout();
          setHydrating(false);
          return;
        }
        const data = parsed.data;
        setAuth({
          id: data.userId,
          name: data.name ?? '',
          email: data.email ?? existingUser.email ?? '',
          role: data.role ?? 'Customer',
          avatarUrl: data.avatarUrl || existingUser.avatarUrl || '',
        }, data.token ?? null);
      })
      .catch(() => {
        if (useAuthStore.getState().user) logout();
        setHydrating(false);
      });

    
  }, [logout, setAuth, setHydrating]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center gap-3 text-text-secondary"><Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" /><span className="text-sm font-medium">Đang tải…</span></div>}>
        <Routes>
        {/* Admin & Staff Portal */}
        <Route
          path="/admin"
          element={
            <AdminRoute allowedRoles={['Admin', 'Staff']}>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            index
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="events"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminEventsPage />
              </AdminRoute>
            }
          />
          <Route
            path="scan-ticket"
            element={
              <AdminRoute allowedRoles={['Admin', 'Staff']}>
                <AdminScanTicketPage />
              </AdminRoute>
            }
          />
          <Route
            path="users"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="refunds"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminRefundsPage />
              </AdminRoute>
            }
          />
          <Route
            path="settlements"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminSettlementsPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* Organizer Portal */}
        <Route
          path="/organizer"
          element={
            <OrganizerRoute allowedRoles={['Organizer', 'Admin']}>
              <OrganizerLayout />
            </OrganizerRoute>
          }
        >
          <Route index element={<OrganizerDashboardPage />} />
          <Route path="events" element={<OrganizerEventsPage />} />
          <Route path="settlements" element={<OrganizerSettlementsPage />} />
        </Route>

        {/* Mock Routes - Development Only */}
        {import.meta.env.DEV && MockPayOSPage && (
          <Route
            path="/mock-payos"
            element={
              <Suspense fallback={<div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center gap-3 text-text-secondary"><Loader2 className="w-8 h-8 text-brand-primary animate-spin" aria-hidden="true" /><span className="text-sm font-medium">Đang tải...</span></div>}>
                <MockPayOSPage />
              </Suspense>
            }
          />
        )}

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Standard Routes */}
        <Route path="/" element={<StandardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="my-tickets" element={<PrivateRoute><MyTicketsPage /></PrivateRoute>} />
          <Route path="payment-result" element={<PrivateRoute><PaymentResultPage /></PrivateRoute>} />
          <Route path="payment/result" element={<PrivateRoute><PaymentResultPage /></PrivateRoute>} />
          <Route path="profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="privacy" element={<LegalPage />} />
          <Route path="terms" element={<LegalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
