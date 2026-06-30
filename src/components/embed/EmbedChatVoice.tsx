import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TotemPlotAILive,
  fetchTotemGeminiApiKey,
  fetchTotemLiveContext
} from '../../services/totemPlotAILiveService'
import './EmbedChatVoice.css'

type UseEmbedChatVoiceOptions = {
  userTexts: string[]
  disabled?: boolean
  onUserTranscript?: (text: string) => void
  onModelTranscript?: (text: string) => void
}

function buildEmbedLiveSystemInstruction(contextBlock?: string): string {
  const clienteBlock = contextBlock?.trim()
    ? `\n\n${contextBlock}\n\nUsá SOLO datos reales del contexto. No inventes OPs ni fechas.`
    : '\n\nSi el cliente pregunta por su pedido pedile nombre DNI CUIT o número de OP.'

  return `Sos PlotAI el asistente de voz del chat web de Plot Center.

IDIOMA: español argentino natural para voz.

PERSONALIDAD: cordial servicial como atención en mostrador. Frases breves que suenen bien al hablar.

EMPRESA: Plot Center — comunicación visual en San Juan Argentina. 9 de Julio 622. Tel 2646212163.
${clienteBlock}

REGLAS DE VOZ:
- Sin markdown asteriscos listas ni emojis.
- Una a tres frases salvo que pidan detalle.
- NUNCA inventes precios fechas ni números de OP.
- Si no tenés un dato decilo con honestidad.`
}

export function useEmbedChatVoice({
  userTexts,
  disabled,
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
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      })

      const apiKey = await fetchTotemGeminiApiKey()
      let contextBlock = ''
      try {
        const ctx = await fetchTotemLiveContext(userTexts)
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
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Activá el micrófono en el navegador.'
          : e instanceof Error
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
  onStop
}: {
  active: boolean
  starting: boolean
  speaking: boolean
  error: string | null
  status: string
  onStop: () => void
}) {
  if (!active && !starting && !error) return null
  return (
    <div className="embed-voice-banner" role="status">
      <div className="embed-voice-banner-main">
        <span className={`embed-voice-pulse${speaking ? ' embed-voice-pulse--speaking' : ''}`} />
        <span>{error || status || 'Conectando...'}</span>
      </div>
      {active && (
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
  onClick
}: {
  active: boolean
  starting: boolean
  disabled?: boolean
  onClick: () => void
}) {
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
