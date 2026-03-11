import { useEffect, useRef, useState } from 'react'

interface PinModalProps {
  isOpen: boolean
  title: string
  description?: string
  error?: string | null
  lockedUntil?: Date | null
  onClose: () => void
  onSubmit: (pin: string) => void
}

export default function PinModal({
  isOpen,
  title,
  description,
  error,
  lockedUntil,
  onClose,
  onSubmit
}: PinModalProps) {
  const [pin, setPin] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setPin('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  if (!isOpen) return null

  const locked = Boolean(lockedUntil && lockedUntil.getTime() > Date.now())
  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)) : 0

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
        {locked && (
          <div className="alert alert-error">
            PIN bloqueado. Intenta en {remaining}s.
          </div>
        )}
        {error && !locked && <div className="alert alert-error">{error}</div>}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="PIN Admin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
          disabled={locked}
        />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn primary"
            disabled={pin.length < 4 || locked}
            onClick={() => onSubmit(pin)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}


