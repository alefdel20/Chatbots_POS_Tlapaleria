import { useEffect, useMemo, useState } from 'react'
import { CartItem, PaymentMethod } from '../lib/types'
import { formatMoney, toNumber } from '../lib/utils'

interface PorPagarModalProps {
  isOpen: boolean
  cart: CartItem[]
  onClose: () => void
  onConfirm: (payload: {
    customer_name: string
    customer_phone: string
    initial_payment: number
    initial_payment_method: PaymentMethod
  }) => void
}

export default function PorPagarModal({ isOpen, cart, onClose, onConfirm }: PorPagarModalProps) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [initialPayment, setInitialPayment] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price_gross, 0), [cart])

  useEffect(() => {
    if (!isOpen) return
    setCustomerName('')
    setCustomerPhone('')
    setInitialPayment('0')
    setPaymentMethod('EFECTIVO')
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const submit = () => {
    if (!customerName.trim()) {
      setError('Nombre de cliente obligatorio.')
      return
    }

    const anticipo = toNumber(initialPayment)
    if (anticipo < 0) {
      setError('Anticipo inválido.')
      return
    }
    if (anticipo > total) {
      setError('El anticipo no puede ser mayor al total.')
      return
    }

    onConfirm({
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      initial_payment: anticipo,
      initial_payment_method: paymentMethod
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Convertir a Por Pagar</h2>
        <p className="muted">Total del carrito: {formatMoney(total)}</p>

        <label>Nombre cliente</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

        <label>Teléfono (opcional)</label>
        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />

        <label>Anticipo inicial (opcional)</label>
        <input value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)} />

        <label>Método anticipo</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TARJETA">Tarjeta</option>
        </select>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>Crear Por Pagar</button>
        </div>
      </div>
    </div>
  )
}