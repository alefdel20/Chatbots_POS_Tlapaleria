import express from 'express'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { createAuditLog } from '../repositories/auditRepository.js'
import { createSaleWithItems, listDailyCuts, listInventoryMovements, listSales, voidSale } from '../repositories/salesRepository.js'

export const salesRoutes = express.Router()

salesRoutes.use(requireAuth)

salesRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    const sales = await listSales(tenantId)
    res.json({ ok: true, data: sales })
  })
)

salesRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.body.tenant_id : req.auth.tenantId
    const payload = {
      ...req.body,
      total: Number(req.body.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0).toFixed(2))
    }
    const sale = await createSaleWithItems({ tenantId, userId: req.auth.id, payload })
    await createAuditLog({ tenantId, actorUserId: req.auth.id, action: 'sale.create', targetType: 'sale', targetId: sale.id, details: { total: sale.total } })
    res.status(201).json({ ok: true, data: sale, folio: sale.id })
  })
)

salesRoutes.post(
  '/:id/void',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.body.tenant_id ?? req.query.tenant_id : req.auth.tenantId
    await voidSale({ tenantId, saleId: req.params.id, userId: req.auth.id })
    await createAuditLog({ tenantId, actorUserId: req.auth.id, action: 'sale.void', targetType: 'sale', targetId: req.params.id, details: {} })
    res.json({ ok: true })
  })
)

salesRoutes.get(
  '/daily-cuts',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    res.json({ ok: true, data: await listDailyCuts(tenantId) })
  })
)

salesRoutes.get(
  '/inventory-movements',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    res.json({ ok: true, data: await listInventoryMovements(tenantId) })
  })
)
