import { useEffect, useState } from 'react'
import { formatMoney, toNumber } from '../lib/utils'

interface PorPagarModalProps {
  isOpen: boolean
  total: number
  onClose: () => void
  onConfirm: (payload: { customer_name: string; customer_phone: string; anticipo: number }) => void
}

export default function PorPagarModal({ isOpen, total, onClose, onConfirm }: PorPagarModalProps) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [anticipoText, setAnticipoText] = useState('0')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setCustomerName('')
    setCustomerPhone('')
    setAnticipoText('0')
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const submit = () => {
    if (!customerName.trim()) {
      setError('Nombre del cliente es obligatorio.')
      return
    }
    if (!customerPhone.trim()) {
      setError('Telefono del cliente es obligatorio.')
      return
    }

    const anticipo = toNumber(anticipoText)
    if (anticipo < 0) {
      setError('Anticipo invalido.')
      return
    }
    if (anticipo > total) {
      setError('El anticipo no puede ser mayor al total.')
      return
    }

    onConfirm({
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      anticipo
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Convertir a Por pagar</h2>
        <p className="muted">Total actual: {formatMoney(total)}</p>

        <label>Nombre del cliente</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

        <label>Telefono</label>
        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />

        <label>Anticipo (opcional)</label>
        <input value={anticipoText} onChange={(e) => setAnticipoText(e.target.value)} />

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>Crear apartado</button>
        </div>
      </div>
    </div>
  )
}
