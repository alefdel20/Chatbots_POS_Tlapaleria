import express from 'express'
import { asyncHandler, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { createAuditLog } from '../repositories/auditRepository.js'
import { adjustProductInventory, createProduct, listProducts, updateProduct } from '../repositories/productRepository.js'
import { pool, query } from '../db/pool.js'

export const productRoutes = express.Router()

productRoutes.use(requireAuth)

productRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    const products = await listProducts(tenantId, req.query.search ?? '')
    res.json({ ok: true, data: products })
  })
)

productRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.body.tenant_id : req.auth.tenantId
    const product = await createProduct(tenantId, req.body)
    await createAuditLog({ tenantId, actorUserId: req.auth.id, action: 'product.create', targetType: 'product', targetId: product.id, details: { nombre: product.nombre } })
    res.status(201).json({ ok: true, data: product })
  })
)

productRoutes.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.body.tenant_id ?? req.query.tenant_id : req.auth.tenantId
    const product = await updateProduct(tenantId, req.params.id, req.body)
    if (!product) return sendError(res, 404, 'Product not found')
    await createAuditLog({ tenantId, actorUserId: req.auth.id, action: 'product.update', targetType: 'product', targetId: product.id, details: req.body })
    res.json({ ok: true, data: product })
  })
)

productRoutes.post(
  '/:id/adjust',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.body.tenant_id ?? req.query.tenant_id : req.auth.tenantId
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const product = await adjustProductInventory(client, tenantId, req.params.id, Number(req.body.quantity), req.body.inventario_confirmado)
      if (!product) {
        await client.query('ROLLBACK')
        return sendError(res, 404, 'Product not found')
      }
      await client.query(
        `
          INSERT INTO inventory_movements (tenant_id, product_id, tipo, cantidad, motivo, referencia, usuario_id)
          VALUES ($1, $2, 'manual_adjustment', $3, $4, NULL, $5)
        `,
        [tenantId, req.params.id, Number(req.body.quantity), req.body.motivo ?? 'Ajuste manual', req.auth.id]
      )
      await client.query('COMMIT')
      await createAuditLog({ tenantId, actorUserId: req.auth.id, action: 'inventory.adjust', targetType: 'product', targetId: product.id, details: req.body })
      res.json({ ok: true, data: product })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
)

productRoutes.get(
  '/lookup/:barcode',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    const result = await query(
      `SELECT * FROM products WHERE tenant_id = $1 AND barcode = $2 LIMIT 1`,
      [tenantId, req.params.barcode]
    )
    res.json({ ok: true, data: result.rows[0] ?? null })
  })
)


