import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentSubscription } from '@/hooks/useSubscriptions';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Server-authoritative subscription gate.
 *
 * Behaviour:
 *  - Loading: show a spinner on the very first fetch only.
 *  - Failed to fetch: allow through ? the backend still enforces auth on
 *    every route, and a network blip shouldn't trap the user on a blank page.
 *  - Expired or missing subscription: redirect to /settings/subscription,
 *    the only page that can restore access.
 *  - Everything else: pass through unchanged.
 *
 * The gate is pure UX. The real security is `requireTenant` on the backend.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data, isLoading, isError, isFetched } = useCurrentSubscription();

  const isOnSubscriptionPage = location.pathname === '/settings/subscription';

  // First load only ? avoid flashing a spinner on subsequent navigations.
  if (isLoading && !isFetched) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  // Don't trap the user when we simply can't reach the API.
  // Every protected endpoint is still gated by requireTenant server-side.
  if (isError || !data) {
    return <>{children}</>;
  }

  const noSubscription = !data.subscription;
  const expired = !!data.isExpired;

  if ((noSubscription || expired) && !isOnSubscriptionPage) {
    return <Navigate to="/settings/subscription" replace />;
  }

  return <>{children}</>;
}
