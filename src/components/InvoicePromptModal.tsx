import { useEffect, useState } from 'react'
import { FiscalData } from '../lib/types'
import { isValidEmail } from '../lib/utils'

interface InvoicePromptModalProps {
  isOpen: boolean
  paymentLabel: string
  initial: FiscalData
  onClose: () => void
  onConfirm: (data: FiscalData) => void
}

export default function InvoicePromptModal({ isOpen, paymentLabel, initial, onClose, onConfirm }: InvoicePromptModalProps) {
  const [wantsInvoice, setWantsInvoice] = useState<boolean>(false)
  const [rfc, setRfc] = useState('')
  const [razon, setRazon] = useState('')
  const [email, setEmail] = useState('')
  const [cp, setCp] = useState('')
  const [usoCfdi, setUsoCfdi] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setWantsInvoice(Boolean(initial.wants_invoice))
    setRfc(initial.rfc ?? '')
    setRazon(initial.razon_social ?? '')
    setEmail(initial.email ?? '')
    setCp(initial.cp ?? '')
    setUsoCfdi(initial.uso_cfdi ?? '')
    setError(null)
  }, [isOpen, initial])

  if (!isOpen) return null

  const submit = () => {
    if (!wantsInvoice) {
      onConfirm({ wants_invoice: false })
      return
    }

    if (!rfc.trim() || !razon.trim() || !email.trim() || !cp.trim()) {
      setError('RFC, razón social, email y CP son obligatorios.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Email inválido.')
      return
    }

    onConfirm({
      wants_invoice: true,
      rfc: rfc.trim().toUpperCase(),
      razon_social: razon.trim(),
      email: email.trim(),
      cp: cp.trim(),
      uso_cfdi: usoCfdi.trim() || undefined
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Pago con {paymentLabel}</h2>
        <p>¿Desea factura?</p>

        <div className="row">
          <button className={!wantsInvoice ? 'btn primary' : 'btn ghost'} onClick={() => setWantsInvoice(false)}>No</button>
          <button className={wantsInvoice ? 'btn primary' : 'btn ghost'} onClick={() => setWantsInvoice(true)}>Sí</button>
        </div>

        {wantsInvoice && (
          <>
            <label>RFC</label>
            <input value={rfc} onChange={(e) => setRfc(e.target.value)} />

            <label>Razón social</label>
            <input value={razon} onChange={(e) => setRazon(e.target.value)} />

            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />

            <label>Código postal</label>
            <input value={cp} onChange={(e) => setCp(e.target.value)} />

            <label>Uso CFDI (opcional)</label>
            <input value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)} placeholder="Por definir" />
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