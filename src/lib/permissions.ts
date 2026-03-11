import { ModuleKey, UserRecord, UserRole } from './types'

export type Permission =
  | 'system.view'
  | 'business.manage'
  | 'business.modules.manage'
  | 'plan.manage'
  | 'users.manage'
  | 'users.activate'
  | 'users.reset_password'
  | 'users.change_role'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'inventory.quick_add'
  | 'sales.create'
  | 'sales.undo'
  | 'reports.view'
  | 'settings.view'

const rolePermissions: Record<UserRole, Permission[]> = {
  superadmin: [
    'system.view',
    'business.manage',
    'business.modules.manage',
    'plan.manage',
    'users.manage',
    'users.activate',
    'users.reset_password',
    'users.change_role',
    'inventory.view',
    'inventory.adjust',
    'inventory.quick_add',
    'sales.create',
    'sales.undo',
    'reports.view',
    'settings.view'
  ],
  owner: [
    'users.manage',
    'users.activate',
    'users.reset_password',
    'users.change_role',
    'inventory.view',
    'inventory.adjust',
    'inventory.quick_add',
    'sales.create',
    'sales.undo',
    'reports.view',
    'settings.view'
  ],
  admin: [
    'users.manage',
    'users.activate',
    'users.reset_password',
    'inventory.view',
    'inventory.adjust',
    'inventory.quick_add',
    'sales.create',
    'sales.undo',
    'reports.view'
  ],
  cajero: ['sales.create', 'inventory.view', 'inventory.quick_add']
}

const roleRank: Record<UserRole, number> = {
  superadmin: 4,
  owner: 3,
  admin: 2,
  cajero: 1
}

export const MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: 'pos', label: 'POS' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'google_sheets_sync', label: 'Google Sheets sync' },
  { key: 'exportacion_excel', label: 'Exportacion Excel' },
  { key: 'agente_ia', label: 'Agente IA' },
  { key: 'pagina_web', label: 'Pagina web' },
  { key: 'recordatorios', label: 'Recordatorios' }
]

export const hasPermission = (user: UserRecord | null | undefined, permission: Permission): boolean => {
  if (!user?.activo) return false
  return rolePermissions[user.rol].includes(permission)
}

export const canAccessModule = (user: UserRecord | null | undefined, modules: ModuleKey[], module: ModuleKey): boolean => {
  if (!user?.activo) return false
  if (user.rol === 'superadmin') return true
  if (!modules.includes(module)) return false
  if (module === 'pos') return hasPermission(user, 'sales.create')
  if (module === 'inventario') return hasPermission(user, 'inventory.view')
  if (module === 'reportes') return hasPermission(user, 'reports.view')
  return hasPermission(user, 'settings.view') || hasPermission(user, 'system.view')
}

export const canManageTargetRole = (actor: UserRecord, targetRole: UserRole): boolean => {
  if (actor.rol === 'superadmin') return true
  if (targetRole === 'superadmin') return false
  if (actor.rol === 'owner') return targetRole !== 'owner'
  if (actor.rol === 'admin') return targetRole === 'admin' || targetRole === 'cajero'
  return false
}

export const canEditUser = (actor: UserRecord, target: UserRecord): boolean => {
  if (actor.rol === 'superadmin') return true
  if (actor.tenant_id !== target.tenant_id) return false
  if (target.rol === 'superadmin') return false
  if (actor.id === target.id) return actor.rol !== 'cajero'
  return roleRank[actor.rol] > roleRank[target.rol]
}

export const getDefaultModules = (): ModuleKey[] => ['pos', 'inventario', 'reportes']
