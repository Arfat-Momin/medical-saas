import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformRepository as repo } from '@/repositories/platform.repository';

const DASH    = ['platform', 'dashboard'];
const TENANTS = ['platform', 'tenants'];
const PLANS   = ['platform', 'plans'];

export function usePlatformDashboard() {
  return useQuery({ queryKey: DASH, queryFn: repo.dashboard });
}

export function useTenants(params: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...TENANTS, params], queryFn: () => repo.listTenants(params) });
}

export function useTenant(id: string | undefined) {
  return useQuery({ queryKey: [...TENANTS, id], queryFn: () => repo.getTenant(id!), enabled: Boolean(id) });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateTenant(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANTS });
      qc.invalidateQueries({ queryKey: DASH });
    },
  });
}

export function useExtendSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days, notes }: { id: string; days: number; notes?: string | null }) =>
      repo.extendSubscription(id, { days, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANTS });
      qc.invalidateQueries({ queryKey: DASH });
    },
  });
}

export function usePlans() {
  return useQuery({ queryKey: PLANS, queryFn: repo.listPlans });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: repo.createPlan, onSuccess: () => qc.invalidateQueries({ queryKey: PLANS }) });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updatePlan(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS }),
  });
}
