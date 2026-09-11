import { useMutation, useQuery } from '@tanstack/react-query';
import { subscriptionsRepository as repo, type SignupInput } from '@/repositories/subscriptions.repository';

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
