interface Metric {
  label: string
  value: string | number
  hint?: string
}

export default function DashboardCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <div key={metric.label} className="metric-card">
          <div className="muted">{metric.label}</div>
          <div className="metric-value">{metric.value}</div>
          {metric.hint && <div className="muted">{metric.hint}</div>}
        </div>
      ))}
    </div>
  )
}
