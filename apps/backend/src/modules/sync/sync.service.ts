import { supabaseForUser } from '../../config/supabase.js';
import { syncRepository as repo } from './sync.repository.js';
import { NotFound, BadRequest } from '../../utils/errors.js';
import type { AuthContext } from '@medical/shared';

export const syncService = {
  async registerDevice(
    auth: AuthContext,
    token: string,
    input: { deviceId: string; platform: string; appVersion?: string | null; osVersion?: string | null },
  ) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    if (!input.deviceId) throw BadRequest('deviceId required');
    const client = supabaseForUser(token);
    return repo.upsertDevice(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      osVersion: input.osVersion ?? null,
    });
  },

  async pull(
    auth: AuthContext,
    token: string,
    params: { entity: string; since: string | null; limit?: number; offset?: number },
  ) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const limit = params.limit ?? 500;
    const offset = params.offset ?? 0;
    const serverTime = new Date().toISOString();

    switch (params.entity) {
      case 'patients': {
        const rows = await repo.pullPatients(client, auth.tenantId, params.since, limit, offset);
        return { entity: 'patients', rows, serverTime, hasMore: rows.length === limit };
      }
      case 'appointments': {
        const rows = await repo.pullAppointments(client, auth.tenantId, params.since, limit, offset);
        return { entity: 'appointments', rows, serverTime, hasMore: rows.length === limit };
      }
      case 'doctors': {
        const rows = await repo.pullDoctors(client, auth.tenantId, params.since);
        return { entity: 'doctors', rows, serverTime, hasMore: false };
      }
      case 'medicines': {
        const rows = await repo.pullMedicines(client, auth.tenantId, params.since, limit, offset);
        return { entity: 'medicines', rows, serverTime, hasMore: rows.length === limit };
      }
      case 'lab_tests': {
        const rows = await repo.pullLabTests(client, auth.tenantId, params.since, limit, offset);
        return { entity: 'lab_tests', rows, serverTime, hasMore: rows.length === limit };
      }
      case 'organization': {
        const rows = await repo.pullOrganization(client, auth.tenantId);
        return { entity: 'organization', rows, serverTime, hasMore: false };
      }
      case 'branches': {
        const rows = await repo.pullBranches(client, auth.tenantId);
        return { entity: 'branches', rows, serverTime, hasMore: false };
      }
      case 'encounters': {
        const rows = await repo.pullEncounters(client, auth.tenantId, params.since, limit, offset);
        return { entity: 'encounters', rows, serverTime, hasMore: rows.length === limit };
      }
      default:
        throw BadRequest(`Unsupported entity: ${params.entity}`);
    }
  },
};