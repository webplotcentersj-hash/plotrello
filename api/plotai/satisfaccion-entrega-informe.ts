import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

type Body = {
  analisis?: unknown
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const analisis = body?.analisis
  if (!analisis || typeof analisis !== 'object') {
    res.status(400).json({ error: 'analisis es requerido' })
    return
  }

  try {
    const payloadJson = JSON.stringify(analisis, null, 2)
    const prompt = `Sos un analista de calidad y experiencia del cliente en Plot Center (imprenta / producción gráfica, San Juan, Argentina).

Te pasan datos REALES de encuestas post-entrega (cliente firma y califica con emoji 1-5 al retirar el trabajo). Tu trabajo es interpretar EN QUÉ OPs fallamos y DE DÓNDE vienen las fallas.

REGLAS:
- Respondé en español argentino, profesional y accionable.
- Usá Markdown con títulos ## y ###.
- NO inventes OPs, sectores ni comentarios que no estén en el JSON.
- Si hay pocos datos, decilo y evitá conclusiones fuertes.
- Diferenciá: problema de producción/taller, de atención en mostrador/entrega, de plazo, de calidad del producto, o mezcla.
- Mencioná OPs concretas (número) cuando cites ejemplos.

ESTRUCTURA OBLIGATORIA DEL INFORME:

## Resumen ejecutivo
(3-5 líneas: situación general del período)

## OPs donde fallamos
(Lista priorizada: OP, nota, cliente, sector/estado si hay; qué dijo el cliente si hay comentario)

## De dónde vienen las fallas
- Por sector/área (usa agregados por_sector y por_estado)
- Patrones en comentarios (cita textos reales entre comillas)
- Posibles causas raíz (hipótesis basadas en datos, marcá cuáles son inferencia)

## Comparativa de notas
(Breve lectura de por_nota y % promotores/detractores)

## Acciones recomendadas
(5-8 acciones concretas: responsable sugerido — taller, mostrador, diseño, instalaciones — y prioridad alta/media)

## Seguimiento sugerido
(Qué revisar en las próximas entregas; OPs críticas a contactar)

DATOS (JSON):
${payloadJson}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    } as any)

    const text =
      (response as any)?.text ??
      (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
      ''

    if (!text || !String(text).trim()) {
      res.status(500).json({ error: 'Gemini no devolvió texto.' })
      return
    }

    res.status(200).json({ report: String(text) })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error al generar el informe con Gemini' })
  }
}
