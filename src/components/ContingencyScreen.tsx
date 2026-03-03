import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { ContingencyBatchPayload, ContingencyLine, PaymentMethod, Product } from '../lib/types'
import { formatMoney, nowIso, uuid } from '../lib/utils'
import { nextContingencyFolio } from '../lib/db'

interface ContingencyScreenProps {
  products: Product[]
  onBack: () => void
  onSave: (payload: ContingencyBatchPayload) => void
}

export default function ContingencyScreen({ products, onBack, onSave }: ContingencyScreenProps) {
  const [folio, setFolio] = useState('')
  const [note, setNote] = useState('')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1.00')
  const [payment, setPayment] = useState<PaymentMethod>('EFECTIVO')
  const [lines, setLines] = useState<ContingencyLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    nextContingencyFolio().then(setFolio)
  }, [])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const totals = useMemo(() => {
    const efectivo = lines
      .filter((l) => l.payment_method === 'EFECTIVO')
      .reduce((sum, l) => sum + l.qty * l.price_gross, 0)
    const tarjeta = lines
      .filter((l) => l.payment_method === 'TARJETA')
      .reduce((sum, l) => sum + l.qty * l.price_gross, 0)
    return { efectivo, tarjeta, total: efectivo + tarjeta }
  }, [lines])

  const handleAdd = async () => {
    if (!barcode.trim()) return
    const local = products.find((p) => p.barcode === barcode.trim())
    let product: Product | undefined = local
    if (!product && navigator.onLine) {
      try {
        product = (await api.lookupProduct(barcode.trim())) ?? undefined
      } catch {
        product = undefined
      }
    }
    if (!product) {
      setError('Producto no encontrado en catálogo.')
      return
    }
    const qtyValue = Number.parseFloat(qty.replace(',', '.'))
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      setError('Cantidad inválida.')
      return
    }
    setLines((prev) => [
      ...prev,
      {
        barcode: product.barcode,
        sku: product.sku,
        name: product.name,
        qty: qtyValue,
        unit_base: product.unit_base,
        price_gross: product.price_gross,
        tax_rate: product.tax_rate,
        payment_method: payment
      }
    ])
    setBarcode('')
    setQty('1.00')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const updateLine = (index: number, next: Partial<ContingencyLine>) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...next } : line)))
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSave = () => {
    if (!note.trim()) {
      setError('La nota es obligatoria.')
      return
    }
    if (lines.length === 0) {
      setError('Agrega al menos una línea.')
      return
    }
    const payload: ContingencyBatchPayload = {
      local_batch_id: uuid(),
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
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Apagón 14:00–17:00" />
          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="card">
          <div className="row gap">
            <div className="grow">
              <label>Barcode</label>
              <input
                ref={inputRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
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
          <button className="btn primary" onClick={handleAdd}>Agregar línea</button>
        </div>
      </div>

      <div className="card">
        <table className="cart-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Qty</th>
              <th>Unidad</th>
              <th>Pago</th>
              <th>Precio</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={7} className="muted center">Sin líneas</td></tr>
            )}
            {lines.map((line, index) => (
              <tr key={`${line.barcode}-${index}`}>
                <td>{line.name}</td>
                <td>
                  <input
                    className="qty-input"
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: Number.parseFloat(e.target.value) })}
                  />
                </td>
                <td>{line.unit_base}</td>
                <td>
                  <select
                    value={line.payment_method}
                    onChange={(e) => updateLine(index, { payment_method: e.target.value as PaymentMethod })}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </td>
                <td>{formatMoney(line.price_gross)}</td>
                <td>{formatMoney(line.qty * line.price_gross)}</td>
                <td>
                  <button className="btn ghost" onClick={() => removeLine(index)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals">
        <div>Efectivo: {formatMoney(totals.efectivo)}</div>
        <div>Tarjeta: {formatMoney(totals.tarjeta)}</div>
        <div className="strong">Total: {formatMoney(totals.total)}</div>
        <button className="btn primary" onClick={handleSave}>Guardar lote</button>
      </div>
    </div>
  )
}
