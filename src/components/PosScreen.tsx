import { useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { CartItem, PaymentMethod, Product, SalePayload } from '../lib/types'
import { formatMoney, getRematePrice, nowIso, uuid } from '../lib/utils'
import CartTable from './CartTable'
import GranelModal from './GranelModal'
import RemateModal from './RemateModal'

interface PosScreenProps {
  products: Product[]
  catalogAvailable: boolean
  online: boolean
  pendingCount: number
  currentUser: string
  onSyncOpen: () => void
  onContingency: () => void
  onUndo: () => void
  onRefreshCatalog: () => void
  onConfirmSale: (payload: SalePayload) => void
  onQuickAddProduct: (product: Product) => void
  onUpdateProduct: (product: Product) => Promise<void>
}

export default function PosScreen({
  products,
  catalogAvailable,
  online,
  pendingCount,
  currentUser,
  onSyncOpen,
  onContingency,
  onUndo,
  onRefreshCatalog,
  onConfirmSale,
  onQuickAddProduct,
  onUpdateProduct
}: PosScreenProps) {
  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState<PaymentMethod | null>(null)
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

  const inputRef = useRef<HTMLInputElement | null>(null)
  const editingRef = useRef(false)

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price_gross, 0),
    [cart]
  )

  const catalogPreview = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    const list = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))
      : products
    return list.slice(0, 8)
  }, [catalogSearch, products])

  const focusBarcode = () => {
    requestAnimationFrame(() => {
      if (granelProduct) return
      if (editingRef.current) return
      inputRef.current?.focus()
    })
  }

  const handleFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (!target) return
    if (inputRef.current && target === inputRef.current) {
      editingRef.current = false
      return
    }
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      editingRef.current = true
    }
  }

  const handleBlurCapture = () => {
    setTimeout(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) {
        editingRef.current = false
        return
      }
      if (inputRef.current && el === inputRef.current) {
        editingRef.current = false
        return
      }
      editingRef.current = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
    }, 0)
  }

  const addToCart = (product: Product, qty: number) => {
    const remate = getRematePrice(product)
    const effectivePrice = remate?.price ?? product.price_gross
    const source = remate ? 'REMATE' : 'NORMAL'

    setCart((prev) => {
      const existing = prev.find((item) => item.barcode === product.barcode)
      const packFactor = product.pack_factor ?? 1

      if (existing) {
        const nextQty = existing.qty + qty
        const qtyBase = product.type === 'GRANEL' ? nextQty : nextQty * packFactor
        return prev.map((item) =>
          item.barcode === product.barcode
            ? { ...item, qty: nextQty, qty_base: qtyBase, price_gross: effectivePrice, price_source: source, remate_label: remate?.label ?? null }
            : item
        )
      }

      const displayUnit = product.type === 'PAQUETE' ? 'paquete' : product.unit_base
      const qtyBase = product.type === 'GRANEL' ? qty : qty * packFactor

      return [
        ...prev,
        {
          barcode: product.barcode,
          sku: product.sku,
          name: product.name,
          unit_base: product.unit_base,
          type: product.type,
          pack_factor: product.pack_factor,
          price_gross: effectivePrice,
          base_price_gross: product.price_gross,
          price_source: source,
          remate_label: remate?.label ?? null,
          tax_rate: product.tax_rate,
          qty,
          qty_base: qtyBase,
          display_unit: displayUnit
        }
      ]
    })
  }

  const handleScan = async () => {
    const code = barcode.trim()
    if (!code) return

    const local = products.find((p) => p.barcode === code)
    let product: Product | undefined = local

    if (!product && online) {
      try {
        product = (await api.lookupProduct(code)) ?? undefined
      } catch {
        product = undefined
      }
    }

    if (!product) {
      setAlert('Producto no encontrado.')
      setQuickAddAvailable(true)
      setQuickAddOpen(false)
      return
    }

    setAlert(null)
    setQuickAddAvailable(false)
    setQuickAddOpen(false)

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
    setCart((prev) => {
      const raw = String(input ?? '').trim().replace(',', '.')
      const q = Number(raw)

      if (raw === '') return prev
      if (!Number.isFinite(q)) return prev
      if (q <= 0) return prev.filter((it) => it.barcode !== barcodeValue)

      return prev.map((it) => {
        if (it.barcode !== barcodeValue) return it

        const isPiece = it.display_unit === 'pza'
        const qty = isPiece ? Math.round(q) : q
        const packFactor = it.pack_factor ?? 1
        const qty_base = it.type === 'GRANEL' ? qty : qty * packFactor

        return { ...it, qty, qty_base }
      })
    })
  }

  const removeItem = (barcodeValue: string) => {
    setCart((prev) => prev.filter((item) => item.barcode !== barcodeValue))
  }

  const confirmSale = () => {
    if (cart.length === 0) {
      setAlert('Carrito vacío.')
      return
    }
    if (!payment) {
      setAlert('Selecciona método de pago.')
      return
    }

    const payload: SalePayload = {
      local_id: uuid(),
      captured_at: nowIso(),
      user: currentUser,
      payment_method: payment,
      items: cart.map((item) => ({
        barcode: item.barcode,
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        unit_base: item.unit_base,
        qty_base: item.qty_base,
        price_gross: item.price_gross,
        base_price_gross: item.base_price_gross,
        price_source: item.price_source,
        remate_label: item.remate_label ?? null,
        tax_rate: item.tax_rate,
        type: item.type,
        pack_factor: item.pack_factor
      }))
    }

    onConfirmSale(payload)
    setCart([])
    setPayment(null)
    setAlert(null)
    focusBarcode()
  }

  const handleQuickAdd = () => {
    if (!quickName.trim()) {
      setAlert('Nombre requerido en alta rápida.')
      return
    }

    const price = Number.parseFloat(quickPrice.replace(',', '.'))
    if (!Number.isFinite(price) || price <= 0) {
      setAlert('Precio inválido.')
      return
    }

    const newProduct: Product = {
      barcode: barcode.trim() || `LOCAL-${Date.now()}`,
      sku: `LOCAL-${Date.now()}`,
      name: quickName.trim(),
      unit_base: quickUnit,
      type: quickType,
      pack_factor: quickType === 'PAQUETE' ? 1 : null,
      price_gross: price,
      tax_rate: 0.16,
      active: true,
      stock_snapshot: null,
      remate_enabled: false,
      remate_type: null,
      remate_value: null,
      remate_start_at: null,
      remate_end_at: null,
      remate_marked_at: null,
      remate_marked_by: null
    }

    onQuickAddProduct(newProduct)
    setQuickAddOpen(false)
    setQuickAddAvailable(false)
    setQuickName('')
    setQuickPrice('')
    addToCart(newProduct, 1)
    setBarcode('')
    focusBarcode()
  }

  return (
    <div className="screen" onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
      <header className="header">
        <div className="status">
          <span className={online ? 'pill online' : 'pill offline'}>
            {online ? 'Online' : 'Offline'}
          </span>
          <span className="pill">Pendientes: {pendingCount}</span>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={onRefreshCatalog}>Actualizar catálogo</button>
          <button className="btn ghost" onClick={onSyncOpen}>Sincronizar</button>
          <button className="btn warning" onClick={onContingency}>Modo contingencia</button>
          <button className="btn danger" onClick={onUndo}>? Deshacer última venta</button>
        </div>
      </header>

      {!catalogAvailable && (
        <div className="alert alert-error">Catálogo no disponible, sincroniza cuando tengas internet.</div>
      )}

      <section className="scan-zone">
        <div>
          <label>Barcode</label>
          <input
            ref={inputRef}
            autoFocus
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          />
        </div>
        <button className="btn primary" onClick={handleScan}>Agregar</button>
      </section>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Catálogo rápido</h3>
          <input
            style={{ maxWidth: 320 }}
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Buscar producto"
          />
        </div>
        <table className="cart-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Remate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {catalogPreview.map((product) => {
              const remate = getRematePrice(product)
              return (
                <tr key={product.barcode}>
                  <td>{product.name}</td>
                  <td>{formatMoney(product.price_gross)}</td>
                  <td>
                    {remate ? <span className="chip remate">{remate.label}: {formatMoney(remate.price)}</span> : <span className="muted">No</span>}
                  </td>
                  <td><button className="btn ghost" onClick={() => setRemateProduct(product)}>Marcar remate</button></td>
                </tr>
              )
            })}
            {catalogPreview.length === 0 && (
              <tr><td colSpan={4} className="muted center">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {alert && (
        <div className="alert alert-error">
          {alert}
          {quickAddAvailable && <button className="btn ghost" onClick={() => setQuickAddOpen(true)}>Alta rápida</button>}
        </div>
      )}

      {quickAddOpen && (
        <div className="card">
          <h3>Alta rápida</h3>
          <div className="row gap">
            <input placeholder="Nombre" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
            <input placeholder="Precio" value={quickPrice} onChange={(e) => setQuickPrice(e.target.value)} />
            <select value={quickUnit} onChange={(e) => setQuickUnit(e.target.value as Product['unit_base'])}>
              <option value="pza">pza</option>
              <option value="kg">kg</option>
              <option value="m">m</option>
              <option value="lt">lt</option>
              <option value="ml">ml</option>
            </select>
            <select value={quickType} onChange={(e) => setQuickType(e.target.value as Product['type'])}>
              <option value="PIEZA">PIEZA</option>
              <option value="GRANEL">GRANEL</option>
              <option value="PAQUETE">PAQUETE</option>
            </select>
            <button className="btn primary" onClick={handleQuickAdd}>Guardar</button>
          </div>
        </div>
      )}

      <CartTable items={cart} onUpdateQty={updateQty} onRemove={removeItem} />

      <div className="totals">
        <div className="total">Total: {formatMoney(total)}</div>
        <div className="payment">
          <button className={payment === 'EFECTIVO' ? 'btn primary' : 'btn ghost'} onClick={() => setPayment('EFECTIVO')}>Efectivo</button>
          <button className={payment === 'TARJETA' ? 'btn primary' : 'btn ghost'} onClick={() => setPayment('TARJETA')}>Tarjeta</button>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setCart([])}>Cancelar</button>
          <button className="btn success" onClick={confirmSale}>Confirmar venta</button>
        </div>
      </div>

      <GranelModal
        isOpen={Boolean(granelProduct)}
        productName={granelProduct?.name ?? ''}
        unit={granelProduct?.unit_base ?? ''}
        onCancel={() => {
          setGranelProduct(null)
          focusBarcode()
        }}
        onConfirm={(qty) => {
          if (granelProduct) addToCart(granelProduct, qty)
          setGranelProduct(null)
          setBarcode('')
          focusBarcode()
        }}
      />

      <RemateModal
        isOpen={Boolean(remateProduct)}
        product={remateProduct}
        currentUser={currentUser}
        onClose={() => setRemateProduct(null)}
        onSave={async (product) => {
          await onUpdateProduct(product)
          setRemateProduct(null)
          setAlert('Remate actualizado.')
        }}
      />
    </div>
  )
}