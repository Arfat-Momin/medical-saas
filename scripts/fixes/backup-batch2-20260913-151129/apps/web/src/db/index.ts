import Dexie, { type Table } from 'dexie';
import {
  DB_NAME,
  SCHEMA_VERSION,
  type LocalPatient,
  type LocalDoctor,
  type LocalAppointment,
  type LocalEncounter,
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

  constructor() {
    super(DB_NAME);
    this.version(SCHEMA_VERSION).stores({
      patients:     'local_id, server_id, full_name, mobile, sync_status, updated_at, deleted',
      doctors:      'local_id, server_id, full_name, is_active',
      appointments: 'local_id, server_id, patient_local_id, appointment_local_id, appointment_date, status, sync_status, updated_at, deleted',
      encounters:   'local_id, server_id, patient_local_id, appointment_local_id, encounter_date, status, sync_status, updated_at, deleted',
      queue:        'id, status, entity, local_id, created_at',
      meta:         'key',
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
