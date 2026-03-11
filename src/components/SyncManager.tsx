import { PendingQueueItem } from '../lib/types'
import { formatMoney } from '../lib/utils'

interface SyncManagerProps {
  isOpen: boolean
  pending: PendingQueueItem[]
  lastSyncError: string | null
  syncMessage: string | null
  isSyncing: boolean
  onClose: () => void
  onSync: () => void
}

const summarizePayload = (item: PendingQueueItem) => {
  if (item.type === 'SALE' && (item.payload as any)?.items) {
    const total = (item.payload as any).items.reduce(
      (sum: number, it: any) => sum + it.qty * it.price_gross,
      0
    )
    return formatMoney(total)
  }
  if (item.type === 'CONTINGENCY_BATCH' && (item.payload as any)?.lines) {
    const total = (item.payload as any).lines.reduce(
      (sum: number, it: any) => sum + it.qty * it.price_gross,
      0
    )
    return formatMoney(total)
  }
  return ''
}

export default function SyncManager({
  isOpen,
  pending,
  lastSyncError,
  syncMessage,
  isSyncing,
  onClose,
  onSync
}: SyncManagerProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <h2>Sincronización</h2>
        {syncMessage && <div className="alert">{syncMessage}</div>}
        {lastSyncError && <div className="alert alert-error">{lastSyncError}</div>}
        <div className="pending-list">
          {pending.length === 0 && <div className="muted center">No hay pendientes.</div>}
          {pending.map((item) => (
            <div key={item.id} className="pending-item">
              <div>
                <div className="strong">{item.type}</div>
                <div className="muted">{new Date(item.created_at).toLocaleString()}</div>
              </div>
              <div className="muted">{summarizePayload(item)}</div>
              <div className={`status ${item.status.toLowerCase()}`}>{item.status}</div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={isSyncing}>Cerrar</button>
          <button className="btn primary" onClick={onSync} disabled={isSyncing}>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>
    </div>
  )
}


