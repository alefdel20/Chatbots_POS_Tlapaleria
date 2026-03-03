import { useMemo, useState } from 'react'
import { PaymentMethod, VentaPorPagar } from '../lib/types'
import { formatMoney, nowIso, toNumber } from '../lib/utils'

interface PorPagarScreenProps {
  items: VentaPorPagar[]
  onBack: () => void
  onRegisterAbono: (id: string, amount: number, method: PaymentMethod, capturedAt: string) => Promise<void>
  onCancel: (id: string, reason: string) => Promise<void>
  onDeliver: (id: string) => Promise<void>
}

export default function PorPagarScreen({ items, onBack, onRegisterAbono, onCancel, onDeliver }: PorPagarScreenProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoMetodo, setAbonoMetodo] = useState<PaymentMethod>('EFECTIVO')
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) =>
      it.customer_name.toLowerCase().includes(q) ||
      it.customer_phone.toLowerCase().includes(q) ||
      it.folio.toLowerCase().includes(q)
    )
  }, [items, search])

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? (items.length > 0 ? items[0] : null),
    [items, selectedId]
  )

  const submitAbono = async () => {
    if (!selected) return
    const amount = toNumber(abonoMonto)
    if (amount <= 0) {
      setError('Monto inválido.')
      return
    }
    setError(null)
    await onRegisterAbono(selected.id, amount, abonoMetodo, nowIso())
    setAbonoMonto('')
  }

  const submitCancel = async () => {
    if (!selected) return
    if (!cancelReason.trim()) {
      setError('Indica motivo de cancelación.')
      return
    }
    setError(null)
    await onCancel(selected.id, cancelReason.trim())
    setCancelReason('')
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1>Por pagar</h1>
          <div className="muted">Apartados y pagos parciales</div>
        </div>
        <button className="btn ghost" onClick={onBack}>Volver</button>
      </div>

      <div className="grid two">
        <div className="card">
          <label>Buscar cliente o folio</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, teléfono o folio" />

          <div className="pending-list">
            {filtered.map((it) => (
              <div key={it.id} className="pending-item" onClick={() => setSelectedId(it.id)} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="strong">{it.folio}</div>
                  <div>{it.customer_name}</div>
                  <div className="muted">{it.customer_phone || 'Sin teléfono'}</div>
                </div>
                <div>
                  <div>{formatMoney(it.balance)}</div>
                  <div className={`status ${it.status.toLowerCase()}`}>{it.status}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="muted center">Sin resultados</div>}
          </div>
        </div>

        <div className="card">
          {!selected && <div className="muted">Selecciona un por pagar.</div>}
          {selected && (
            <>
              <h3>{selected.folio}</h3>
              <div>Cliente: {selected.customer_name}</div>
              <div>Teléfono: {selected.customer_phone || 'N/A'}</div>
              <div>Total: {formatMoney(selected.total)}</div>
              <div>Abonado: {formatMoney(selected.paid)}</div>
              <div className="strong">Saldo: {formatMoney(selected.balance)}</div>
              <div>Estatus: <span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span></div>

              <hr style={{ borderColor: '#334155', width: '100%' }} />
              <h4>Items</h4>
              <ul>
                {selected.items.map((line) => (
                  <li key={`${selected.id}-${line.barcode}`}>{line.name} x{line.qty} ({formatMoney(line.price_gross)})</li>
                ))}
              </ul>

              {selected.status === 'ABIERTO' && (
                <>
                  <h4>Registrar abono</h4>
                  <div className="row gap">
                    <input placeholder="Monto" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} />
                    <select value={abonoMetodo} onChange={(e) => setAbonoMetodo(e.target.value as PaymentMethod)}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TARJETA">Tarjeta</option>
                    </select>
                    <button className="btn primary" onClick={submitAbono}>Abonar</button>
                  </div>

                  <h4>Cancelar</h4>
                  <div className="row gap">
                    <input placeholder="Motivo" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                    <button className="btn danger" onClick={submitCancel}>Cancelar</button>
                  </div>
                </>
              )}

              {selected.status === 'LIQUIDADO' && (
                <div className="row gap">
                  <button className="btn success" onClick={() => onDeliver(selected.id)} disabled={Boolean(selected.delivered_at)}>
                    {selected.delivered_at ? 'Entregado' : 'Marcar entregado'}
                  </button>
                  {selected.delivered_at && <span className="muted">{new Date(selected.delivered_at).toLocaleString()}</span>}
                </div>
              )}

              <h4>Historial de abonos</h4>
              {selected.abonos.length === 0 && <div className="muted">Sin abonos</div>}
              {selected.abonos.map((abono) => (
                <div key={abono.id} className="pending-item">
                  <div>{new Date(abono.captured_at).toLocaleString()}</div>
                  <div>{abono.method}</div>
                  <div>{formatMoney(abono.amount)}</div>
                </div>
              ))}
            </>
          )}
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}