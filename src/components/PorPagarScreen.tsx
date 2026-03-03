import { useMemo, useState } from 'react'
import { PaymentMethod, PorPagarOrder } from '../lib/types'
import { formatMoney, toNumber } from '../lib/utils'

interface PorPagarScreenProps {
  orders: PorPagarOrder[]
  onBack: () => void
  onRegisterAbono: (
    orderId: string,
    amount: number,
    method: PaymentMethod,
    receivedAmount?: number,
    changeAmount?: number
  ) => Promise<void>
  onCancel: (orderId: string) => Promise<void>
  onMarkDelivered: (orderId: string) => Promise<void>
}

export default function PorPagarScreen({
  orders,
  onBack,
  onRegisterAbono,
  onCancel,
  onMarkDelivered
}: PorPagarScreenProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [abonoOpen, setAbonoOpen] = useState(false)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('EFECTIVO')
  const [abonoReceived, setAbonoReceived] = useState('')
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((order) =>
      order.folio.toLowerCase().includes(q) ||
      order.customer_name.toLowerCase().includes(q) ||
      order.customer_phone.toLowerCase().includes(q)
    )
  }, [orders, search])

  const selected = useMemo(() => {
    if (selectedId) return orders.find((order) => order.id === selectedId) ?? null
    return filtered[0] ?? null
  }, [orders, filtered, selectedId])

  const submitAbono = async () => {
    if (!selected) return
    const amount = toNumber(abonoAmount)
    if (amount <= 0) {
      setError('Monto de abono invalido.')
      return
    }
    const receivedAmount = toNumber(abonoReceived)
    const changeAmount = Math.max(0, Number((receivedAmount - amount).toFixed(2)))
    if (abonoMethod === 'EFECTIVO' && receivedAmount < amount) {
      setError('Recibido insuficiente para cubrir el abono.')
      return
    }
    setError(null)
    await onRegisterAbono(
      selected.id,
      amount,
      abonoMethod,
      abonoMethod === 'EFECTIVO' ? receivedAmount : undefined,
      abonoMethod === 'EFECTIVO' ? changeAmount : undefined
    )
    setAbonoAmount('')
    setAbonoMethod('EFECTIVO')
    setAbonoReceived('')
    setAbonoOpen(false)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1>Por pagar</h1>
          <div className="muted">Apartados</div>
        </div>
        <button className="btn ghost" onClick={onBack}>Volver</button>
      </div>

      <div className="grid two">
        <div className="card">
          <label>Buscar por folio o cliente</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, nombre o telefono" />

          <div className="pending-list">
            {filtered.map((order) => (
              <div
                key={order.id}
                className="pending-item"
                onClick={() => setSelectedId(order.id)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div className="strong">{order.folio}</div>
                  <div>{order.customer_name}</div>
                  <div className="muted">{order.customer_phone}</div>
                </div>
                <div>
                  <div>Total: {formatMoney(order.total)}</div>
                  <div>Saldo: {formatMoney(order.balance)}</div>
                  <div className={`status status-${order.status.toLowerCase()}`}>{order.status}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="muted center">Sin apartados</div>}
          </div>
        </div>

        <div className="card">
          {!selected && <div className="muted">Selecciona un apartado para ver detalle.</div>}
          {selected && (
            <>
              <h3>Detalle {selected.folio}</h3>
              <div>Cliente: {selected.customer_name}</div>
              <div>Telefono: {selected.customer_phone}</div>
              <div>Total: {formatMoney(selected.total)}</div>
              <div>Anticipo: {formatMoney(selected.anticipo)}</div>
              <div className="strong">Saldo: {formatMoney(selected.balance)}</div>
              <div>
                Estatus: <span className={`status status-${selected.status.toLowerCase()}`}>{selected.status}</span>
              </div>
              <div className="muted">Creado: {new Date(selected.created_at).toLocaleString()}</div>
              {selected.canceled_at && <div className="muted">Cancelado: {new Date(selected.canceled_at).toLocaleString()}</div>}
              {selected.delivered_at && <div className="muted">Entregado: {new Date(selected.delivered_at).toLocaleString()}</div>}

              <div className="row gap">
                <button
                  className="btn primary"
                  disabled={selected.status !== 'ABIERTO'}
                  onClick={() => {
                    setAbonoOpen(true)
                    setError(null)
                  }}
                >
                  Registrar abono
                </button>
                <button
                  className="btn danger"
                  disabled={selected.status !== 'ABIERTO'}
                  onClick={() => onCancel(selected.id)}
                >
                  Cancelar
                </button>
                <button
                  className="btn success"
                  disabled={selected.status !== 'LIQUIDADO'}
                  onClick={() => onMarkDelivered(selected.id)}
                >
                  Marcar entregado
                </button>
              </div>

              <h4>Items</h4>
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={`${selected.id}-${item.barcode}`}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{formatMoney(item.price_gross)}</td>
                      <td>{formatMoney(item.qty * item.price_gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Historial de abonos</h4>
              {selected.payment_history.length === 0 && <div className="muted">Sin abonos registrados.</div>}
              {selected.payment_history.map((abono) => (
                <div key={abono.id} className="pending-item">
                  <div>{new Date(abono.captured_at).toLocaleString()}</div>
                  <div>
                    {abono.method}
                    {abono.received_amount !== undefined && (
                      <div className="muted">
                        Recibido: {formatMoney(abono.received_amount)} / Cambio: {formatMoney(abono.change_amount ?? 0)}
                      </div>
                    )}
                  </div>
                  <div>{formatMoney(abono.amount)}</div>
                </div>
              ))}
            </>
          )}
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </div>

      {abonoOpen && selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Registrar abono</h2>
            <p className="muted">Fecha: {new Date().toLocaleString()}</p>

            <label>Monto</label>
            <input value={abonoAmount} onChange={(e) => setAbonoAmount(e.target.value)} />

            <label>Metodo</label>
            <select value={abonoMethod} onChange={(e) => setAbonoMethod(e.target.value as PaymentMethod)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
            {abonoMethod === 'EFECTIVO' && (
              <>
                <label>Recibido</label>
                <input value={abonoReceived} onChange={(e) => setAbonoReceived(e.target.value)} />
                <div className="muted">
                  Cambio: {formatMoney(Math.max(0, toNumber(abonoReceived) - toNumber(abonoAmount)))}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setAbonoOpen(false)}>Cancelar</button>
              <button className="btn primary" onClick={submitAbono}>Guardar abono</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
