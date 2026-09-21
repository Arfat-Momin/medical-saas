import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsRepository, type UpdateOrganizationInput } from '@/repositories/organizations.repository';
import { organizationLocalRepository } from '@/repositories/offline.repositories';
import { syncEngine } from '@/sync/engine';
import { useAuthStore } from '@/stores/auth.store';

const KEY = ['organization'];

/**
 * Reads the org from Dexie, scoped to the caller's tenant.
 *
 * Refresh policy: first mount pulls synchronously if the cache is empty;
 * subsequent mounts background-refresh so edits made on other devices
 * appear without a manual reload.
 */
export function useOrganization() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: [...KEY, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return null;

      const online = typeof navigator !== 'undefined' && navigator.onLine !== false;
      const local = await organizationLocalRepository.get();

      if (!local && online) {
        try { await syncEngine.pullEntity('organization'); } catch { /* best effort */ }
      } else if (online) {
        void syncEngine.pullEntity('organization').catch(() => {});
      }

      return organizationLocalRepository.get();
    },
    staleTime: 30_000,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateOrganizationInput) => organizationsRepository.updateMine(patch),
    onSuccess: async () => {
      // Re-read the server's canonical copy before invalidating.
      try { await syncEngine.pullEntity('organization'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}