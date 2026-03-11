import { query } from '../db/pool.js'

export const listProducts = async (tenantId, search = '') => {
  const params = [tenantId]
  let where = 'WHERE tenant_id = $1'
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`)
    where += ' AND (LOWER(nombre) LIKE $2 OR LOWER(sku) LIKE $2 OR COALESCE(barcode, \'\') LIKE $2)'
  }
  const result = await query(`SELECT * FROM products ${where} ORDER BY nombre ASC`, params)
  return result.rows
}

export const createProduct = async (tenantId, input) => {
  const result = await query(
    `
      INSERT INTO products (
        tenant_id, nombre, sku, barcode, categoria,
        precio_compra, precio_venta, stock_actual, stock_minimo,
        inventario_confirmado, activo, unit_base, product_type,
        pack_factor, tax_rate, remate_enabled, remate_type,
        remate_value, remate_start_at, remate_end_at, remate_marked_at, remate_marked_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *
    `,
    [
      tenantId,
      input.nombre,
      input.sku,
      input.barcode || null,
      input.categoria || null,
      input.precio_compra ?? 0,
      input.precio_venta,
      input.stock_actual ?? null,
      input.stock_minimo ?? 0,
      input.inventario_confirmado ?? false,
      input.active ?? true,
      input.unit_base ?? 'pza',
      input.product_type ?? 'PIEZA',
      input.pack_factor ?? null,
      input.tax_rate ?? 0.16,
      input.remate_enabled ?? false,
      input.remate_type ?? null,
      input.remate_value ?? null,
      input.remate_start_at ?? null,
      input.remate_end_at ?? null,
      input.remate_marked_at ?? null,
      input.remate_marked_by ?? null
    ]
  )
  return result.rows[0]
}

export const updateProduct = async (tenantId, productId, input) => {
  const result = await query(
    `
      UPDATE products
      SET nombre = $3,
          sku = $4,
          barcode = $5,
          categoria = $6,
          precio_compra = $7,
          precio_venta = $8,
          stock_actual = $9,
          stock_minimo = $10,
          inventario_confirmado = $11,
          activo = $12,
          unit_base = $13,
          product_type = $14,
          pack_factor = $15,
          tax_rate = $16,
          remate_enabled = $17,
          remate_type = $18,
          remate_value = $19,
          remate_start_at = $20,
          remate_end_at = $21,
          remate_marked_at = $22,
          remate_marked_by = $23
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
    [
      productId,
      tenantId,
      input.nombre,
      input.sku,
      input.barcode || null,
      input.categoria || null,
      input.precio_compra ?? 0,
      input.precio_venta,
      input.stock_actual ?? null,
      input.stock_minimo ?? 0,
      input.inventario_confirmado ?? false,
      input.active ?? true,
      input.unit_base ?? 'pza',
      input.product_type ?? 'PIEZA',
      input.pack_factor ?? null,
      input.tax_rate ?? 0.16,
      input.remate_enabled ?? false,
      input.remate_type ?? null,
      input.remate_value ?? null,
      input.remate_start_at ?? null,
      input.remate_end_at ?? null,
      input.remate_marked_at ?? null,
      input.remate_marked_by ?? null
    ]
  )
  return result.rows[0] ?? null
}

export const adjustProductInventory = async (client, tenantId, productId, delta, inventarioConfirmado) => {
  const result = await client.query(
    `
      UPDATE products
      SET
        stock_actual = CASE
          WHEN stock_actual IS NULL THEN $3
          ELSE stock_actual + $3
        END,
        inventario_confirmado = COALESCE($4, inventario_confirmado)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
    [productId, tenantId, delta, inventarioConfirmado]
  )
  return result.rows[0] ?? null
}
