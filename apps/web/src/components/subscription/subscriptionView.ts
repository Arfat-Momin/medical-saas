/**
 * Subscription display state ? the single source of truth for the UI.
 *
 * A tenant is "free tier" if either the subscription row or its plan says so.
 * This is defensive: older free-tier rows were created before the
 * `is_free_tier` column existed, so the flag may be missing even though the
 * plan is the FREE plan.
 */
export interface SubscriptionView {
  isFree: boolean;
  isExpired: boolean;
  noSubscription: boolean;
  daysRemaining: number;
  endsAt: string | null;
  planName: string | null;
  planCode: string | null;
  needsUpgrade: boolean;   // true for free OR expired ? never "renew" for free
  ctaLabel: 'Upgrade' | 'Extend / Upgrade';
}

export function deriveSubscriptionView(
  sub: {
    isFreeTier: boolean;
    endsAt: string;
  } | null,
  plan: { is_free?: boolean; name?: string; code?: string } | null,
  daysRemaining: number,
  isExpired: boolean,
): SubscriptionView {
  const noSubscription = !sub;
  const isFree = !!(sub?.isFreeTier || plan?.is_free);
  const expired = noSubscription || isExpired;

  return {
    isFree,
    isExpired: expired,
    noSubscription,
    daysRemaining,
    endsAt: sub?.endsAt ?? null,
    planName: plan?.name ?? null,
    planCode: plan?.code ?? null,
    // Free tier and expired paid both need a change of plan, not a same-plan renewal
    needsUpgrade: isFree || expired,
    ctaLabel: isFree || expired ? 'Upgrade' : 'Extend / Upgrade',
  };
}
