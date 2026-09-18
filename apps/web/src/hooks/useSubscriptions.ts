import { useMutation, useQuery } from '@tanstack/react-query';
import { subscriptionsRepository as repo, type SignupInput } from '@/repositories/subscriptions.repository';

export function usePublicPlans() {
  return useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: repo.listPlans,
    // Public marketing data — must never be trusted from a stale cache.
    // A persisted empty [] from an earlier session (dev DB, outage) would
    // otherwise show "No plans available yet" for up to 7 days.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  });
}

export function useSignup() {
  return useMutation({ mutationFn: (input: SignupInput) => repo.signup(input) });
}

export function useSignupStatus(signupId: string | undefined, opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['subscriptions', 'signup', signupId],
    queryFn: () => repo.getStatus(signupId!),
    enabled: Boolean(signupId),
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useVerifySignature() {
  return useMutation({ mutationFn: repo.verifySignature });
}
