import { SaleRecord, TenantMetrics } from '../lib/types'
import { formatMoney } from '../lib/utils'
import DashboardCards from './DashboardCards'

interface ReportsScreenProps {
  metrics: TenantMetrics
  sales: SaleRecord[]
}

export default function ReportsScreen({ metrics, sales }: ReportsScreenProps) {
  return (
    <div className="screen">
      <DashboardCards
        metrics={[
          { label: 'Ventas', value: metrics.total_sales },
          { label: 'Ingresos', value: formatMoney(metrics.total_revenue) },
          { label: 'Productos', value: metrics.total_products },
          { label: 'Stock bajo', value: metrics.low_stock_count, hint: `${metrics.unconfirmed_inventory_count} sin confirmar` }
        ]}
      />
      <div className="card">
        <h3>Ventas recientes</h3>
        <table className="cart-table">
          <thead><tr><th>Fecha</th><th>Metodo</th><th>Total</th><th>Status</th><th>Usuario</th></tr></thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{new Date(sale.fecha).toLocaleString()}</td>
                <td>{sale.metodo_pago}</td>
                <td>{formatMoney(sale.total)}</td>
                <td>{sale.status}</td>
                <td>{sale.usuario_id}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={5} className="muted center">Sin ventas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}


