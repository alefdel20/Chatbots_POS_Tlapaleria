import crypto from 'node:crypto'
import { env } from '../config/env.js'

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url')
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8')

export const signToken = (payload) => {
  const body = base64UrlEncode(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', env.sessionSecret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export const verifyToken = (token) => {
  if (!token?.includes('.')) return null
  const [body, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', env.sessionSecret).update(body).digest('base64url')
  if (signature !== expected) return null
  const payload = JSON.parse(base64UrlDecode(body))
  if (payload.exp && Date.now() > payload.exp) return null
  return payload
}


