import { useMemo, useState } from 'react'
import { Product } from '../lib/types'
import { formatMoney } from '../lib/utils'

interface InventoryScreenProps {
  tenantId: string
  products: Product[]
  canAdjust: boolean
  onSaveProduct: (product: Product) => Promise<void>
  onAdjust: (productId: string, quantity: number, reason: string, confirmed: boolean) => Promise<void>
}

export default function InventoryScreen({ tenantId, products, canAdjust, onSaveProduct, onAdjust }: InventoryScreenProps) {
  const [search, setSearch] = useState('')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('0')
  const [newSku, setNewSku] = useState('')
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) => {
      if (onlyAlerts && !(product.stock_actual !== null && product.stock_actual <= product.stock_minimo || !product.inventario_confirmado)) return false
      if (!q) return true
      return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q) || product.barcode.includes(q)
    })
  }, [onlyAlerts, products, search])

  return (
    <div className="grid two">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Inventario</h3>
          <input style={{ maxWidth: 260 }} placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={onlyAlerts} onChange={() => setOnlyAlerts((prev) => !prev)} />
          <span>Solo stock bajo o no confirmado</span>
        </label>
        <table className="cart-table">
          <thead>
            <tr><th>Producto</th><th>Venta</th><th>Stock</th><th>Estado</th><th>Ajuste</th></tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="strong">{product.name}</div>
                  <div className="muted">{product.sku} / {product.barcode}</div>
                </td>
                <td>{formatMoney(product.precio_venta)}</td>
                <td>{product.stock_actual ?? 'N/A'}</td>
                <td>
                  {product.stock_actual !== null && product.stock_actual <= product.stock_minimo && <div className="chip chip-danger">Stock bajo</div>}
                  {!product.inventario_confirmado && <div className="chip">No confirmado</div>}
                </td>
                <td>
                  <div className="row wrap">
                    <input className="qty-input" placeholder="+/-" value={adjustments[product.id] ?? ''} onChange={(e) => setAdjustments((prev) => ({ ...prev, [product.id]: e.target.value }))} />
                    <button className="btn ghost" disabled={!canAdjust} onClick={() => onAdjust(product.id, Number(adjustments[product.id] ?? 0), 'Ajuste manual', true)}>Aplicar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="muted center">Sin productos</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Alta rapida inventario</h3>
        <label>Nombre</label>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        <label>SKU</label>
        <input value={newSku} onChange={(e) => setNewSku(e.target.value)} />
        <label>Precio venta</label>
        <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        <button className="btn primary" onClick={async () => {
          const now = new Date().toISOString()
          await onSaveProduct({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            barcode: `INV-${Date.now()}`,
            sku: newSku || `INV-${Date.now()}`,
            name: newName,
            categoria: 'Alta rapida',
            unit_base: 'pza',
            type: 'PIEZA',
            pack_factor: null,
            precio_compra: Number(newPrice) * 0.7,
            precio_venta: Number(newPrice),
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
            created_at: now,
            updated_at: now
          })
          setNewName('')
          setNewSku('')
          setNewPrice('0')
        }}>Guardar producto</button>
      </div>
    </div>
  )
}


