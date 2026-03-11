import { useMemo, useState } from 'react'
import { MODULES } from '../lib/permissions'
import { Business, UserRecord } from '../lib/types'

interface BusinessesAdminProps {
  businesses: Business[]
  actor: UserRecord
  onCreate: (input: Pick<Business, 'nombre' | 'telefono' | 'email' | 'direccion' | 'plan' | 'activo' | 'modulos_activos'>) => Promise<void>
  onUpdate: (businessId: string, patch: Partial<Pick<Business, 'nombre' | 'telefono' | 'email' | 'direccion' | 'plan' | 'activo' | 'modulos_activos'>>) => Promise<void>
}

const emptyForm = {
  nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  plan: 'base',
  activo: true
}

export default function BusinessesAdmin({ businesses, onCreate, onUpdate }: BusinessesAdminProps) {
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [selectedModules, setSelectedModules] = useState(new Set(MODULES.filter((item) => ['pos', 'inventario', 'reportes'].includes(item.key)).map((item) => item.key)))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return businesses
    return businesses.filter((business) => business.nombre.toLowerCase().includes(q) || business.email.toLowerCase().includes(q) || business.plan.toLowerCase().includes(q))
  }, [businesses, search])

  return (
    <div className="grid two">
      <div className="card">
        <h3>Crear negocio</h3>
        <label>Nombre</label>
        <input value={form.nombre} onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))} />
        <label>Telefono</label>
        <input value={form.telefono} onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))} />
        <label>Email</label>
        <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
        <label>Direccion</label>
        <input value={form.direccion} onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))} />
        <label>Plan</label>
        <input value={form.plan} onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))} />
        <div className="module-grid">
          {MODULES.map((module) => (
            <label key={module.key} className="toggle-row">
              <input
                type="checkbox"
                checked={selectedModules.has(module.key)}
                onChange={() => setSelectedModules((prev) => {
                  const next = new Set(prev)
                  next.has(module.key) ? next.delete(module.key) : next.add(module.key)
                  return next
                })}
              />
              <span>{module.label}</span>
            </label>
          ))}
        </div>
        <button className="btn primary" onClick={async () => {
          await onCreate({ ...form, modulos_activos: Array.from(selectedModules) as Business['modulos_activos'] })
          setForm(emptyForm)
        }}>Crear negocio</button>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Negocios</h3>
          <input style={{ maxWidth: 280 }} placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="pending-list business-list">
          {filtered.map((business) => (
            <div key={business.id} className="pending-item block">
              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="strong">{business.nombre}</div>
                  <div className="muted">{business.email || 'Sin email'}</div>
                  <div className="muted">Plan: {business.plan}</div>
                </div>
                <div className={business.activo ? 'chip chip-success' : 'chip chip-danger'}>{business.activo ? 'Activo' : 'Inactivo'}</div>
              </div>
              <div className="row wrap">
                {MODULES.map((module) => (
                  <button key={module.key} className={business.modulos_activos.includes(module.key) ? 'btn ghost active-outline' : 'btn ghost'} onClick={() => onUpdate(business.id, {
                    modulos_activos: business.modulos_activos.includes(module.key)
                      ? business.modulos_activos.filter((item) => item !== module.key)
                      : [...business.modulos_activos, module.key]
                  })}>
                    {module.label}
                  </button>
                ))}
              </div>
              <div className="row wrap">
                <button className="btn ghost" onClick={() => onUpdate(business.id, { activo: !business.activo })}>{business.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
