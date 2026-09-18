import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  subscriptionsRepository as repo,
  type SignupInput,
  type VerifyRenewalInput,
} from '@/repositories/subscriptions.repository';

export function usePublicPlans() {
  return useQuery({ queryKey: ['subscriptions', 'plans'], queryFn: repo.listPlans, staleTime: 60_000 });
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

// ===== Subscription info + renewal =====

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['subscriptions', 'current'],
    queryFn: repo.getCurrentSubscription,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

export function useRenewSubscription() {
  return useMutation({ mutationFn: (planId: string) => repo.createRenewal(planId) });
}

export function useVerifyRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyRenewalInput) => repo.verifyRenewal(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions', 'current'] });
    },
  });
}
