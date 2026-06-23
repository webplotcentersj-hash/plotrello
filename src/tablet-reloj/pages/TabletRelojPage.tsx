import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import {
  ARGENTINA_TIMEZONE,
  getMarcacionTimestamptzIso,
  horaMarcacionTabletDisplay
} from '../../utils/dateUtils'
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
type Paso = 'esperando' | 'camara' | 'detectando' | 'procesando' | 'exito' | 'error'

const SETTLE_MS = 1200
const COOLDOWN_MS = 8000
const AUTO_RESET_ERROR_MS = 6000

function tituloExitoMarcacion(tipo: 'entrada' | 'salida'): string {
  return tipo === 'entrada' ? '¡Registrado!' : '¡Salida!'
}

function PanelExitoMarcacion({
  resultado,
  nombre
}: {
  resultado: MarcacionTabletResult
  nombre?: string | null
}) {
  return (
    <div className="tablet-reloj-exito">
      <p className="tablet-reloj-exito-banner">{tituloExitoMarcacion(resultado.tipo)}</p>
      <div className="tablet-reloj-exito-icon">✓</div>
      {nombre ? <h2 className="tablet-reloj-exito-nombre">{nombre}</h2> : null}
      <p className="tablet-reloj-exito-hora">
        {horaMarcacionTabletDisplay(resultado)} · Argentina
      </p>
      {resultado.tipo === 'salida' && resultado.horas_trabajadas != null ? (
        <p className="tablet-reloj-exito-detalle">{resultado.mensaje}</p>
      ) : null}
    </div>
  )
}

async function esperarVideoListo(video: HTMLVideoElement, maxMs = 6000): Promise<boolean> {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (video.readyState >= 2 && video.videoWidth > 64 && video.videoHeight > 64) return true
    await new Promise((r) => window.setTimeout(r, 120))
  }
  return video.readyState >= 2 && video.videoWidth > 0
}

function useAnchorRect(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!active) {
      setRect(null)
      return
    }
    const el = ref.current
    if (!el) return

    const update = () => setRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, ref])

  return rect
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
  const [relojArgentina, setRelojArgentina] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const kioscoWrapRef = useRef<HTMLDivElement>(null)
  const modalHoleRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const procesandoRef = useRef(false)
  const pasoRef = useRef<Paso>('esperando')
  const enCooldownRef = useRef(false)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  pasoRef.current = paso
  enCooldownRef.current = enCooldown

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

  useEffect(() => {
    const tick = () =>
      setRelojArgentina(
        new Date().toLocaleString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: ARGENTINA_TIMEZONE
        })
      )
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

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
    if (videoRef.current) videoRef.current.srcObject = null
    setCamaraLista(false)
  }, [])

  const iniciarCamara = useCallback(async () => {
    if (streamRef.current?.active) {
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current
        await videoRef.current.play().catch(() => undefined)
      }
      setCamaraLista(true)
      return
    }
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
  }, [])

  useEffect(() => {
    if (loading || error) return
    let cancelled = false
    void iniciarCamara().catch(() => {
      if (!cancelled) setError('No se pudo acceder a la cámara. Revisá permisos del navegador.')
    })
    return () => {
      cancelled = true
      detenerCamara()
    }
  }, [loading, error, iniciarCamara, detenerCamara])

  const capturarSelfie = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas) return null
    if (!(await esperarVideoListo(video))) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.88)
  }, [])

  const volverEspera = useCallback(() => {
    setPaso('esperando')
    setSeleccionado(null)
    setResultado(null)
    setMensajeError('')
    procesandoRef.current = false
    setOcupado(false)
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
          if (verErr instanceof Error && verErr.message.includes('coincide')) throw verErr
          detalle = 'Verificación omitida por error técnico'
        }

        const data = await marcarRelojTablet({
          idUsuario: emp.id_usuario,
          selfieDataUrl: selfie,
          confianza,
          detalle,
          marcadoAt: getMarcacionTimestamptzIso()
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
        setOcupado(false)
      }
    },
    [iniciarCooldown, volverEspera]
  )

  const ejecutarFlujoAuto = useCallback(async () => {
    setPaso('detectando')
    await new Promise((r) => window.setTimeout(r, SETTLE_MS))
    const selfie = await capturarSelfie()
    if (!selfie) {
      setPaso('error')
      setMensajeError('No se pudo capturar la foto. Mantenete frente a la cámara.')
      procesandoRef.current = false
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      return
    }
    setPaso('procesando')
    try {
      const id = await identificarSelfieRelojTablet(selfie)
      if (!id.match || !id.id_usuario) throw new Error(id.mensaje || 'No se reconoció ningún empleado')
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
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    }
  }, [capturarSelfie, empleados, procesarMarcacion, volverEspera])

  const dispararMarcacion = useCallback(() => {
    if (modo !== 'auto') return
    if (pasoRef.current !== 'esperando' || enCooldownRef.current || procesandoRef.current) return
    procesandoRef.current = true
    setOcupado(true)
    void ejecutarFlujoAuto()
  }, [modo, ejecutarFlujoAuto])

  const { sensorActivo } = useMotionPresence(
    videoRef,
    modo === 'auto' && paso === 'esperando' && camaraLista && !enCooldown && !ocupado,
    dispararMarcacion
  )

  const elegirEmpleadoManual = async (emp: EmpleadoRelojTablet) => {
    if (ocupado || procesandoRef.current) return
    setSeleccionado(emp)
    setMensajeError('')
    setPaso('camara')
    try {
      await iniciarCamara()
      const video = videoRef.current
      if (video) await esperarVideoListo(video)
    } catch {
      setPaso('error')
      setMensajeError('No se pudo activar la cámara')
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    }
  }

  const confirmarMarcacionManual = async () => {
    if (!seleccionado || procesandoRef.current) return
    procesandoRef.current = true
    setOcupado(true)
    try {
      await new Promise((r) => window.setTimeout(r, 400))
      const selfie = await capturarSelfie()
      if (!selfie) throw new Error('No se pudo capturar la foto. Mirá a la cámara e intentá de nuevo.')
      await procesarMarcacion(selfie, seleccionado)
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
      procesandoRef.current = false
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    }
  }

  const videoModo =
    modo === 'auto' && paso === 'esperando'
      ? 'kiosco'
      : paso === 'camara'
        ? 'modal'
        : 'standby'

  const kioscoRect = useAnchorRect(kioscoWrapRef, videoModo === 'kiosco')
  const modalRect = useAnchorRect(modalHoleRef, videoModo === 'modal')

  const videoStyle = useMemo((): CSSProperties => {
    const standby: CSSProperties = {
      position: 'fixed',
      width: 640,
      height: 480,
      right: -10000,
      top: 0,
      zIndex: 1,
      objectFit: 'cover',
      transform: 'scaleX(-1)',
      pointerEvents: 'none'
    }
    if (videoModo === 'kiosco' && kioscoRect) {
      return {
        position: 'fixed',
        left: kioscoRect.left,
        top: kioscoRect.top,
        width: kioscoRect.width,
        height: kioscoRect.height,
        zIndex: 1,
        objectFit: 'cover',
        transform: 'scaleX(-1)',
        borderRadius: 20
      }
    }
    if (videoModo === 'modal' && modalRect) {
      return {
        position: 'fixed',
        left: modalRect.left,
        top: modalRect.top,
        width: modalRect.width,
        height: modalRect.height,
        zIndex: 60,
        objectFit: 'cover',
        transform: 'scaleX(-1)',
        borderRadius: 16,
        border: '2px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)'
      }
    }
    return standby
  }, [videoModo, kioscoRect, modalRect])

  const cambiarModo = (nuevo: Modo) => {
    if (nuevo === modo) return
    volverEspera()
    setModo(nuevo)
  }

  const estadoTexto =
    paso === 'camara'
      ? 'Confirmá tu marcación'
      : paso === 'detectando'
        ? 'Posate frente a la cámara…'
        : paso === 'procesando'
          ? 'Verificando y registrando…'
          : paso === 'exito'
            ? 'Marcación registrada'
            : paso === 'error'
              ? mensajeError
              : enCooldown
                ? 'Esperá unos segundos antes de marcar de nuevo'
                : 'Acercate al reloj — el sensor te detecta solo'

  const puedeMarcarAuto = modo === 'auto' && paso === 'esperando' && !enCooldown && !ocupado

  return (
    <div className={`tablet-reloj-page ${modo === 'auto' ? 'tablet-reloj-page--kiosco' : ''}`}>
      <header className="tablet-reloj-header">
        <div className="tablet-reloj-header-brand">
          <h1>Reloj Plot Lab</h1>
          <p className="tablet-reloj-sub" title="Hora de Argentina (Buenos Aires)">
            {relojArgentina}
          </p>
        </div>
        <div className="tablet-reloj-header-actions">
          {modo === 'manual' ? (
            <button type="button" className="tablet-reloj-btn-ghost" onClick={() => cambiarModo('auto')}>
              Automático
            </button>
          ) : (
            <button type="button" className="tablet-reloj-btn-ghost" onClick={() => cambiarModo('manual')}>
              Manual
            </button>
          )}
          <button type="button" className="tablet-reloj-btn-ghost tablet-reloj-btn-icon" onClick={() => void cargar()}>
            ↻
          </button>
          <button
            type="button"
            className="tablet-reloj-btn-ghost tablet-reloj-btn-icon"
            onClick={() => setMostrarConfig((v) => !v)}
          >
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
          <div className="tablet-reloj-kiosco-video-wrap" ref={kioscoWrapRef}>
            <div className="tablet-reloj-kiosco-hole" />
            <div className="tablet-reloj-kiosco-overlay">
              <div
                className={`tablet-reloj-sensor ${sensorActivo ? 'tablet-reloj-sensor--activo' : ''} ${paso !== 'esperando' ? 'tablet-reloj-sensor--busy' : ''}`}
              >
                <span className="tablet-reloj-sensor-dot" />
                {paso === 'esperando' ? 'Sensor activo' : 'Procesando'}
              </div>
              <p className="tablet-reloj-kiosco-hint">{estadoTexto}</p>
              {(paso === 'procesando' || paso === 'detectando') && (
                <div className="tablet-reloj-spinner tablet-reloj-spinner--lg" />
              )}
              {puedeMarcarAuto && (
                <button type="button" className="tablet-reloj-btn-marcar" onClick={dispararMarcacion}>
                  Marcar ahora
                </button>
              )}
            </div>
            {paso === 'exito' && resultado && (
              <div className="tablet-reloj-exito-overlay">
                <PanelExitoMarcacion
                  resultado={resultado}
                  nombre={resultado.nombre || seleccionado?.nombre_completo}
                />
              </div>
            )}
          </div>
          {paso === 'error' && (
            <div className="tablet-reloj-error-kiosco">
              <p>{mensajeError}</p>
            </div>
          )}
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
                  disabled={ocupado || paso !== 'esperando'}
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
        </>
      )}

      <canvas ref={captureCanvasRef} className="tablet-reloj-canvas" aria-hidden />

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="tablet-reloj-video"
        style={videoStyle}
        aria-hidden={videoModo === 'standby'}
      />

      {paso === 'camara' && seleccionado && (
        <div className="tablet-reloj-overlay" role="dialog" aria-modal="true">
          <div className="tablet-reloj-modal tablet-reloj-modal--camara">
            <h2>{seleccionado.nombre_completo || seleccionado.login}</h2>
            <p className="tablet-reloj-modal-hint">Mirá a la cámara y confirmá tu marcación</p>
            <div ref={modalHoleRef} className="tablet-reloj-modal-video-hole" />
            <div className="tablet-reloj-modal-actions">
              <button type="button" className="tablet-reloj-btn-ghost" onClick={volverEspera}>
                Cancelar
              </button>
              <button type="button" className="tablet-reloj-btn-primary" onClick={() => void confirmarMarcacionManual()}>
                Marcar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {modo === 'manual' && paso !== 'esperando' && paso !== 'camara' && (
        <div className="tablet-reloj-overlay" role="status">
          <div className="tablet-reloj-modal">
            {(paso === 'procesando' || paso === 'detectando') && (
              <div className="tablet-reloj-procesando">
                <div className="tablet-reloj-spinner tablet-reloj-spinner--lg" />
                <p>{estadoTexto}</p>
              </div>
            )}
            {paso === 'exito' && resultado && (
              <PanelExitoMarcacion
                resultado={resultado}
                nombre={resultado.nombre || seleccionado?.nombre_completo}
              />
            )}
            {paso === 'error' && (
              <div className="tablet-reloj-error-modal">
                <h2>No se pudo marcar</h2>
                <p>{mensajeError}</p>
                <button type="button" className="tablet-reloj-btn-primary" onClick={volverEspera}>
                  Volver
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
