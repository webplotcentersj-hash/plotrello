/** Sectores de producción a los que puede volver una OP en reclamo (rehacer). */
export const SECTORES_PRODUCCION_RECLAMO = [
  'Metalúrgica',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Imprenta (Área de Impresión)',
  'Instalaciones'
] as const

export type SectorProduccionReclamo = (typeof SECTORES_PRODUCCION_RECLAMO)[number]

/** Opciones del modal de reclamo (sin alias duplicados del kanban). */
export const DESTINOS_RECLAMO_UI: ReadonlyArray<{ value: SectorProduccionReclamo; label: string }> = [
  { value: 'Taller de Imprenta', label: 'Taller de Imprenta' },
  { value: 'Metalúrgica', label: 'Metalúrgica' },
  { value: 'Taller Gráfico', label: 'Taller Gráfico' },
  { value: 'Instalaciones', label: 'Instalaciones' }
]

export function esDestinoProduccionReclamo(sector: string | null | undefined): sector is SectorProduccionReclamo {
  const s = (sector ?? '').trim()
  return (SECTORES_PRODUCCION_RECLAMO as readonly string[]).includes(s)
}

const TERMINALES = new Set([
  'Almacén de Entrega',
  'Finalizado en Taller',
  'Entregado o Instalado'
])

function norm(s: string | null | undefined): string {
  return (s ?? '').trim()
}

function isProduccion(sector: string): sector is SectorProduccionReclamo {
  return (SECTORES_PRODUCCION_RECLAMO as readonly string[]).includes(sector)
}

/**
 * Resuelve a qué columna de producción vuelve una OP al marcar reclamo
 * desde Almacén / Finalizado / Entregado.
 *
 * Prioridad:
 * 1. Último sector de producción en el historial (antes del terminal)
 * 2. `sectores[]` de la OP (Metalúrgica > Imprenta > Taller Gráfico > Instalaciones)
 * 3. `sector_inicial` si es de producción
 * 4. Inferencia por texto (metal / hierro / estructura → Metalúrgica; resto → Taller de Imprenta)
 */
export function resolverDestinoProduccionReclamo(input: {
  sectorInicial?: string | null
  sectores?: string[] | null
  historialEstados?: Array<{ estado_anterior?: string | null; estado_nuevo?: string | null }> | null
  descripcion?: string | null
  materiales?: string | null
  tipoImpresion?: string | null
}): string {
  const hist = input.historialEstados || []
  for (const h of hist) {
    const ant = norm(h.estado_anterior)
    const neu = norm(h.estado_nuevo)
    // Paso a terminal: el anterior es el taller que corresponde
    if (TERMINALES.has(neu) && isProduccion(ant)) return ant
    if (isProduccion(ant) && !TERMINALES.has(ant)) return ant
    if (isProduccion(neu) && !TERMINALES.has(neu)) return neu
  }

  const lista = (input.sectores || []).map(norm).filter(Boolean)
  const prioridad: SectorProduccionReclamo[] = [
    'Metalúrgica',
    'Taller de Imprenta',
    'Imprenta (Área de Impresión)',
    'Taller Gráfico',
    'Instalaciones'
  ]
  for (const p of prioridad) {
    if (lista.includes(p)) return p
  }

  const inicial = norm(input.sectorInicial)
  if (isProduccion(inicial)) return inicial

  const blob = `${input.descripcion || ''} ${input.materiales || ''} ${input.tipoImpresion || ''}`.toLowerCase()
  if (
    /metalurg|metalúrg|hierro|acero|estructura|soldad|chapa|perfil|portón|porton|reja|marco metálico|marco metalico/.test(
      blob
    )
  ) {
    return 'Metalúrgica'
  }
  if (/instalaci[oó]n|colocaci[oó]n|montaje en (obra|sitio|local)/.test(blob)) {
    return 'Instalaciones'
  }
  if (/corte|router|cnc|acabado|plotter de corte|vinilo de corte/.test(blob) && !/impres/.test(blob)) {
    return 'Taller Gráfico'
  }

  return 'Taller de Imprenta'
}

export function esEstadoTerminalReclamo(estado: string | null | undefined): boolean {
  return TERMINALES.has(norm(estado))
}
