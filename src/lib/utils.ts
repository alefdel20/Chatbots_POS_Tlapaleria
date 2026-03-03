import { Product } from './types'

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)

export const toNumber = (value: string) => {
  const normalized = value.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export const nowIso = () => new Date().toISOString()

export const uuid = () => {
  if (crypto && 'randomUUID' in crypto) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const isRemateActive = (product: Product, at = new Date()): boolean => {
  if (!product.remate_enabled || !product.remate_type || product.remate_value === null || product.remate_value === undefined) {
    return false
  }
  const start = product.remate_start_at ? new Date(product.remate_start_at) : null
  const end = product.remate_end_at ? new Date(product.remate_end_at) : null
  if (start && at < start) return false
  if (end && at > end) return false
  return true
}

export const getRematePrice = (product: Product): { price: number; label: string } | null => {
  if (!isRemateActive(product)) return null
  if (!product.remate_type || product.remate_value === null || product.remate_value === undefined) return null

  if (product.remate_type === 'PORCENTAJE') {
    const percent = Math.max(0, Math.min(100, product.remate_value))
    const price = Math.max(0.01, Number((product.price_gross * (1 - percent / 100)).toFixed(2)))
    return { price, label: `Remate ${percent}%` }
  }

  const fixed = Math.max(0.01, Number(product.remate_value.toFixed(2)))
  return { price: fixed, label: 'Remate precio fijo' }
}