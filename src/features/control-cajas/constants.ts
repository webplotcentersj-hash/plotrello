import type { CajaRegistro, CajaSectionId } from './types'

export const BILLETE_DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const

export const TURNOS_CAJA = ['Mañana', 'Tarde', 'Único'] as const

export const CONCEPTOS_MOVIMIENTO = [
  'Fondo de caja',
  'Pase de caja',
  'Cierre de caja',
  'Otro'
] as const

export const DEFAULT_CAJAS: CajaRegistro[] = [
  { slug: 'noelia', nombre: 'Caja Noelia', fondo_fijo: 50000, activa: true },
  { slug: 'rosa', nombre: 'Caja Rosa', fondo_fijo: 50000, activa: true },
  { slug: 'admin', nombre: 'Caja Administración', fondo_fijo: 0, activa: true },
  { slug: 'vuelto', nombre: 'Caja Vuelto', fondo_fijo: 5000, activa: true }
]

export type NavItem =
  | { header: string }
  | {
      section: CajaSectionId
      label: string
      icon: string
      adminOnly?: boolean
      cajaOnly?: boolean
    }

export const NAV_CAJA: NavItem[] = [
  { header: 'Mi día' },
  { section: 'arqueo', label: 'Mi arqueo', icon: '💵', cajaOnly: true },
  { section: 'movimientos', label: 'Mis movimientos', icon: '↔️', cajaOnly: true },
  { section: 'historial', label: 'Historial', icon: '🕐', cajaOnly: true },
  { section: 'asistente', label: 'Asistente IA', icon: '✨' }
]

export const DEFAULT_CAJERAS: { nombre: string; usuario: string }[] = [
  { nombre: 'Noelia Galaburri', usuario: 'NGALABURRI' },
  { nombre: 'Rosa Tabera', usuario: 'RTABERA' },
  { nombre: 'Administración', usuario: 'ADMIN' }
]

export const DEFAULT_PARAMS = {
  tolerancia: 0,
  cajeras: DEFAULT_CAJERAS
}

export const NAV_ADMIN: NavItem[] = [
  { section: 'tablero_admin', label: 'Tablero', icon: '📊', adminOnly: true },
  { section: 'centro_ia', label: 'Centro IA', icon: '✨', adminOnly: true },
  { header: 'Operación diaria' },
  { section: 'cierres_new', label: 'Nuevo cierre', icon: '➕', adminOnly: true },
  { section: 'cierres', label: 'Cierres', icon: '✅', adminOnly: true },
  { section: 'arqueos_admin', label: 'Arqueos', icon: '💵', adminOnly: true },
  { section: 'movimientos_admin', label: 'Movimientos', icon: '↔️', adminOnly: true },
  { header: 'Conciliaciones' },
  { section: 'concil_mp', label: 'Mercado Pago', icon: '💳', adminOnly: true },
  { section: 'concil_banco', label: 'Banco', icon: '🏦', adminOnly: true },
  { header: 'Seguimiento' },
  { section: 'diferencias', label: 'Diferencias', icon: '⚠️', adminOnly: true },
  { section: 'ventas', label: 'Ventas diarias', icon: '📈', adminOnly: true },
  { section: 'tablero', label: 'Tablero ERP', icon: '🏢', adminOnly: true },
  { header: 'Configuración' },
  { section: 'config', label: 'Maestros', icon: '⚙️', adminOnly: true },
  { section: 'asistente', label: 'Asistente IA', icon: '✨' }
]

export const LS_KEY = 'plotlab_control_cajas_v1'
