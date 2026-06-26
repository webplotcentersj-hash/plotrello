import type { CajaRegistro, CajaSectionId } from './types'
import { FONDO_CAJA_BASE_MIN } from './fondoCaja'

export { FONDO_CAJA_BASE_MIN }

export const BILLETE_DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const

export const TURNOS_CAJA = ['Mañana', 'Tarde', 'Único'] as const

export const CONCEPTOS_MOVIMIENTO = [
  'Fondo de caja',
  'Pase de caja',
  'Cierre de caja',
  'Otro'
] as const

export const DEFAULT_CAJAS: CajaRegistro[] = [
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
  { section: 'menu', label: 'Menú', icon: '🏠', cajaOnly: true },
  { header: 'Mi día' },
  { section: 'arqueo', label: 'Mi arqueo', icon: '💵', cajaOnly: true },
  { section: 'cierre_turno', label: 'Cierre de turno', icon: '🔁', cajaOnly: true },
  { section: 'pase_caja', label: 'Pase de caja', icon: '↔️', cajaOnly: true },
  { section: 'traspasos', label: 'Mis traspasos', icon: '🔀', cajaOnly: true },
  { section: 'egresos', label: 'Egresos', icon: '📤', cajaOnly: true },
  { section: 'historial', label: 'Mis movimientos', icon: '📋', cajaOnly: true },
  { section: 'asistente', label: 'Asistente IA', icon: '✨' }
]

export const DEFAULT_PARAMS = {
  tolerancia: 0
}

export const NAV_ADMIN: NavItem[] = [
  { section: 'tablero_admin', label: 'Calendario', icon: '📅', adminOnly: true },
  { section: 'cierre_turno', label: 'Cierre de turno', icon: '🔁', adminOnly: true },
  { section: 'egresos', label: 'Egresos', icon: '📤', adminOnly: true },
  { section: 'arqueos_admin', label: 'Arqueos', icon: '💵', adminOnly: true },
  { section: 'movimientos_admin', label: 'Movimientos', icon: '📋', adminOnly: true },
  { section: 'cierres', label: 'Cierres', icon: '✅', adminOnly: true },
  { header: 'Avanzado' },
  { section: 'cierres_new', label: 'Nuevo cierre', icon: '➕', adminOnly: true },
  { section: 'concil_mp', label: 'Mercado Pago', icon: '💳', adminOnly: true },
  { section: 'concil_banco', label: 'Banco', icon: '🏦', adminOnly: true },
  { section: 'centro_ia', label: 'Centro IA', icon: '✨', adminOnly: true }
]

export const LS_KEY = 'plotlab_control_cajas_v1'
