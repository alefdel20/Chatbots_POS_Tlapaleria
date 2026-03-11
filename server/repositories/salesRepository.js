import { pool, query } from '../db/pool.js'

export const listSales = async (tenantId) => {
  const result = await query(
    `
      SELECT id, tenant_id, usuario_id, fecha, total, metodo_pago, status, created_at, updated_at
      FROM sales
      WHERE tenant_id = $1
      ORDER BY fecha DESC
    `,
    [tenantId]
  )
  return result.rows
}

export const listDailyCuts = async (tenantId) => {
  const result = await query(
    `
      SELECT *
      FROM daily_cuts
      WHERE tenant_id = $1
      ORDER BY fecha DESC
    `,
    [tenantId]
  )
  return result.rows
}

export const listInventoryMovements = async (tenantId) => {
  const result = await query(
    `
      SELECT *
      FROM inventory_movements
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `,
    [tenantId]
  )
  return result.rows
}

export const createSaleWithItems = async ({ tenantId, userId, payload }) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const saleResult = await client.query(
      `
        INSERT INTO sales (
          tenant_id, usuario_id, fecha, total, metodo_pago, status,
          referencia_externa, notas, local_reference, amount_received,
          change_amount, fiscal_data
        )
        VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10, $11::jsonb)
        RETURNING *
      `,
      [
        tenantId,
        userId,
        payload.captured_at,
        payload.total,
        payload.payment_method,
        payload.local_id,
        payload.fiscal_data ? JSON.stringify(payload.fiscal_data) : null,
        payload.local_id,
        payload.amount_received ?? null,
        payload.change_amount ?? null,
        JSON.stringify(payload.fiscal_data ?? {})
      ]
    )
    const sale = saleResult.rows[0]

    for (const item of payload.items) {
      await client.query(
        `
          INSERT INTO sale_items (tenant_id, sale_id, product_id, cantidad, precio_unitario, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [tenantId, sale.id, item.product_id, item.qty_base ?? item.qty, item.price_gross, Number((item.qty * item.price_gross).toFixed(2))]
      )

      await client.query(
        `
          UPDATE products
          SET stock_actual = CASE
            WHEN stock_actual IS NULL THEN NULL
            ELSE stock_actual - $3
          END
          WHERE id = $1 AND tenant_id = $2
        `,
        [item.product_id, tenantId, item.qty_base ?? item.qty]
      )

      await client.query(
        `
          INSERT INTO inventory_movements (tenant_id, product_id, tipo, cantidad, motivo, referencia, usuario_id)
          VALUES ($1, $2, 'sale', $3, $4, $5, $6)
        `,
        [tenantId, item.product_id, -(item.qty_base ?? item.qty), `Venta ${sale.id}`, sale.id, userId]
      )
    }

    await client.query('COMMIT')
    return sale
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const voidSale = async ({ tenantId, saleId, userId }) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const saleResult = await client.query('SELECT * FROM sales WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [saleId, tenantId])
    const sale = saleResult.rows[0]
    if (!sale) throw new Error('Sale not found')

    const itemsResult = await client.query('SELECT * FROM sale_items WHERE sale_id = $1 AND tenant_id = $2', [saleId, tenantId])
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_actual = CASE WHEN stock_actual IS NULL THEN NULL ELSE stock_actual + $3 END WHERE id = $1 AND tenant_id = $2',
        [item.product_id, tenantId, item.cantidad]
      )
      await client.query(
        `
          INSERT INTO inventory_movements (tenant_id, product_id, tipo, cantidad, motivo, referencia, usuario_id)
          VALUES ($1, $2, 'sale_cancel', $3, $4, $5, $6)
        `,
        [tenantId, item.product_id, item.cantidad, `Anulacion ${sale.id}`, sale.id, userId]
      )
    }
    await client.query(`UPDATE sales SET status = 'cancelled' WHERE id = $1 AND tenant_id = $2`, [saleId, tenantId])
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
