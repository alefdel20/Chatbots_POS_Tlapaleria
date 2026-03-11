import { useMemo, useState } from 'react'
import { canEditUser, canManageTargetRole } from '../lib/permissions'
import { Business, UserRecord } from '../lib/types'

interface UsersAdminProps {
  actor: UserRecord
  businesses: Business[]
  users: UserRecord[]
  currentTenantId: string
  allowTenantSelection: boolean
  onCreate: (input: { tenant_id: string; nombre: string; email: string; password: string; rol: UserRecord['rol']; activo: boolean }) => Promise<void>
  onUpdate: (userId: string, patch: Partial<Pick<UserRecord, 'nombre' | 'email' | 'rol' | 'activo'>>) => Promise<void>
  onResetPassword: (userId: string, password: string) => Promise<void>
}

export default function UsersAdmin(props: UsersAdminProps) {
  const { actor, businesses, users, currentTenantId, allowTenantSelection, onCreate, onUpdate, onResetPassword } = props
  const [tenantId, setTenantId] = useState(currentTenantId)
  const [search, setSearch] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('Temp123!')
  const [rol, setRol] = useState<UserRecord['rol']>(actor.rol === 'admin' ? 'cajero' : 'admin')

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((user) => user.tenant_id === tenantId && (!q || user.nombre.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)))
  }, [search, tenantId, users])

  return (
    <div className="grid two">
      <div className="card">
        <h3>Crear usuario</h3>
        {allowTenantSelection && (
          <>
            <label>Negocio</label>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.nombre}</option>)}
            </select>
          </>
        )}
        <label>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password temporal</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} />
        <label>Rol</label>
        <select value={rol} onChange={(e) => setRol(e.target.value as UserRecord['rol'])}>
          {(['owner', 'admin', 'cajero'] as UserRecord['rol'][]).filter((item) => canManageTargetRole(actor, item)).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button className="btn primary" onClick={async () => {
          await onCreate({ tenant_id: tenantId, nombre, email, password, rol, activo: true })
          setNombre('')
          setEmail('')
          setPassword('Temp123!')
        }}>Crear usuario</button>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Usuarios</h3>
          <input style={{ maxWidth: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" />
        </div>
        <div className="pending-list business-list">
          {visibleUsers.map((user) => (
            <div key={user.id} className="pending-item block">
              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="strong">{user.nombre}</div>
                  <div className="muted">{user.email}</div>
                  <div className="muted">Rol: {user.rol}</div>
                </div>
                <div className={user.activo ? 'chip chip-success' : 'chip chip-danger'}>{user.activo ? 'Activo' : 'Inactivo'}</div>
              </div>
              <div className="row wrap">
                <button className="btn ghost" disabled={!canEditUser(actor, user)} onClick={() => onUpdate(user.id, { activo: !user.activo })}>{user.activo ? 'Desactivar' : 'Activar'}</button>
                {(['owner', 'admin', 'cajero'] as UserRecord['rol'][]).filter((item) => canManageTargetRole(actor, item)).map((roleOption) => (
                  <button key={roleOption} className={user.rol === roleOption ? 'btn primary' : 'btn ghost'} disabled={!canEditUser(actor, user)} onClick={() => onUpdate(user.id, { rol: roleOption })}>{roleOption}</button>
                ))}
                <button className="btn warning" disabled={!canEditUser(actor, user)} onClick={() => onResetPassword(user.id, 'Temp123!')}>Reset Temp123!</button>
              </div>
            </div>
          ))}
          {visibleUsers.length === 0 && <div className="muted">Sin usuarios</div>}
        </div>
      </div>
    </div>
  )
}


