import { AuthSession, UserRecord } from './types'

const SESSION_KEY = 'pos_auth_session_v1'
const HASH_PREFIX = 'pbkdf2$'
const ITERATIONS = 120000

const encoder = new TextEncoder()

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const deriveBits = async (password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<Uint8Array> => {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: salt.slice().buffer
    },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `${HASH_PREFIX}${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash.startsWith(HASH_PREFIX)) return false
  const [, iterationRaw, saltEncoded, hashEncoded] = storedHash.split('$')
  const iterations = Number(iterationRaw)
  if (!iterations || !saltEncoded || !hashEncoded) return false
  const salt = base64ToBytes(saltEncoded)
  const expected = base64ToBytes(hashEncoded)
  const candidate = await deriveBits(password, salt, iterations)
  if (candidate.length !== expected.length) return false
  let diff = 0
  for (let index = 0; index < candidate.length; index += 1) {
    diff |= candidate[index] ^ expected[index]
  }
  return diff === 0
}

export const saveSession = (session: AuthSession | null) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const loadSession = (): AuthSession | null => {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.user_id || !parsed?.tenant_id || !parsed?.token) return null
    return parsed
  } catch {
    return null
  }
}

export const isUserAllowedToLogin = (user: UserRecord | null | undefined) => Boolean(user?.activo)
