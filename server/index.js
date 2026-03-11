import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { query } from './db/pool.js'
import { sendError } from './lib/http.js'
import { authRoutes } from './routes/authRoutes.js'
import { businessRoutes } from './routes/businessRoutes.js'
import { productRoutes } from './routes/productRoutes.js'
import { reportRoutes } from './routes/reportRoutes.js'
import { salesRoutes } from './routes/salesRoutes.js'
import { userRoutes } from './routes/userRoutes.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[api] ${req.method} ${req.path}`)
  }
  next()
})

app.get('/api/health', async (_req, res) => {
  await query('SELECT 1')
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/businesses', businessRoutes)
app.use('/api/users', userRoutes)
app.use('/api/products', productRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/reports', reportRoutes)

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return sendError(res, 404, 'Route not found')
  }
  res.status(404).end()
})

app.use((error, req, res, _next) => {
  const status = error?.statusCode || error?.status || 500
  console.error('[api-error]', {
    method: req.method,
    path: req.path,
    message: error?.message,
    stack: error?.stack
  })
  if (res.headersSent) return
  sendError(res, status, error?.message || 'Internal server error')
})

app.listen(env.port, () => {
  console.log(`API listening on http://127.0.0.1:${env.port}`)
})


