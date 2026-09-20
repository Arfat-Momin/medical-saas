import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrentSubscription } from '@/hooks/useSubscriptions';

/**
 * SubscriptionGate ? pure side-effect component. Renders children unchanged.
 * Redirects to /settings/subscription when the backend reports expiry/missing.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isFetched } = useCurrentSubscription();

  useEffect(() => {
    if (!isFetched || !data) return;
    const noSub = !data.subscription;
    const expired = !!data.isExpired;
    if (!noSub && !expired) return;
    if (location.pathname.startsWith('/settings/subscription')) return;
    navigate('/settings/subscription', { replace: true });
  }, [data, isFetched, location.pathname, navigate]);

  return <>{children}</>;
}
