import { query } from '../db/pool.js'

export const listBusinesses = async () => {
  const result = await query('SELECT * FROM businesses ORDER BY nombre ASC')
  return result.rows
}

export const getBusinessById = async (id) => {
  const result = await query('SELECT * FROM businesses WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export const createBusiness = async (input) => {
  const result = await query(
    `
      INSERT INTO businesses (nombre, telefono, email, direccion, plan, modulos_activos, activo)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING *
    `,
    [input.nombre, input.telefono, input.email, input.direccion, input.plan, JSON.stringify(input.modulos_activos), input.activo]
  )
  return result.rows[0]
}

export const updateBusiness = async (id, input) => {
  const result = await query(
    `
      UPDATE businesses
      SET nombre = $2,
          telefono = $3,
          email = $4,
          direccion = $5,
          plan = $6,
          modulos_activos = $7::jsonb,
          activo = $8
      WHERE id = $1
      RETURNING *
    `,
    [id, input.nombre, input.telefono, input.email, input.direccion, input.plan, JSON.stringify(input.modulos_activos), input.activo]
  )
  return result.rows[0] ?? null
}


