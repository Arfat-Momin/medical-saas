import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsRepository, type UpdateOrganizationInput } from '@/repositories/organizations.repository';
import { organizationLocalRepository } from '@/repositories/offline.repositories';
import { db, meta } from '@/db';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const KEY = ['organization'];

/**
 * Reads the org from Dexie, scoped to the caller's tenant.
 *
 * - Waits for tenantId to be resolved (otherwise it caches an empty
 *   result and never refetches when the tenant arrives).
 * - Includes tenantId in the queryKey so switching tenant refetches.
 * - If the local cache is empty and we're online, pulls
 *   /sync/pull?entity=organization directly, upserts, and re-reads.
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
        try {
          const cursorKey = `last_pull_at:${tenantId}:organization`;
          const since = await meta.get(cursorKey);
          const url = `/sync/pull?entity=organization${
            since ? `&since=${encodeURIComponent(since)}` : ''
          }`;
          const res = await api.get<{ rows: any[]; serverTime: string }>(url);
          for (const row of res.rows) {
            await organizationLocalRepository.upsertFromServer(row);
          }
          await meta.set(cursorKey, res.serverTime);
        } catch (err) {
          console.warn('[useOrganization] pull failed', err);
        }
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}