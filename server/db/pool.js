import pg from 'pg'
import { env } from '../config/env.js'

const { Pool } = pg

export const pool = new Pool({
  ...(env.pg.connectionString ? { connectionString: env.pg.connectionString } : {
    host: env.pg.host,
    port: env.pg.port,
    database: env.pg.database,
    user: env.pg.user,
    password: env.pg.password
  }),
  ssl: env.pg.ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

export const query = (text, params = []) => pool.query(text, params)
