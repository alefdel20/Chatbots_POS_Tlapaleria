import express from 'express'
import { asyncHandler, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { createAuditLog } from '../repositories/auditRepository.js'
import { createUser, listUsers, resetUserPassword, updateUser } from '../repositories/userRepository.js'

export const userRoutes = express.Router()

userRoutes.use(requireAuth)

userRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.auth.role === 'superadmin' ? req.query.tenant_id || null : req.auth.tenantId
    const users = await listUsers(tenantId)
    res.json({ ok: true, data: users })
  })
)

userRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = {
      ...req.body,
      tenant_id: req.auth.role === 'superadmin' ? req.body.tenant_id : req.auth.tenantId
    }
    const user = await createUser(payload)
    await createAuditLog({ tenantId: user.tenant_id, actorUserId: req.auth.id, action: 'user.create', targetType: 'user', targetId: user.id, details: { email: user.email, rol: user.rol } })
    res.status(201).json({ ok: true, data: user })
  })
)

userRoutes.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const currentUsers = await listUsers(req.auth.role === 'superadmin' ? null : req.auth.tenantId)
    const target = currentUsers.find((item) => item.id === req.params.id)
    if (!target && req.auth.role !== 'superadmin') return sendError(res, 404, 'User not found')
    const tenantId = target?.tenant_id ?? req.body.tenant_id ?? req.auth.tenantId
    if (req.auth.role !== 'superadmin' && tenantId !== req.auth.tenantId) return sendError(res, 403, 'Forbidden')
    if (req.auth.role !== 'superadmin' && req.body.rol === 'superadmin') return sendError(res, 403, 'Forbidden')
    const user = await updateUser(req.params.id, req.body)
    if (!user) return sendError(res, 404, 'User not found')
    await createAuditLog({ tenantId: user.tenant_id, actorUserId: req.auth.id, action: 'user.update', targetType: 'user', targetId: user.id, details: req.body })
    res.json({ ok: true, data: user })
  })
)

userRoutes.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const result = await resetUserPassword(req.params.id, req.body.password)
    if (!result) return sendError(res, 404, 'User not found')
    await createAuditLog({ tenantId: req.auth.tenantId, actorUserId: req.auth.id, action: 'user.reset_password', targetType: 'user', targetId: req.params.id, details: {} })
    res.json({ ok: true })
  })
)


