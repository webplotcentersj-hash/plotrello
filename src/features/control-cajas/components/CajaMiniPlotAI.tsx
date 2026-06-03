import { useState } from 'react'
import { generateContent } from '../../../services/plotAIService'

type Props = {
  titulo?: string
  contexto: string
  preguntaDefault?: string
}

export default function CajaMiniPlotAI({
  titulo = 'Asistente PlotAI',
  contexto,
  preguntaDefault = 'Resumí el estado, priorizá acciones y pasos concretos para resolver.'
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analizar = async () => {
    setLoading(true)
    setError(null)
    setRespuesta(null)
    try {
      const text = await generateContent({
        contents: preguntaDefault,
        extraContextPrefix: contexto,
        useCompleteContext: false,
        useMemory: false,
        includeAppManual: false,
        learnFromResponse: false
      })
      setRespuesta(text.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar PlotAI')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="caja-cc-mini-ai">
      <button
        type="button"
        className="caja-cc-mini-ai-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span aria-hidden>✨</span> {titulo} {open ? '▼' : '▶'}
      </button>
      {open && (
        <div className="caja-cc-mini-ai-body">
          <p className="caja-cc-help">Usa los datos cargados en caja (planillas, movimientos, conciliaciones).</p>
          <button type="button" className="btn-secondary btn-small" disabled={loading} onClick={() => void analizar()}>
            {loading ? 'Analizando…' : 'Analizar con PlotAI'}
          </button>
          {error && <p className="caja-cc-error">{error}</p>}
          {respuesta && <div className="caja-cc-mini-ai-response">{respuesta}</div>}
        </div>
      )}
    </section>
  )
}
