import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'

export const getUserWithBusinessByEmail = async (email) => {
  const result = await query(
    `
      SELECT
        u.id,
        u.tenant_id,
        u.nombre,
        u.email,
        u.password_hash,
        u.rol,
        u.activo,
        u.created_at,
        u.updated_at,
        b.nombre AS business_nombre,
        b.email AS business_email,
        b.plan AS business_plan,
        b.activo AS business_activo,
        b.modulos_activos
      FROM users u
      JOIN businesses b ON b.id = u.tenant_id
      WHERE LOWER(u.email) = LOWER($1)
    `,
    [email]
  )
  return result.rows[0] ?? null
}

export const getUserWithBusinessById = async (id) => {
  const result = await query(
    `
      SELECT
        u.id,
        u.tenant_id,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        u.created_at,
        u.updated_at,
        b.id AS business_id,
        b.nombre AS business_nombre,
        b.email AS business_email,
        b.plan AS business_plan,
        b.activo AS business_activo,
        b.modulos_activos
      FROM users u
      JOIN businesses b ON b.id = u.tenant_id
      WHERE u.id = $1
    `,
    [id]
  )
  return result.rows[0] ?? null
}

export const listUsers = async (tenantId) => {
  const params = []
  let where = ''
  if (tenantId) {
    params.push(tenantId)
    where = 'WHERE u.tenant_id = $1'
  }
  const result = await query(
    `
      SELECT u.id, u.tenant_id, u.nombre, u.email, u.rol, u.activo, u.created_at, u.updated_at
      FROM users u
      ${where}
      ORDER BY u.nombre ASC
    `,
    params
  )
  return result.rows
}

export const createUser = async (input) => {
  const passwordHash = await bcrypt.hash(input.password, 12)
  const result = await query(
    `
      INSERT INTO users (tenant_id, nombre, email, password_hash, rol, activo)
      VALUES ($1, $2, $3, $4, $5::user_role, $6)
      RETURNING id, tenant_id, nombre, email, rol, activo, created_at, updated_at
    `,
    [input.tenant_id, input.nombre, input.email, passwordHash, input.rol, input.activo]
  )
  return result.rows[0]
}

export const updateUser = async (id, input) => {
  const result = await query(
    `
      UPDATE users
      SET nombre = $2,
          email = $3,
          rol = $4::user_role,
          activo = $5
      WHERE id = $1
      RETURNING id, tenant_id, nombre, email, rol, activo, created_at, updated_at
    `,
    [id, input.nombre, input.email, input.rol, input.activo]
  )
  return result.rows[0] ?? null
}

export const resetUserPassword = async (id, password) => {
  const passwordHash = await bcrypt.hash(password, 12)
  const result = await query(
    `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, passwordHash]
  )
  return result.rows[0] ?? null
}
