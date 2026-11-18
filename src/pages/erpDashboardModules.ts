import {
  Barcode,
  BookOpen,
  CalendarClock,
  Calculator,
  ChartColumn,
  CreditCard,
  Handshake,
  Landmark,
  ListTree,
  NotebookPen,
  Package,
  Receipt,
  Scale,
  ScanLine,
  Settings,
  ShieldCheck,
  Truck,
  Wallet,
  type LucideIcon
} from 'lucide-react'

export type ErpGroupId = 'ventas' | 'finanzas' | 'contabilidad' | 'herramientas'

export type ErpGroupDef = {
  id: ErpGroupId
  title: string
  description: string
  /** Un solo color por grupo: las tarjetas del mismo grupo comparten acento. */
  accent: string
}

export type ErpModuleDef = {
  id: string
  group: ErpGroupId
  title: string
  description: string
  icon: LucideIcon
  path: string
  keywords: string[]
  /** Abrir en pestaña nueva (p. ej. PWA del lector AFIP). */
  openInNewTab?: boolean
}

export const ERP_GROUPS: ErpGroupDef[] = [
  { id: 'ventas', title: 'Ventas y operación', description: 'Facturación, remitos, comisiones y stock', accent: '#34d399' },
  { id: 'finanzas', title: 'Finanzas', description: 'Tesorería, gastos, costos y reportes', accent: '#38bdf8' },
  { id: 'contabilidad', title: 'Contabilidad e impuestos', description: 'Asientos, plan de cuentas, IVA y AFIP', accent: '#a78bfa' },
  { id: 'herramientas', title: 'Herramientas y configuración', description: 'AFIP, códigos de barras y administración', accent: '#fbbf24' }
]

export const GROUP_BY_ID = Object.fromEntries(ERP_GROUPS.map((g) => [g.id, g])) as Record<ErpGroupId, ErpGroupDef>

export const CONTABLE_MODULES: ErpModuleDef[] = [
  // Ventas y operación
  {
    id: 'facturas',
    group: 'ventas',
    title: 'Facturación',
    description: 'Crear y gestionar facturas de venta',
    icon: Receipt,
    path: '/erp/facturas',
    keywords: ['factura', 'facturacion', 'comprobante', 'cae', 'venta']
  },
  {
    id: 'remitos',
    group: 'ventas',
    title: 'Remitos',
    description: 'Remitos X y R (con CAI): entregas parciales, devoluciones y traslados',
    icon: Truck,
    path: '/remitos',
    keywords: ['remito', 'entrega', 'parcial', 'despacho', 'pendiente']
  },
  {
    id: 'comisiones',
    group: 'ventas',
    title: 'Comisiones',
    description: 'Comisiones por ventas y liquidaciones mensuales',
    icon: Handshake,
    path: '/erp/comisiones',
    keywords: ['comisiones', 'vendedores', 'liquidacion', 'ventas', 'premios']
  },
  {
    id: 'stock',
    group: 'ventas',
    title: 'Stock / Inventario',
    description: 'Existencias, movimientos y reportes',
    icon: Package,
    path: '/erp/stock',
    keywords: ['stock', 'inventario', 'deposito', 'existencias']
  },
  // Finanzas
  {
    id: 'tesoreria',
    group: 'finanzas',
    title: 'Tesorería',
    description: 'Cobros, pagos, vencimientos y flujo de caja',
    icon: Wallet,
    path: '/erp/tesoreria',
    keywords: ['tesoreria', 'cobros', 'pagos', 'banco', 'caja', 'vencimientos']
  },
  {
    id: 'gastos',
    group: 'finanzas',
    title: 'Gastos',
    description: 'Gastos corrientes, tickets y estadísticas',
    icon: CreditCard,
    path: '/erp/gastos',
    keywords: ['gastos', 'ticket', 'rendicion', 'egreso']
  },
  {
    id: 'gastos-fijos',
    group: 'finanzas',
    title: 'Gastos fijos',
    description: 'Alquiler, servicios, sueldos y abonos con vencimientos',
    icon: CalendarClock,
    path: '/erp/gastos-fijos',
    keywords: ['gastos', 'fijos', 'recurrentes', 'alquiler', 'servicios', 'abonos', 'vencimientos', 'mensual']
  },
  {
    id: 'costos',
    group: 'finanzas',
    title: 'Control de costos',
    description: 'Costos por orden de trabajo',
    icon: Calculator,
    path: '/erp/costos',
    keywords: ['costos', 'op', 'orden', 'margen']
  },
  {
    id: 'reportes',
    group: 'finanzas',
    title: 'Reportes financieros',
    description: 'Resultados, balance y flujo de caja',
    icon: ChartColumn,
    path: '/erp/reportes',
    keywords: ['reportes', 'balance', 'resultados', 'kpi', 'informes']
  },
  {
    id: 'balance-economico',
    group: 'finanzas',
    title: 'Balance económico',
    description: 'Ventas (incl. CC), gastos, proveedores, egresos y liquidaciones',
    icon: Scale,
    path: '/erp/balance-economico',
    keywords: [
      'balance',
      'economico',
      'ventas',
      'cuenta corriente',
      'gastos',
      'fijos',
      'proveedores',
      'egresos',
      'sueldos',
      'liquidacion',
      'empleados'
    ]
  },
  // Contabilidad e impuestos
  {
    id: 'contabilidad',
    group: 'contabilidad',
    title: 'Contabilidad',
    description: 'Asientos, plan de cuentas y reportes contables',
    icon: BookOpen,
    path: '/erp/contabilidad',
    keywords: ['contabilidad', 'asientos', 'libro', 'mayor', 'diario']
  },
  {
    id: 'asientos',
    group: 'contabilidad',
    title: 'Asientos contables',
    description: 'Gestión con partida doble',
    icon: NotebookPen,
    path: '/erp/asientos',
    keywords: ['asiento', 'partida', 'doble', 'contable']
  },
  {
    id: 'plan-cuentas',
    group: 'contabilidad',
    title: 'Plan de cuentas',
    description: 'Estructura contable del negocio',
    icon: ListTree,
    path: '/erp/plan-cuentas',
    keywords: ['plan', 'cuentas', 'rubros', 'estructura']
  },
  {
    id: 'impuestos',
    group: 'contabilidad',
    title: 'Impuestos',
    description: 'AFIP, IVA y reportes impositivos',
    icon: Landmark,
    path: '/erp/impuestos',
    keywords: ['impuestos', 'iva', 'afip', 'arca', 'fiscal']
  },
  // Herramientas y configuración
  {
    id: 'config-afip',
    group: 'herramientas',
    title: 'Configuración AFIP',
    description: 'Facturación electrónica y homologación',
    icon: ShieldCheck,
    path: '/erp/configuracion-afip',
    keywords: ['afip', 'cae', 'certificado', 'punto venta', 'homologacion']
  },
  {
    id: 'codigo-barras-afip',
    group: 'herramientas',
    title: 'Código de barras AFIP',
    description: 'Generar ITF RG 1702 (CUIT, tipo, PV, CAE y vencimiento)',
    icon: Barcode,
    path: '/generador-codigo-barras-afip',
    keywords: ['codigo', 'barras', 'afip', 'itf', 'cae', 'cai', 'rg1702', 'generador']
  },
  {
    id: 'lector-barras-afip',
    group: 'herramientas',
    title: 'Lector AFIP',
    description: 'Leer con la cámara el código de barras de comprobantes',
    icon: ScanLine,
    path: '/lector-afip/',
    keywords: ['lector', 'escaner', 'camara', 'barras', 'afip', 'itf', 'cae', 'rg1702'],
    openInNewTab: true
  },
  {
    id: 'admin',
    group: 'herramientas',
    title: 'Administración',
    description: 'Circuitos, roles y checklist',
    icon: Settings,
    path: '/erp/admin',
    keywords: ['admin', 'configuracion', 'circuitos', 'roles']
  }
]
