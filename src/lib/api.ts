import { sampleProducts } from './seed'
import { ContingencyBatchPayload, SalePayload, UndoLastSalePayload } from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getStore = (key: string): Set<string> => {
  const raw = localStorage.getItem(key)
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

const setStore = (key: string, values: Set<string>) => {
  localStorage.setItem(key, JSON.stringify(Array.from(values)))
}

const assertOnline = () => {
  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet.')
  }
}

export const api = {
  async fetchProducts() {
    assertOnline()
    await delay(400)
    return sampleProducts
  },

  async lookupProduct(barcode: string) {
    assertOnline()
    await delay(150)
    return sampleProducts.find((p) => p.barcode === barcode) ?? null
  },

  async postSale(payload: SalePayload) {
    assertOnline()
    await delay(350)
    const key = 'mock_sales'
    const store = getStore(key)
    if (store.has(payload.local_id)) {
      return { ok: false, error: 'Duplicado', duplicate: true }
    }
    store.add(payload.local_id)
    setStore(key, store)
    return { ok: true, server_sale_id: `S-${Date.now()}`, folio: `VTA-${Date.now()}` }
  },

  async postBatch(payload: ContingencyBatchPayload) {
    assertOnline()
    await delay(350)
    const key = 'mock_batches'
    const store = getStore(key)
    if (store.has(payload.local_batch_id)) {
      return { ok: false, error: 'Duplicado', duplicate: true }
    }
    store.add(payload.local_batch_id)
    setStore(key, store)
    return { ok: true, server_batch_id: `B-${Date.now()}`, folio: payload.folio_lote }
  },

  async postUndo(payload: UndoLastSalePayload) {
    assertOnline()
    await delay(250)
    const key = 'mock_undo'
    const store = getStore(key)
    if (store.has(payload.local_id)) {
      return { ok: false, error: 'Duplicado', duplicate: true }
    }
    store.add(payload.local_id)
    setStore(key, store)
    return { ok: true }
  }
}
