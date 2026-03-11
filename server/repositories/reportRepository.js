import { query } from '../db/pool.js'

export const getTenantMetrics = async (tenantId) => {
  const result = await query(
    `
      SELECT
        COALESCE((SELECT COUNT(*) FROM sales WHERE tenant_id = $1 AND status = 'completed'), 0) AS total_sales,
        COALESCE((SELECT SUM(total) FROM sales WHERE tenant_id = $1 AND status = 'completed'), 0) AS total_revenue,
        COALESCE((SELECT COUNT(*) FROM products WHERE tenant_id = $1), 0) AS total_products,
        COALESCE((SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND stock_actual IS NOT NULL AND stock_actual <= stock_minimo), 0) AS low_stock_count,
        COALESCE((SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND inventario_confirmado = FALSE), 0) AS unconfirmed_inventory_count,
        COALESCE((SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND activo = TRUE), 0) AS active_users
    `,
    [tenantId]
  )
  return result.rows[0]
}

export const getGlobalMetrics = async () => {
  const result = await query(
    `
      SELECT
        COALESCE((SELECT COUNT(*) FROM businesses), 0) AS total_businesses,
        COALESCE((SELECT COUNT(*) FROM businesses WHERE activo = TRUE), 0) AS active_businesses,
        COALESCE((SELECT COUNT(*) FROM users WHERE rol <> 'superadmin'), 0) AS total_users,
        COALESCE((SELECT COUNT(*) FROM users WHERE activo = TRUE AND rol <> 'superadmin'), 0) AS active_users,
        COALESCE((SELECT COUNT(*) FROM sales WHERE status = 'completed'), 0) AS total_sales,
        COALESCE((SELECT SUM(total) FROM sales WHERE status = 'completed'), 0) AS total_revenue
    `
  )
  return result.rows[0]
}

export const listAuditLogs = async (tenantId) => {
  const result = tenantId
    ? await query('SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200', [tenantId])
    : await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')
  return result.rows
}


