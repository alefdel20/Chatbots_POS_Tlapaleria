import bcrypt from 'bcryptjs'
import { signToken } from '../lib/tokens.js'
import { getUserWithBusinessByEmail, getUserWithBusinessById } from '../repositories/userRepository.js'

const buildAuthPayload = (row) => ({
  user: {
    id: row.id,
    tenant_id: row.tenant_id,
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    activo: row.activo,
    created_at: row.created_at,
    updated_at: row.updated_at
  },
  business: {
    id: row.business_id ?? row.tenant_id,
    nombre: row.business_nombre,
    email: row.business_email,
    plan: row.business_plan,
    activo: row.business_activo,
    modulos_activos: row.modulos_activos
  }
})

export const login = async (email, password) => {
  const row = await getUserWithBusinessByEmail(email)
  if (!row) {
    console.warn(`[auth] login rejected: user not found email=${email}`)
    return null
  }
  if (!row?.activo) return null
  if (!row.password_hash || typeof row.password_hash !== 'string') {
    console.error(`[auth] login failed: missing password_hash for user_id=${row.id}`)
    throw new Error('Invalid user credentials configuration')
  }
  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid) return null
  if (row.rol !== 'superadmin' && !row.business_activo) {
    console.warn(`[auth] login rejected: inactive business tenant_id=${row.tenant_id}`)
    return null
  }
  const token = signToken({
    userId: row.id,
    tenantId: row.tenant_id,
    role: row.rol,
    exp: Date.now() + 1000 * 60 * 60 * 12
  })
  return { token, ...buildAuthPayload(row) }
}

export const getCurrentSession = async (userId) => {
  const row = await getUserWithBusinessById(userId)
  if (!row) return null
  return buildAuthPayload(row)
}
