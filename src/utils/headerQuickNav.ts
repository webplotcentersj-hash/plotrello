import type { Usuario } from '../hooks/useAuth'

export type HeaderQuickNavItem = {
  id: string
  label: string
  icon: string
  href?: string
  /** Enlace externo (abre en pestaña nueva). */
  external?: boolean
  onClick?: () => void
  title?: string
  badge?: number
}

const VIA_PUBLICA_URL = 'https://vp-zeta-eight.vercel.app/'

type BuildHeaderQuickNavCtx = {
  usuario: Usuario | null
  isAdmin: boolean
  canAccessMostradorViews: boolean
  canAccessAsesorPresupuestos: boolean
  canAccessAtencionPublico: boolean
  canManageCompras: boolean
  canManageCaja: boolean
  canManageRecursosHumanos: boolean
  onNavigateToStats?: () => void
  onNavigateToMostrador?: () => void
  onNavigateToCompras?: () => void
  onNavigateToCaja?: () => void
  onNavigateToDiseno?: () => void
  onNavigateToRecursosHumanos?: () => void
  onNavigateToAsesorPresupuestos?: () => void
  onNavigateToAtencionPublico?: () => void
  onNavigateToFlota?: () => void
  onNavigateToERP?: () => void
  onOpenPermisos?: () => void
  onSolicitarProductos?: () => void
}

/** Botones visibles en el header según el rol (dashboard propio + menú diario + flota). */
export function buildHeaderQuickNavItems(ctx: BuildHeaderQuickNavCtx): HeaderQuickNavItem[] {
  const { usuario } = ctx
  if (!usuario) return []

  const items: HeaderQuickNavItem[] = []
  const rol = usuario.rol

  const push = (item: HeaderQuickNavItem) => {
    if (!items.some((i) => i.id === item.id)) items.push(item)
  }

  // ——— Dashboard / módulo principal del rol ———
  switch (rol) {
    case 'recursos-humanos':
      if (ctx.canManageRecursosHumanos && ctx.onNavigateToRecursosHumanos) {
        push({
          id: 'dashboard-rrhh',
          label: 'RRHH',
          icon: '👥',
          onClick: ctx.onNavigateToRecursosHumanos,
          title: 'Dashboard Recursos Humanos'
        })
      }
      break
    case 'mostrador':
      if (ctx.canAccessMostradorViews && ctx.onNavigateToMostrador) {
        push({
          id: 'dashboard-mostrador',
          label: 'Mostrador',
          icon: '📋',
          onClick: ctx.onNavigateToMostrador,
          title: 'Dashboard Mostrador'
        })
      }
      break
    case 'caja':
      if (ctx.canManageCaja && ctx.onNavigateToCaja) {
        push({
          id: 'dashboard-caja',
          label: 'Caja',
          icon: '💰',
          onClick: ctx.onNavigateToCaja,
          title: 'Dashboard Caja'
        })
      }
      break
    case 'presupuestos':
      if (ctx.canAccessAsesorPresupuestos && ctx.onNavigateToAsesorPresupuestos) {
        push({
          id: 'dashboard-dt',
          label: 'DT',
          icon: '📐',
          onClick: ctx.onNavigateToAsesorPresupuestos,
          title: 'Asesor técnico / presupuestos'
        })
      } else if (ctx.canAccessMostradorViews && ctx.onNavigateToMostrador) {
        push({
          id: 'dashboard-mostrador',
          label: 'Mostrador',
          icon: '📋',
          onClick: ctx.onNavigateToMostrador,
          title: 'Dashboard Mostrador'
        })
      }
      break
    case 'compras':
      if (ctx.canManageCompras && ctx.onNavigateToCompras) {
        push({
          id: 'dashboard-compras',
          label: 'Compras',
          icon: '🛒',
          onClick: ctx.onNavigateToCompras,
          title: 'Dashboard Compras'
        })
      }
      break
    case 'diseno':
      if (ctx.onNavigateToDiseno) {
        push({
          id: 'dashboard-diseno',
          label: 'Diseño',
          icon: '🎨',
          onClick: ctx.onNavigateToDiseno,
          title: 'Dashboard Diseño'
        })
      }
      break
    case 'taller-grafico':
      push({
        id: 'dashboard-taller',
        label: 'Taller gráfico',
        icon: '🧩',
        href: '/taller-grafico/dashboard',
        title: 'Kanban Taller Gráfico'
      })
      break
    case 'imprenta':
      push({
        id: 'dashboard-imprenta',
        label: 'Imprenta',
        icon: '🖨️',
        href: '/impresoras',
        title: 'Ocupación de impresoras'
      })
      break
    case 'instalaciones':
      push({
        id: 'dashboard-campo-inst',
        label: 'App campo',
        icon: '📱',
        href: '/app-campo',
        title: 'App campo Instalaciones'
      })
      break
    case 'metalurgica':
      push({
        id: 'dashboard-metalurgica',
        label: 'Metalúrgica',
        icon: '🔧',
        href: '/metalurgica/inventario',
        title: 'Inventario Metalúrgica'
      })
      break
    case 'asesor-tecnico':
      if (ctx.canAccessAsesorPresupuestos && ctx.onNavigateToAsesorPresupuestos) {
        push({
          id: 'dashboard-dt',
          label: 'DT',
          icon: '📐',
          onClick: ctx.onNavigateToAsesorPresupuestos,
          title: 'Asesor técnico / presupuestos'
        })
      }
      break
    case 'administracion':
    case 'gerencia':
      if (ctx.isAdmin && ctx.onNavigateToStats) {
        push({
          id: 'dashboard-stats',
          label: 'Estadísticas',
          icon: '📊',
          onClick: ctx.onNavigateToStats,
          title: 'Estadísticas del tablero'
        })
      }
      if (ctx.isAdmin && ctx.onNavigateToERP) {
        push({
          id: 'dashboard-erp',
          label: 'ERP',
          icon: '💼',
          onClick: ctx.onNavigateToERP,
          title: 'Sistema ERP'
        })
      }
      break
    default:
      break
  }

  // ——— Vía Pública (administración, gerencia y presupuestos) ———
  if (ctx.isAdmin || rol === 'presupuestos') {
    push({
      id: 'via-publica',
      label: 'Vía Pública',
      icon: '🛣️',
      href: VIA_PUBLICA_URL,
      external: true,
      title: 'Vía Pública Plot Center'
    })
  }

  // ——— Accesos comunes visibles para todos los usuarios logueados ———
  push({
    id: 'menu-diario',
    label: 'Menú diario',
    icon: '🍽️',
    href: '/menu-diario',
    title: 'Menú del día y turnos'
  })

  if (ctx.onNavigateToFlota) {
    push({
      id: 'flota',
      label: 'Flota',
      icon: '🚗',
      onClick: ctx.onNavigateToFlota,
      title: 'Gestión de flota'
    })
  }

  // ——— Accesos frecuentes (todos los usuarios logueados) ———
  if (ctx.usuario) {
    if (ctx.canManageRecursosHumanos) {
      push({
        id: 'permisos',
        label: 'Permisos',
        icon: '📋',
        href: '/rrhh/permisos',
        title: 'Gestionar solicitudes de permisos'
      })
    } else if (ctx.onOpenPermisos) {
      push({
        id: 'permisos',
        label: 'Permisos',
        icon: '📋',
        onClick: ctx.onOpenPermisos,
        title: 'Solicitar permisos, turnos o vacaciones'
      })
    }
  }

  if (ctx.onSolicitarProductos) {
    push({
      id: 'solicitar-productos',
      label: 'Productos',
      icon: '📦',
      onClick: ctx.onSolicitarProductos,
      title: 'Solicitar productos faltantes'
    })
  }

  if (ctx.canAccessAtencionPublico && ctx.onNavigateToAtencionPublico) {
    push({
      id: 'atencion-publico',
      label: 'Atención',
      icon: '📞',
      onClick: ctx.onNavigateToAtencionPublico,
      title: 'Atención al público'
    })
  }

  return items
}
