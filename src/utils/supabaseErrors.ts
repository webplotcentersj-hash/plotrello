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
    return 'Supabase no responde (plan NANO saturado o spend cap). En dashboard.supabase.com: reiniciá el proyecto, subí Compute o desactivá spend cap. Luego recargá Plotrello.'
  }
  return raw
}
