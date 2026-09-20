/**
 * Subscription display state ? single source of truth for the UI.
 *
 * The backend is authoritative. This helper decides only how to *render*
 * the values it returns; it never overrides the backend's `isExpired`.
 */
export interface SubscriptionView {
  isFree: boolean;
  isExpired: boolean;
  noSubscription: boolean;
  daysRemaining: number;
  endsAt: string | null;
  planName: string | null;
  planCode: string | null;
  needsUpgrade: boolean;
  ctaLabel: 'Upgrade' | 'Extend / Upgrade';
  statusLabel: 'Active' | 'Trial' | 'Expiring soon' | 'Expired' | 'No plan';
}

export function deriveSubscriptionView(
  sub: { isFreeTier: boolean; endsAt: string } | null | undefined,
  plan: { is_free?: boolean; name?: string; code?: string } | null | undefined,
  daysRemaining: number,
  isExpired: boolean,
): SubscriptionView {
  const noSubscription = !sub;
  const isFree = !!(sub?.isFreeTier || plan?.is_free);

  // Trust the backend's `isExpired` ? do not recompute from `endsAt`.
  const expired = noSubscription || !!isExpired;

  let statusLabel: SubscriptionView['statusLabel'];
  if (noSubscription) statusLabel = 'No plan';
  else if (expired) statusLabel = 'Expired';
  else if (daysRemaining <= 7) statusLabel = 'Expiring soon';
  else if (isFree) statusLabel = 'Trial';
  else statusLabel = 'Active';

  return {
    isFree,
    isExpired: expired,
    noSubscription,
    daysRemaining,
    endsAt: sub?.endsAt ?? null,
    planName: plan?.name ?? null,
    planCode: plan?.code ?? null,
    needsUpgrade: isFree || expired,
    ctaLabel: isFree || expired ? 'Upgrade' : 'Extend / Upgrade',
    statusLabel,
  };
}
