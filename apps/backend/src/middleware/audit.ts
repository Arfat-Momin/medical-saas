import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';

export async function audit(opts: {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await supabaseAdmin.from('platform_audit_logs').insert({
      actor_user_id: opts.actorUserId,
      action: opts.action,
      entity: opts.entity,
      entity_id: opts.entityId ?? null,
      before_state: opts.before ?? null,
      after_state: opts.after ?? null,
    });
  } catch (err) {
    logger.error({ err, ...opts }, 'Audit log write failed');
  }
}
