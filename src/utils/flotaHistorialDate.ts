/** Convierte input type=date (YYYY-MM-DD) a ISO inicio/fin de día (local) para filtrar `hora_salida` en Supabase. */
export function dateInputToIsoStartLocal(ymd: string): string | undefined {
  const s = (ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const d = new Date(s + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function dateInputToIsoEndLocal(ymd: string): string | undefined {
  const s = (ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const d = new Date(s + 'T23:59:59.999')
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
