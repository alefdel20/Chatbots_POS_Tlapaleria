import { useEffect, useState } from 'react'
import { FiscalData } from '../lib/types'

interface InvoicePromptModalProps {
  isOpen: boolean
  paymentLabel: string
  initial: FiscalData
  onClose: () => void
  onConfirm: (data: FiscalData) => void
}

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim())

export default function InvoicePromptModal({ isOpen, paymentLabel, initial, onClose, onConfirm }: InvoicePromptModalProps) {
  const [wantsInvoice, setWantsInvoice] = useState(false)
  const [rfc, setRfc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [email, setEmail] = useState('')
  const [cp, setCp] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setWantsInvoice(Boolean(initial.wants_invoice))
    setRfc(initial.rfc ?? '')
    setRazonSocial(initial.razon_social ?? '')
    setEmail(initial.email ?? '')
    setCp(initial.cp ?? '')
    setError(null)
  }, [isOpen, initial])

  if (!isOpen) return null

  const submit = () => {
    if (!wantsInvoice) {
      onConfirm({ wants_invoice: false })
      return
    }

    if (!rfc.trim() || !cp.trim()) {
      setError('RFC y Código Postal son obligatorios.')
      return
    }

    if (email.trim() && !isValidEmail(email)) {
      setError('Email con formato inválido.')
      return
    }

    onConfirm({
      wants_invoice: true,
      rfc: rfc.trim().toUpperCase(),
      razon_social: razonSocial.trim() || undefined,
      email: email.trim() || undefined,
      cp: cp.trim()
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Método de pago: {paymentLabel}</h2>
        <p>¿Desea factura?</p>

        <div className="row gap">
          <button className={!wantsInvoice ? 'btn primary' : 'btn ghost'} onClick={() => setWantsInvoice(false)}>
            No
          </button>
          <button className={wantsInvoice ? 'btn primary' : 'btn ghost'} onClick={() => setWantsInvoice(true)}>
            Sí
          </button>
        </div>

        {wantsInvoice && (
          <>
            <label>RFC</label>
            <input value={rfc} onChange={(e) => setRfc(e.target.value)} />

            <label>Razón Social</label>
            <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />

            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />

            <label>Código Postal</label>
            <input value={cp} onChange={(e) => setCp(e.target.value)} />
          </>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>Continuar</button>
        </div>
      </div>
    </div>
  )
}

