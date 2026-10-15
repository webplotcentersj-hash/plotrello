import type { TotemKioskIconName } from '../components/totem/TotemKioskIcons'

/** Hacia dónde apuntan las flechas de cada franja de la señalética. */
export type SectorDirection = 'planta-baja' | 'adelante' | 'primer-piso'

export const DIRECCION_TEXTO: Record<SectorDirection, string> = {
  'planta-baja': 'Seguí las flechas del piso hacia abajo',
  adelante: 'Seguí hacia adelante',
  'primer-piso': 'Subí por las escaleras'
}

export const DIRECCION_DETALLE: Record<SectorDirection, string> = {
  'planta-baja': 'Seguí las flechas hacia abajo hasta llegar a tu destino.',
  adelante: 'Seguí las flechas hacia adelante hasta llegar a tu destino.',
  'primer-piso': 'Subí al 1° piso por las escaleras y seguí las flechas en el piso hasta llegar a tu destino.'
}

/** Paleta CMYK de proceso (impresión) para la señalética del tótem. */
export const CMYK = {
  C: { bg: '#00AEEF', text: '#0f172a' },
  M: { bg: '#EC008C', text: '#ffffff' },
  Y: { bg: '#FFF200', text: '#0f172a' },
  K: { bg: '#231F20', text: '#ffffff' }
} as const

export type TotemSectorSenaletica = {
  id: string
  label: string
  icon: TotemKioskIconName
  sectorDestino: string
  bg: string
  textColor: string
  direction: SectorDirection
}

/**
 * Señalética: franjas horizontales; Diseño + Marketing → 1° piso (flecha arriba).
 * Fuente única para el tótem de autogestión y la señalética animada de tablet.
 */
export const TOTEM_SECTORS_QUEHACER: TotemSectorSenaletica[] = [
  {
    id: 'presupuestos',
    label: 'PRESUPUESTOS Y ASESORAMIENTO',
    icon: 'presupuestos',
    sectorDestino: 'Presupuestos y asesoramiento',
    bg: CMYK.C.bg,
    textColor: CMYK.C.text,
    direction: 'planta-baja'
  },
  {
    id: 'recepcion',
    label: 'RECEPCIÓN DE PEDIDOS',
    icon: 'recepcion',
    sectorDestino: 'Recepción de pedidos',
    bg: CMYK.Y.bg,
    textColor: CMYK.Y.text,
    direction: 'planta-baja'
  },
  {
    id: 'diseno',
    label: 'DISEÑO GRÁFICO Y MARKETING',
    icon: 'diseno',
    sectorDestino: 'Diseño gráfico y marketing',
    bg: CMYK.M.bg,
    textColor: CMYK.M.text,
    direction: 'primer-piso'
  },
  {
    id: 'caja',
    label: 'ENTREGAS TALLER GRÁFICO',
    icon: 'caja',
    sectorDestino: 'Entregas Taller Gráfico',
    bg: CMYK.K.bg,
    textColor: CMYK.K.text,
    direction: 'adelante'
  },
  {
    id: 'base_operaciones',
    label: 'ENTREGAS TALLER DE IMPRENTA',
    icon: 'base_operaciones',
    sectorDestino: 'Entregas taller de imprenta',
    bg: '#F472B6',
    textColor: '#0f172a',
    direction: 'adelante'
  }
]

/**
 * Imprimir es un flujo del tótem (no un sector que genere avisos al personal), por eso
 * no está en TOTEM_SECTORS_QUEHACER: se suma solo a la señalética animada de tablet.
 */
export const TOTEM_IMPRIMIR_SENALETICA: TotemSectorSenaletica = {
  id: 'imprimir',
  label: 'IMPRIMIR',
  icon: 'print',
  sectorDestino: 'Imprimir',
  bg: '#7C3AED',
  textColor: '#ffffff',
  direction: 'adelante'
}

/** Franjas de la señalética de tablet: las del tótem + Imprimir. */
export const TOTEM_SENALETICA_ITEMS: TotemSectorSenaletica[] = [
  ...TOTEM_SECTORS_QUEHACER,
  TOTEM_IMPRIMIR_SENALETICA
]
