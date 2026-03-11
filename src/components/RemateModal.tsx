import { useEffect, useState } from 'react'
import { Product, RemateType } from '../lib/types'
import { nowIso, toNumber } from '../lib/utils'

interface RemateModalProps {
  isOpen: boolean
  product: Product | null
  currentUser: string
  onClose: () => void
  onSave: (product: Product) => void
}

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const toIsoOrNull = (localValue: string) => {
  if (!localValue.trim()) return null
  const parsed = new Date(localValue)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function RemateModal({ isOpen, product, currentUser, onClose, onSave }: RemateModalProps) {
  const [enabled, setEnabled] = useState(false)
  const [type, setType] = useState<RemateType>('PORCENTAJE')
  const [value, setValue] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !product) return
    setEnabled(Boolean(product.remate_enabled))
    setType(product.remate_type ?? 'PORCENTAJE')
    setValue(product.remate_value !== null && product.remate_value !== undefined ? String(product.remate_value) : '')
    setStartAt(toLocalInput(product.remate_start_at))
    setEndAt(toLocalInput(product.remate_end_at))
    setError(null)
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const save = () => {
    if (!enabled) {
      onSave({
        ...product,
        remate_enabled: false,
        remate_type: null,
        remate_value: null,
        remate_start_at: null,
        remate_end_at: null,
        remate_marked_at: nowIso(),
        remate_marked_by: currentUser
      })
      return
    }

    const parsedValue = toNumber(value)
    if (parsedValue <= 0) {
      setError('Define un valor de remate válido.')
      return
    }
    if (type === 'PORCENTAJE' && (parsedValue <= 0 || parsedValue >= 100)) {
      setError('El porcentaje debe ser mayor a 0 y menor a 100.')
      return
    }

    const startIso = toIsoOrNull(startAt)
    const endIso = toIsoOrNull(endAt)
    if (startIso && endIso && new Date(startIso) > new Date(endIso)) {
      setError('La fecha de inicio no puede ser mayor al fin.')
      return
    }

    onSave({
      ...product,
      remate_enabled: true,
      remate_type: type,
      remate_value: parsedValue,
      remate_start_at: startIso,
      remate_end_at: endIso,
      remate_marked_at: nowIso(),
      remate_marked_by: currentUser
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Marcar como remate</h2>
        <p className="muted">{product.name}</p>

        <div className="row">
          <button className={enabled ? 'btn primary' : 'btn ghost'} onClick={() => setEnabled(true)}>Activo</button>
          <button className={!enabled ? 'btn warning' : 'btn ghost'} onClick={() => setEnabled(false)}>Desactivar</button>
        </div>

        {enabled && (
          <>
            <label>Tipo de remate</label>
            <select value={type} onChange={(e) => setType(e.target.value as RemateType)}>
              <option value="PORCENTAJE">Porcentaje</option>
              <option value="PRECIO_FIJO">Precio fijo</option>
            </select>

            <label>{type === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Precio fijo'}</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'PORCENTAJE' ? '10' : '99.90'} />

            <label>Inicio (opcional)</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />

            <label>Fin (opcional)</label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

