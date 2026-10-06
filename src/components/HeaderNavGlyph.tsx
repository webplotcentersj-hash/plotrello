export type HeaderGlyphId =
  | 'compass'
  | 'toolbox'
  | 'palette'
  | 'bag'
  | 'chart'
  | 'briefcase'
  | 'road'
  | 'users'
  | 'utensils'
  | 'car'
  | 'clipboard'
  | 'timer'
  | 'box'
  | 'phone'
  | 'note'
  | 'mail'
  | 'calendar'
  | 'userCog'
  | 'receipt'
  | 'cart'
  | 'vault'
  | 'printer'
  | 'ruler'
  | 'flask'
  | 'wrench'
  | 'kanban'
  | 'book'
  | 'door'
  | 'phoneApp'
  | 'globe'
  | 'file'
  | 'scroll'
  | 'grad'
  | 'check'
  | 'orders'
  | 'spark'
  | 'menu'
  | 'grid'
  | 'bell'
  | 'close'
  | 'history'
  | 'chat'

const paths: Record<HeaderGlyphId, string> = {
  compass:
    'M12 3.5A8.5 8.5 0 1 1 3.5 12 8.5 8.5 0 0 1 12 3.5Zm0 0V2m0 20v-1.5M22 12h-1.5M3.5 12H2m7.2-1.4 5.4-2.2-2.2 5.4-5.4 2.2 2.2-5.4Z',
  toolbox:
    'M4 9.5h16v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9.5Zm2-4h4.2a2 2 0 0 1 1.6.8L13 8h5V9.5H6V5.5Zm6 8.5h4',
  palette:
    'M12 4a8 8 0 0 1 7.7 10.2c-.4 1.3-1.8 1.8-3.1 1.3l-1.4-.5a2.2 2.2 0 0 0-2.8 1.2 3 3 0 0 1-2.8 1.8A5.6 5.6 0 0 1 4.8 12 7.2 7.2 0 0 1 12 4Zm-3.2 5.2h.01M15.4 7.8h.01M17.2 11.4h.01',
  bag: 'M7 8V7a5 5 0 0 1 10 0v1m-11 0h12l-.8 11.2A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.8L6 8Z',
  chart:
    'M4 19.5h16M7.5 16.5V11m4.5 5.5V8m4.5 8.5V12.5',
  briefcase:
    'M4 8.5h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Zm4-4h8v4H8v-4Zm-4 8h16',
  road: 'M12 3v3m0 4v4m0 4v3M5 6.5 8 20m11-13.5L16 20',
  users:
    'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.2-1.2a2.4 2.4 0 1 0 0-4.2M4.2 19c.4-2.8 2.6-4.5 4.3-4.5s3.9 1.7 4.3 4.5M14 14.6c1.5 0 3.3 1.3 3.8 3.4',
  utensils:
    'M7 4v7a1.5 1.5 0 0 0 3 0V4M8.5 11v9M16 4v6.5a2 2 0 0 1-2 2H13V4m3 8.5V21',
  car: 'M4.5 14.5h15l-1.2-4.2A2 2 0 0 0 16.4 9H7.6a2 2 0 0 0-1.9 1.3L4.5 14.5Zm0 0v3.2a1 1 0 0 0 1 1h1.8v-1.2m10.4 1.2h1.8a1 1 0 0 0 1-1v-3.2m-3.8 4.2v-1.2M7 17.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm10 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  clipboard:
    'M9 5.5h6m-5.2 0V4.2A1.2 1.2 0 0 1 11 3h2a1.2 1.2 0 0 1 1.2 1.2V5.5M8 5.5h8.2A1.8 1.8 0 0 1 18 7.3V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7.3A1.8 1.8 0 0 1 7.8 5.5H8Zm1.5 6h5m-5 3.5h5',
  timer:
    'M12 8v5l3 1.8M12 4.2A8 8 0 1 0 20 12M9.5 3.5h5',
  box: 'M4.5 8.2 12 4.5l7.5 3.7v7.6L12 19.5 4.5 15.8V8.2Zm0 0L12 12m7.5-3.8L12 12m0 0v7.5',
  phone:
    'M8.2 4.8c.4-.8 1.4-1.1 2.2-.7l1.6.8c.7.4.9 1.3.5 2l-.8 1.4a1.4 1.4 0 0 0 .2 1.6l3.2 3.2a1.4 1.4 0 0 0 1.6.2l1.4-.8c.7-.4 1.6-.2 2 .5l.8 1.6c.4.8.1 1.8-.7 2.2l-1.3.6c-1.6.8-3.8.3-6.4-2.3S6.8 8.9 7.6 7.3l.6-2.5Z',
  note: 'M7 4.5h7.5L19 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Zm7.5 0V9H19M8.5 13h7m-7 3.2h5',
  mail: 'M4.5 7.5h15v10h-15v-10Zm0 0 7.5 5.5 7.5-5.5',
  calendar:
    'M6 6.5h12a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V8.5a2 2 0 0 1 2-2Zm0 0V4.5M18 6.5V4.5M4.5 10h15',
  userCog:
    'M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-4.6 8c.5-2.6 2.5-4.2 4.6-4.2 1.1 0 2.2.4 3.1 1.1M17.5 14.2v1.2m0 3.2v1.2m-2.6-4.6 1 .7m3.2 2.2 1 .7m-5.2 0 1-.7m3.2-2.2 1-.7m.3 2.6a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0Z',
  receipt:
    'M7 4.5h10v16l-1.6-1.1-1.6 1.1-1.6-1.1-1.6 1.1-1.6-1.1L7 20.5v-16Zm3 4.2h4.5M10 12h4.5M10 15.2h3',
  cart: 'M5 6.5h1.6l1.4 9h10.2l1.6-6.4H8M9.2 19.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7.6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  vault:
    'M5 7.5h14v11H5v-11Zm7 2.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm0 2.2v2',
  printer:
    'M7 4.5h10V8H7V4.5Zm-2 4h14v7.5h-2.5v-3h-9v3H5V8.5Zm4.5 6.5h5V20h-5v-5Z',
  ruler: 'M5 16.5 16.5 5l2.5 2.5L7.5 19 5 16.5Zm3.2-1.1 1.4 1.4m1.4-3.2 1.4 1.4m1.4-3.2 1.4 1.4',
  flask: 'M9.2 3.5h5.6M10 3.5v5.2L6.6 16a3.6 3.6 0 0 0 3.1 5h4.6a3.6 3.6 0 0 0 3.1-5L14 8.7V3.5',
  wrench:
    'M14.8 6.2a3.6 3.6 0 0 1 3.4 4.4L14 14.8l-4.8-4.8 4.2-4.2a3.6 3.6 0 0 1 1.4.4Zm-6 8.4-3.4 3.4a1.6 1.6 0 0 0 2.2 2.2l3.4-3.4',
  kanban: 'M5 5.5h4.2v13H5v-13Zm5.2 0h3.6v8.5h-3.6V5.5Zm4.8 0H19v11h-4V5.5Z',
  book: 'M6 5.5h11.2A1.8 1.8 0 0 1 19 7.3V19H8.2A2.2 2.2 0 0 0 6 21.2V5.5Zm0 0v13.5',
  door: 'M6.5 4.5h8.5v16H6.5v-16Zm8.5 3.5 3.5 2v8.5H15M13 13.2h.01',
  phoneApp:
    'M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5-1.5ZM10 18h4',
  globe:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-6.5 8h13M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16',
  file: 'M7 4.5h7.2L18 8.3V19.5H7v-15Zm7.2 0V8.3H18',
  scroll:
    'M7 6.5h9.5A1.5 1.5 0 0 1 18 8v9.2H8.5A1.5 1.5 0 0 0 7 18.7V6.5Zm0 0A1.5 1.5 0 0 0 5.5 8v.8H7',
  grad: 'M3.5 10.5 12 6l8.5 4.5L12 15 3.5 10.5Zm4.8 3.2v3.6c0 .8 1.6 2.2 3.7 2.2s3.7-1.4 3.7-2.2v-3.6',
  check: 'M6.5 12.2 10 16l7.5-8.2M5 19.5h14',
  orders:
    'M7 6.5h10M7 11h10M7 15.5h6M17.5 17l1.6 1.6 3-3.2',
  spark:
    'M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9 12 3.5Z',
  menu: 'M5 7h14M5 12h14M5 17h14',
  grid: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z',
  bell: 'M12 4.5a5.2 5.2 0 0 1 5.2 5.2c0 3.4.8 4.6 1.3 5.3H5.5c.5-.7 1.3-1.9 1.3-5.3A5.2 5.2 0 0 1 12 4.5ZM10 18.4a2 2 0 0 0 4 0',
  close: 'M6 6l12 12M18 6 6 18',
  history: 'M4.6 12A7.4 7.4 0 1 0 7 6.2M4.6 4.8v4.2H8.8M12 8v4.4l3.1 1.8',
  chat: 'M5 6.2h14v9.2H9.4L5 19.2V6.2Zm4 3.6h6M9 12.6h4.5'
}

export function HeaderNavGlyph({ id, size = 20 }: { id: HeaderGlyphId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[id]} />
    </svg>
  )
}

export type HeaderGlyphTone = 'orange' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo' | 'lime' | 'slate'

const ID_META: Record<string, { glyph: HeaderGlyphId; tone: HeaderGlyphTone }> = {
  'panel-admin': { glyph: 'compass', tone: 'orange' },
  'dashboard-rrhh': { glyph: 'users', tone: 'violet' },
  'dashboard-mostrador': { glyph: 'clipboard', tone: 'sky' },
  'dashboard-caja': { glyph: 'vault', tone: 'emerald' },
  'dashboard-dt': { glyph: 'ruler', tone: 'amber' },
  'dashboard-compras': { glyph: 'cart', tone: 'cyan' },
  'dashboard-diseno': { glyph: 'palette', tone: 'violet' },
  'dashboard-taller': { glyph: 'kanban', tone: 'indigo' },
  'dashboard-imprenta': { glyph: 'printer', tone: 'slate' },
  'dashboard-campo-inst': { glyph: 'phoneApp', tone: 'lime' },
  'dashboard-metalurgica': { glyph: 'wrench', tone: 'amber' },
  'dashboard-stats': { glyph: 'chart', tone: 'sky' },
  'dashboard-erp': { glyph: 'briefcase', tone: 'orange' },
  'plot-design': { glyph: 'palette', tone: 'violet' },
  'plot-design-admin': { glyph: 'palette', tone: 'violet' },
  'plot-design-externo': { glyph: 'palette', tone: 'violet' },
  'plot-ai-studio': { glyph: 'spark', tone: 'indigo' },
  'bolsa-plot-admin': { glyph: 'bag', tone: 'emerald' },
  'bolsa-plot-externo': { glyph: 'bag', tone: 'emerald' },
  'bolsa-plot-inst': { glyph: 'bag', tone: 'emerald' },
  'bolsa-plot-metal': { glyph: 'bag', tone: 'emerald' },
  'plotbolsa': { glyph: 'bag', tone: 'lime' },
  'panol-taller-imprenta': { glyph: 'toolbox', tone: 'amber' },
  'panol-taller-imprenta-admin': { glyph: 'toolbox', tone: 'amber' },
  'panol-taller-imprenta-gerencia': { glyph: 'toolbox', tone: 'amber' },
  'via-publica': { glyph: 'road', tone: 'cyan' },
  'clientes-consulta': { glyph: 'users', tone: 'sky' },
  'clientes-dashboard': { glyph: 'users', tone: 'sky' },
  'menu-diario': { glyph: 'utensils', tone: 'rose' },
  flota: { glyph: 'car', tone: 'indigo' },
  permisos: { glyph: 'clipboard', tone: 'amber' },
  'horas-extra': { glyph: 'timer', tone: 'orange' },
  'solicitar-productos': { glyph: 'box', tone: 'cyan' },
  'atencion-publico': { glyph: 'phone', tone: 'emerald' },
  'actividades-operarios': { glyph: 'note', tone: 'violet' },
  mensajeria: { glyph: 'mail', tone: 'sky' },
  'app-campo': { glyph: 'phoneApp', tone: 'lime' },
  calendario: { glyph: 'calendar', tone: 'indigo' },
  usuarios: { glyph: 'userCog', tone: 'slate' },
  ventas: { glyph: 'receipt', tone: 'emerald' },
  'impresoras-totem': { glyph: 'printer', tone: 'slate' },
  'portal-web': { glyph: 'globe', tone: 'cyan' },
  'inventario-tg': { glyph: 'flask', tone: 'lime' },
  'inventario-metal': { glyph: 'wrench', tone: 'amber' },
  'kanban-tg': { glyph: 'kanban', tone: 'indigo' },
  briefs: { glyph: 'file', tone: 'violet' },
  'libro-actas': { glyph: 'scroll', tone: 'amber' },
  protocolos: { glyph: 'book', tone: 'slate' },
  capacitaciones: { glyph: 'grad', tone: 'sky' },
  evaluaciones: { glyph: 'check', tone: 'emerald' },
  manual: { glyph: 'book', tone: 'orange' },
  'mis-pedidos': { glyph: 'orders', tone: 'cyan' },
  salir: { glyph: 'door', tone: 'rose' }
}

export function glyphMetaForNavId(id: string): { glyph: HeaderGlyphId; tone: HeaderGlyphTone } {
  return ID_META[id] ?? { glyph: 'grid', tone: 'slate' }
}
