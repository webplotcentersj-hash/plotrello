import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchEmpleadosRelojTablet,
  fotoEmpleadoUrl,
  getRelojTabletApiKey,
  inicialesEmpleado,
  marcarRelojTablet,
  setRelojTabletApiKey,
  verificarSelfieRelojTablet,
  type EmpleadoRelojTablet,
  type MarcacionTabletResult
} from '../services/relojTabletApi'
import './TabletRelojPage.css'

type Paso = 'idle' | 'camara' | 'procesando' | 'exito' | 'error'

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/San_Juan'
    })
  } catch {
    return ''
  }
}

export default function TabletRelojPage() {
  const [empleados, setEmpleados] = useState<EmpleadoRelojTablet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [paso, setPaso] = useState<Paso>('idle')
  const [seleccionado, setSeleccionado] = useState<EmpleadoRelojTablet | null>(null)
  const [resultado, setResultado] = useState<MarcacionTabletResult | null>(null)
  const [mensajeError, setMensajeError] = useState('')
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(getRelojTabletApiKey())

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchEmpleadosRelojTablet()
      setEmpleados(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return empleados
    return empleados.filter((e) =>
      [e.nombre_completo, e.nombre, e.apellido, e.sector, e.login].join(' ').toLowerCase().includes(q)
    )
  }, [empleados, busqueda])

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const iniciarCamara = useCallback(async () => {
    detenerCamara()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
  }, [detenerCamara])

  useEffect(() => () => detenerCamara(), [detenerCamara])

  const capturarSelfie = (): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  const cerrarFlujo = useCallback(() => {
    detenerCamara()
    setPaso('idle')
    setSeleccionado(null)
    setResultado(null)
    setMensajeError('')
  }, [detenerCamara])

  const elegirEmpleado = async (emp: EmpleadoRelojTablet) => {
    setSeleccionado(emp)
    setPaso('camara')
    setMensajeError('')
    try {
      await iniciarCamara()
    } catch {
      setPaso('error')
      setMensajeError('No se pudo acceder a la cámara. Revisá permisos del navegador.')
    }
  }

  const confirmarMarcacion = async () => {
    if (!seleccionado) return
    setPaso('procesando')
    try {
      const selfie = capturarSelfie()
      detenerCamara()
      if (!selfie) {
        throw new Error('No se pudo capturar la foto')
      }

      let confianza: number | undefined
      let detalle: string | undefined
      try {
        const ver = await verificarSelfieRelojTablet(seleccionado.id_usuario, selfie)
        confianza = ver.confianza
        detalle = ver.motivo || ver.mensaje
        if (!ver.omitir_verificacion && !ver.match) {
          throw new Error(ver.mensaje || 'La foto no coincide con el legajo')
        }
      } catch (verErr) {
        if (verErr instanceof Error && verErr.message.includes('coincide')) {
          throw verErr
        }
        detalle = 'Verificación omitida por error técnico'
      }

      const data = await marcarRelojTablet({
        idUsuario: seleccionado.id_usuario,
        selfieDataUrl: selfie,
        confianza,
        detalle
      })
      setResultado(data)
      setPaso('exito')
      window.setTimeout(() => cerrarFlujo(), 4500)
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
    }
  }

  const ahora = new Date().toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/San_Juan'
  })

  return (
    <div className="tablet-reloj-page">
      <header className="tablet-reloj-header">
        <div>
          <h1>Reloj Plot Lab</h1>
          <p className="tablet-reloj-sub">{ahora}</p>
        </div>
        <div className="tablet-reloj-header-actions">
          <button type="button" className="tablet-reloj-btn-ghost" onClick={() => void cargar()}>
            Actualizar
          </button>
          <button type="button" className="tablet-reloj-btn-ghost" onClick={() => setMostrarConfig((v) => !v)}>
            ⚙
          </button>
        </div>
      </header>

      {mostrarConfig ? (
        <div className="tablet-reloj-config">
          <label>
            Clave tablet (opcional)
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="RELOJ_TABLET_API_KEY en servidor"
            />
          </label>
          <button
            type="button"
            className="tablet-reloj-btn-primary"
            onClick={() => {
              setRelojTabletApiKey(apiKeyDraft)
              setMostrarConfig(false)
              void cargar()
            }}
          >
            Guardar
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="tablet-reloj-loading">
          <div className="tablet-reloj-spinner" />
          <p>Cargando empleados…</p>
        </div>
      ) : error ? (
        <div className="tablet-reloj-error-banner">
          <p>{error}</p>
          <button type="button" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="tablet-reloj-search-wrap">
            <input
              type="search"
              className="tablet-reloj-search"
              placeholder="Buscar por nombre o sector…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="tablet-reloj-grid">
            {filtrados.map((emp) => {
              const foto = fotoEmpleadoUrl(emp)
              return (
                <button
                  key={emp.id_usuario}
                  type="button"
                  className="tablet-reloj-card"
                  onClick={() => void elegirEmpleado(emp)}
                >
                  <div className="tablet-reloj-avatar">
                    {foto ? (
                      <img src={foto} alt="" />
                    ) : (
                      <span>{inicialesEmpleado(emp)}</span>
                    )}
                  </div>
                  <div className="tablet-reloj-card-text">
                    <strong>{emp.nombre_completo || emp.login}</strong>
                    {emp.sector ? <span>{emp.sector}</span> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {paso !== 'idle' ? (
        <div className="tablet-reloj-overlay" role="dialog" aria-modal="true">
          <div className="tablet-reloj-modal">
            {paso === 'camara' && seleccionado ? (
              <>
                <h2>{seleccionado.nombre_completo}</h2>
                <p className="tablet-reloj-modal-hint">Mirá a la cámara y confirmá tu marcación</p>
                <div className="tablet-reloj-video-wrap">
                  <video ref={videoRef} playsInline muted className="tablet-reloj-video" />
                </div>
                <canvas ref={canvasRef} className="tablet-reloj-canvas" />
                <div className="tablet-reloj-modal-actions">
                  <button type="button" className="tablet-reloj-btn-ghost" onClick={cerrarFlujo}>
                    Cancelar
                  </button>
                  <button type="button" className="tablet-reloj-btn-primary" onClick={() => void confirmarMarcacion()}>
                    Marcar ahora
                  </button>
                </div>
              </>
            ) : null}

            {paso === 'procesando' ? (
              <div className="tablet-reloj-procesando">
                <div className="tablet-reloj-spinner" />
                <p>Verificando y registrando…</p>
              </div>
            ) : null}

            {paso === 'exito' && resultado ? (
              <div className="tablet-reloj-exito">
                <div className="tablet-reloj-exito-icon">✓</div>
                <h2>{resultado.nombre || seleccionado?.nombre_completo}</h2>
                <p className="tablet-reloj-exito-tipo">
                  {resultado.tipo === 'entrada' ? 'Entrada' : 'Salida'} · {formatHora(resultado.hora)}
                </p>
                <p>{resultado.mensaje}</p>
              </div>
            ) : null}

            {paso === 'error' ? (
              <div className="tablet-reloj-error-modal">
                <h2>No se pudo marcar</h2>
                <p>{mensajeError}</p>
                <button type="button" className="tablet-reloj-btn-primary" onClick={cerrarFlujo}>
                  Volver
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
