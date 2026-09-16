import { db, uuid, type LocalDoctor } from '@/db';

export interface Doctor {
  id: string;
  local_id: string;
  server_id: string | null;
  full_name: string;
  email: string | null;
  role_code: string | null;
}

export const doctorsRepository = {
  async list(): Promise<Doctor[]> {
    const rows = await db.doctors.where('is_active').equals(1).toArray();
    rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return rows.map((d) => ({
      id: d.local_id,
      local_id: d.local_id,
      server_id: d.server_id,
      full_name: d.full_name,
      email: d.email,
      role_code: d.role_code,
    }));
  },

  async upsertFromServer(server: {
    id: string;
    full_name: string;
    email: string | null;
    role_code: string | null;
    updated_at: string;
  }): Promise<void> {
    const existing = await db.doctors.where('server_id').equals(server.id).first();
    if (existing) {
      await db.doctors.update(existing.local_id, {
        full_name: server.full_name,
        email: server.email,
        role_code: server.role_code,
        is_active: 1,
        updated_at: server.updated_at,
      });
      return;
    }
    await db.doctors.add({
      local_id: uuid(),
      server_id: server.id,
      full_name: server.full_name,
      email: server.email,
      role_code: server.role_code,
      is_active: 1,
      updated_at: server.updated_at,
    });
  },

  async count(): Promise<number> {
    return db.doctors.where('is_active').equals(1).count();
  },
};
