/** Paleta CMYK de proceso (impresión) — misma que TotemConsultaClientePage. */
const CMYK = {
  C: { bg: '#00AEEF', text: '#0f172a' },
  M: { bg: '#EC008C', text: '#ffffff' },
  Y: { bg: '#FFF200', text: '#0f172a' },
  K: { bg: '#231F20', text: '#ffffff' }
} as const

/** Colores de señalética del tótem (mismo criterio que TotemConsultaClientePage). */
export const TOTEM_SECTOR_STYLES: Array<{
  sectorDestino: string
  label: string
  bg: string
  textColor: string
}> = [
  {
    sectorDestino: 'Presupuestos y asesoramiento',
    label: 'Presupuestos',
    bg: CMYK.C.bg,
    textColor: CMYK.C.text
  },
  {
    sectorDestino: 'Recepción de pedidos',
    label: 'Recepción',
    bg: CMYK.Y.bg,
    textColor: CMYK.Y.text
  },
  {
    sectorDestino: 'Diseño gráfico y marketing',
    label: 'Diseño gráfico y marketing',
    bg: CMYK.M.bg,
    textColor: CMYK.M.text
  },
  // Alias de visitas anteriores (antes eran franjas separadas)
  {
    sectorDestino: 'Diseño gráfico',
    label: 'Diseño gráfico y marketing',
    bg: CMYK.M.bg,
    textColor: CMYK.M.text
  },
  {
    sectorDestino: 'Marketing y comunicación',
    label: 'Diseño gráfico y marketing',
    bg: CMYK.M.bg,
    textColor: CMYK.M.text
  },
  {
    sectorDestino: 'Entregas Taller Gráfico',
    label: 'Entregas Taller Gráfico',
    bg: CMYK.K.bg,
    textColor: CMYK.K.text
  },
  {
    sectorDestino: 'Entregas taller de imprenta',
    label: 'Entregas taller de imprenta',
    bg: '#F472B6',
    textColor: '#0f172a'
  }
]

const DEFAULT_SECTOR = {
  label: 'Mostrador',
  bg: CMYK.K.bg,
  textColor: CMYK.K.text
}

export function estiloSectorPorDestino(sectorDestino: string | null | undefined): {
  label: string
  bg: string
  textColor: string
} {
  const key = String(sectorDestino ?? '').trim().toLowerCase()
  if (!key) return DEFAULT_SECTOR
  const hit = TOTEM_SECTOR_STYLES.find((s) => s.sectorDestino.toLowerCase() === key)
  if (hit) return { label: hit.label, bg: hit.bg, textColor: hit.textColor }
  const partial = TOTEM_SECTOR_STYLES.find(
    (s) => key.includes(s.sectorDestino.toLowerCase()) || s.sectorDestino.toLowerCase().includes(key)
  )
  if (partial) return { label: partial.label, bg: partial.bg, textColor: partial.textColor }
  return { ...DEFAULT_SECTOR, label: sectorDestino || DEFAULT_SECTOR.label }
}

/** Notas del tótem: "Cliente se dirige a X (desde tótem). Motivo: Y" */
export function parsearNotasTotem(notas: string | null | undefined): {
  sectorDestino: string | null
  motivo: string | null
} {
  const text = String(notas ?? '').trim()
  if (!text) return { sectorDestino: null, motivo: null }
  const sectorMatch = text.match(/se dirige a\s+(.+?)\s*\(\s*desde\s+t[óo]tem\s*\)/i)
  const motivoMatch = text.match(/Motivo:\s*(.+)$/i)
  return {
    sectorDestino: sectorMatch?.[1]?.trim() ?? null,
    motivo: motivoMatch?.[1]?.trim() ?? null
  }
}
