import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchEmpleadosRelojTablet,
  fotoEmpleadoUrl,
  getRelojTabletApiKey,
  identificarSelfieRelojTablet,
  inicialesEmpleado,
  marcarRelojTablet,
  setRelojTabletApiKey,
  verificarSelfieRelojTablet,
  type EmpleadoRelojTablet,
  type MarcacionTabletResult
} from '../services/relojTabletApi'
import { useMotionPresence } from '../hooks/useMotionPresence'
import './TabletRelojPage.css'

type Modo = 'auto' | 'manual'
type Paso = 'esperando' | 'detectando' | 'procesando' | 'exito' | 'error'

const SETTLE_MS = 1400
const COOLDOWN_MS = 9000
const AUTO_RESET_ERROR_MS = 5000

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
  const [modo, setModo] = useState<Modo>('auto')
  const [paso, setPaso] = useState<Paso>('esperando')
  const [seleccionado, setSeleccionado] = useState<EmpleadoRelojTablet | null>(null)
  const [resultado, setResultado] = useState<MarcacionTabletResult | null>(null)
  const [mensajeError, setMensajeError] = useState('')
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(getRelojTabletApiKey())
  const [camaraLista, setCamaraLista] = useState(false)
  const [enCooldown, setEnCooldown] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const procesandoRef = useRef(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setCamaraLista(false)
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
    setCamaraLista(true)
  }, [detenerCamara])

  useEffect(() => {
    if (modo === 'auto' && !loading && !error) {
      void iniciarCamara().catch(() => {
        setError('No se pudo acceder a la cámara. Revisá permisos del navegador.')
      })
    }
    return () => detenerCamara()
  }, [modo, loading, error, iniciarCamara, detenerCamara])

  const capturarSelfie = useCallback((): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }, [])

  const volverEspera = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    setPaso('esperando')
    setSeleccionado(null)
    setResultado(null)
    setMensajeError('')
    procesandoRef.current = false
  }, [])

  const iniciarCooldown = useCallback(() => {
    setEnCooldown(true)
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    cooldownTimerRef.current = setTimeout(() => setEnCooldown(false), COOLDOWN_MS)
  }, [])

  const procesarMarcacion = useCallback(
    async (selfie: string, emp: EmpleadoRelojTablet) => {
      setPaso('procesando')
      try {
        let confianza: number | undefined
        let detalle: string | undefined
        try {
          const ver = await verificarSelfieRelojTablet(emp.id_usuario, selfie)
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
          idUsuario: emp.id_usuario,
          selfieDataUrl: selfie,
          confianza,
          detalle
        })
        setResultado(data)
        setPaso('exito')
        iniciarCooldown()
        window.setTimeout(() => volverEspera(), 4500)
      } catch (e) {
        setPaso('error')
        setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
        window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      } finally {
        procesandoRef.current = false
      }
    },
    [iniciarCooldown, volverEspera]
  )

  const procesarAuto = useCallback(async () => {
    if (procesandoRef.current || enCooldown) return
    procesandoRef.current = true
    setPaso('detectando')

    await new Promise((r) => setTimeout(r, SETTLE_MS))

    const selfie = capturarSelfie()
    if (!selfie) {
      setPaso('error')
      setMensajeError('No se pudo capturar la foto')
      procesandoRef.current = false
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      return
    }

    setPaso('procesando')
    try {
      const id = await identificarSelfieRelojTablet(selfie)
      if (!id.match || !id.id_usuario) {
        throw new Error(id.mensaje || 'No se reconoció ningún empleado')
      }

      const emp =
        empleados.find((e) => e.id_usuario === id.id_usuario) ||
        ({
          id_usuario: id.id_usuario,
          nombre: '',
          apellido: '',
          sector: '',
          foto_url: null,
          login: '',
          nombre_completo: id.nombre || 'Empleado'
        } satisfies EmpleadoRelojTablet)

      setSeleccionado(emp)
      await procesarMarcacion(selfie, emp)
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'No se pudo identificar')
      procesandoRef.current = false
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    }
  }, [capturarSelfie, empleados, enCooldown, procesarMarcacion, volverEspera])

  const onPresenciaDetectada = useCallback(() => {
    if (modo !== 'auto' || paso !== 'esperando' || enCooldown || procesandoRef.current) return
    if (settleTimerRef.current) return
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null
      void procesarAuto()
    }, 0)
  }, [modo, paso, enCooldown, procesarAuto])

  const { sensorActivo } = useMotionPresence(
    videoRef,
    canvasRef,
    modo === 'auto' && paso === 'esperando' && camaraLista && !enCooldown,
    onPresenciaDetectada
  )

  const elegirEmpleadoManual = async (emp: EmpleadoRelojTablet) => {
    if (procesandoRef.current) return
    procesandoRef.current = true
    setSeleccionado(emp)
    setPaso('detectando')
    setMensajeError('')
    try {
      if (!camaraLista) await iniciarCamara()
      await new Promise((r) => setTimeout(r, SETTLE_MS))
      const selfie = capturarSelfie()
      if (!selfie) throw new Error('No se pudo capturar la foto')
      await procesarMarcacion(selfie, emp)
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
      procesandoRef.current = false
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
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

  const estadoTexto =
    paso === 'detectando'
      ? 'Detectando presencia…'
      : paso === 'procesando'
        ? 'Identificando y registrando…'
        : paso === 'exito'
          ? 'Marcación registrada'
          : paso === 'error'
            ? mensajeError
            : enCooldown
              ? 'Esperá unos segundos antes de marcar de nuevo'
              : 'Acercate al reloj — el sensor te detecta solo'

  return (
    <div className={`tablet-reloj-page ${modo === 'auto' ? 'tablet-reloj-page--kiosco' : ''}`}>
      <header className="tablet-reloj-header">
        <div>
          <h1>Reloj Plot Lab</h1>
          <p className="tablet-reloj-sub">{ahora}</p>
        </div>
        <div className="tablet-reloj-header-actions">
          {modo === 'manual' ? (
            <button type="button" className="tablet-reloj-btn-ghost" onClick={() => setModo('auto')}>
              Modo automático
            </button>
          ) : (
            <button type="button" className="tablet-reloj-btn-ghost" onClick={() => setModo('manual')}>
              Buscar manual
            </button>
          )}
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
      ) : modo === 'auto' ? (
        <div className="tablet-reloj-kiosco">
          <div className="tablet-reloj-kiosco-video-wrap">
            <video ref={videoRef} playsInline muted className="tablet-reloj-kiosco-video" />
            <canvas ref={canvasRef} className="tablet-reloj-canvas" />
            <div className="tablet-reloj-kiosco-overlay">
              <div
                className={`tablet-reloj-sensor ${sensorActivo ? 'tablet-reloj-sensor--activo' : ''} ${paso !== 'esperando' ? 'tablet-reloj-sensor--busy' : ''}`}
              >
                <span className="tablet-reloj-sensor-dot" />
                Sensor
              </div>
              <p className="tablet-reloj-kiosco-hint">{estadoTexto}</p>
              {paso === 'procesando' || paso === 'detectando' ? (
                <div className="tablet-reloj-spinner tablet-reloj-spinner--lg" />
              ) : null}
            </div>
          </div>

          {paso === 'exito' && resultado ? (
            <div className="tablet-reloj-exito tablet-reloj-exito--kiosco">
              <div className="tablet-reloj-exito-icon">✓</div>
              <h2>{resultado.nombre || seleccionado?.nombre_completo}</h2>
              <p className="tablet-reloj-exito-tipo">
                {resultado.tipo === 'entrada' ? 'Entrada' : 'Salida'} · {formatHora(resultado.hora)}
              </p>
              <p>{resultado.mensaje}</p>
            </div>
          ) : null}

          {paso === 'error' ? (
            <div className="tablet-reloj-error-kiosco">
              <p>{mensajeError}</p>
            </div>
          ) : null}
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
                  onClick={() => void elegirEmpleadoManual(emp)}
                >
                  <div className="tablet-reloj-avatar">
                    {foto ? <img src={foto} alt="" /> : <span>{inicialesEmpleado(emp)}</span>}
                  </div>
                  <div className="tablet-reloj-card-text">
                    <strong>{emp.nombre_completo || emp.login}</strong>
                    {emp.sector ? <span>{emp.sector}</span> : null}
                  </div>
                </button>
              )
            })}
          </div>
          <canvas ref={canvasRef} className="tablet-reloj-canvas" />
          <video ref={videoRef} playsInline muted className="tablet-reloj-canvas" aria-hidden />
        </>
      )}
    </div>
  )
}
