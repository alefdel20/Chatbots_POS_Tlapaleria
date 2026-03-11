import express from 'express'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { listAuditLogs, getGlobalMetrics, getTenantMetrics } from '../repositories/reportRepository.js'

export const reportRoutes = express.Router()

reportRoutes.use(requireAuth)

reportRoutes.get(
  '/tenant-metrics',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id : req.auth.tenantId
    res.json({ ok: true, data: await getTenantMetrics(tenantId) })
  })
)

reportRoutes.get(
  '/global-metrics',
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: req.auth.role === 'superadmin' ? await getGlobalMetrics() : null })
  })
)

reportRoutes.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id || null : req.auth.tenantId
    res.json({ ok: true, data: await listAuditLogs(tenantId) })
  })
)


