import { Product, PendingQueueItem, Settings, VentaPorPagar, Abono } from './types'
import { sampleProducts } from './seed'

const DB_NAME = 'pos_db'
const DB_VERSION = 2

const STORE_PRODUCTS = 'products'
const STORE_PENDING = 'pending_queue'
const STORE_SETTINGS = 'settings'
const STORE_META = 'meta'
const STORE_SALES = 'sales'
const STORE_POR_PAGAR = 'por_pagar'

let dbPromise: Promise<IDBDatabase> | null = null

const withRemateDefaults = (product: Product): Product => ({
  ...product,
  remate_enabled: product.remate_enabled ?? false,
  remate_type: product.remate_type ?? null,
  remate_value: product.remate_value ?? null,
  remate_start_at: product.remate_start_at ?? null,
  remate_end_at: product.remate_end_at ?? null,
  remate_marked_at: product.remate_marked_at ?? null,
  remate_marked_by: product.remate_marked_by ?? null
})

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const tx = request.transaction

      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'barcode' })
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_POR_PAGAR)) {
        db.createObjectStore(STORE_POR_PAGAR, { keyPath: 'id' })
      }

      const oldVersion = (event as IDBVersionChangeEvent).oldVersion
      if (oldVersion < 2 && tx && db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const productsStore = tx.objectStore(STORE_PRODUCTS)
        const cursorReq = productsStore.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return
          const normalized = withRemateDefaults(cursor.value as Product)
          cursor.update(normalized)
          cursor.continue()
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

const withStore = async <T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<T> => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    fn(store)
    tx.oncomplete = () => resolve(undefined as T)
    tx.onerror = () => reject(tx.error)
  })
}

const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDb()
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

const getByKey = async <T>(storeName: string, key: IDBValidKey): Promise<T | null> => {
  const db = await openDb()
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

const putValue = async <T>(storeName: string, value: T): Promise<void> => {
  await withStore<void>(storeName, 'readwrite', (store) => {
    store.put(value as never)
  })
}

const deleteValue = async (storeName: string, key: IDBValidKey): Promise<void> => {
  await withStore<void>(storeName, 'readwrite', (store) => {
    store.delete(key)
  })
}

export const dbEvents = new EventTarget()
const emit = (name: string) => dbEvents.dispatchEvent(new Event(name))

export const initDb = async (): Promise<void> => {
  await openDb()
  const products = await getAll<Product>(STORE_PRODUCTS)
  if (products.length === 0) {
    await upsertProducts(sampleProducts)
  } else {
    await upsertProducts(products.map(withRemateDefaults))
  }
  const settings = await getSettings()
  if (!settings) {
    await setSettings({ user: 'CAJA1', admin_pin: '1234' })
  }
}

export const getProducts = () => getAll<Product>(STORE_PRODUCTS)
export const getProductByBarcode = (barcode: string) => getByKey<Product>(STORE_PRODUCTS, barcode)

export const upsertProducts = async (products: Product[]): Promise<void> => {
  await withStore<void>(STORE_PRODUCTS, 'readwrite', (store) => {
    for (const product of products) {
      store.put(withRemateDefaults(product))
    }
  })
  emit('products-changed')
}

export const clearProducts = async (): Promise<void> => {
  await withStore<void>(STORE_PRODUCTS, 'readwrite', (store) => store.clear())
  emit('products-changed')
}

export const getPendingQueue = () => getAll<PendingQueueItem>(STORE_PENDING)

export const addPendingQueueItem = async (item: PendingQueueItem): Promise<void> => {
  await putValue(STORE_PENDING, item)
  emit('pending-changed')
}

export const updatePendingQueueItem = async (item: PendingQueueItem): Promise<void> => {
  await putValue(STORE_PENDING, item)
  emit('pending-changed')
}

export const removePendingQueueItem = async (id: string): Promise<void> => {
  await deleteValue(STORE_PENDING, id)
  emit('pending-changed')
}

export const getSettings = async (): Promise<Settings | null> => {
  const record = await getByKey<{ key: string; value: Settings }>(STORE_SETTINGS, 'settings')
  return record?.value ?? null
}

export const setSettings = async (settings: Settings): Promise<void> => {
  await putValue(STORE_SETTINGS, { key: 'settings', value: settings })
}

export const getMeta = async <T>(key: string): Promise<T | null> => {
  const record = await getByKey<{ key: string; value: T }>(STORE_META, key)
  return record?.value ?? null
}

export const setMeta = async <T>(key: string, value: T): Promise<void> => {
  await putValue(STORE_META, { key, value })
}

export const setLastSale = async (sale: unknown & { local_id?: string; id?: string }): Promise<void> => {
  const id = sale.local_id ?? sale.id ?? ''
  if (!id) return
  await putValue(STORE_SALES, { id, value: sale })
  await setMeta('last_sale_id', id)
}

export const getLastSale = async (): Promise<{ id: string; value: unknown } | null> => {
  const lastId = await getMeta<string>('last_sale_id')
  if (!lastId) return null
  const record = await getByKey<{ id: string; value: unknown }>(STORE_SALES, lastId)
  return record ?? null
}

export const clearLastSale = async (): Promise<void> => {
  await setMeta('last_sale_id', '')
}

export const nextContingencyFolio = async (): Promise<string> => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const key = `cont-counter-${yyyy}${mm}${dd}`
  const current = (await getMeta<number>(key)) ?? 0
  const next = current + 1
  await setMeta(key, next)
  return `CONT-${yyyy}${mm}${dd}-${String(next).padStart(3, '0')}`
}

export const nextPorPagarFolio = async (): Promise<string> => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const key = `por-pagar-counter-${yyyy}${mm}${dd}`
  const current = (await getMeta<number>(key)) ?? 0
  const next = current + 1
  await setMeta(key, next)
  return `PP-${yyyy}${mm}${dd}-${String(next).padStart(3, '0')}`
}

export const getPorPagarList = () => getAll<VentaPorPagar>(STORE_POR_PAGAR)
export const getPorPagarById = (id: string) => getByKey<VentaPorPagar>(STORE_POR_PAGAR, id)

export const createPorPagar = async (order: VentaPorPagar): Promise<void> => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS, STORE_POR_PAGAR], 'readwrite')
    const productStore = tx.objectStore(STORE_PRODUCTS)
    const orderStore = tx.objectStore(STORE_POR_PAGAR)

    for (const item of order.items) {
      const req = productStore.get(item.barcode)
      req.onsuccess = () => {
        const product = req.result as Product | undefined
        if (!product || product.stock_snapshot === null) return
        const nextStock = Math.max(0, product.stock_snapshot - item.qty_base)
        productStore.put({ ...product, stock_snapshot: nextStock })
      }
    }

    orderStore.put(order)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  emit('products-changed')
  emit('por-pagar-changed')
}

export const addAbonoToPorPagar = async (id: string, abono: Abono): Promise<VentaPorPagar | null> => {
  const db = await openDb()
  return new Promise<VentaPorPagar | null>((resolve, reject) => {
    const tx = db.transaction(STORE_POR_PAGAR, 'readwrite')
    const store = tx.objectStore(STORE_POR_PAGAR)
    const req = store.get(id)

    req.onsuccess = () => {
      const order = req.result as VentaPorPagar | undefined
      if (!order) {
        resolve(null)
        return
      }
      if (order.status !== 'ABIERTO') {
        resolve(order)
        return
      }
      const nextPaid = Number((order.paid + abono.amount).toFixed(2))
      const nextBalance = Number(Math.max(0, order.total - nextPaid).toFixed(2))
      const updated: VentaPorPagar = {
        ...order,
        paid: nextPaid,
        balance: nextBalance,
        status: nextBalance <= 0 ? 'LIQUIDADO' : 'ABIERTO',
        abonos: [...order.abonos, abono]
      }
      store.put(updated)
      resolve(updated)
    }

    req.onerror = () => reject(req.error)
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => emit('por-pagar-changed')
  })
}

export const markPorPagarDelivered = async (id: string, user: string, at: string): Promise<VentaPorPagar | null> => {
  const order = await getPorPagarById(id)
  if (!order || order.status !== 'LIQUIDADO') return order
  const updated: VentaPorPagar = {
    ...order,
    delivered_at: at,
    delivered_by: user
  }
  await putValue(STORE_POR_PAGAR, updated)
  emit('por-pagar-changed')
  return updated
}

export const cancelPorPagar = async (id: string, user: string, at: string, reason: string): Promise<VentaPorPagar | null> => {
  const db = await openDb()
  return new Promise<VentaPorPagar | null>((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS, STORE_POR_PAGAR], 'readwrite')
    const productStore = tx.objectStore(STORE_PRODUCTS)
    const orderStore = tx.objectStore(STORE_POR_PAGAR)
    const req = orderStore.get(id)

    req.onsuccess = () => {
      const order = req.result as VentaPorPagar | undefined
      if (!order) {
        resolve(null)
        return
      }
      if (order.status === 'CANCELADO') {
        resolve(order)
        return
      }

      for (const item of order.items) {
        const productReq = productStore.get(item.barcode)
        productReq.onsuccess = () => {
          const product = productReq.result as Product | undefined
          if (!product || product.stock_snapshot === null) return
          productStore.put({ ...product, stock_snapshot: product.stock_snapshot + item.qty_base })
        }
      }

      const updated: VentaPorPagar = {
        ...order,
        status: 'CANCELADO',
        canceled_at: at,
        canceled_by: user,
        cancellation_reason: reason || 'Cancelado por usuario'
      }
      orderStore.put(updated)
      resolve(updated)
    }

    req.onerror = () => reject(req.error)
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => {
      emit('products-changed')
      emit('por-pagar-changed')
    }
  })
}
