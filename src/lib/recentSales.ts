import { SalePayload } from './types'

const LIMIT = 20
const keyFor = (tenantId: string) => `pos_recent_sales:${tenantId}`

export interface RecentSaleEntry {
  sale_id: string
  folio?: string
  captured_at: string
  total: number
  product_count: number
}

const parse = (raw: string | null): RecentSaleEntry[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const persist = (tenantId: string, sales: RecentSaleEntry[]) => {
  localStorage.setItem(keyFor(tenantId), JSON.stringify(sales))
}

export const getRecentSales = (tenantId: string): RecentSaleEntry[] => parse(localStorage.getItem(keyFor(tenantId)))

export const registerRecentSale = (tenantId: string, payload: SalePayload, folio?: string): RecentSaleEntry[] => {
  const total = Number(payload.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0).toFixed(2))
  const product_count = Number(payload.items.reduce((sum, item) => sum + item.qty, 0).toFixed(3))
  const current = getRecentSales(tenantId).filter((item) => item.sale_id !== payload.local_id)
  const next = [{ sale_id: payload.local_id, folio: folio?.trim() || undefined, captured_at: payload.captured_at, total, product_count }, ...current].slice(0, LIMIT)
  persist(tenantId, next)
  return next
}

export const updateRecentSaleFolio = (tenantId: string, saleId: string, folio: string): RecentSaleEntry[] => {
  const next = getRecentSales(tenantId).map((item) => (item.sale_id === saleId ? { ...item, folio: folio.trim() } : item))
  persist(tenantId, next)
  return next
}
