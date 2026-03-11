import { loadSession } from './auth'
import { apiUrl } from './http'
import { ContingencyBatchPayload, Product, SalePayload, UndoLastSalePayload } from './types'

const getHeaders = () => {
  const session = loadSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(apiUrl(path), { ...init, headers: { ...getHeaders(), ...(init?.headers ?? {}) } })
  const raw = await response.text()
  let data: any = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`)
  return data as T
}

export const api = {
  async fetchProducts(tenantId: string) {
    const params = new URLSearchParams({ tenant_id: tenantId })
    const result = await request<{ ok: true; data: Product[] }>(`/api/products?${params.toString()}`)
    return result.data
  },

  async lookupProduct(tenantId: string, barcode: string) {
    const params = new URLSearchParams({ tenant_id: tenantId })
    const result = await request<{ ok: true; data: Product | null }>(`/api/products/lookup/${encodeURIComponent(barcode)}?${params.toString()}`)
    return result.data
  },

  async postSale(payload: SalePayload) {
    const result = await request<{ ok: true; data: { id: string }; folio: string }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return { ok: true, server_sale_id: result.data.id, folio: result.folio }
  },

  async postBatch(payload: ContingencyBatchPayload) {
    return { ok: true, duplicate: false, server_batch_id: payload.local_batch_id, folio: payload.folio_lote }
  },

  async postUndo(payload: UndoLastSalePayload) {
    await request<{ ok: true }>(`/api/sales/${payload.last_sale_id}/void`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return { ok: true }
  }
}


