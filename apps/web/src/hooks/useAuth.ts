import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authRepository } from '@/repositories/auth.repository';
import { useAuthStore } from '@/stores/auth.store';

export function useMeSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setContext   = useAuthStore((s) => s.setContext);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: authRepository.me,
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data?.auth) {
      setContext({
        tenantId: query.data.auth.tenantId,
        primaryBranchId: query.data.primaryBranchId ?? null,
        roles: query.data.auth.roles,
        permissions: query.data.auth.permissions,
      });
    }
  }, [query.data, setContext]);

  return query;
}

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);
  return {
    permissions,
    can: (perm: string) => permissions.includes(perm),
  };
}