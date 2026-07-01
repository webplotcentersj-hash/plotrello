/** Mensaje para la UI cuando Postgres cancela por tiempo (tablero / getOrdenes). */
export function formatSupabaseStatementTimeoutError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (
    m.includes('statement timeout') ||
    m.includes('canceling statement') ||
    m.includes('tardó demasiado') ||
    m.includes('timeout') ||
    m.includes('aborted')
  ) {
    return 'Supabase está lento o saturado (incidente de plataforma o plan NANO). Reintentá en unos segundos; si persiste: dashboard.supabase.com → reiniciar proyecto o subir Compute. Luego recargá Plotrello.'
  }
  return raw
}
