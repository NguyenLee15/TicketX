import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface OrganizerRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function OrganizerRoute({
  children,
  allowedRoles = ['Organizer', 'Admin'],
}: OrganizerRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user, isHydrating } = useAuthStore();

  if (isHydrating) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="min-h-dvh bg-surface-base flex flex-col items-center justify-center gap-3"
      >
        <Loader2 className="h-8 w-8 text-brand-primary animate-spin" aria-hidden="true" />
        <span className="sr-only">Đang xác thực thông tin tài khoản ban tổ chức...</span>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = user?.role || 'Customer';
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
