import { useState } from 'react'

interface LoginScreenProps {
  error: string | null
  loading: boolean
  onLogin: (email: string, password: string) => Promise<void>
}

export default function LoginScreen({ error, loading, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="eyebrow">POS multiusuario</div>
        <h1>Acceso al sistema</h1>
        <p className="muted">Autenticacion con PostgreSQL, tenants, roles y modulos.</p>

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn primary full" disabled={loading} onClick={() => onLogin(email, password)}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="card compact">
          <div className="strong">Credenciales iniciales</div>
          <div className="muted">superadmin@local.test / Admin123!</div>
          <div className="muted">owner@local.test / Owner123!</div>
        </div>
      </div>
    </div>
  )
}


