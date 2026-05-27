import type { SatisfaccionEntregaAnalisisPayload } from './satisfaccionEntregaAnalisisData'

export async function fetchSatisfaccionEntregaInformeIA(
  analisis: SatisfaccionEntregaAnalisisPayload
): Promise<string> {
  const resp = await fetch('/api/plotai/satisfaccion-entrega-informe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analisis })
  })

  const json = (await resp.json().catch(() => ({}))) as { report?: string; error?: string }

  if (!resp.ok) {
    throw new Error(json.error || 'Error al generar el informe con IA.')
  }

  const report = (json.report || '').trim()
  if (!report) {
    throw new Error('La IA no devolvió contenido para el informe.')
  }

  return report
}
