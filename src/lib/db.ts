import { loadSession, saveSession } from './auth'
import { api } from './api'
import { apiUrl } from './http'
import {
  AuthContextValue,
  Business,
  ContingencyBatchPayload,
  GlobalMetrics,
  InventoryMovement,
  PendingQueueItem,
  PorPagarOrder,
  Product,
  SalePayload,
  SaleRecord,
  Settings,
  TenantMetrics,
  UndoLastSalePayload,
  UserRecord
} from './types'
import { nowIso, uuid } from './utils'

const key = {
  settings: 'pos_settings_v3',
  meta: 'pos_meta_v3',
  pending: 'pos_pending_v3',
  porPagar: 'pos_por_pagar_v3'
}

export const dbEvents = new EventTarget()
const emit = (name: string) => dbEvents.dispatchEvent(new Event(name))

const readJson = <T>(storageKey: string, fallback: T): T => {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const writeJson = <T>(storageKey: string, value: T) => {
  localStorage.setItem(storageKey, JSON.stringify(value))
}

const authHeaders = () => {
  const session = loadSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(apiUrl(path), { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } })
  const raw = await response.text()
  let data: any = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? `HTTP ${response.status}`)
  }
  return data as T
}

export const initDb = async () => {
  if (!getSettings()) {
    await setSettings({ user: 'CAJA1', admin_pin: '1234' })
  }
}

export const authenticateUser = async (email: string, password: string): Promise<AuthContextValue | null> => {
  const result = await request<{ ok: true; token: string; user: UserRecord; business: Business }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  saveSession({ user_id: result.user.id, tenant_id: result.user.tenant_id, token: result.token, issued_at: nowIso() })
  return { session: loadSession(), user: result.user, business: result.business }
}

export const restoreAuth = async (): Promise<AuthContextValue> => {
  const session = loadSession()
  if (!session) return { session: null, user: null, business: null }
  try {
    const result = await request<{ ok: true; user: UserRecord; business: Business }>('/api/auth/me')
    return { session, user: result.user, business: result.business }
  } catch {
    saveSession(null)
    return { session: null, user: null, business: null }
  }
}

export const logout = () => saveSession(null)

export const getBusinesses = async (_includeSystem = false): Promise<Business[]> => {
  const result = await request<{ ok: true; data: Business[] }>('/api/businesses')
  return result.data
}

export const createBusiness = async (input: Pick<Business, 'nombre' | 'telefono' | 'email' | 'direccion' | 'plan' | 'activo' | 'modulos_activos'>, _actor: UserRecord) => {
  const result = await request<{ ok: true; data: Business }>('/api/businesses', { method: 'POST', body: JSON.stringify(input) })
  emit('businesses-changed')
  return result.data
}

export const updateBusiness = async (businessId: string, patch: Partial<Pick<Business, 'nombre' | 'telefono' | 'email' | 'direccion' | 'plan' | 'activo' | 'modulos_activos'>>, _actor: UserRecord) => {
  const result = await request<{ ok: true; data: Business }>(`/api/businesses/${businessId}`, { method: 'PATCH', body: JSON.stringify(patch) })
  emit('businesses-changed')
  return result.data
}

export const getUsers = async (): Promise<UserRecord[]> => {
  const result = await request<{ ok: true; data: UserRecord[] }>('/api/users')
  return result.data
}

export const getUsersByTenant = async (tenantId: string): Promise<UserRecord[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId })
  const result = await request<{ ok: true; data: UserRecord[] }>(`/api/users?${params.toString()}`)
  return result.data
}

export const createUser = async (input: { tenant_id: string; nombre: string; email: string; password: string; rol: UserRecord['rol']; activo: boolean }, _actor: UserRecord) => {
  const result = await request<{ ok: true; data: UserRecord }>('/api/users', { method: 'POST', body: JSON.stringify(input) })
  emit('users-changed')
  return result.data
}

export const updateUser = async (userId: string, patch: Partial<Pick<UserRecord, 'nombre' | 'email' | 'rol' | 'activo'>>, _actor: UserRecord) => {
  const result = await request<{ ok: true; data: UserRecord }>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) })
  emit('users-changed')
  return result.data
}

export const resetUserPassword = async (userId: string, password: string, _actor: UserRecord) => {
  await request<{ ok: true }>(`/api/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) })
  emit('users-changed')
  return true
}

const mapProductFromServer = (row: any): Product => ({
  id: row.id,
  tenant_id: row.tenant_id,
  barcode: row.barcode ?? '',
  sku: row.sku,
  name: row.nombre,
  categoria: row.categoria ?? 'General',
  unit_base: row.unit_base ?? 'pza',
  type: row.product_type ?? 'PIEZA',
  pack_factor: row.pack_factor === null || row.pack_factor === undefined ? null : Number(row.pack_factor),
  precio_compra: Number(row.precio_compra ?? 0),
  precio_venta: Number(row.precio_venta),
  tax_rate: Number(row.tax_rate ?? 0.16),
  stock_actual: row.stock_actual === null ? null : Number(row.stock_actual),
  stock_minimo: Number(row.stock_minimo ?? 0),
  inventario_confirmado: Boolean(row.inventario_confirmado),
  active: Boolean(row.activo),
  remate_enabled: Boolean(row.remate_enabled),
  remate_type: row.remate_type ?? null,
  remate_value: row.remate_value === null || row.remate_value === undefined ? null : Number(row.remate_value),
  remate_start_at: row.remate_start_at ?? null,
  remate_end_at: row.remate_end_at ?? null,
  remate_marked_at: row.remate_marked_at ?? null,
  remate_marked_by: row.remate_marked_by ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at
})

const mapProductToServer = (product: Product) => ({
  tenant_id: product.tenant_id,
  nombre: product.name,
  sku: product.sku,
  barcode: product.barcode,
  categoria: product.categoria,
  precio_compra: product.precio_compra,
  precio_venta: product.precio_venta,
  stock_actual: product.stock_actual,
  stock_minimo: product.stock_minimo,
  inventario_confirmado: product.inventario_confirmado,
  active: product.active,
  unit_base: product.unit_base,
  product_type: product.type,
  pack_factor: product.pack_factor,
  tax_rate: product.tax_rate,
  remate_enabled: product.remate_enabled,
  remate_type: product.remate_type,
  remate_value: product.remate_value,
  remate_start_at: product.remate_start_at,
  remate_end_at: product.remate_end_at,
  remate_marked_at: product.remate_marked_at,
  remate_marked_by: product.remate_marked_by
})

export const getProducts = async (tenantId: string): Promise<Product[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId })
  const result = await request<{ ok: true; data: any[] }>(`/api/products?${params.toString()}`)
  return result.data.map(mapProductFromServer)
}

export const upsertProducts = async (products: Product[]) => {
  for (const product of products) {
    const payload = mapProductToServer(product)
    if (product.id) {
      await request(`/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      await request('/api/products', { method: 'POST', body: JSON.stringify(payload) })
    }
  }
  emit('products-changed')
}

export const getSales = async (tenantId: string): Promise<SaleRecord[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId })
  const result = await request<{ ok: true; data: SaleRecord[] }>(`/api/sales?${params.toString()}`)
  return result.data
}

export const recordSale = async (payload: SalePayload, _actor: UserRecord) => {
  const result = await request<{ ok: true; data: SaleRecord; folio: string }>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  emit('sales-changed')
  emit('products-changed')
  emit('inventory-changed')
  return result.data
}

export const voidLastSale = async (payload: UndoLastSalePayload, _actor: UserRecord) => {
  await request(`/api/sales/${payload.last_sale_id}/void`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  emit('sales-changed')
  emit('products-changed')
  emit('inventory-changed')
  return true
}

export const adjustInventory = async (input: { tenant_id: string; product_id: string; quantity: number; motivo: string; usuario_id: string; inventario_confirmado?: boolean }) => {
  await request(`/api/products/${input.product_id}/adjust`, { method: 'POST', body: JSON.stringify(input) })
  emit('products-changed')
  emit('inventory-changed')
  return true
}

export const getInventoryMovements = async (tenantId: string): Promise<InventoryMovement[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId })
  const result = await request<{ ok: true; data: InventoryMovement[] }>(`/api/sales/inventory-movements?${params.toString()}`)
  return result.data
}

export const getTenantMetrics = async (tenantId: string): Promise<TenantMetrics> => {
  const params = new URLSearchParams({ tenant_id: tenantId })
  const result = await request<{ ok: true; data: TenantMetrics }>(`/api/reports/tenant-metrics?${params.toString()}`)
  return result.data
}

export const getGlobalMetrics = async (): Promise<GlobalMetrics> => {
  const result = await request<{ ok: true; data: GlobalMetrics }>('/api/reports/global-metrics')
  return result.data
}

export const getAuditLogs = async () => {
  const result = await request<{ ok: true; data: any[] }>('/api/reports/audit-logs')
  return result.data
}

export const getSettings = async (): Promise<Settings | null> => readJson<Settings | null>(key.settings, null)
export const setSettings = async (settings: Settings) => writeJson(key.settings, settings)
export const getMeta = async <T>(metaKey: string): Promise<T | null> => readJson<Record<string, T>>(key.meta, {})[metaKey] ?? null
export const setMeta = async <T>(metaKey: string, value: T) => {
  const current = readJson<Record<string, T>>(key.meta, {})
  current[metaKey] = value
  writeJson(key.meta, current)
}

const lastSaleKey = (tenantId: string) => `last_sale:${tenantId}`
export const setLastSale = async (tenantId: string, sale: unknown & { local_id?: string; id?: string }) => setMeta(lastSaleKey(tenantId), { id: sale.local_id ?? sale.id, value: sale })
export const getLastSale = async (tenantId: string): Promise<{ id: string; value: unknown } | null> => getMeta(lastSaleKey(tenantId))
export const clearLastSale = async (tenantId: string) => setMeta(lastSaleKey(tenantId), null)

export const getPendingQueue = async (tenantId: string) => readJson<PendingQueueItem[]>(key.pending, []).filter((item) => item.tenant_id === tenantId)
export const addPendingQueueItem = async (item: PendingQueueItem) => { writeJson(key.pending, [...readJson<PendingQueueItem[]>(key.pending, []), item]); emit('pending-changed') }
export const updatePendingQueueItem = async (item: PendingQueueItem) => {
  const next = readJson<PendingQueueItem[]>(key.pending, []).map((row) => row.id === item.id ? item : row)
  writeJson(key.pending, next)
  emit('pending-changed')
}

export const saveContingencyBatch = async (payload: ContingencyBatchPayload) => {
  await addPendingQueueItem({ id: payload.local_batch_id, tenant_id: payload.tenant_id, usuario_id: payload.usuario_id, type: 'CONTINGENCY_BATCH', payload, status: 'PENDING_SYNC', created_at: payload.captured_at, last_attempt_at: null, error_message: null })
}

export const nextContingencyFolio = async (tenantId: string) => {
  const metaKey = `cont_counter:${tenantId}:${new Date().toISOString().slice(0, 10)}`
  const next = ((await getMeta<number>(metaKey)) ?? 0) + 1
  await setMeta(metaKey, next)
  return `CONT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(next).padStart(3, '0')}`
}

export const nextPorPagarFolio = async (tenantId: string) => {
  const metaKey = `porpagar_counter:${tenantId}:${new Date().toISOString().slice(0, 10)}`
  const next = ((await getMeta<number>(metaKey)) ?? 0) + 1
  await setMeta(metaKey, next)
  return `PP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(next).padStart(3, '0')}`
}

const readPorPagar = () => readJson<PorPagarOrder[]>(key.porPagar, [])
const writePorPagar = (orders: PorPagarOrder[]) => writeJson(key.porPagar, orders)

export const getPorPagarList = async (tenantId: string) => readPorPagar().filter((item) => item.tenant_id === tenantId)
export const createPorPagarOrder = async (order: PorPagarOrder) => { writePorPagar([...readPorPagar(), order]); emit('por-pagar-changed') }
export const addPorPagarPayment = async (orderId: string, payment: PorPagarOrder['payment_history'][number]) => {
  const next = readPorPagar().map((order) => order.id !== orderId ? order : {
    ...order,
    balance: Math.max(0, Number((order.balance - payment.amount).toFixed(2))),
    status: (order.balance - payment.amount <= 0 ? 'LIQUIDADO' : 'ABIERTO') as PorPagarOrder['status'],
    payment_history: [...order.payment_history, payment],
    updated_at: nowIso()
  })
  writePorPagar(next)
  emit('por-pagar-changed')
}
export const cancelPorPagarOrder = async (orderId: string, canceledAt: string) => {
  writePorPagar(readPorPagar().map((order) => order.id === orderId ? { ...order, status: 'CANCELADO', canceled_at: canceledAt, updated_at: canceledAt } : order))
  emit('por-pagar-changed')
}
export const markPorPagarDelivered = async (orderId: string, deliveredAt: string) => {
  writePorPagar(readPorPagar().map((order) => order.id === orderId ? { ...order, status: 'ENTREGADO', delivered_at: deliveredAt, updated_at: deliveredAt } : order))
  emit('por-pagar-changed')
}
