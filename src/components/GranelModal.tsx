import { useEffect, useRef, useState } from "react";

interface GranelModalProps {
  isOpen: boolean;
  productName: string;
  unit: string;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}

export default function GranelModal({
  isOpen,
  productName,
  unit,
  onCancel,
  onConfirm,
}: GranelModalProps) {
  const [qtyText, setQtyText] = useState("1.00");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQtyText("1.00");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  if (!isOpen) return null;

  const parsed = Number(String(qtyText).replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Granel</h2>
        <p className="muted">{productName}</p>

        <label>Cantidad ({unit})</label>
        <input
          ref={inputRef}
          className="qty-input"
          type="text"
          inputMode="decimal"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => onConfirm(parsed)}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

