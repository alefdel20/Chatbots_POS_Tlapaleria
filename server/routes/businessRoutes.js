import express from 'express'
import { asyncHandler, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createAuditLog } from '../repositories/auditRepository.js'
import { createBusiness, getBusinessById, listBusinesses, updateBusiness } from '../repositories/businessRepository.js'

export const businessRoutes = express.Router()

businessRoutes.use(requireAuth)

businessRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = req.auth.role === 'superadmin' ? await listBusinesses() : [await getBusinessById(req.auth.tenantId)].filter(Boolean)
    res.json({ ok: true, data: rows })
  })
)

businessRoutes.post(
  '/',
  requireRole('superadmin'),
  asyncHandler(async (req, res) => {
    const business = await createBusiness(req.body)
    await createAuditLog({ tenantId: business.id, actorUserId: req.auth.id, action: 'business.create', targetType: 'business', targetId: business.id, details: { nombre: business.nombre } })
    res.status(201).json({ ok: true, data: business })
  })
)

businessRoutes.patch(
  '/:id',
  requireRole('superadmin'),
  asyncHandler(async (req, res) => {
    const business = await updateBusiness(req.params.id, req.body)
    if (!business) return sendError(res, 404, 'Business not found')
    await createAuditLog({ tenantId: business.id, actorUserId: req.auth.id, action: 'business.update', targetType: 'business', targetId: business.id, details: req.body })
    res.json({ ok: true, data: business })
  })
)
