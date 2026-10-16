import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import type { ReactNode } from 'react';

interface Props {
  permission: string;
  children: ReactNode;
  /** Where to redirect when access is denied. Defaults to '/dashboard' */
  redirectTo?: string;
}

/**
 * Renders children only when the authenticated user holds the required permission.
 * Otherwise redirects to /dashboard (or a custom path).
 * Use this as a wrapper around <Route element={...}> or inside a page component.
 */
export function PermissionGuard({ permission, children, redirectTo = '/dashboard' }: Props) {
  const permissions = useAuthStore((s) => s.permissions);
  if (!permissions.includes(permission)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
