export type ClienteNotifTipoMeta = {
  label: string
  accent: string
  bg: string
  border: string
}

const DEFAULT_META: ClienteNotifTipoMeta = {
  label: 'Aviso',
  accent: '#c2410c',
  bg: '#fff7ed',
  border: '#fdba74'
}

const TIPO_MAP: Record<string, ClienteNotifTipoMeta> = {
  op_desde_pedido: {
    label: 'Pedido → OP',
    accent: '#15803d',
    bg: '#ecfdf5',
    border: '#6ee7b7'
  },
  op_desde_brief: {
    label: 'Brief → OP',
    accent: '#15803d',
    bg: '#ecfdf5',
    border: '#6ee7b7'
  },
  mensaje_pedido: {
    label: 'Mensaje',
    accent: '#1d4ed8',
    bg: '#eff6ff',
    border: '#93c5fd'
  },
  pedido_estado: {
    label: 'Estado pedido',
    accent: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd'
  },
  reclamo: {
    label: 'Reclamo',
    accent: '#b45309',
    bg: '#fffbeb',
    border: '#fcd34d'
  }
}

export function metaNotificacionCliente(tipo: string): ClienteNotifTipoMeta {
  const key = tipo?.trim().toLowerCase() || ''
  if (TIPO_MAP[key]) return TIPO_MAP[key]
  if (key.includes('op')) return TIPO_MAP.op_desde_pedido
  if (key.includes('mensaje')) return TIPO_MAP.mensaje_pedido
  if (key.includes('reclamo')) return TIPO_MAP.reclamo
  return DEFAULT_META
}
