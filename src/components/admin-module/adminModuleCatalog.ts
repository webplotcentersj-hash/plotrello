import type { Usuario } from '../../hooks/useAuth'

export type AdminModuleCategory =
  | 'produccion'
  | 'ventas'
  | 'finanzas'
  | 'compras'
  | 'rrhh'
  | 'logistica'
  | 'sistemas'

export type AdminModuleDef = {
  id: string
  title: string
  description: string
  icon: string
  path: string
  category: AdminModuleCategory
  /** Roles con acceso. 'all' = cualquier usuario staff. 'admin' = administración y gerencia. */
  roles: Usuario['rol'][] | 'all' | 'admin'
  accent: string
  /** Destacado en accesos rápidos del panel. */
  featured?: boolean
  /** Abrir en pestaña nueva (p. ej. panel admin.html). */
  openInNewTab?: boolean
  /** Acción especial en lugar de navegar. */
  action?: 'plotai' | 'backup' | 'pdf' | 'refresh'
}

export const CATEGORY_META: Record<
  AdminModuleCategory,
  { label: string; color: string; description: string }
> = {
  produccion: {
    label: 'Producción & OPs',
    color: '#eb671b',
    description: 'Tablero, diseño, asesoría y seguimiento de órdenes'
  },
  ventas: {
    label: 'Mostrador & Ventas',
    color: '#3b82f6',
    description: 'Atención, CRM, cuenta corriente y pedidos'
  },
  finanzas: {
    label: 'Finanzas & Caja',
    color: '#10b981',
    description: 'Caja, ERP, conciliaciones y tesorería'
  },
  compras: {
    label: 'Compras & Stock',
    color: '#8b5cf6',
    description: 'Pedidos, proveedores e inventario'
  },
  rrhh: {
    label: 'Recursos Humanos',
    color: '#f59e0b',
    description: 'Personal, incidencias y capacitaciones'
  },
  logistica: {
    label: 'Logística & Talleres',
    color: '#06b6d4',
    description: 'Flota, instalaciones e inventarios de taller'
  },
  sistemas: {
    label: 'Administración & Sistemas',
    color: '#f43f5e',
    description: 'Usuarios, reportes, herramientas y configuración'
  }
}

export const ROLE_LABELS: Record<Usuario['rol'], string> = {
  administracion: 'Admin',
  gerencia: 'Gerencia',
  'recursos-humanos': 'RRHH',
  diseno: 'Diseño',
  imprenta: 'Imprenta',
  'taller-grafico': 'Taller gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica',
  caja: 'Caja',
  mostrador: 'Mostrador',
  compras: 'Compras',
  'asesor-tecnico': 'Asesor técnico',
  presupuestos: 'Presupuestos',
  'operario-diseno': 'Operario diseño',
  'operario-bolsa': 'Operario bolsa'
}

const ADMIN_ROLES: Usuario['rol'][] = ['administracion', 'gerencia']

export function canUserAccessModule(
  rol: Usuario['rol'] | undefined,
  module: AdminModuleDef
): boolean {
  if (!rol) return false
  if (ADMIN_ROLES.includes(rol)) return true
  if (module.roles === 'all') return true
  if (module.roles === 'admin') return false
  return module.roles.includes(rol)
}

export function moduleRoleLabels(module: AdminModuleDef): string[] {
  if (module.roles === 'all') return ['Todos']
  if (module.roles === 'admin') return ['Admin', 'Gerencia']
  return module.roles.map((r) => ROLE_LABELS[r] ?? r)
}

export function resolveModuleNavigatePath(module: AdminModuleDef): string {
  if (module.id === 'tablero' || module.path === '/') return '/tablero'
  return module.path
}

export const ADMIN_MODULE_CATALOG: AdminModuleDef[] = [
  {
    id: 'tablero',
    title: 'Tablero Kanban',
    description: 'Órdenes de trabajo en columnas, drag & drop y seguimiento en vivo',
    icon: '🧩',
    path: '/tablero',
    category: 'produccion',
    roles: 'all',
    accent: '#eb671b',
    featured: true
  },
  {
    id: 'estadisticas',
    title: 'Estadísticas',
    description: 'Métricas y rendimiento del tablero',
    icon: '📈',
    path: '/statistics',
    category: 'produccion',
    roles: 'admin',
    accent: '#ef4444'
  },
  {
    id: 'asesor-presupuestos',
    title: 'Asesor & Presupuestos',
    description: 'Fichas No OP y flujo asesor → presupuestos',
    icon: '🧮',
    path: '/asesor-presupuestos',
    category: 'produccion',
    roles: ['asesor-tecnico', 'presupuestos', 'administracion'],
    accent: '#f59e0b'
  },
  {
    id: 'plot-design',
    title: 'Plot Design',
    description: 'Bolsa de trabajos de diseño gráfico',
    icon: '🎨',
    path: '/plot-design',
    category: 'produccion',
    roles: ['diseno', 'presupuestos', 'administracion', 'operario-diseno'],
    accent: '#a855f7'
  },
  {
    id: 'phi-landing',
    title: 'phi (φ)',
    description: 'Web pública Plot Design para diseñadores externos',
    icon: 'φ',
    path: 'https://phi-omega-one.vercel.app/',
    category: 'produccion',
    roles: 'all',
    accent: '#c026d3',
    openInNewTab: true
  },
  {
    id: 'bolsa-plot',
    title: 'Bolsa Plot',
    description: 'Trabajos de instalaciones y metalúrgica',
    icon: '🔩',
    path: '/bolsa-plot',
    category: 'produccion',
    roles: ['instalaciones', 'metalurgica', 'presupuestos', 'administracion', 'operario-bolsa'],
    accent: '#6366f1'
  },
  {
    id: 'diseno',
    title: 'Dashboard Diseño',
    description: 'Panel del sector diseño gráfico',
    icon: '✏️',
    path: '/diseno/dashboard',
    category: 'produccion',
    roles: ['diseno', 'administracion'],
    accent: '#ec4899'
  },
  {
    id: 'calendario',
    title: 'Calendario',
    description: 'Entregas y vencimientos de OPs',
    icon: '📅',
    path: '/calendario',
    category: 'produccion',
    roles: 'all',
    accent: '#14b8a6'
  },
  {
    id: 'gantt',
    title: 'Gantt',
    description: 'Planificación temporal de producción',
    icon: '📊',
    path: '/gantt',
    category: 'produccion',
    roles: 'admin',
    accent: '#0ea5e9'
  },
  {
    id: 'galeria',
    title: 'Galería de trabajos',
    description: 'Portfolio y referencias visuales',
    icon: '🖼️',
    path: '/galeria',
    category: 'produccion',
    roles: 'all',
    accent: '#d946ef'
  },
  {
    id: 'briefs',
    title: 'Briefs pendientes',
    description: 'Solicitudes de diseño por atender',
    icon: '📝',
    path: '/briefs-pendientes',
    category: 'produccion',
    roles: ['diseno', 'mostrador', 'administracion'],
    accent: '#f472b6'
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Buscar, alta, frecuentes y cuenta corriente',
    icon: '👥',
    path: '/clientes/dashboard',
    category: 'ventas',
    roles: ['mostrador', 'caja', 'presupuestos', 'administracion', 'gerencia'],
    accent: '#1d4ed8',
    featured: true
  },
  {
    id: 'mostrador',
    title: 'Mostrador',
    description: 'Dashboard de atención y entregas',
    icon: '🏪',
    path: '/mostrador/dashboard',
    category: 'ventas',
    roles: ['mostrador', 'caja', 'presupuestos', 'administracion', 'gerencia'],
    accent: '#3b82f6',
    featured: true
  },
  {
    id: 'crm-ventas',
    title: 'CRM Ventas',
    description: 'Pipeline comercial y seguimiento de clientes',
    icon: '🧾',
    path: '/crm-ventas',
    category: 'ventas',
    roles: ['mostrador', 'presupuestos', 'administracion', 'gerencia'],
    accent: '#6366f1',
    featured: true
  },
  {
    id: 'cuenta-corriente',
    title: 'Cuenta corriente',
    description: 'Cobranzas CC, aging y perfil de clientes',
    icon: '💳',
    path: '/clientes/cuenta-corriente',
    category: 'ventas',
    roles: ['mostrador', 'caja', 'administracion', 'gerencia'],
    accent: '#0ea5e9'
  },
  {
    id: 'atencion-publico',
    title: 'Atención al público',
    description: 'Cola y turnos de atención',
    icon: '🙋',
    path: '/atencion-publico',
    category: 'ventas',
    roles: 'all',
    accent: '#22d3ee'
  },
  {
    id: 'clientes-web',
    title: 'Clientes Web',
    description: 'Portal y gestión de clientes online',
    icon: '🌐',
    path: '/clientes-web/dashboard',
    category: 'ventas',
    roles: 'admin',
    accent: '#8b5cf6'
  },
  {
    id: 'caja',
    title: 'Caja',
    description: 'Movimientos, arqueos y cierre de caja',
    icon: '💰',
    path: '/caja/dashboard/admin',
    category: 'finanzas',
    roles: ['caja', 'administracion', 'gerencia'],
    accent: '#10b981',
    featured: true
  },
  {
    id: 'erp',
    title: 'ERP',
    description: 'Facturación, contabilidad y tesorería',
    icon: '🏭',
    path: '/erp',
    category: 'finanzas',
    roles: 'admin',
    accent: '#059669',
    featured: true
  },
  {
    id: 'conciliacion-bancaria',
    title: 'Conciliación bancaria',
    description: 'Match de extractos y movimientos',
    icon: '🏦',
    path: '/compras/conciliacion-bancaria',
    category: 'finanzas',
    roles: ['compras', 'administracion', 'gerencia'],
    accent: '#34d399'
  },
  {
    id: 'conciliacion-mp',
    title: 'Conciliación Mercado Pago',
    description: 'Cobros MP vs. sistema',
    icon: '📱',
    path: '/compras/conciliacion-mercadopago',
    category: 'finanzas',
    roles: ['compras', 'caja', 'administracion'],
    accent: '#2dd4bf'
  },
  {
    id: 'compras',
    title: 'Compras',
    description: 'Pedidos, presupuestos y proveedores',
    icon: '🛒',
    path: '/compras/dashboard',
    category: 'compras',
    roles: ['compras', 'administracion'],
    accent: '#8b5cf6',
    featured: true
  },
  {
    id: 'gestion-stock',
    title: 'Gestión de stock',
    description: 'Inventario y movimientos de materiales',
    icon: '📦',
    path: '/compras/gestion-stock',
    category: 'compras',
    roles: ['compras', 'administracion'],
    accent: '#a78bfa'
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    description: 'Catálogo y condiciones comerciales',
    icon: '🤝',
    path: '/compras/proveedores',
    category: 'compras',
    roles: ['compras', 'administracion'],
    accent: '#7c3aed'
  },
  {
    id: 'rrhh',
    title: 'RRHH',
    description: 'Dashboard de recursos humanos',
    icon: '🧑‍💼',
    path: '/rrhh/dashboard',
    category: 'rrhh',
    roles: ['recursos-humanos', 'administracion', 'gerencia'],
    accent: '#f59e0b',
    featured: true
  },
  {
    id: 'postulaciones',
    title: 'Postulaciones',
    description: 'Ingreso y seguimiento de candidatos',
    icon: '📨',
    path: '/rrhh/postulaciones',
    category: 'rrhh',
    roles: ['recursos-humanos', 'administracion'],
    accent: '#fbbf24'
  },
  {
    id: 'incidencias',
    title: 'Incidencias RRHH',
    description: 'Reclamos y novedades de personal',
    icon: '⚠️',
    path: '/rrhh/incidencias',
    category: 'rrhh',
    roles: ['recursos-humanos', 'administracion'],
    accent: '#fcd34d'
  },
  {
    id: 'menu-diario',
    title: 'Menú diario',
    description: 'Comedor y menú del día',
    icon: '🍽️',
    path: '/menu-diario',
    category: 'rrhh',
    roles: 'all',
    accent: '#fde047'
  },
  {
    id: 'flota',
    title: 'Flota',
    description: 'Vehículos, rutas y logística',
    icon: '🚚',
    path: '/flota',
    category: 'logistica',
    roles: 'admin',
    accent: '#06b6d4'
  },
  {
    id: 'taller-grafico',
    title: 'Taller gráfico',
    description: 'Dashboard e inventario del taller',
    icon: '🖨️',
    path: '/taller-grafico/dashboard',
    category: 'logistica',
    roles: ['taller-grafico', 'administracion'],
    accent: '#22d3ee'
  },
  {
    id: 'metalurgica',
    title: 'Metalúrgica',
    description: 'Inventario y producción metalúrgica',
    icon: '🔧',
    path: '/metalurgica/inventario',
    category: 'logistica',
    roles: ['metalurgica', 'administracion'],
    accent: '#0891b2'
  },
  {
    id: 'impresoras',
    title: 'Impresoras',
    description: 'Estado y ocupación de equipos',
    icon: '🖨️',
    path: '/impresoras',
    category: 'logistica',
    roles: ['taller-grafico', 'imprenta', 'administracion'],
    accent: '#67e8f9'
  },
  {
    id: 'usuarios',
    title: 'Usuarios',
    description: 'Gestión de cuentas y roles del sistema',
    icon: '👥',
    path: '/usuarios',
    category: 'sistemas',
    roles: 'admin',
    accent: '#f43f5e'
  },
  {
    id: 'reportes-admin',
    title: 'Estadísticas',
    description: 'Informes y métricas del tablero',
    icon: '📊',
    path: '/statistics',
    category: 'sistemas',
    roles: 'admin',
    accent: '#e11d48'
  },
  {
    id: 'op-eliminadas',
    title: 'OPs eliminadas',
    description: 'Auditoría y restauración de fichas',
    icon: '🗑️',
    path: '/op-eliminadas',
    category: 'sistemas',
    roles: 'admin',
    accent: '#be123c'
  },
  {
    id: 'plotai',
    title: 'PlotAI',
    description: 'Asistente inteligente con contexto del tablero',
    icon: '🤖',
    path: '#plotai',
    category: 'sistemas',
    roles: 'all',
    accent: '#a855f7',
    action: 'plotai',
    featured: true
  },
  {
    id: 'chat',
    title: 'Chat interno',
    description: 'Mensajería entre sectores',
    icon: '💬',
    path: '/chat',
    category: 'sistemas',
    roles: 'all',
    accent: '#818cf8'
  },
  {
    id: 'mensajeria',
    title: 'Mensajería',
    description: 'Comunicaciones y notificaciones',
    icon: '📧',
    path: '/mensajeria',
    category: 'sistemas',
    roles: 'all',
    accent: '#6366f1'
  },
  {
    id: 'protocolos',
    title: 'Protocolos',
    description: 'Bases y procedimientos operativos',
    icon: '📚',
    path: '/protocolos-bases',
    category: 'sistemas',
    roles: 'all',
    accent: '#94a3b8'
  },
  {
    id: 'panel-ejecutivo',
    title: 'Panel ejecutivo',
    description: 'Resumen gerencial (admin.html)',
    icon: '📈',
    path: '/admin.html',
    category: 'sistemas',
    roles: 'admin',
    accent: '#f97316',
    openInNewTab: true
  },
  {
    id: 'backup',
    title: 'Backup JSON',
    description: 'Exportar órdenes, historial y usuarios',
    icon: '💾',
    path: '#backup',
    category: 'sistemas',
    roles: 'admin',
    accent: '#34d399',
    action: 'backup'
  },
  {
    id: 'fichas-pdf',
    title: 'Fichas activas PDF',
    description: 'Exportar tablero Kanban a PDF',
    icon: '📑',
    path: '#pdf',
    category: 'sistemas',
    roles: 'admin',
    accent: '#fb7185',
    action: 'pdf'
  }
]
