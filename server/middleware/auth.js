import { query } from '../db/pool.js'
import { verifyToken } from '../lib/tokens.js'
import { sendError } from '../lib/http.js'

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token)
  if (!payload?.userId) return sendError(res, 401, 'Unauthorized')
  const result = await query(
    `
      SELECT
        u.id,
        u.tenant_id,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        b.nombre AS business_nombre,
        b.activo AS business_activo
      FROM users u
      JOIN businesses b ON b.id = u.tenant_id
      WHERE u.id = $1
    `,
    [payload.userId]
  )
  const user = result.rows[0]
  if (!user?.activo) return sendError(res, 401, 'User inactive')
  if (user.rol !== 'superadmin' && !user.business_activo) return sendError(res, 403, 'Business inactive')
  req.auth = {
    id: user.id,
    tenantId: user.tenant_id,
    role: user.rol,
    nombre: user.nombre,
    email: user.email
  }
  next()
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) return sendError(res, 403, 'Forbidden')
  next()
}

export const withTenantScope = (req, explicitTenantId) => {
  if (req.auth.role === 'superadmin' && explicitTenantId) return explicitTenantId
  return req.auth.tenantId
}


