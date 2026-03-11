import { AuditLog } from '../lib/types'

export default function AuditScreen({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="card">
      <h3>Auditoria</h3>
      <table className="cart-table">
        <thead><tr><th>Fecha</th><th>Accion</th><th>Actor</th><th>Objetivo</th><th>Detalle</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>{log.action}</td>
              <td>{log.actor_user_id}</td>
              <td>{log.target_type}:{log.target_id}</td>
              <td>{log.details}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="muted center">Sin auditoria</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
