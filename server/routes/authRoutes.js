import express from 'express'
import { asyncHandler, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { getCurrentSession, login } from '../services/authService.js'

export const authRoutes = express.Router()

authRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    console.log(`[auth] login attempt email=${email || '<empty>'}`)
    if (!email || !password) {
      return sendError(res, 400, 'Email y password son obligatorios')
    }
    const result = await login(email, password)
    if (!result) return sendError(res, 401, 'Credenciales invalidas')
    console.log(`[auth] login success user_id=${result.user.id} tenant_id=${result.user.tenant_id} role=${result.user.rol}`)
    res.json({ ok: true, ...result })
  })
)

authRoutes.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getCurrentSession(req.auth.id)
    if (!result) return sendError(res, 404, 'Session not found')
    res.json({ ok: true, ...result })
  })
)


