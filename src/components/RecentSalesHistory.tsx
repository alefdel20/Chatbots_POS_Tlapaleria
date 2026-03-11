import { RecentSaleEntry } from '../lib/recentSales'
import { formatMoney } from '../lib/utils'

interface RecentSalesHistoryProps {
  sales: RecentSaleEntry[]
}

export default function RecentSalesHistory({ sales }: RecentSalesHistoryProps) {
  return (
    <div className="card">
      <h3>Historial reciente</h3>
      {sales.length === 0 && <div className="muted">Aun no hay ventas registradas</div>}
      {sales.length > 0 && (
        <table className="cart-table">
          <thead>
            <tr><th>Venta</th><th>Fecha y hora</th><th>Total</th><th>Productos</th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.sale_id}>
                <td>{sale.folio ?? sale.sale_id}</td>
                <td>{new Date(sale.captured_at).toLocaleString()}</td>
                <td>{formatMoney(sale.total)}</td>
                <td>{sale.product_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
