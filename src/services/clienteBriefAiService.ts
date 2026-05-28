export type BriefCamposIa = 'all' | 'objetivo' | 'brief_publico' | 'estilo_diseno'

export type BriefIaResult = {
  objetivo_proyecto: string
  brief_publico: string
  estilo_diseno: string
}

export async function generarBriefCamposIa(input: {
  contexto: string
  campo?: BriefCamposIa
  indicacion?: string
}): Promise<BriefIaResult> {
  const resp = await fetch('/api/plotai/brief-completo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contexto: input.contexto,
      campo: input.campo || 'all',
      indicacion: input.indicacion
    })
  })
  const json = (await resp.json().catch(() => ({}))) as BriefIaResult & { error?: string }
  if (!resp.ok) {
    throw new Error(json.error || 'No se pudo generar el brief con IA.')
  }
  return {
    objetivo_proyecto: json.objetivo_proyecto || '',
    brief_publico: json.brief_publico || '',
    estilo_diseno: json.estilo_diseno || ''
  }
}

export { generarMockupImagenIa } from './clientePedidoAiService'
