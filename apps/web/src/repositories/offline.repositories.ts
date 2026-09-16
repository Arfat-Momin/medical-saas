import { db } from '@/db';
import { useAuthStore } from '@/stores/auth.store';
import type {
  LocalMedicine,
  LocalLabTest,
  LocalOrganization,
  LocalBranch,
  LocalEncounterHeader,
} from '@/db/schema';

/**
 * SECURITY: every read in this file is scoped to the currently
 * authenticated tenant. If the tenant is not yet resolved (e.g., the
 * app is still booting and /auth/me hasn't returned), reads return
 * empty so we never leak data from a previous session.
 */
function currentTenantId(): string | null {
  return useAuthStore.getState().tenantId ?? null;
}

// ─────────────────────────────────────────────────────────────
// Medicines (read-only cache)
// ─────────────────────────────────────────────────────────────
export const medicinesLocalRepository = {
  async list(params: { search?: string; page?: number; pageSize?: number; activeOnly?: boolean }) {
    const tenantId = currentTenantId();
    if (!tenantId) return { rows: [] as LocalMedicine[], total: 0, page: 1, pageSize: params.pageSize ?? 20 };

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const search = (params.search ?? '').trim().toLowerCase();
    const activeOnly = params.activeOnly ?? true;

    let rows = await db.medicines.where('tenant_id').equals(tenantId).toArray();
    if (activeOnly) rows = rows.filter((r) => r.is_active !== false);
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          (r.generic_name ?? '').toLowerCase().includes(search) ||
          (r.code ?? '').toLowerCase().includes(search) ||
          (r.barcode ?? '').toLowerCase().includes(search),
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const total = rows.length;
    const from = (page - 1) * pageSize;
    return { rows: rows.slice(from, from + pageSize), total, page, pageSize };
  },

  async findByBarcode(barcode: string): Promise<LocalMedicine | null> {
    const tenantId = currentTenantId();
    if (!tenantId) return null;
    const b = barcode.trim();
    if (!b) return null;
    return (await db.medicines.where('[tenant_id+id]').between([tenantId, ''], [tenantId, '\uffff']).filter((r) => r.barcode === b).first()) ?? null;
  },

  async upsertFromServer(row: any): Promise<void> {
    const local: LocalMedicine = {
      id: row.id,
      tenant_id: row.tenant_id,
      code: row.code ?? null,
      barcode: row.barcode ?? null,
      name: row.name,
      generic_name: row.generic_name ?? null,
      manufacturer: row.manufacturer ?? null,
      category: row.category ?? null,
      unit: row.unit ?? null,
      hsn_code: row.hsn_code ?? null,
      gst_rate: row.gst_rate ?? 0,
      reorder_level: row.reorder_level ?? 10,
      is_active: row.is_active !== false,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
    await db.medicines.put(local);
  },

  async clear(): Promise<void> { await db.medicines.clear(); },
  async count(): Promise<number> { return db.medicines.count(); },
};

// ─────────────────────────────────────────────────────────────
// Lab Tests (read-only cache)
// ─────────────────────────────────────────────────────────────
export const labTestsLocalRepository = {
  async list(params: { search?: string; page?: number; pageSize?: number; activeOnly?: boolean }) {
    const tenantId = currentTenantId();
    if (!tenantId) return { rows: [] as LocalLabTest[], total: 0, page: 1, pageSize: params.pageSize ?? 20 };

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const search = (params.search ?? '').trim().toLowerCase();
    const activeOnly = params.activeOnly ?? true;

    let rows = await db.labTests.where('tenant_id').equals(tenantId).toArray();
    if (activeOnly) rows = rows.filter((r) => r.is_active !== false);
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          (r.code ?? '').toLowerCase().includes(search) ||
          (r.category ?? '').toLowerCase().includes(search),
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const total = rows.length;
    const from = (page - 1) * pageSize;
    return { rows: rows.slice(from, from + pageSize), total, page, pageSize };
  },

  async upsertFromServer(row: any): Promise<void> {
    const local: LocalLabTest = {
      id: row.id,
      tenant_id: row.tenant_id,
      code: row.code ?? null,
      name: row.name,
      category: row.category ?? null,
      sample_type: row.sample_type ?? null,
      unit: row.unit ?? null,
      reference_min: row.reference_min ?? null,
      reference_max: row.reference_max ?? null,
      reference_text: row.reference_text ?? null,
      price: Number(row.price ?? 0),
      turnaround_hrs: row.turnaround_hrs ?? 24,
      is_active: row.is_active !== false,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
    await db.labTests.put(local);
  },

  async clear(): Promise<void> { await db.labTests.clear(); },
  async count(): Promise<number> { return db.labTests.count(); },
};

// ─────────────────────────────────────────────────────────────
// Organization profile (single row per tenant)
// ─────────────────────────────────────────────────────────────
export const organizationLocalRepository = {
  async get(): Promise<LocalOrganization | null> {
    const tenantId = currentTenantId();
    if (!tenantId) return null;
    const row = await db.organization.where('tenant_id').equals(tenantId).first();
    return row ?? null;
  },

  async upsertFromServer(row: any): Promise<void> {
    const local: LocalOrganization = {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      legal_name: row.legal_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      pincode: row.pincode ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    };
    await db.organization.put(local);
  },

  async clear(): Promise<void> { await db.organization.clear(); },
  async count(): Promise<number> { return db.organization.count(); },
};

// ─────────────────────────────────────────────────────────────
// Branches (read-only cache)
// ─────────────────────────────────────────────────────────────
export const branchesLocalRepository = {
  async list(activeOnly = true): Promise<LocalBranch[]> {
    const tenantId = currentTenantId();
    if (!tenantId) return [];
    let rows = await db.branches.where('tenant_id').equals(tenantId).toArray();
    if (activeOnly) rows = rows.filter((r) => r.is_active !== false);
    rows.sort((a, b) => (a.branch_code ?? '').localeCompare(b.branch_code ?? ''));
    return rows;
  },

  async upsertFromServer(row: any): Promise<void> {
    const local: LocalBranch = {
      id: row.id,
      tenant_id: row.tenant_id,
      organization_id: row.organization_id ?? null,
      name: row.name,
      address: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      pincode: row.pincode ?? null,
      phone: row.phone ?? null,
      branch_code: row.branch_code ?? '',
      is_active: row.is_active !== false,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
    await db.branches.put(local);
  },

  async clear(): Promise<void> { await db.branches.clear(); },
  async count(): Promise<number> { return db.branches.count(); },
};

// ─────────────────────────────────────────────────────────────
// Encounter headers (read-only history list)
// ─────────────────────────────────────────────────────────────
export const encounterHeadersLocalRepository = {
  async listForPatient(patientServerId: string): Promise<LocalEncounterHeader[]> {
    const tenantId = currentTenantId();
    if (!tenantId || !patientServerId) return [];
    const rows = await db.encounterHeaders
      .where('[tenant_id+patient_id]')
      .between([tenantId, patientServerId], [tenantId, patientServerId + '\uffff'])
      .toArray();
    rows.sort((a, b) => (b.encounter_date ?? '').localeCompare(a.encounter_date ?? ''));
    return rows;
  },

  async upsertFromServer(row: any): Promise<void> {
    const local: LocalEncounterHeader = {
      id: row.id,
      tenant_id: row.tenant_id,
      branch_id: row.branch_id ?? null,
      patient_id: row.patient_id,
      doctor_id: row.doctor_id ?? null,
      appointment_id: row.appointment_id ?? null,
      encounter_type: row.encounter_type ?? null,
      encounter_date: row.encounter_date,
      status: row.status ?? 'DRAFT',
      chief_complaint: row.chief_complaint ?? null,
      history: row.history ?? null,
      examination: row.examination ?? null,
      notes: row.notes ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
    await db.encounterHeaders.put(local);
  },

  async clear(): Promise<void> { await db.encounterHeaders.clear(); },
  async count(): Promise<number> { return db.encounterHeaders.count(); },
};