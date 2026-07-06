import { useEffect, useRef, useState, type FormEvent } from 'react'
import PlotCenterDesignToolsGrid from '../../components/diseno/PlotCenterDesignToolsGrid'
import { STUDIO_NAV, STUDIO_PRIMARY } from './constants'
import {
  fileToBase64,
  studioChat,
  studioEditImage,
  studioGenerateImage,
  studioGenerateVideo,
  studioSearch,
  studioThinking,
  studioTts
} from './plotcenterAiStudioService'
import type { ApiState, ChatMessage, GroundingChunk, StudioView } from './types'
import { StudioView as View } from './types'

function StudioSpinner({ large }: { large?: boolean }) {
  return <span className={`pcai-spinner${large ? ' pcai-spinner--lg' : ''}`} aria-hidden />
}

function StudioPanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="pcai-panel-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  )
}

export function StudioDashboard({ onNavigate }: { onNavigate: (v: StudioView) => void }) {
  const features = STUDIO_NAV.filter((item) => item.id !== View.DASHBOARD)
  return (
    <div className="pcai-panel">
      <header className="pcai-panel-header pcai-panel-header--hero">
        <h1>
          Bienvenido a <span style={{ color: STUDIO_PRIMARY }}>Plot AI Studio</span>
        </h1>
        <p>Herramientas Gemini para el equipo de diseño: imágenes, video, copy, análisis y más.</p>
      </header>
      <div className="pcai-feature-grid">
        {features.map((feature) => (
          <button
            key={feature.id}
            type="button"
            className="pcai-feature-card"
            onClick={() => onNavigate(feature.id)}
          >
            <span className="pcai-feature-icon" aria-hidden>
              {feature.icon}
            </span>
            <strong>{feature.label}</strong>
            <span>{feature.description}</span>
          </button>
        ))}
      </div>

      <section className="pcai-external-tools">
        <h2>Herramientas web Plot Center</h2>
        <p className="pcai-muted">QR, accesibilidad, resizer, paletas de color y más.</p>
        <PlotCenterDesignToolsGrid compact />
      </section>
    </div>
  )
}

export function StudioChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [apiState, setApiState] = useState<ApiState>('idle')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, apiState])

  const send = async () => {
    const text = input.trim()
    if (!text || apiState === 'loading') return
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setApiState('loading')
    try {
      const reply = await studioChat(messages, text)
      setMessages((prev) => [...prev, { role: 'model', text: reply || 'Sin respuesta.' }])
      setApiState('success')
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Ocurrió un error. Intentá de nuevo en unos segundos.' }
      ])
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel pcai-panel--chat">
      <StudioPanelHeader
        title="Asistente de chat"
        subtitle="Brainstorming, textos y consultas creativas para diseño."
      />
      <div className="pcai-chat-thread">
        {messages.length === 0 && (
          <p className="pcai-muted">Escribí tu primera consulta. Ej: ideas para un cartel de verano en A3.</p>
        )}
        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}`} className={`pcai-chat-bubble pcai-chat-bubble--${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {apiState === 'loading' && (
          <div className="pcai-chat-bubble pcai-chat-bubble--model">
            <StudioSpinner />
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="pcai-chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder="Escribí tu mensaje…"
          disabled={apiState === 'loading'}
        />
        <button type="button" className="pcai-btn pcai-btn--primary" onClick={() => void send()} disabled={apiState === 'loading'}>
          Enviar
        </button>
      </div>
    </div>
  )
}

export function StudioImageGenView() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || apiState === 'loading') return
    setApiState('loading')
    setImageUrl(null)
    setError(null)
    try {
      setImageUrl(await studioGenerateImage(prompt.trim(), aspectRatio))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader title="Generador de imágenes" subtitle="Creá piezas visuales desde una descripción." />
      <div className="pcai-split">
        <form className="pcai-form" onSubmit={(e) => void submit(e)}>
          <label>
            Descripción
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: cartel promocional verano, colores cálidos, estilo minimalista"
              rows={6}
              required
            />
          </label>
          <label>
            Relación de aspecto
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
              <option value="1:1">Cuadrado (1:1)</option>
              <option value="16:9">Horizontal (16:9)</option>
              <option value="9:16">Vertical (9:16)</option>
            </select>
          </label>
          <button type="submit" className="pcai-btn pcai-btn--primary" disabled={apiState === 'loading'}>
            {apiState === 'loading' ? 'Generando…' : 'Generar imagen'}
          </button>
        </form>
        <div className="pcai-result-box">
          {apiState === 'loading' && <StudioSpinner large />}
          {error && <p className="pcai-error">{error}</p>}
          {imageUrl && <img src={imageUrl} alt="Generada" className="pcai-result-media" />}
          {apiState === 'idle' && !imageUrl && <p className="pcai-muted">El resultado aparecerá acá</p>}
        </div>
      </div>
    </div>
  )
}

export function StudioImageEditView() {
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setEditedUrl(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || !file || apiState === 'loading') return
    setApiState('loading')
    setEditedUrl(null)
    setError(null)
    try {
      const part = await fileToBase64(file)
      setEditedUrl(await studioEditImage(prompt.trim(), part.data, part.mimeType))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar la imagen.')
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader title="Editor de imágenes" subtitle="Modificá una imagen con instrucciones en texto." />
      <div className="pcai-split">
        <form className="pcai-form" onSubmit={(e) => void submit(e)}>
          <label>
            1. Subí una imagen
            <input ref={inputRef} type="file" accept="image/*" className="pcai-hidden" onChange={onFile} />
            <button type="button" className="pcai-btn pcai-btn--ghost" onClick={() => inputRef.current?.click()}>
              {file ? file.name : 'Seleccionar archivo…'}
            </button>
          </label>
          <label>
            2. Describí la edición
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: fondo blanco, más contraste, quitar texto"
              rows={5}
              required
            />
          </label>
          <button type="submit" className="pcai-btn pcai-btn--primary" disabled={!file || apiState === 'loading'}>
            {apiState === 'loading' ? 'Editando…' : 'Aplicar edición'}
          </button>
        </form>
        <div className="pcai-dual-preview">
          <div className="pcai-result-box">
            <h3>Original</h3>
            {preview ? <img src={preview} alt="Original" className="pcai-result-media" /> : <p className="pcai-muted">Sin imagen</p>}
          </div>
          <div className="pcai-result-box">
            <h3>Editada</h3>
            {apiState === 'loading' && <StudioSpinner large />}
            {error && <p className="pcai-error">{error}</p>}
            {editedUrl && <img src={editedUrl} alt="Editada" className="pcai-result-media" />}
            {!editedUrl && apiState !== 'loading' && <p className="pcai-muted">Resultado acá</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StudioVideoGenView() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || apiState === 'loading') return
    setApiState('loading')
    setVideoUrl(null)
    setError(null)
    try {
      setVideoUrl(await studioGenerateVideo(prompt.trim(), aspectRatio))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el video.')
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader
        title="Generador de video"
        subtitle="Videos cortos con Veo (requiere acceso habilitado en la API de Gemini)."
      />
      <div className="pcai-split">
        <form className="pcai-form" onSubmit={(e) => void submit(e)}>
          <label>
            Descripción
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: logo animado con partículas naranjas sobre fondo oscuro"
              rows={6}
              required
            />
          </label>
          <label>
            Formato
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
            >
              <option value="16:9">Horizontal (16:9)</option>
              <option value="9:16">Vertical (9:16)</option>
            </select>
          </label>
          <button type="submit" className="pcai-btn pcai-btn--primary" disabled={apiState === 'loading'}>
            {apiState === 'loading' ? 'Generando (puede tardar)…' : 'Generar video'}
          </button>
        </form>
        <div className="pcai-result-box">
          {apiState === 'loading' && (
            <>
              <StudioSpinner large />
              <p className="pcai-muted">La generación puede tardar varios minutos.</p>
            </>
          )}
          {error && <p className="pcai-error">{error}</p>}
          {videoUrl && <video src={videoUrl} controls className="pcai-result-media" />}
          {apiState === 'idle' && !videoUrl && <p className="pcai-muted">El video aparecerá acá</p>}
        </div>
      </div>
    </div>
  )
}

export function StudioComplexTaskView() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || apiState === 'loading') return
    setApiState('loading')
    setResult(null)
    setError(null)
    try {
      setResult(await studioThinking(prompt.trim()))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el análisis.')
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader
        title="Análisis profundo"
        subtitle="Estrategias, guiones y briefs detallados con Gemini Pro."
      />
      <div className="pcai-split">
        <form className="pcai-form" onSubmit={(e) => void submit(e)}>
          <label>
            Tarea compleja
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: estrategia de contenido 3 meses para marca local de café en Instagram"
              rows={10}
              required
            />
          </label>
          <button type="submit" className="pcai-btn pcai-btn--primary" disabled={apiState === 'loading'}>
            {apiState === 'loading' ? 'Analizando…' : 'Iniciar análisis'}
          </button>
        </form>
        <div className="pcai-result-box pcai-result-box--text">
          {apiState === 'loading' && <StudioSpinner large />}
          {error && <p className="pcai-error">{error}</p>}
          {result && <pre className="pcai-text-result">{result}</pre>}
          {apiState === 'idle' && !result && <p className="pcai-muted">El análisis aparecerá acá</p>}
        </div>
      </div>
    </div>
  )
}

export function StudioSearchView() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<{ text: string; chunks: GroundingChunk[] } | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || apiState === 'loading') return
    setApiState('loading')
    setResult(null)
    setError(null)
    try {
      setResult(await studioSearch(prompt.trim()))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la búsqueda.')
      setApiState('error')
    }
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader title="Búsqueda en tiempo real" subtitle="Información actualizada de la web." />
      <form className="pcai-inline-search" onSubmit={(e) => void submit(e)}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: tendencias de diseño gráfico 2026"
          disabled={apiState === 'loading'}
        />
        <button type="submit" className="pcai-btn pcai-btn--primary" disabled={apiState === 'loading'}>
          Buscar
        </button>
      </form>
      <div className="pcai-result-box pcai-result-box--text">
        {apiState === 'loading' && <StudioSpinner large />}
        {error && <p className="pcai-error">{error}</p>}
        {result && (
          <>
            <pre className="pcai-text-result">{result.text}</pre>
            {result.chunks.length > 0 && (
              <div className="pcai-sources">
                <h3>Fuentes</h3>
                <ul>
                  {result.chunks.map((chunk, i) => {
                    const source = chunk.web || chunk.maps
                    if (!source?.uri) return null
                    return (
                      <li key={`${source.uri}-${i}`}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer">
                          {source.title || source.uri}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
        {apiState === 'idle' && !result && <p className="pcai-muted">Los resultados aparecerán acá</p>}
      </div>
    </div>
  )
}

function decodePcmBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function pcmToAudioBuffer(data: Uint8Array, sampleRate = 24000): Promise<AudioBuffer> {
  const ctx = new AudioContext({ sampleRate })
  const int16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2)
  const buffer = ctx.createBuffer(1, int16.length, sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768
  return buffer
}

export function StudioTtsView() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('Kore')
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const voices = [
    { id: 'Kore', name: 'Kore (femenino)' },
    { id: 'Puck', name: 'Puck (masculino)' },
    { id: 'Charon', name: 'Charon (masculino)' },
    { id: 'Fenrir', name: 'Fenrir (femenino)' },
    { id: 'Zephyr', name: 'Zephyr (masculino)' }
  ]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || apiState === 'loading') return
    setApiState('loading')
    setAudioBuffer(null)
    setError(null)
    try {
      const b64 = await studioTts(text.trim(), voice)
      setAudioBuffer(await pcmToAudioBuffer(decodePcmBase64(b64)))
      setApiState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar audio.')
      setApiState('error')
    }
  }

  const play = () => {
    if (!audioBuffer) return
    const ctx = new AudioContext({ sampleRate: 24000 })
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start()
  }

  return (
    <div className="pcai-panel">
      <StudioPanelHeader title="Texto a voz" subtitle="Locuciones para videos o presentaciones." />
      <div className="pcai-split">
        <form className="pcai-form" onSubmit={(e) => void submit(e)}>
          <label>
            Texto
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribí el texto a locutar…"
              rows={8}
              required
            />
          </label>
          <label>
            Voz
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="pcai-btn pcai-btn--primary" disabled={apiState === 'loading'}>
            {apiState === 'loading' ? 'Generando…' : 'Generar audio'}
          </button>
        </form>
        <div className="pcai-result-box pcai-result-box--center">
          {apiState === 'loading' && <StudioSpinner large />}
          {error && <p className="pcai-error">{error}</p>}
          {audioBuffer && (
            <button type="button" className="pcai-btn pcai-btn--primary pcai-btn--round" onClick={play}>
              ▶ Reproducir
            </button>
          )}
          {apiState === 'idle' && !audioBuffer && <p className="pcai-muted">El audio aparecerá acá</p>}
        </div>
      </div>
    </div>
  )
}

export function renderStudioView(view: StudioView, onNavigate: (v: StudioView) => void) {
  switch (view) {
    case View.DASHBOARD:
      return <StudioDashboard onNavigate={onNavigate} />
    case View.CHATBOT:
      return <StudioChatView />
    case View.IMAGE_GEN:
      return <StudioImageGenView />
    case View.IMAGE_EDIT:
      return <StudioImageEditView />
    case View.VIDEO_GEN:
      return <StudioVideoGenView />
    case View.COMPLEX_TASK:
      return <StudioComplexTaskView />
    case View.SEARCH:
      return <StudioSearchView />
    case View.TTS:
      return <StudioTtsView />
    default:
      return <StudioDashboard onNavigate={onNavigate} />
  }
}
