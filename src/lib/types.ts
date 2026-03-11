export type UnitBase = 'pza' | 'kg' | 'm' | 'lt' | 'ml'
export type ProductType = 'PIEZA' | 'GRANEL' | 'PAQUETE'
export type RemateType = 'PORCENTAJE' | 'PRECIO_FIJO'
export type PaymentMethod = 'EFECTIVO' | 'TARJETA'
export type SaleType = 'VENTA' | 'POR_PAGAR'
export type PorPagarStatus = 'ABIERTO' | 'LIQUIDADO' | 'CANCELADO' | 'ENTREGADO'
export type PendingType = 'SALE' | 'CONTINGENCY_BATCH' | 'UNDO_LAST_SALE'
export type PendingStatus = 'PENDING_SYNC' | 'SYNCED' | 'ERROR'
export type UserRole = 'superadmin' | 'owner' | 'admin' | 'cajero'
export type ModuleKey =
  | 'pos'
  | 'inventario'
  | 'reportes'
  | 'google_sheets_sync'
  | 'exportacion_excel'
  | 'agente_ia'
  | 'pagina_web'
  | 'recordatorios'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled'
export type InventoryMovementType =
  | 'SALE'
  | 'UNDO_SALE'
  | 'QUICK_ADD'
  | 'MANUAL_ADJUSTMENT'
  | 'POR_PAGAR_RESERVE'
  | 'POR_PAGAR_CANCEL'
export type SaleStatus = 'COMPLETED' | 'VOIDED'

export interface TimestampedEntity {
  created_at: string
  updated_at: string
}

export interface Business extends TimestampedEntity {
  id: string
  nombre: string
  telefono: string
  email: string
  direccion: string
  plan: string
  activo: boolean
  modulos_activos: ModuleKey[]
  is_system?: boolean
}

export interface UserRecord extends TimestampedEntity {
  id: string
  tenant_id: string
  nombre: string
  email: string
  password_hash: string
  rol: UserRole
  activo: boolean
}

export interface AuthSession {
  user_id: string
  tenant_id: string
  token: string
  issued_at: string
}

export interface Subscription extends TimestampedEntity {
  id: string
  tenant_id: string
  plan: string
  modalidad: string
  modulos_activos: ModuleKey[]
  fecha_inicio: string
  fecha_fin: string | null
  status: SubscriptionStatus
}

export interface Product extends TimestampedEntity {
  id: string
  tenant_id: string
  barcode: string
  sku: string
  name: string
  categoria: string
  unit_base: UnitBase
  type: ProductType
  pack_factor: number | null
  precio_compra: number
  precio_venta: number
  tax_rate: number
  stock_actual: number | null
  stock_minimo: number
  inventario_confirmado: boolean
  active: boolean
  remate_enabled?: boolean
  remate_type?: RemateType | null
  remate_value?: number | null
  remate_start_at?: string | null
  remate_end_at?: string | null
  remate_marked_at?: string | null
  remate_marked_by?: string | null
}

export interface CartItem {
  product_id?: string
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

export interface FiscalData {
  wants_invoice: boolean
  rfc?: string
  razon_social?: string
  email?: string
  cp?: string
}

export interface SalePayload {
  local_id: string
  tenant_id: string
  usuario_id: string
  captured_at: string
  user: string
  sale_type?: SaleType
  payment_method: PaymentMethod
  amount_received?: number
  change_amount?: number
  fiscal_data?: FiscalData
  items: Array<{
    product_id?: string
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

export interface SaleRecord extends TimestampedEntity {
  id: string
  tenant_id: string
  usuario_id: string
  fecha: string
  total: number
  metodo_pago: PaymentMethod
  status: SaleStatus
  amount_received?: number
  change_amount?: number
  sale_type: SaleType
  fiscal_data?: FiscalData
  items: SaleItem[]
}

export interface SaleItem extends TimestampedEntity {
  id: string
  tenant_id: string
  sale_id: string
  product_id: string | null
  cantidad: number
  cantidad_base: number
  precio_unitario: number
  subtotal: number
  barcode: string
  sku: string
  nombre: string
}

export interface PorPagarItem {
  product_id?: string
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

export interface PorPagarOrder extends TimestampedEntity {
  id: string
  tenant_id: string
  usuario_id: string
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
    usuario_id?: string
  }>
  canceled_at: string | null
  delivered_at: string | null
}

export interface ContingencyLine {
  product_id?: string
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
  tenant_id: string
  usuario_id: string
  captured_at: string
  note: string
  folio_lote: string
  lines: ContingencyLine[]
}

export interface UndoLastSalePayload {
  local_id: string
  tenant_id: string
  usuario_id: string
  captured_at: string
  last_sale_id: string
  note?: string
}

export interface PendingQueueItem {
  id: string
  tenant_id: string
  usuario_id: string
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

export interface InventoryMovement {
  id: string
  tenant_id: string
  product_id: string | null
  tipo: InventoryMovementType
  cantidad: number
  motivo: string
  referencia: string | null
  usuario_id: string
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string | null
  actor_user_id: string
  action: string
  target_type: string
  target_id: string
  details: string
  created_at: string
}

export interface UserWithBusiness {
  user: UserRecord
  business: Business | null
}

export interface AuthContextValue {
  session: AuthSession | null
  user: UserRecord | null
  business: Business | null
}

export interface TenantMetrics {
  total_sales: number
  total_revenue: number
  total_products: number
  low_stock_count: number
  unconfirmed_inventory_count: number
  active_users: number
}

export interface GlobalMetrics {
  total_businesses: number
  active_businesses: number
  total_users: number
  active_users: number
  total_sales: number
  total_revenue: number
}
