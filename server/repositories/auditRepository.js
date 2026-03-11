import { query } from '../db/pool.js'

export const createAuditLog = async ({ tenantId, actorUserId, action, targetType, targetId, details }) => {
  await query(
    `
      INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, details)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [tenantId, actorUserId, action, targetType, targetId ?? null, JSON.stringify(details ?? {})]
  )
}
