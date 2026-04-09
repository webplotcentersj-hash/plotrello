/** Zona horaria usada para "hoy" en prompts de PlotAI (coherente con el negocio). */
const AR_TZ = 'America/Argentina/Buenos_Aires'

/**
 * Bloque de texto para inyectar en prompts: la fecha se calcula al momento de la llamada
 * (navegador o servidor), así mañana será el día correcto sin tocar código.
 */
export function formatPlotAITodayReferenceParagraph(): string {
  const now = new Date()
  const larga = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: AR_TZ,
  })
  const corta = now.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: AR_TZ,
  })
  return `FECHA DE REFERENCIA:
- Considerá que HOY es ${larga} (${corta}), hora Argentina (${AR_TZ}).
- Si hablás de plazos, fechas relativas, atrasos o "hace X días", calculalo en relación a esa fecha (no uses otra fecha como "hoy").`
}
