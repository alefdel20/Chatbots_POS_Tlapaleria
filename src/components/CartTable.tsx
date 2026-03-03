import { useEffect, useState } from 'react'
import { CartItem } from '../lib/types'
import { formatMoney } from '../lib/utils'

interface CartTableProps {
  items: CartItem[]
  onUpdateQty: (barcode: string, qty: string) => void
  onRemove: (barcode: string) => void
}

export default function CartTable({ items, onUpdateQty, onRemove }: CartTableProps) {
  // drafts: permite escribir libremente (incluye '' mientras borras)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    // Sincroniza drafts con items actuales
    setDrafts((prev) => {
      const next: Record<string, string> = { ...prev }

      // agrega drafts faltantes
      for (const it of items) {
        if (next[it.barcode] === undefined) next[it.barcode] = String(it.qty)
      }

      // elimina drafts de items que ya no existen
      for (const k of Object.keys(next)) {
        if (!items.some((it) => it.barcode === k)) delete next[k]
      }

      return next
    })
  }, [items])

  const commitQty = (barcode: string) => {
    const raw = String(drafts[barcode] ?? '')
      .trim()
      .replace(',', '.') // acepta coma decimal

    // si lo dejan vacío, no crashees: regresa al valor actual
    if (raw === '') {
      const current = items.find((it) => it.barcode === barcode)
      setDrafts((prev) => ({ ...prev, [barcode]: String(current?.qty ?? 1) }))
      return
    }

    onUpdateQty(barcode, raw)
  }

  return (
    <table className="cart-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Qty</th>
          <th>Unidad</th>
          <th>Precio</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={6} className="muted center">
              Sin productos
            </td>
          </tr>
        )}

        {items.map((item) => {
          const subtotal = item.qty * item.price_gross
          const draftValue = drafts[item.barcode] ?? String(item.qty)

          return (
            <tr key={item.barcode}>
              <td>
                <div>{item.name}</div>
                {item.price_source === 'REMATE' && (
                  <div className="chip remate">
                    {item.remate_label ?? 'Remate'}: {formatMoney(item.price_gross)}
                  </div>
                )}
                {item.type === 'PAQUETE' && item.pack_factor && (
                  <div className="muted">
                    1 paquete ({item.pack_factor} {item.unit_base})
                  </div>
                )}
              </td>

              <td>
                <input
                  className="qty-input"
                  type="text"
                  inputMode={item.display_unit === 'pza' ? 'numeric' : 'decimal'}
                  value={draftValue}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [item.barcode]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitQty(item.barcode)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                  onBlur={() => commitQty(item.barcode)}
                />
              </td>

              <td>{item.display_unit}</td>
              <td>
                {formatMoney(item.price_gross)}
                {item.price_source === 'REMATE' && (
                  <div className="muted strike">{formatMoney(item.base_price_gross)}</div>
                )}
              </td>
              <td>{formatMoney(subtotal)}</td>

              <td>
                <button className="btn ghost" onClick={() => onRemove(item.barcode)}>
                  Eliminar
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
