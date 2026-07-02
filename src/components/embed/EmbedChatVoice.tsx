import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TotemPlotAILive,
  fetchTotemGeminiApiKey,
  fetchTotemLiveContext
} from '../../services/totemPlotAILiveService'
import { requestEmbedMicrophoneStream, isMicAvailableInEmbed } from '../../utils/embedMicPermission'
import './EmbedChatVoice.css'

type UseEmbedChatVoiceOptions = {
  userTexts: string[]
  disabled?: boolean
  identificacion?: {
    nombre?: string
    telefono?: string
    dni?: string
    cuit?: string
    op?: string
    empresa?: string
  }
  onUserTranscript?: (text: string) => void
  onModelTranscript?: (text: string) => void
}

function buildEmbedLiveSystemInstruction(contextBlock?: string): string {
  const clienteBlock = contextBlock?.trim()
    ? `\n\n${contextBlock}\n\nUsá SOLO datos reales del contexto. No inventes OPs ni fechas ni precios.`
    : '\n\nSi el cliente pregunta por su pedido pedile nombre DNI CUIT o número de OP.'

  return `Sos PlotAI el asistente de voz del chat web de Plot Center.

IDIOMA: español argentino natural para voz.

PERSONALIDAD: cordial servicial como atención en mostrador. Frases breves que suenen bien al hablar.

EMPRESA: Plot Center — comunicación visual en San Juan Argentina. 9 de Julio 622. Tel 2646212163.
${clienteBlock}

CONTACTO Y PRECIOS (obligatorio en chat web):
- Antes de cotizar precios o armar un pedido nuevo pedí nombre y WhatsApp si aún no los tenés.
- Cotizá SOLO con precios de Lista 1 del contexto cuando figuren. Si no hay precio en el contexto no inventes.
- Para consultas de OP usá solo datos reales del contexto.

REGLAS DE VOZ:
- Sin markdown asteriscos listas ni emojis.
- Una a tres frases salvo que pidan detalle.
- NUNCA inventes precios fechas ni números de OP.
- Si no tenés un dato decilo con honestidad.`
}

export function useEmbedChatVoice({
  userTexts,
  disabled,
  identificacion,
  onUserTranscript,
  onModelTranscript
}: UseEmbedChatVoiceOptions) {
  const liveRef = useRef<TotemPlotAILive | null>(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const stopLive = useCallback(() => {
    liveRef.current?.stop()
    liveRef.current = null
    setActive(false)
    setSpeaking(false)
    setStarting(false)
    setStatus('')
  }, [])

  useEffect(() => () => stopLive(), [stopLive])

  const micAvailable = isMicAvailableInEmbed()

  const toggleLive = async () => {
    if (active) {
      stopLive()
      return
    }
    if (disabled || starting) return
    setError(null)
    setStarting(true)
    setStatus('Conectando voz...')

    try {
      const micStream = await requestEmbedMicrophoneStream()

      const apiKey = await fetchTotemGeminiApiKey()
      let contextBlock = ''
      try {
        const ctx = await fetchTotemLiveContext(userTexts, {
          modo: 'web_publico',
          nombre: identificacion?.nombre,
          empresa: identificacion?.empresa,
          dni: identificacion?.dni,
          cuit: identificacion?.cuit,
          op: identificacion?.op
        })
        contextBlock = ctx.contextBlock
      } catch {
        /* contexto opcional */
      }

      const live = new TotemPlotAILive(apiKey)
      liveRef.current = live

      await live.start({
        micStream,
        systemInstruction: buildEmbedLiveSystemInstruction(contextBlock),
        callbacks: {
          onOpen: () => {
            setActive(true)
            setStarting(false)
            setStatus('Escuchando... hablá con PlotAI')
            live.sendGreetingNudge()
          },
          onUserTranscript: (text) => onUserTranscript?.(text),
          onModelTranscript: (text) => {
            onModelTranscript?.(text)
            setStatus('PlotAI responde...')
          },
          onSpeakingChange: (isSpeaking) => {
            setSpeaking(isSpeaking)
            setStatus(isSpeaking ? 'PlotAI está hablando...' : 'Escuchando...')
          },
          onError: (err) => {
            setError(err.message || 'Error de voz')
            stopLive()
          },
          onClose: () => stopLive()
        }
      })
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'No se pudo iniciar la llamada de voz'
      setError(msg)
      stopLive()
    }
  }

  return {
    active,
    starting,
    speaking,
    error,
    status,
    micAvailable,
    stopLive,
    toggleLive
  }
}

export function EmbedChatVoiceBanner({
  active,
  starting,
  speaking,
  error,
  status,
  onStop,
  onRetry,
  onOpenStandalone
}: {
  active: boolean
  starting: boolean
  speaking: boolean
  error: string | null
  status: string
  onStop: () => void
  onRetry?: () => void
  onOpenStandalone?: () => void
}) {
  if (!active && !starting && !error) return null
  return (
    <div
      className={`embed-voice-banner${error ? ' embed-voice-banner--error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <div className="embed-voice-banner-main">
        {!error && <span className={`embed-voice-pulse${speaking ? ' embed-voice-pulse--speaking' : ''}`} />}
        <span className="embed-voice-banner-text">{error || status || 'Conectando...'}</span>
      </div>
      {error && onRetry && (
        <button type="button" className="embed-voice-retry" onClick={onRetry}>
          Reintentar
        </button>
      )}
      {error && onOpenStandalone && (
        <button type="button" className="embed-voice-standalone" onClick={onOpenStandalone}>
          Pantalla completa
        </button>
      )}
      {active && !error && (
        <button type="button" className="embed-voice-stop" onClick={onStop}>
          Cortar
        </button>
      )}
    </div>
  )
}

export function EmbedChatVoiceButton({
  active,
  starting,
  disabled,
  micAvailable = true,
  onClick
}: {
  active: boolean
  starting: boolean
  disabled?: boolean
  micAvailable?: boolean
  onClick: () => void
}) {
  if (!micAvailable) return null
  return (
    <button
      type="button"
      className={`embed-voice-btn${active ? ' embed-voice-btn--active' : ''}`}
      onClick={onClick}
      disabled={disabled || starting}
      aria-label={active ? 'Finalizar llamada de voz' : 'Llamada de voz con PlotAI'}
      title={active ? 'Finalizar llamada' : 'Hablar con PlotAI (Gemini Live)'}
    >
      {starting ? '…' : active ? '⏹' : '🎤'}
    </button>
  )
}
