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
    bg: '#7dd3fc',
    textColor: '#0f172a'
  },
  {
    sectorDestino: 'Recepción de pedidos',
    label: 'Recepción',
    bg: '#facc15',
    textColor: '#0f172a'
  },
  {
    sectorDestino: 'Diseño gráfico',
    label: 'Diseño gráfico',
    bg: '#ec4899',
    textColor: '#ffffff'
  },
  {
    sectorDestino: 'Caja / Entrega de pedidos',
    label: 'Caja',
    bg: '#1f2937',
    textColor: '#ffffff'
  },
  {
    sectorDestino: 'Base de operaciones',
    label: 'Base de operaciones',
    bg: '#f97316',
    textColor: '#0f172a'
  },
  {
    sectorDestino: 'Marketing y comunicación',
    label: 'Marketing',
    bg: '#ffffff',
    textColor: '#0f172a'
  }
]

const DEFAULT_SECTOR = {
  label: 'Mostrador',
  bg: '#6366f1',
  textColor: '#ffffff'
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
