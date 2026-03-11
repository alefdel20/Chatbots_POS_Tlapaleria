import { useEffect, useMemo, useState } from 'react'
import AuditScreen from './components/AuditScreen'
import BusinessesAdmin from './components/BusinessesAdmin'
import ContingencyScreen from './components/ContingencyScreen'
import DashboardCards from './components/DashboardCards'
import InventoryScreen from './components/InventoryScreen'
import LoginScreen from './components/LoginScreen'
import PinModal from './components/PinModal'
import PorPagarScreen from './components/PorPagarScreen'
import PosScreen from './components/PosScreen'
import ReportsScreen from './components/ReportsScreen'
import SyncManager from './components/SyncManager'
import UsersAdmin from './components/UsersAdmin'
import { api } from './lib/api'
import {
  addPendingQueueItem,
  addPorPagarPayment,
  adjustInventory,
  authenticateUser,
  cancelPorPagarOrder,
  clearLastSale,
  createBusiness,
  createPorPagarOrder,
  createUser,
  dbEvents,
  getAuditLogs,
  getBusinesses,
  getGlobalMetrics,
  getInventoryMovements,
  getLastSale,
  getMeta,
  getPendingQueue,
  getPorPagarList,
  getProducts,
  getSales,
  getSettings,
  getTenantMetrics,
  getUsers,
  getUsersByTenant,
  initDb,
  logout,
  markPorPagarDelivered,
  nextPorPagarFolio,
  recordSale,
  resetUserPassword,
  restoreAuth,
  saveContingencyBatch,
  setLastSale,
  setMeta,
  updateBusiness,
  updatePendingQueueItem,
  updateUser,
  upsertProducts,
  voidLastSale
} from './lib/db'
import { canAccessModule, hasPermission } from './lib/permissions'
import { getRecentSales, registerRecentSale, updateRecentSaleFolio } from './lib/recentSales'
import {
  AuditLog,
  Business,
  ContingencyBatchPayload,
  GlobalMetrics,
  PendingQueueItem,
  PorPagarOrder,
  Product,
  SalePayload,
  TenantMetrics,
  UndoLastSalePayload,
  UserRecord
} from './lib/types'
import { formatMoney, nowIso, uuid } from './lib/utils'

type Screen = 'dashboard' | 'businesses' | 'users' | 'pos' | 'contingency' | 'por_pagar' | 'inventory' | 'reports' | 'audit'

const PIN_LOCK_SECONDS = 120

export default function App() {
  const [booting, setBooting] = useState(true)
  const [auth, setAuth] = useState<{ user: UserRecord | null; business: Business | null }>({ user: null, business: null })
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState<PendingQueueItem[]>([])
  const [porPagarOrders, setPorPagarOrders] = useState<PorPagarOrder[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null)
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLockedUntil, setPinLockedUntil] = useState<Date | null>(null)
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null)
  const [undoSummary, setUndoSummary] = useState<{ id: string; total: number; payment: string; at: string } | null>(null)

  const user = auth.user
  const business = auth.business
  const tenantId = user?.tenant_id ?? ''
  const tenantModules = business?.modulos_activos ?? []
  const pendingCount = useMemo(() => pending.filter((item) => item.status === 'PENDING_SYNC').length, [pending])

  const menu = useMemo(() => {
    if (!user) return []
    if (user.rol === 'superadmin') {
      return [
        { key: 'dashboard' as const, label: 'Superadmin' },
        { key: 'businesses' as const, label: 'Negocios' },
        { key: 'users' as const, label: 'Usuarios' },
        { key: 'audit' as const, label: 'Auditoria' }
      ]
    }
    const items: Array<{ key: Screen; label: string }> = [{ key: 'dashboard', label: 'Resumen' }]
    if (canAccessModule(user, tenantModules, 'pos')) items.push({ key: 'pos', label: 'POS' }, { key: 'por_pagar', label: 'Por pagar' })
    if (canAccessModule(user, tenantModules, 'inventario')) items.push({ key: 'inventory', label: 'Inventario' })
    if (hasPermission(user, 'users.manage')) items.push({ key: 'users', label: 'Usuarios' })
    if (canAccessModule(user, tenantModules, 'reportes')) items.push({ key: 'reports', label: 'Reportes' })
    return items
  }, [tenantModules, user])

  const refreshData = async (nextUser = user, nextBusiness = business) => {
    if (!nextUser) return
    setBusinesses(await getBusinesses(false))
    setUsers(nextUser.rol === 'superadmin' ? await getUsers() : await getUsersByTenant(nextUser.tenant_id))
    setAuditLogs(nextUser.rol === 'superadmin' ? await getAuditLogs() : (await getAuditLogs()).filter((log) => log.tenant_id === nextUser.tenant_id))
    if (nextUser.rol === 'superadmin') {
      setGlobalMetrics(await getGlobalMetrics())
      return
    }
    setProducts(await getProducts(nextUser.tenant_id))
    setPending(await getPendingQueue(nextUser.tenant_id))
    setPorPagarOrders(await getPorPagarList(nextUser.tenant_id))
    setSales(await getSales(nextUser.tenant_id))
    setMetrics(await getTenantMetrics(nextUser.tenant_id))
    setRecentSales(getRecentSales(nextUser.tenant_id))
    const loadedBusiness = nextBusiness ?? await getBusinesses(false).then((rows) => rows.find((row) => row.id === nextUser.tenant_id) ?? null)
    setAuth({ user: nextUser, business: loadedBusiness })
    void getInventoryMovements(nextUser.tenant_id)
  }

  useEffect(() => {
    const load = async () => {
      await initDb()
      const restored = await restoreAuth()
      setAuth({ user: restored.user, business: restored.business })
      if (restored.user) {
        setScreen(restored.user.rol === 'superadmin' ? 'dashboard' : 'pos')
        await refreshData(restored.user, restored.business)
      }
      setBooting(false)
    }
    load()
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
    const handler = () => { if (user) void refreshData(user, business) }
    ;['products-changed', 'pending-changed', 'por-pagar-changed', 'users-changed', 'businesses-changed', 'sales-changed', 'inventory-changed'].forEach((event) => dbEvents.addEventListener(event, handler))
    return () => { ['products-changed', 'pending-changed', 'por-pagar-changed', 'users-changed', 'businesses-changed', 'sales-changed', 'inventory-changed'].forEach((event) => dbEvents.removeEventListener(event, handler)) }
  }, [business, user])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const handleLogin = async (email: string, password: string) => {
    setLoggingIn(true)
    setLoginError(null)
    const result = await authenticateUser(email, password)
    if (!result?.user) {
      setLoggingIn(false)
      setLoginError('Credenciales invalidas o usuario inactivo.')
      return
    }
    setAuth({ user: result.user, business: result.business })
    setScreen(result.user.rol === 'superadmin' ? 'dashboard' : 'pos')
    await refreshData(result.user, result.business)
    setLoggingIn(false)
  }

  const handleLogout = () => {
    logout()
    setAuth({ user: null, business: null })
    setScreen('dashboard')
  }

  const requestAdmin = (action: () => void) => {
    setPendingAdminAction(() => action)
    setPinError(null)
    setPinOpen(true)
  }

  const verifyPin = async (pin: string) => {
    const locked = pinLockedUntil && pinLockedUntil.getTime() > Date.now()
    if (locked) return setPinError('PIN bloqueado temporalmente.')
    const settings = await getSettings()
    const expected = settings?.admin_pin ?? '1234'
    if (pin === expected) {
      await setMeta('pin_fail_count', 0)
      await setMeta('pin_lock_until', '')
      setPinLockedUntil(null)
      setPinOpen(false)
      pendingAdminAction?.()
      setPendingAdminAction(null)
      return
    }
    const fails = ((await getMeta<number>('pin_fail_count')) ?? 0) + 1
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

  const handleConfirmSale = async (payload: SalePayload) => {
    if (!user) return
    if (!online) {
      await addPendingQueueItem({ id: uuid(), tenant_id: payload.tenant_id, usuario_id: payload.usuario_id, type: 'SALE', payload, status: 'PENDING_SYNC', created_at: nowIso(), last_attempt_at: null, error_message: null })
      setMessage('Venta guardada en cola.')
      return
    }
    await recordSale(payload, user)
    setRecentSales(registerRecentSale(payload.tenant_id, payload))
    await setLastSale(payload.tenant_id, payload)
    setMessage('Venta registrada.')
  }

  const handleSaveBatch = async (payload: ContingencyBatchPayload) => {
    await saveContingencyBatch(payload)
    if (online) {
      const response = await api.postBatch(payload)
      if (response.ok || response.duplicate) {
        await updatePendingQueueItem({ id: payload.local_batch_id, tenant_id: payload.tenant_id, usuario_id: payload.usuario_id, type: 'CONTINGENCY_BATCH', payload, status: 'SYNCED', created_at: payload.captured_at, last_attempt_at: nowIso(), error_message: null })
      }
    }
    setMessage('Lote de contingencia guardado.')
    setScreen('pos')
  }

  const handleUndoRequest = async () => {
    if (!tenantId) return
    const last = await getLastSale(tenantId)
    if (!last) return setMessage('No hay venta para deshacer.')
    const sale = last.value as SalePayload
    setUndoSummary({ id: last.id, total: sale.items.reduce((sum, item) => sum + item.qty * item.price_gross, 0), payment: sale.payment_method, at: sale.captured_at })
  }

  const confirmUndo = async () => {
    if (!undoSummary || !user) return
    const payload: UndoLastSalePayload = { local_id: uuid(), tenant_id: tenantId, usuario_id: user.id, captured_at: nowIso(), last_sale_id: undoSummary.id }
    if (!online) {
      await addPendingQueueItem({ id: payload.local_id, tenant_id: payload.tenant_id, usuario_id: payload.usuario_id, type: 'UNDO_LAST_SALE', payload, status: 'PENDING_SYNC', created_at: payload.captured_at, last_attempt_at: null, error_message: null })
    } else {
      await voidLastSale(payload, user)
    }
    await clearLastSale(tenantId)
    setUndoSummary(null)
    setMessage('Venta anulada.')
  }

  const syncPending = async () => {
    if (!user || user.rol === 'superadmin') return
    if (!online) return setSyncError('Sin conexion.')
    setIsSyncing(true)
    const queue = await getPendingQueue(user.tenant_id)
    for (const item of queue.filter((row) => row.status !== 'SYNCED')) {
      try {
        if (item.type === 'SALE') await api.postSale(item.payload as SalePayload)
        if (item.type === 'CONTINGENCY_BATCH') await api.postBatch(item.payload as ContingencyBatchPayload)
        if (item.type === 'UNDO_LAST_SALE') await api.postUndo(item.payload as UndoLastSalePayload)
        await updatePendingQueueItem({ ...item, status: 'SYNCED', last_attempt_at: nowIso(), error_message: null })
      } catch (error) {
        await updatePendingQueueItem({ ...item, status: 'ERROR', last_attempt_at: nowIso(), error_message: (error as Error).message })
      }
    }
    setIsSyncing(false)
    setSyncMessage('Sincronizacion terminada.')
    await refreshData(user, business)
  }

  if (booting) return <div className="app">Cargando...</div>
  if (!user) return <LoginScreen error={loginError} loading={loggingIn} onLogin={handleLogin} />

  const selectedContent = (() => {
    if (user.rol === 'superadmin') {
      if (screen === 'businesses') return <BusinessesAdmin businesses={businesses} actor={user} onCreate={(input) => createBusiness(input, user).then(() => undefined)} onUpdate={(id, patch) => updateBusiness(id, patch, user).then(() => undefined)} />
      if (screen === 'users') return <UsersAdmin actor={user} businesses={businesses} users={users.filter((item) => item.rol !== 'superadmin')} currentTenantId={businesses[0]?.id ?? ''} allowTenantSelection onCreate={(input) => createUser(input, user).then(() => undefined)} onUpdate={(id, patch) => updateUser(id, patch, user).then(() => undefined)} onResetPassword={(id, password) => resetUserPassword(id, password, user).then(() => undefined)} />
      if (screen === 'audit') return <AuditScreen logs={auditLogs} />
      return (
        <div className="screen">
          <DashboardCards metrics={[
            { label: 'Negocios', value: globalMetrics?.total_businesses ?? 0, hint: `${globalMetrics?.active_businesses ?? 0} activos` },
            { label: 'Usuarios', value: globalMetrics?.total_users ?? 0, hint: `${globalMetrics?.active_users ?? 0} activos` },
            { label: 'Ventas', value: globalMetrics?.total_sales ?? 0 },
            { label: 'Ingresos', value: formatMoney(globalMetrics?.total_revenue ?? 0) }
          ]} />
          <div className="card"><h3>Ruta protegida superadmin</h3><p className="muted">Desde aqui puedes crear negocios, administrar usuarios, planes y modulos.</p></div>
        </div>
      )
    }

    if (screen === 'contingency') return <ContingencyScreen products={products} tenantId={tenantId} userId={user.id} onBack={() => setScreen('pos')} onSave={handleSaveBatch} />
    if (screen === 'por_pagar') {
      return (
        <PorPagarScreen
          orders={porPagarOrders}
          onBack={() => setScreen('pos')}
          onRegisterAbono={(orderId, amount, method, receivedAmount, changeAmount) => addPorPagarPayment(orderId, { id: uuid(), amount, method, captured_at: nowIso(), received_amount: receivedAmount, change_amount: changeAmount, usuario_id: user.id })}
          onCancel={(orderId) => cancelPorPagarOrder(orderId, nowIso())}
          onMarkDelivered={(orderId) => markPorPagarDelivered(orderId, nowIso())}
        />
      )
    }
    if (screen === 'inventory') {
      return <InventoryScreen tenantId={tenantId} products={products} canAdjust={hasPermission(user, 'inventory.adjust')} onSaveProduct={(product) => upsertProducts([product])} onAdjust={(productId, quantity, reason, confirmed) => adjustInventory({ tenant_id: tenantId, product_id: productId, quantity, motivo: reason, usuario_id: user.id, inventario_confirmado: confirmed }).then(() => undefined)} />
    }
    if (screen === 'users') {
      return <UsersAdmin actor={user} businesses={businesses.filter((item) => item.id === tenantId)} users={users} currentTenantId={tenantId} allowTenantSelection={false} onCreate={(input) => createUser(input, user).then(() => undefined)} onUpdate={(id, patch) => updateUser(id, patch, user).then(() => undefined)} onResetPassword={(id, password) => resetUserPassword(id, password, user).then(() => undefined)} />
    }
    if (screen === 'reports') return <ReportsScreen metrics={metrics ?? { total_sales: 0, total_revenue: 0, total_products: 0, low_stock_count: 0, unconfirmed_inventory_count: 0, active_users: 0 }} sales={sales as any} />
    if (screen === 'dashboard') {
      return <DashboardCards metrics={[
        { label: 'Ventas', value: metrics?.total_sales ?? 0 },
        { label: 'Ingresos', value: formatMoney(metrics?.total_revenue ?? 0) },
        { label: 'Productos', value: metrics?.total_products ?? 0 },
        { label: 'Stock bajo', value: metrics?.low_stock_count ?? 0, hint: `${metrics?.unconfirmed_inventory_count ?? 0} sin confirmar` }
      ]} />
    }
    return (
      <PosScreen
        products={products}
        catalogAvailable={products.length > 0}
        online={online}
        pendingCount={pendingCount}
        recentSales={recentSales}
        currentUser={user.nombre}
        userId={user.id}
        tenantId={tenantId}
        onSyncOpen={() => setSyncOpen(true)}
        onContingency={() => requestAdmin(() => setScreen('contingency'))}
        onUndo={() => requestAdmin(handleUndoRequest)}
        onRefreshCatalog={async () => {
          const fetched = await api.fetchProducts(tenantId)
          await upsertProducts(fetched.map((item) => ({ ...item, tenant_id: tenantId })))
          setMessage('Catalogo actualizado.')
        }}
        onOpenPorPagar={() => setScreen('por_pagar')}
        onConfirmSale={handleConfirmSale}
        onQuickAddProduct={async (product) => {
          await upsertProducts([product])
        }}
        onUpdateProduct={(product) => upsertProducts([{ ...product, updated_at: nowIso() }])}
        onConvertToPorPagar={async ({ cart, customer_name, customer_phone, anticipo }) => {
          const total = Number(cart.reduce((sum, item) => sum + item.qty * item.price_gross, 0).toFixed(2))
          const normalizedAnticipo = Number(Math.max(0, Math.min(total, anticipo)).toFixed(2))
          const order: PorPagarOrder = {
            id: uuid(),
            tenant_id: tenantId,
            usuario_id: user.id,
            folio: await nextPorPagarFolio(tenantId),
            sale_type: 'POR_PAGAR',
            customer_name,
            customer_phone,
            items: cart.map((item) => ({ product_id: item.product_id, barcode: item.barcode, sku: item.sku, name: item.name, unit_base: item.unit_base, type: item.type, pack_factor: item.pack_factor, qty: item.qty, qty_base: item.qty_base, price_gross: item.price_gross })),
            total,
            anticipo: normalizedAnticipo,
            balance: Number((total - normalizedAnticipo).toFixed(2)),
            status: total - normalizedAnticipo <= 0 ? 'LIQUIDADO' : 'ABIERTO',
            payment_history: normalizedAnticipo > 0 ? [{ id: uuid(), amount: normalizedAnticipo, method: 'EFECTIVO', captured_at: nowIso(), usuario_id: user.id }] : [],
            canceled_at: null,
            delivered_at: null,
            created_at: nowIso(),
            updated_at: nowIso()
          }
          await createPorPagarOrder(order)
          setMessage(`Apartado ${order.folio} creado.`)
        }}
      />
    )
  })()

  return (
    <div className="app">
      <div className="shell">
        <aside className="sidebar">
          <div>
            <div className="eyebrow">{user.rol === 'superadmin' ? 'Panel superadmin' : business?.nombre}</div>
            <h2>{user.nombre}</h2>
            <div className="muted">{user.email}</div>
            <div className="chip">{user.rol}</div>
          </div>
          <nav className="nav-list">
            {menu.map((item) => (
              <button key={item.key} className={screen === item.key ? 'btn primary full' : 'btn ghost full'} onClick={() => setScreen(item.key)}>{item.label}</button>
            ))}
          </nav>
          <button className="btn ghost full" onClick={handleLogout}>Cerrar sesion</button>
        </aside>

        <main className="main-panel">
          {message && <div className="toast">{message}</div>}
          {selectedContent}
        </main>
      </div>

      <SyncManager isOpen={syncOpen} pending={pending} lastSyncError={syncError} syncMessage={syncMessage} isSyncing={isSyncing} onClose={() => setSyncOpen(false)} onSync={syncPending} />
      <PinModal isOpen={pinOpen} title="PIN admin" description="Acceso restringido" error={pinError} lockedUntil={pinLockedUntil} onClose={() => setPinOpen(false)} onSubmit={verifyPin} />
      {undoSummary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Deshacer ultima venta</h2>
            <p className="muted">ID: {undoSummary.id}</p>
            <p>Hora: {new Date(undoSummary.at).toLocaleString()}</p>
            <p>Pago: {undoSummary.payment}</p>
            <p className="strong">Total: {formatMoney(undoSummary.total)}</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setUndoSummary(null)}>Cancelar</button>
              <button className="btn danger" onClick={confirmUndo}>Confirmar anulacion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


