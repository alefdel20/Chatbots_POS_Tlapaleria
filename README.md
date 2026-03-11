# POS SaaS Multiusuario

POS con frontend Vite/React y backend Node/Express conectado a PostgreSQL.

## Requisitos
- Node.js 18+
- npm
- PostgreSQL con el esquema ya cargado

## Variables de entorno
Crea `.env` a partir de `.env.example`.

Precedencia:
1. Si `DATABASE_URL` tiene valor, el backend usa esa cadena y ignora `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
2. Si `DATABASE_URL` esta vacia, usa las variables `PG*`.

Variables soportadas:
- `PORT`
- `DATABASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSLMODE`
- `SESSION_SECRET`
- `VITE_API_BASE_URL`

## Configuracion local
Usa localhost o 127.0.0.1.

Ejemplo:
```env
PORT=3001
DATABASE_URL=
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=pos_saas
PGUSER=postgres
PGPASSWORD=changeme
PGSSLMODE=disable
SESSION_SECRET=change-this-in-production
VITE_API_BASE_URL=http://127.0.0.1:3001
```

## Configuracion VPS con Docker
Usa el host interno del servicio de Postgres en la red Docker, no la IP publica.

Ejemplo si el servicio/container se llama `postgres`:
```env
PORT=3001
DATABASE_URL=postgres://postgres:changeme@postgres:5432/pos_saas
PGSSLMODE=disable
SESSION_SECRET=change-this-in-production
VITE_API_BASE_URL=https://tu-dominio-o-ip
```

Alternativa sin `DATABASE_URL`:
```env
PGHOST=postgres
PGPORT=5432
PGDATABASE=pos_saas
PGUSER=postgres
PGPASSWORD=changeme
```

## Como correr backend local
```bash
npm run dev:server
```

## Como correr frontend local
```bash
npm run dev:client
```

## Como correr backend en VPS
Sin modo watch:
```bash
npm run start:server
```

Si ejecutas dentro del contenedor/app server en la misma red Docker que Postgres, `PGHOST` o `DATABASE_URL` debe usar el nombre interno del servicio, por ejemplo `postgres`.

## Login
El login consulta PostgreSQL en `users`, busca por `email`, valida `activo = true` y compara `password_hash` usando bcrypt.

Usuarios seed esperados:
- `superadmin@local.test`
- `owner@local.test`

## Prueba rapida API login
```bash
curl -X POST http://127.0.0.1:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"superadmin@local.test\",\"password\":\"Admin123!\"}"
```
