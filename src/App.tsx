import { useEffect, useMemo, useState } from 'react'
import PosScreen from './components/PosScreen'
import ContingencyScreen from './components/ContingencyScreen'
import PorPagarScreen from './components/PorPagarScreen'
import PinModal from './components/PinModal'
import SyncManager from './components/SyncManager'
import {
  addPorPagarPayment,
  addPendingQueueItem,
  cancelPorPagarOrder,
  clearLastSale,
  createPorPagarOrder,
  dbEvents,
  getMeta,
  getLastSale,
  getPendingQueue,
  getPorPagarList,
  getProducts,
  getSettings,
  initDb,
  markPorPagarDelivered,
  nextPorPagarFolio,
  setLastSale,
  setMeta,
  updatePendingQueueItem,
  upsertProducts
} from './lib/db'
import { api } from './lib/api'
import {
  ContingencyBatchPayload,
  PendingQueueItem,
  PorPagarOrder,
  Product,
  SalePayload,
  UndoLastSalePayload
} from './lib/types'
import { nowIso, uuid } from './lib/utils'
import {
  getRecentSales,
  RecentSaleEntry,
  registerRecentSale,
  updateRecentSaleFolio
} from './lib/recentSales'

const PIN_LOCK_SECONDS = 120

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState<PendingQueueItem[]>([])
  const [porPagarOrders, setPorPagarOrders] = useState<PorPagarOrder[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [screen, setScreen] = useState<'pos' | 'contingency' | 'por_pagar'>('pos')
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLockedUntil, setPinLockedUntil] = useState<Date | null>(null)
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [undoSummary, setUndoSummary] = useState<{ id: string; total: number; payment: string; at: string } | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)
  const [currentUser, setCurrentUser] = useState('CAJA1')
  const [recentSales, setRecentSales] = useState<RecentSaleEntry[]>([])

  const catalogAvailable = products.length > 0
  const pendingCount = useMemo(() => pending.filter((p) => p.status === 'PENDING_SYNC').length, [pending])

  useEffect(() => {
    const init = async () => {
      await initDb()
      setProducts(await getProducts())
      setPending(await getPendingQueue())
      setPorPagarOrders(await getPorPagarList())
      const settings = await getSettings()
      if (settings?.user) setCurrentUser(settings.user)
      const lockUntil = await getMetaDate('pin_lock_until')
      setPinLockedUntil(lockUntil)
      setRecentSales(getRecentSales())
    }
    init()
  }, [])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const pendingHandler = () => getPendingQueue().then(setPending)
    const productsHandler = () => getProducts().then(setProducts)
    const porPagarHandler = () => getPorPagarList().then(setPorPagarOrders)
    dbEvents.addEventListener('pending-changed', pendingHandler)
    dbEvents.addEventListener('products-changed', productsHandler)
    dbEvents.addEventListener('por-pagar-changed', porPagarHandler)
    return () => {
      dbEvents.removeEventListener('pending-changed', pendingHandler)
      dbEvents.removeEventListener('products-changed', productsHandler)
      dbEvents.removeEventListener('por-pagar-changed', porPagarHandler)
    }
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const refreshCatalog = async () => {
    try {
      const fetched = await api.fetchProducts()
      await upsertProducts(fetched)
      setProducts(await getProducts())
      setMessage('Catalogo actualizado.')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const requestAdmin = (action: () => void) => {
    setPendingAdminAction(() => action)
    setPinError(null)
    setPinOpen(true)
  }

  const verifyPin = async (pin: string) => {
    const locked = pinLockedUntil && pinLockedUntil.getTime() > Date.now()
    if (locked) {
      setPinError('PIN bloqueado. Espera e intenta de nuevo.')
      return
    }
    const settings = await getSettings()
    const expected = settings?.admin_pin ?? '1234'
    if (pin === expected) {
      await setMeta('pin_fail_count', 0)
      await setMeta('pin_lock_until', '')
      setPinLockedUntil(null)
      setPinError(null)
      setPinOpen(false)
      if (pendingAdminAction) pendingAdminAction()
      setPendingAdminAction(null)
      return
    }
    const fails = ((await getMetaNumber('pin_fail_count')) ?? 0) + 1
    await setMeta('pin_fail_count', fails)
    if (fails >= 3) {
      const lockUntil = new Date(Date.now() + PIN_LOCK_SECONDS * 1000)
      await setMeta('pin_lock_until', lockUntil.toISOString())
      setPinLockedUntil(lockUntil)
      setPinError('Demasiados intentos. Bloqueado 2 minutos.')
      return
    }
    setPinError('PIN incorrecto.')
  }

  const enviarAn8n = async (payload: SalePayload) => {
    const N8N_WEBHOOK_URL = 'https://chatbotsn8n.com/webhook-test/0998ffe0-6f57-4fd1-95d4-b5a67494307b'
    const totalVenta = payload.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0)

    try {
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ventaId: payload.local_id,
          fechaISO: payload.captured_at,
          posId: currentUser,
          SUBTOTAL: totalVenta,
          METODO_PAGO: payload.payment_method,
          RECIBIDO: payload.amount_received ?? totalVenta,
          CAMBIO: payload.change_amount ?? 0,
          factura: payload.fiscal_data ?? { wants_invoice: false },
          items: payload.items
        })
      })
    } catch (error) {
      console.error('Error enviando a n8n:', error)
    }
  }

  const handleConfirmSale = async (payload: SalePayload) => {
    await setLastSale(payload)
    setRecentSales(registerRecentSale(payload))
    if (!online) {
      await addPendingQueueItem(createPending('SALE', payload))
      setMessage('Venta guardada en cola (offline).')
      return
    }
    try {
      const response = await api.postSale(payload)
      await enviarAn8n(payload)
      if (!response.ok) {
        await addPendingQueueItem(createPending('SALE', payload, response.error ?? 'Error remoto'))
        setMessage('Venta en cola por error en servidor.')
        return
      }
      if (response.folio) {
        setRecentSales(updateRecentSaleFolio(payload.local_id, response.folio))
      }
      setMessage('Venta registrada.')
    } catch (error) {
      await addPendingQueueItem(createPending('SALE', payload, (error as Error).message))
      setMessage('Venta en cola por error de red.')
    }
  }

  const handleSaveBatch = async (payload: ContingencyBatchPayload) => {
    if (!online) {
      await addPendingQueueItem(createPending('CONTINGENCY_BATCH', payload))
      setMessage('Lote guardado en cola (offline).')
      setScreen('pos')
      return
    }
    try {
      const response = await api.postBatch(payload)
      if (!response.ok) {
        await addPendingQueueItem(createPending('CONTINGENCY_BATCH', payload, response.error ?? 'Error remoto'))
        setMessage('Lote en cola por error en servidor.')
      } else {
        setMessage('Lote registrado.')
      }
    } catch (error) {
      await addPendingQueueItem(createPending('CONTINGENCY_BATCH', payload, (error as Error).message))
      setMessage('Lote en cola por error de red.')
    }
    setScreen('pos')
  }

  const handleUndoRequest = async () => {
    const last = await getLastSale()
    if (!last) {
      setMessage('No hay venta para deshacer.')
      return
    }
    const sale = last.value as SalePayload
    const total = sale.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0)
    setUndoSummary({ id: last.id, total, payment: sale.payment_method, at: sale.captured_at })
  }

  const confirmUndo = async () => {
    if (!undoSummary || isUndoing) return
    const payload: UndoLastSalePayload = {
      local_id: uuid(),
      captured_at: nowIso(),
      last_sale_id: undoSummary.id
    }
    setIsUndoing(true)
    try {
      if (!online) {
        await addPendingQueueItem(createPending('UNDO_LAST_SALE', payload))
        await clearLastSale()
        setMessage('Undo guardado en cola (offline).')
        setUndoSummary(null)
        return
      }

      const response = await api.postUndo(payload)
      if (!response.ok) {
        await addPendingQueueItem(createPending('UNDO_LAST_SALE', payload, response.error ?? 'Error remoto'))
        await clearLastSale()
        setMessage('Error al deshacer venta, se envio a cola.')
      } else {
        await clearLastSale()
        setMessage('Venta anulada.')
      }
      setPending(await getPendingQueue())
    } catch (error) {
      await addPendingQueueItem(createPending('UNDO_LAST_SALE', payload, (error as Error).message))
      await clearLastSale()
      setMessage('Error al deshacer venta, se envio a cola.')
      setPending(await getPendingQueue())
    } finally {
      setIsUndoing(false)
      setUndoSummary(null)
    }
  }

  const syncPending = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    setSyncError(null)
    setSyncMessage(null)
    if (!online) {
      setSyncError('Error al sincronizar')
      setSyncMessage('Error al sincronizar')
      setMessage('Error al sincronizar')
      setIsSyncing(false)
      return
    }

    try {
      const queue = await getPendingQueue()
      const toSync = queue.filter((item) => item.status === 'PENDING_SYNC' || item.status === 'ERROR')

      if (toSync.length === 0) {
        setSyncMessage('No hay datos pendientes por sincronizar')
        setMessage('No hay datos pendientes por sincronizar')
        return
      }

      let hasError = false
      for (const item of toSync) {
        try {
          if (item.type === 'SALE') {
            const res = await api.postSale(item.payload as SalePayload)
            if (!res.ok && !res.duplicate) throw new Error(res.error ?? 'Error en venta')
          }
          if (item.type === 'CONTINGENCY_BATCH') {
            const res = await api.postBatch(item.payload as ContingencyBatchPayload)
            if (!res.ok && !res.duplicate) throw new Error(res.error ?? 'Error en lote')
          }
          if (item.type === 'UNDO_LAST_SALE') {
            const res = await api.postUndo(item.payload as UndoLastSalePayload)
            if (!res.ok && !res.duplicate) throw new Error(res.error ?? 'Error en undo')
          }
          const syncedItem: PendingQueueItem = {
            ...item,
            status: 'SYNCED',
            last_attempt_at: nowIso(),
            error_message: null
          }
          await updatePendingQueueItem(syncedItem)
        } catch (error) {
          hasError = true
          const failedItem: PendingQueueItem = {
            ...item,
            status: 'ERROR',
            last_attempt_at: nowIso(),
            error_message: (error as Error).message
          }
          await updatePendingQueueItem(failedItem)
        }
      }

      if (hasError) {
        setSyncError('Error al sincronizar')
        setSyncMessage('Error al sincronizar')
        setMessage('Error al sincronizar')
      } else {
        setSyncMessage('Sincronización completada')
        setMessage('Sincronización completada')
      }
    } catch {
      setSyncError('Error al sincronizar')
      setSyncMessage('Error al sincronizar')
      setMessage('Error al sincronizar')
    } finally {
      setPending(await getPendingQueue())
      setIsSyncing(false)
    }
  }

  // ✅ Renderiza SOLO una pantalla a la vez (evita “flash” / doble UI)
  let content: JSX.Element | null = null

  if (screen === 'pos') {
    content = (
      <PosScreen
        products={products}
        catalogAvailable={catalogAvailable}
        online={online}
        pendingCount={pendingCount}
        recentSales={recentSales}
        currentUser={currentUser}
        onSyncOpen={() => {
          setSyncError(null)
          setSyncMessage(null)
          setSyncOpen(true)
        }}
        onContingency={() => requestAdmin(() => setScreen('contingency'))}
        onUndo={() => requestAdmin(handleUndoRequest)}
        onRefreshCatalog={() => requestAdmin(refreshCatalog)}
        onOpenPorPagar={() => setScreen('por_pagar')}
        onConfirmSale={handleConfirmSale}
        onQuickAddProduct={async (product) => {
          await upsertProducts([product])
          setProducts(await getProducts())
        }}
        onUpdateProduct={async (product) => {
          await upsertProducts([product])
          setProducts(await getProducts())
        }}
        onConvertToPorPagar={async ({ cart, customer_name, customer_phone, anticipo }) => {
          const total = Number(cart.reduce((sum, item) => sum + item.qty * item.price_gross, 0).toFixed(2))
          const normalizedAnticipo = Number(Math.max(0, Math.min(total, anticipo)).toFixed(2))
          const balance = Number((total - normalizedAnticipo).toFixed(2))

          const order: PorPagarOrder = {
            id: uuid(),
            folio: await nextPorPagarFolio(),
            sale_type: 'POR_PAGAR',
            customer_name,
            customer_phone,
            items: cart.map((item) => ({
              barcode: item.barcode,
              sku: item.sku,
              name: item.name,
              unit_base: item.unit_base,
              type: item.type,
              pack_factor: item.pack_factor,
              qty: item.qty,
              qty_base: item.qty_base,
              price_gross: item.price_gross
            })),
            total,
            anticipo: normalizedAnticipo,
            balance,
            status: balance <= 0 ? 'LIQUIDADO' : 'ABIERTO',
            payment_history:
              normalizedAnticipo > 0
                ? [{ id: uuid(), amount: normalizedAnticipo, method: 'EFECTIVO', captured_at: nowIso() }]
                : [],
            canceled_at: null,
            delivered_at: null,
            created_at: nowIso()
          }

          await createPorPagarOrder(order)
          setPorPagarOrders(await getPorPagarList())
          setProducts(await getProducts())
          setMessage(`Apartado ${order.folio} creado.`)
        }}
      />
    )
  } else if (screen === 'contingency') {
    content = (
      <ContingencyScreen
        products={products}
        onBack={() => setScreen('pos')}
        onSave={handleSaveBatch}
      />
    )
  } else if (screen === 'por_pagar') {
    content = (
      <PorPagarScreen
        orders={porPagarOrders}
        onBack={() => setScreen('pos')}
          onRegisterAbono={async (orderId, amount, method, receivedAmount, changeAmount) => {
            await addPorPagarPayment(orderId, {
              id: uuid(),
              amount,
              method,
              captured_at: nowIso(),
              received_amount: receivedAmount,
              change_amount: changeAmount
            })
            setPorPagarOrders(await getPorPagarList())
          }}
        onCancel={async (orderId) => {
          await cancelPorPagarOrder(orderId, nowIso())
          setPorPagarOrders(await getPorPagarList())
          setProducts(await getProducts())
        }}
        onMarkDelivered={async (orderId) => {
          await markPorPagarDelivered(orderId, nowIso())
          setPorPagarOrders(await getPorPagarList())
        }}
      />
    )
  }

  return (
    <div className="app">
      {message && <div className="toast">{message}</div>}

      {content}

      <SyncManager
        isOpen={syncOpen}
        pending={pending}
        lastSyncError={syncError}
        syncMessage={syncMessage}
        isSyncing={isSyncing}
        onClose={() => setSyncOpen(false)}
        onSync={syncPending}
      />

      <PinModal
        isOpen={pinOpen}
        title="PIN Admin"
        description="Acceso restringido"
        error={pinError}
        lockedUntil={pinLockedUntil}
        onClose={() => setPinOpen(false)}
        onSubmit={verifyPin}
      />

      {undoSummary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Deshacer ultima venta</h2>
            <p className="muted">ID: {undoSummary.id}</p>
            <p>Hora: {new Date(undoSummary.at).toLocaleString()}</p>
            <p>Pago: {undoSummary.payment}</p>
            <p className="strong">Total: {undoSummary.total.toFixed(2)}</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setUndoSummary(null)} disabled={isUndoing}>Cancelar</button>
              <button className="btn danger" onClick={confirmUndo} disabled={isUndoing}>
                {isUndoing ? 'Procesando...' : 'Confirmar anulacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const createPending = (type: PendingQueueItem['type'], payload: unknown, errorMessage?: string): PendingQueueItem => ({
  id: uuid(),
  type,
  payload,
  status: 'PENDING_SYNC',
  created_at: nowIso(),
  last_attempt_at: null,
  error_message: errorMessage ?? null
})

const getMetaNumber = async (key: string): Promise<number | null> => {
  const record = await getMeta<number>(key)
  return record ?? null
}

const getMetaDate = async (key: string): Promise<Date | null> => {
  const raw = await getMeta<string>(key)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
