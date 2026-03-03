import { useMemo, useState } from 'react'
import { PorPagarOrder } from '../lib/types'
import { formatMoney } from '../lib/utils'

interface PorPagarScreenProps {
  orders: PorPagarOrder[]
  onBack: () => void
}

export default function PorPagarScreen({ orders, onBack }: PorPagarScreenProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1>Por pagar</h1>
          <div className="muted">Apartados abiertos</div>
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
                  <div className="status pending_sync">{order.status}</div>
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
              <div>Estatus: {selected.status}</div>
              <div className="muted">Creado: {new Date(selected.created_at).toLocaleString()}</div>

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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
