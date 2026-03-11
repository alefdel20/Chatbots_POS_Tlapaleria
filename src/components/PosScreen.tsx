import { useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { CartItem, FiscalData, PaymentMethod, Product, SalePayload } from '../lib/types'
import { formatMoney, getRematePrice, nowIso, toNumber, uuid } from '../lib/utils'
import CartTable from './CartTable'
import GranelModal from './GranelModal'
import InvoicePromptModal from './InvoicePromptModal'
import PorPagarModal from './PorPagarModal'
import RecentSalesHistory from './RecentSalesHistory'
import RemateModal from './RemateModal'
import { RecentSaleEntry } from '../lib/recentSales'

const isLikelyBarcode = (value: string) => /^[0-9]{8,}$/.test(value.trim())

interface PosScreenProps {
  products: Product[]
  catalogAvailable: boolean
  online: boolean
  pendingCount: number
  recentSales: RecentSaleEntry[]
  currentUser: string
  userId: string
  tenantId: string
  onSyncOpen: () => void
  onContingency: () => void
  onUndo: () => void
  onRefreshCatalog: () => void
  onOpenPorPagar: () => void
  onConfirmSale: (payload: SalePayload) => void
  onQuickAddProduct: (product: Product) => void
  onUpdateProduct: (product: Product) => Promise<void>
  onConvertToPorPagar: (payload: { cart: CartItem[]; customer_name: string; customer_phone: string; anticipo: number }) => Promise<void>
}

export default function PosScreen(props: PosScreenProps) {
  const {
    products,
    catalogAvailable,
    online,
    pendingCount,
    recentSales,
    currentUser,
    userId,
    tenantId,
    onSyncOpen,
    onContingency,
    onUndo,
    onRefreshCatalog,
    onOpenPorPagar,
    onConfirmSale,
    onQuickAddProduct,
    onUpdateProduct,
    onConvertToPorPagar
  } = props

  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState<PaymentMethod | null>(null)
  const [fiscalData, setFiscalData] = useState<FiscalData>({ wants_invoice: false })
  const [alert, setAlert] = useState<string | null>(null)
  const [granelProduct, setGranelProduct] = useState<Product | null>(null)
  const [remateProduct, setRemateProduct] = useState<Product | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddAvailable, setQuickAddAvailable] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPrice, setQuickPrice] = useState('')
  const [quickUnit, setQuickUnit] = useState<Product['unit_base']>('pza')
  const [quickType, setQuickType] = useState<Product['type']>('PIEZA')
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PaymentMethod>('EFECTIVO')
  const [porPagarOpen, setPorPagarOpen] = useState(false)
  const [cashReceivedText, setCashReceivedText] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price_gross, 0), [cart])
  const cashReceived = toNumber(cashReceivedText)
  const cashChange = payment === 'EFECTIVO' ? Math.max(0, Number((cashReceived - total).toFixed(2))) : 0

  const scanSuggestions = useMemo(() => {
    const q = barcode.trim().toLowerCase()
    if (!q || isLikelyBarcode(q)) return []
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8)
  }, [barcode, products])

  const catalogPreview = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)) : products
    return filtered.slice(0, 8)
  }, [catalogSearch, products])

  const focusBarcode = () => requestAnimationFrame(() => inputRef.current?.focus())

  const addToCart = (product: Product, qty: number) => {
    if (!product?.barcode || qty <= 0) return
    const remate = getRematePrice(product)
    const price = remate?.price ?? product.precio_venta
    const price_source = remate ? 'REMATE' : 'NORMAL'
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id)
      const packFactor = product.pack_factor ?? 1
      const nextQty = existing ? existing.qty + qty : qty
      const qty_base = product.type === 'GRANEL' ? nextQty : nextQty * packFactor
      if (existing) {
        return prev.map((item) => item.product_id === product.id ? { ...item, qty: nextQty, qty_base, price_gross: price, price_source, remate_label: remate?.label ?? null } : item)
      }
      return [...prev, {
        product_id: product.id,
        barcode: product.barcode,
        sku: product.sku,
        name: product.name,
        unit_base: product.unit_base,
        type: product.type,
        pack_factor: product.pack_factor,
        price_gross: price,
        base_price_gross: product.precio_venta,
        price_source,
        remate_label: remate?.label ?? null,
        tax_rate: product.tax_rate,
        qty,
        qty_base,
        display_unit: product.type === 'PAQUETE' ? 'paquete' : product.unit_base
      }]
    })
  }

  const handleScan = async () => {
    const code = barcode.trim()
    if (!code) return
    let product = products.find((p) => p.barcode === code)
    if (!product && !isLikelyBarcode(code) && scanSuggestions.length > 0) product = scanSuggestions[0]
    if (!product && online) {
      try {
        product = (await api.lookupProduct(tenantId, code)) ?? undefined
      } catch {
        product = undefined
      }
    }
    if (!product) {
      setAlert('Producto no encontrado.')
      setQuickAddAvailable(true)
      return
    }
    setAlert(null)
    setQuickAddAvailable(false)
    if (product.type === 'GRANEL') {
      setGranelProduct(product)
      setBarcode('')
      return
    }
    addToCart(product, 1)
    setBarcode('')
    focusBarcode()
  }

  const updateQty = (barcodeValue: string, input: number | string) => {
    const raw = String(input ?? '').trim().replace(',', '.')
    const q = Number(raw)
    if (!Number.isFinite(q)) return
    setCart((prev) => q <= 0 ? prev.filter((item) => item.barcode !== barcodeValue) : prev.map((item) => {
      if (item.barcode !== barcodeValue) return item
      const qty = item.display_unit === 'pza' ? Math.round(q) : q
      const qty_base = item.type === 'GRANEL' ? qty : qty * (item.pack_factor ?? 1)
      return { ...item, qty, qty_base }
    }))
  }

  const confirmSale = () => {
    if (!cart.length) return setAlert('Carrito vacio.')
    if (!payment) return setAlert('Selecciona metodo de pago.')
    if (payment === 'EFECTIVO' && cashReceived < total) return setAlert('Monto recibido insuficiente.')
    const payload: SalePayload = {
      local_id: uuid(),
      tenant_id: tenantId,
      usuario_id: userId,
      captured_at: nowIso(),
      user: currentUser,
      sale_type: 'VENTA',
      payment_method: payment,
      amount_received: payment === 'EFECTIVO' ? cashReceived : undefined,
      change_amount: payment === 'EFECTIVO' ? cashChange : undefined,
      fiscal_data: fiscalData,
      items: cart.map((item) => ({ ...item }))
    }
    onConfirmSale(payload)
    setCart([])
    setPayment(null)
    setCashReceivedText('')
    setFiscalData({ wants_invoice: false })
    setAlert(null)
  }

  const handleQuickAdd = () => {
    const price = Number.parseFloat(quickPrice.replace(',', '.'))
    if (!quickName.trim()) return setAlert('Nombre requerido en alta rapida.')
    if (!Number.isFinite(price) || price <= 0) return setAlert('Precio invalido.')
    const timestamp = nowIso()
    const product: Product = {
      id: uuid(),
      tenant_id: tenantId,
      barcode: barcode.trim() || `LOCAL-${Date.now()}`,
      sku: `LOCAL-${Date.now()}`,
      name: quickName.trim(),
      categoria: 'Alta rapida',
      unit_base: quickUnit,
      type: quickType,
      pack_factor: quickType === 'PAQUETE' ? 1 : null,
      precio_compra: Number((price * 0.7).toFixed(2)),
      precio_venta: price,
      tax_rate: 0.16,
      stock_actual: null,
      stock_minimo: 1,
      inventario_confirmado: false,
      active: true,
      remate_enabled: false,
      remate_type: null,
      remate_value: null,
      remate_start_at: null,
      remate_end_at: null,
      remate_marked_at: null,
      remate_marked_by: null,
      created_at: timestamp,
      updated_at: timestamp
    }
    onQuickAddProduct(product)
    setQuickAddOpen(false)
    setQuickAddAvailable(false)
    setQuickName('')
    setQuickPrice('')
    addToCart(product, 1)
    setBarcode('')
  }

  return (
    <div className="screen">
      <header className="header">
        <div className="status">
          <span className={online ? 'pill online' : 'pill offline'}>{online ? 'Online' : 'Offline'}</span>
          <span className="pill">Pendientes: {pendingCount}</span>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={onRefreshCatalog}>Actualizar catalogo</button>
          <button className="btn ghost" onClick={onOpenPorPagar}>Por pagar</button>
          <button className="btn ghost" onClick={onSyncOpen}>Sincronizar</button>
          <button className="btn warning" onClick={onContingency}>Modo contingencia</button>
          <button className="btn danger" onClick={onUndo}>Deshacer ultima venta</button>
        </div>
      </header>

      {!catalogAvailable && <div className="alert alert-error">Catalogo no disponible.</div>}

      <section className="scan-zone">
        <div>
          <label>Barcode / Nombre / SKU</label>
          <input ref={inputRef} autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleScan()} />
          {scanSuggestions.length > 0 && (
            <div className="suggestions">
              {scanSuggestions.map((item) => (
                <button key={item.id} className="suggestion-item" onClick={() => item.type === 'GRANEL' ? setGranelProduct(item) : addToCart(item, 1)}>
                  <span>{item.name}</span>
                  <span className="muted">{item.sku}</span>
                  <span>{formatMoney(item.precio_venta)}</span>
                  <span className="muted">Stock: {item.stock_actual ?? 'N/A'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn primary" onClick={handleScan}>Agregar</button>
      </section>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Catalogo rapido</h3>
          <input style={{ maxWidth: 320 }} value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Buscar producto" />
        </div>
        <table className="cart-table">
          <thead>
            <tr><th>Producto</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {catalogPreview.map((product) => {
              const remate = getRematePrice(product)
              return (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{formatMoney(product.precio_venta)}</td>
                  <td>
                    {product.stock_actual !== null && product.stock_actual <= product.stock_minimo ? <span className="chip chip-danger">Stock bajo</span> : <span className="muted">{product.inventario_confirmado ? 'Inventario confirmado' : 'Inventario no confirmado'}</span>}
                    {remate && <span className="chip remate">{remate.label}</span>}
                  </td>
                  <td className="row">
                    <button className="btn primary" onClick={() => product.type === 'GRANEL' ? setGranelProduct(product) : addToCart(product, 1)}>Agregar</button>
                    <button className="btn ghost" onClick={() => setRemateProduct(product)}>Remate</button>
                  </td>
                </tr>
              )
            })}
            {catalogPreview.length === 0 && <tr><td colSpan={4} className="muted center">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      {alert && <div className="alert alert-error">{alert}{quickAddAvailable && <button className="btn ghost" onClick={() => setQuickAddOpen(true)}>Alta rapida</button>}</div>}

      {quickAddOpen && (
        <div className="card">
          <h3>Alta rapida</h3>
          <div className="row gap">
            <input placeholder="Nombre" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
            <input placeholder="Precio" value={quickPrice} onChange={(e) => setQuickPrice(e.target.value)} />
            <select value={quickUnit} onChange={(e) => setQuickUnit(e.target.value as Product['unit_base'])}>
              <option value="pza">pza</option><option value="kg">kg</option><option value="m">m</option><option value="lt">lt</option><option value="ml">ml</option>
            </select>
            <select value={quickType} onChange={(e) => setQuickType(e.target.value as Product['type'])}>
              <option value="PIEZA">PIEZA</option><option value="GRANEL">GRANEL</option><option value="PAQUETE">PAQUETE</option>
            </select>
            <button className="btn primary" onClick={handleQuickAdd}>Guardar</button>
          </div>
        </div>
      )}

      <CartTable items={cart} onUpdateQty={updateQty} onRemove={(code) => setCart((prev) => prev.filter((item) => item.barcode !== code))} />

      <div className="totals">
        <div className="total">Total: {formatMoney(total)}</div>
        <div className="payment">
          <button className={payment === 'EFECTIVO' ? 'btn primary' : 'btn ghost'} onClick={() => { setPendingPayment('EFECTIVO'); setInvoiceModalOpen(true) }}>Efectivo</button>
          <button className={payment === 'TARJETA' ? 'btn primary' : 'btn ghost'} onClick={() => { setPendingPayment('TARJETA'); setInvoiceModalOpen(true); setCashReceivedText('') }}>Tarjeta</button>
        </div>
        {payment === 'EFECTIVO' && (
          <div className="card cash-box">
            <label>Recibido</label>
            <input value={cashReceivedText} onChange={(e) => setCashReceivedText(e.target.value)} placeholder="0.00" />
            <div className="muted">Cambio: {formatMoney(cashChange)}</div>
          </div>
        )}
        <div className="actions">
          <button className="btn ghost" onClick={() => setCart([])}>Cancelar</button>
          <button className="btn warning" onClick={() => setPorPagarOpen(true)} disabled={!cart.length}>Convertir a Por pagar</button>
          <button className="btn success" onClick={confirmSale}>Confirmar venta</button>
        </div>
      </div>

      <RecentSalesHistory sales={recentSales} />

      <GranelModal isOpen={Boolean(granelProduct)} productName={granelProduct?.name ?? ''} unit={granelProduct?.unit_base ?? ''} onCancel={() => setGranelProduct(null)} onConfirm={(qty) => { if (granelProduct) addToCart(granelProduct, qty); setGranelProduct(null); setBarcode(''); focusBarcode() }} />
      <RemateModal isOpen={Boolean(remateProduct)} product={remateProduct} currentUser={currentUser} onClose={() => setRemateProduct(null)} onSave={async (product) => { await onUpdateProduct(product); setRemateProduct(null) }} />
      <InvoicePromptModal isOpen={invoiceModalOpen} paymentLabel={pendingPayment === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'} initial={fiscalData} onClose={() => setInvoiceModalOpen(false)} onConfirm={(data) => { setFiscalData(data); setPayment(pendingPayment); if (pendingPayment !== 'EFECTIVO') setCashReceivedText(''); setInvoiceModalOpen(false) }} />
      <PorPagarModal isOpen={porPagarOpen} total={total} onClose={() => setPorPagarOpen(false)} onConfirm={async (data) => { await onConvertToPorPagar({ cart, ...data }); setPorPagarOpen(false); setCart([]); setPayment(null); setFiscalData({ wants_invoice: false }); }} />
    </div>
  )
}
