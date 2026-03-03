export type UnitBase = 'pza' | 'kg' | 'm' | 'lt' | 'ml'
export type ProductType = 'PIEZA' | 'GRANEL' | 'PAQUETE'
export type RemateType = 'PORCENTAJE' | 'PRECIO_FIJO'

export interface Product {
  barcode: string
  sku: string
  name: string
  unit_base: UnitBase
  type: ProductType
  pack_factor: number | null
  price_gross: number
  tax_rate: number
  active: boolean
  stock_snapshot: number | null
  remate_enabled?: boolean
  remate_type?: RemateType | null
  remate_value?: number | null
  remate_start_at?: string | null
  remate_end_at?: string | null
  remate_marked_at?: string | null
  remate_marked_by?: string | null
}

export interface CartItem {
  barcode: string
  sku: string
  name: string
  unit_base: UnitBase
  type: ProductType
  pack_factor: number | null
  price_gross: number
  base_price_gross: number
  price_source: 'NORMAL' | 'REMATE'
  remate_label?: string | null
  tax_rate: number
  qty: number
  qty_base: number
  display_unit: string
}

export type PaymentMethod = 'EFECTIVO' | 'TARJETA'
export type SaleType = 'VENTA' | 'POR_PAGAR'
export type PorPagarStatus = 'ABIERTO' | 'LIQUIDADO' | 'CANCELADO' | 'ENTREGADO'

export interface FiscalData {
  wants_invoice: boolean
  rfc?: string
  razon_social?: string
  email?: string
  cp?: string
}

export interface SalePayload {
  local_id: string
  captured_at: string
  user: string
  sale_type?: SaleType
  payment_method: PaymentMethod
  amount_received?: number
  change_amount?: number
  fiscal_data?: FiscalData
  items: Array<{
    barcode: string
    sku: string
    name: string
    qty: number
    unit_base: UnitBase
    qty_base: number
    price_gross: number
    base_price_gross?: number
    price_source?: 'NORMAL' | 'REMATE'
    remate_label?: string | null
    tax_rate: number
    type: ProductType
    pack_factor: number | null
  }>
}

export interface PorPagarItem {
  barcode: string
  sku: string
  name: string
  unit_base: UnitBase
  type: ProductType
  pack_factor: number | null
  qty: number
  qty_base: number
  price_gross: number
}

export interface PorPagarOrder {
  id: string
  folio: string
  sale_type: 'POR_PAGAR'
  customer_name: string
  customer_phone: string
  items: PorPagarItem[]
  total: number
  anticipo: number
  balance: number
  status: PorPagarStatus
  payment_history: Array<{
    id: string
    amount: number
    method: PaymentMethod
    captured_at: string
    received_amount?: number
    change_amount?: number
  }>
  canceled_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface ContingencyLine {
  barcode: string
  sku: string
  name: string
  qty: number
  unit_base: UnitBase
  price_gross: number
  tax_rate: number
  payment_method: PaymentMethod
}

export interface ContingencyBatchPayload {
  local_batch_id: string
  captured_at: string
  note: string
  folio_lote: string
  lines: ContingencyLine[]
}

export interface UndoLastSalePayload {
  local_id: string
  captured_at: string
  last_sale_id: string
  note?: string
}

export type PendingType = 'SALE' | 'CONTINGENCY_BATCH' | 'UNDO_LAST_SALE'
export type PendingStatus = 'PENDING_SYNC' | 'SYNCED' | 'ERROR'

export interface PendingQueueItem {
  id: string
  type: PendingType
  payload: unknown
  status: PendingStatus
  created_at: string
  last_attempt_at: string | null
  error_message: string | null
}

export interface Settings {
  user: string
  admin_pin: string
}
