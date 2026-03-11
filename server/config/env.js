import dotenv from 'dotenv'

dotenv.config()

const requireEnv = (name, fallback) => {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  pg: {
    connectionString: process.env.DATABASE_URL ?? '',
    host: process.env.DATABASE_URL ? '' : requireEnv('PGHOST', '127.0.0.1'),
    port: process.env.DATABASE_URL ? 0 : Number(process.env.PGPORT ?? 5432),
    database: process.env.DATABASE_URL ? '' : requireEnv('PGDATABASE'),
    user: process.env.DATABASE_URL ? '' : requireEnv('PGUSER'),
    password: process.env.DATABASE_URL ? '' : requireEnv('PGPASSWORD'),
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
  },
  sessionSecret: requireEnv('SESSION_SECRET', 'change-this-in-production')
}

if (env.pg.connectionString) {
  console.log('[config] PostgreSQL configured via DATABASE_URL')
} else {
  console.log(`[config] PostgreSQL configured via PG* vars host=${env.pg.host} port=${env.pg.port} db=${env.pg.database}`)
}
