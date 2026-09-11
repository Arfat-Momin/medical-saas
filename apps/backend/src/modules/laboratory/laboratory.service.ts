import { supabaseForUser } from '../../config/supabase.js';
import { laboratoryRepository as repo } from './laboratory.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreateLabTestInput, UpdateLabTestInput, CreateLabOrderInput,
  CollectSampleInput, EnterResultsInput, ListLabTestsQuery, ListLabOrdersQuery,
} from './laboratory.validators.js';

export const laboratoryService = {
  // TESTS
  async listTests(auth: AuthContext, token: string, q: ListLabTestsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listTests(supabaseForUser(token), auth.tenantId, q);
  },
  async createTest(auth: AuthContext, token: string, input: CreateLabTestInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const t = await repo.createTest(client, {
      tenant_id: auth.tenantId,
      code: input.code ?? null,
      name: input.name,
      category: input.category ?? null,
      sample_type: input.sampleType ?? null,
      unit: input.unit ?? null,
      reference_min: input.referenceMin ?? null,
      reference_max: input.referenceMax ?? null,
      reference_text: input.referenceText ?? null,
      price: input.price,
      turnaround_hrs: input.turnaroundHrs,
    });
    await audit({ actorUserId: auth.userId, action: 'LAB_TEST_CREATED', entity: 'lab_tests', entityId: t.id, after: t });
    return t;
  },
  async updateTest(auth: AuthContext, token: string, id: string, patch: UpdateLabTestInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findTest(client, auth.tenantId, id);
    if (!before) throw NotFound('Test not found');

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)          dbPatch.name = patch.name;
    if (patch.category !== undefined)      dbPatch.category = patch.category;
    if (patch.sampleType !== undefined)    dbPatch.sample_type = patch.sampleType;
    if (patch.unit !== undefined)          dbPatch.unit = patch.unit;
    if (patch.referenceMin !== undefined)  dbPatch.reference_min = patch.referenceMin;
    if (patch.referenceMax !== undefined)  dbPatch.reference_max = patch.referenceMax;
    if (patch.referenceText !== undefined) dbPatch.reference_text = patch.referenceText;
    if (patch.price !== undefined)         dbPatch.price = patch.price;
    if (patch.turnaroundHrs !== undefined) dbPatch.turnaround_hrs = patch.turnaroundHrs;
    if (patch.isActive !== undefined)      dbPatch.is_active = patch.isActive;

    const after = await repo.updateTest(client, auth.tenantId, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'LAB_TEST_UPDATED', entity: 'lab_tests', entityId: id, before, after });
    return after;
  },

  // ORDERS
  async listOrders(auth: AuthContext, token: string, q: ListLabOrdersQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listOrders(supabaseForUser(token), auth.tenantId, q);
  },

  async getOrder(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const order = await repo.findOrderWithItems(client, auth.tenantId, id);
    if (!order) throw NotFound('Lab order not found');
    return order;
  },

  async createOrder(auth: AuthContext, token: string, input: CreateLabOrderInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const branchId =
      input.branchId ??
      (await repo.findDefaultBranch(client, auth.tenantId))?.id ??
      null;

    if (!branchId) throw BadRequest('No active branch found');

    const result = await repo.createOrder(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      encounterId: input.encounterId ?? null,
      priority: input.priority,
      notes: input.notes ?? null,
      testIds: input.testIds,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'LAB_ORDER_CREATED',
      entity: 'lab_orders',
      entityId: result.orderId,
      after: { totalAmount: result.totalAmount, testCount: input.testIds.length },
    });

    return result;
  },

  async collectSample(auth: AuthContext, token: string, orderId: string, input: CollectSampleInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const order = await repo.findOrderWithItems(client, auth.tenantId, orderId);
    if (!order) throw NotFound('Lab order not found');
    if (order.status === 'CANCELLED') throw Conflict('Order is cancelled');
    if (order.status === 'COLLECTED' || order.status === 'RESULTED' || order.status === 'VERIFIED') {
      throw Conflict(`Sample already collected (status: ${order.status})`);
    }

    const sample = await repo.collectSample(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      orderId,
      sampleType: input.sampleType,
      barcode: input.barcode ?? null,
      notes: input.notes ?? null,
    });

    await repo.updateOrderStatus(client, auth.tenantId, orderId, 'COLLECTED');

    await audit({
      actorUserId: auth.userId,
      action: 'LAB_SAMPLE_COLLECTED',
      entity: 'lab_orders',
      entityId: orderId,
      after: sample,
    });

    return sample;
  },

  async enterResults(auth: AuthContext, token: string, orderId: string, input: EnterResultsInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const order = await repo.findOrderWithItems(client, auth.tenantId, orderId);
    if (!order) throw NotFound('Lab order not found');
    if (order.status === 'CANCELLED') throw Conflict('Order is cancelled');
    if (order.status === 'VERIFIED') throw Conflict('Order already verified - cannot edit');

    await repo.enterResults(client, auth.tenantId, auth.userId, input.items);
    await repo.updateOrderStatus(client, auth.tenantId, orderId, 'RESULTED');

    await audit({
      actorUserId: auth.userId,
      action: 'LAB_RESULTS_ENTERED',
      entity: 'lab_orders',
      entityId: orderId,
      after: { itemCount: input.items.length },
    });

    return repo.findOrderWithItems(client, auth.tenantId, orderId);
  },

  async verifyResults(auth: AuthContext, token: string, orderId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const order = await repo.findOrderWithItems(client, auth.tenantId, orderId);
    if (!order) throw NotFound('Lab order not found');
    if (order.status !== 'RESULTED') throw Conflict('Results must be entered before verification');

    const pending = order.items.filter((i: any) => !i.resulted_at);
    if (pending.length > 0) throw BadRequest(`${pending.length} item(s) still missing results`);

    await repo.verifyResults(client, auth.tenantId, auth.userId, orderId);
    await repo.updateOrderStatus(client, auth.tenantId, orderId, 'VERIFIED');

    await audit({
      actorUserId: auth.userId,
      action: 'LAB_RESULTS_VERIFIED',
      entity: 'lab_orders',
      entityId: orderId,
    });

    return repo.findOrderWithItems(client, auth.tenantId, orderId);
  },
};
