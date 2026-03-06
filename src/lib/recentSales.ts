import { SalePayload } from './types'

const RECENT_SALES_KEY = 'pos_recent_sales_v1'
const RECENT_SALES_LIMIT = 20

export interface RecentSaleEntry {
  sale_id: string
  folio?: string
  captured_at: string
  total: number
  product_count: number
}

const parseRecentSales = (raw: string | null): RecentSaleEntry[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentSaleEntry =>
        Boolean(item) &&
        typeof item.sale_id === 'string' &&
        typeof item.captured_at === 'string' &&
        typeof item.total === 'number' &&
        typeof item.product_count === 'number'
    )
  } catch {
    return []
  }
}

const persistRecentSales = (sales: RecentSaleEntry[]) => {
  localStorage.setItem(RECENT_SALES_KEY, JSON.stringify(sales))
}

export const getRecentSales = (): RecentSaleEntry[] => {
  return parseRecentSales(localStorage.getItem(RECENT_SALES_KEY))
}

export const registerRecentSale = (payload: SalePayload, folio?: string): RecentSaleEntry[] => {
  const total = Number(
    payload.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0).toFixed(2)
  )
  const productCount = payload.items.reduce((sum, item) => sum + item.qty, 0)
  const current = getRecentSales()

  const entry: RecentSaleEntry = {
    sale_id: payload.local_id,
    folio: folio?.trim() ? folio.trim() : undefined,
    captured_at: payload.captured_at,
    total,
    product_count: Number(productCount.toFixed(3))
  }

  const deduped = current.filter((item) => item.sale_id !== entry.sale_id)
  const next = [entry, ...deduped].slice(0, RECENT_SALES_LIMIT)
  persistRecentSales(next)
  return next
}

export const updateRecentSaleFolio = (saleId: string, folio: string): RecentSaleEntry[] => {
  if (!saleId || !folio?.trim()) return getRecentSales()
  const current = getRecentSales()
  const next = current.map((item) =>
    item.sale_id === saleId ? { ...item, folio: folio.trim() } : item
  )
  persistRecentSales(next)
  return next
}
