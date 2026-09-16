import Dexie, { type Table } from 'dexie';
import {
  DB_NAME,
  SCHEMA_VERSION,
  type LocalPatient,
  type LocalDoctor,
  type LocalAppointment,
  type LocalEncounter,
  type LocalMedicine,
  type LocalLabTest,
  type LocalOrganization,
  type LocalBranch,
  type LocalEncounterHeader,
  type QueueItem,
  type MetaItem,
} from './schema';

export * from './schema';

class MedSaasDB extends Dexie {
  patients!: Table<LocalPatient, string>;
  doctors!: Table<LocalDoctor, string>;
  appointments!: Table<LocalAppointment, string>;
  encounters!: Table<LocalEncounter, string>;
  queue!: Table<QueueItem, string>;
  meta!: Table<MetaItem, string>;

  // Tier 1 + 2 offline caches (read-only master data, tenant-scoped)
  medicines!: Table<LocalMedicine, [string, string]>;
  labTests!: Table<LocalLabTest, [string, string]>;
  organization!: Table<LocalOrganization, [string, string]>;
  branches!: Table<LocalBranch, [string, string]>;
  encounterHeaders!: Table<LocalEncounterHeader, [string, string]>;

  constructor() {
    super(DB_NAME);

    this.version(3).stores({
      patients:     'local_id, server_id, full_name, mobile, sync_status, updated_at, deleted',
      doctors:      'local_id, server_id, full_name, is_active',
      appointments: 'local_id, server_id, patient_local_id, appointment_local_id, appointment_date, status, sync_status, updated_at, deleted',
      encounters:   'local_id, server_id, patient_local_id, appointment_local_id, encounter_date, status, sync_status, updated_at, deleted',
      queue:        'id, status, entity, local_id, created_at',
      meta:         'key',
    });

    this.version(4).stores({
      patients:     'local_id, server_id, full_name, mobile, sync_status, updated_at, deleted',
      doctors:      'local_id, server_id, full_name, is_active',
      appointments: 'local_id, server_id, patient_local_id, appointment_local_id, appointment_date, status, sync_status, updated_at, deleted',
      encounters:   'local_id, server_id, patient_local_id, appointment_local_id, encounter_date, status, sync_status, updated_at, deleted',
      queue:        'id, status, entity, local_id, created_at, next_retry_at',
      meta:         'key',
    }).upgrade(async (tx) => {
      await tx.table('queue').toCollection().modify((row: any) => {
        if (row.next_retry_at === undefined) row.next_retry_at = null;
      });
    });

    this.version(5).stores({
      patients:        'local_id, server_id, full_name, mobile, sync_status, updated_at, deleted',
      doctors:         'local_id, server_id, full_name, is_active',
      appointments:    'local_id, server_id, patient_local_id, appointment_local_id, appointment_date, status, sync_status, updated_at, deleted',
      encounters:      'local_id, server_id, patient_local_id, appointment_local_id, encounter_date, status, sync_status, updated_at, deleted',
      queue:           'id, status, entity, local_id, created_at, next_retry_at',
      meta:            'key',
      medicines:       'id, tenant_id, name, code, barcode, generic_name, is_active, updated_at',
      labTests:        'id, tenant_id, name, code, category, is_active, updated_at',
      organization:    'id, tenant_id',
      branches:        'id, tenant_id, branch_code, is_active',
      encounterHeaders:'id, tenant_id, patient_id, encounter_date, updated_at',
    });

    // v6 — tenant-scoped compound primary keys on all master-data caches.
    // This prevents cross-tenant bleed when a user belongs to multiple tenants.
    // The read-only cache tables are cleared here; they repopulate on the
    // next pull (which happens automatically on app boot).
    this.version(SCHEMA_VERSION).stores({
      patients:        'local_id, server_id, full_name, mobile, sync_status, updated_at, deleted',
      doctors:         'local_id, server_id, full_name, is_active',
      appointments:    'local_id, server_id, patient_local_id, appointment_local_id, appointment_date, status, sync_status, updated_at, deleted',
      encounters:      'local_id, server_id, patient_local_id, appointment_local_id, encounter_date, status, sync_status, updated_at, deleted',
      queue:           'id, status, entity, local_id, created_at, next_retry_at',
      meta:            'key',
      medicines:       '[tenant_id+id], tenant_id, name, code, barcode, generic_name, is_active, updated_at',
      labTests:        '[tenant_id+id], tenant_id, name, code, category, is_active, updated_at',
      organization:    '[tenant_id+id], tenant_id',
      branches:        '[tenant_id+id], tenant_id, branch_code, is_active',
      encounterHeaders:'[tenant_id+id], tenant_id, patient_id, encounter_date, updated_at',
    }).upgrade(async (tx) => {
      await tx.table('medicines').clear();
      await tx.table('labTests').clear();
      await tx.table('organization').clear();
      await tx.table('branches').clear();
      await tx.table('encounterHeaders').clear();
    });
  }
}

export const db = new MedSaasDB();

export const uuid = (): string =>
  (crypto as any).randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

export const meta = {
  async get(key: string): Promise<string | null> {
    const row = await db.meta.get(key);
    return row?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    await db.meta.put({ key, value });
  },
  async remove(key: string): Promise<void> {
    await db.meta.delete(key);
  },
};

export async function getDeviceId(): Promise<string> {
  let id = await meta.get('device_id');
  if (!id) {
    id = uuid();
    await meta.set('device_id', id);
  }
  return id;
}