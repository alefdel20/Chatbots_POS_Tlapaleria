import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { ContingencyBatchPayload, ContingencyLine, PaymentMethod, Product } from '../lib/types'
import { formatMoney, nowIso, uuid } from '../lib/utils'
import { nextContingencyFolio } from '../lib/db'

interface ContingencyScreenProps {
  products: Product[]
  tenantId: string
  userId: string
  onBack: () => void
  onSave: (payload: ContingencyBatchPayload) => void
}

export default function ContingencyScreen({ products, tenantId, userId, onBack, onSave }: ContingencyScreenProps) {
  const [folio, setFolio] = useState('')
  const [note, setNote] = useState('')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1.00')
  const [payment, setPayment] = useState<PaymentMethod>('EFECTIVO')
  const [lines, setLines] = useState<ContingencyLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    nextContingencyFolio(tenantId).then(setFolio)
  }, [tenantId])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const totals = useMemo(() => {
    const efectivo = lines.filter((line) => line.payment_method === 'EFECTIVO').reduce((sum, line) => sum + line.qty * line.price_gross, 0)
    const tarjeta = lines.filter((line) => line.payment_method === 'TARJETA').reduce((sum, line) => sum + line.qty * line.price_gross, 0)
    return { efectivo, tarjeta, total: efectivo + tarjeta }
  }, [lines])

  const handleAdd = async () => {
    if (!barcode.trim()) return
    let product = products.find((item) => item.barcode === barcode.trim())
    if (!product && navigator.onLine) {
      try {
        product = (await api.lookupProduct(tenantId, barcode.trim())) ?? undefined
      } catch {
        product = undefined
      }
    }
    if (!product) return setError('Producto no encontrado.')
    const qtyValue = Number.parseFloat(qty.replace(',', '.'))
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) return setError('Cantidad invalida.')
    setLines((prev) => [
      ...prev,
      {
        product_id: product.id,
        barcode: product.barcode,
        sku: product.sku,
        name: product.name,
        qty: qtyValue,
        unit_base: product.unit_base,
        price_gross: product.precio_venta,
        tax_rate: product.tax_rate,
        payment_method: payment
      }
    ])
    setBarcode('')
    setQty('1.00')
    setError(null)
  }

  const save = () => {
    if (!note.trim()) return setError('La nota es obligatoria.')
    if (!lines.length) return setError('Agrega al menos una linea.')
    const payload: ContingencyBatchPayload = {
      local_batch_id: uuid(),
      tenant_id: tenantId,
      usuario_id: userId,
      captured_at: nowIso(),
      note: note.trim(),
      folio_lote: folio,
      lines
    }
    onSave(payload)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1>Modo contingencia</h1>
          <div className="muted">Folio: {folio}</div>
        </div>
        <button className="btn ghost" onClick={onBack}>Volver</button>
      </div>

      <div className="grid two">
        <div className="card">
          <label>Nota obligatoria</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="card">
          <div className="row gap">
            <div className="grow">
              <label>Barcode</label>
              <input ref={inputRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            </div>
            <div>
              <label>Qty</label>
              <input value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label>Pago</label>
              <div className="segmented">
                <button className={payment === 'EFECTIVO' ? 'active' : ''} onClick={() => setPayment('EFECTIVO')}>Efectivo</button>
                <button className={payment === 'TARJETA' ? 'active' : ''} onClick={() => setPayment('TARJETA')}>Tarjeta</button>
              </div>
            </div>
          </div>
          <button className="btn primary" onClick={handleAdd}>Agregar linea</button>
        </div>
      </div>

      <div className="card">
        <table className="cart-table">
          <thead>
            <tr><th>Producto</th><th>Qty</th><th>Pago</th><th>Precio</th><th>Subtotal</th><th></th></tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={6} className="muted center">Sin lineas</td></tr>}
            {lines.map((line, index) => (
              <tr key={`${line.barcode}-${index}`}>
                <td>{line.name}</td>
                <td><input className="qty-input" value={line.qty} onChange={(e) => setLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, qty: Number.parseFloat(e.target.value) || 0 } : row))} /></td>
                <td>{line.payment_method}</td>
                <td>{formatMoney(line.price_gross)}</td>
                <td>{formatMoney(line.qty * line.price_gross)}</td>
                <td><button className="btn ghost" onClick={() => setLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals">
        <div>Efectivo: {formatMoney(totals.efectivo)}</div>
        <div>Tarjeta: {formatMoney(totals.tarjeta)}</div>
        <div className="strong">Total: {formatMoney(totals.total)}</div>
        <button className="btn primary" onClick={save}>Guardar lote</button>
      </div>
    </div>
  )
}


