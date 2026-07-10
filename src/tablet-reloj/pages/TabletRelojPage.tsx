import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ARGENTINA_TIMEZONE,
  getMarcacionTimestamptzIso,
  horaMarcacionTabletDisplay
} from '../../utils/dateUtils'
import {
  fetchEmpleadosRelojTablet,
  fotoEmpleadoUrl,
  getRelojTabletApiKey,
  inicialesEmpleado,
  marcarAutoRelojTablet,
  marcarRelojTablet,
  detectarPresenciaRelojTablet,
  precalentarLegajosRelojTablet,
  setRelojTabletApiKey,
  verificarSelfieRelojTablet,
  type EmpleadoRelojTablet,
  type MarcacionTabletResult
} from '../services/relojTabletApi'
import { useFacePresence } from '../hooks/useFacePresence'
import {
  estadoMarcacionHoy,
  getDispositivoId,
  isKioskUnlocked,
  lockKiosk,
  playMarcacionSound,
  requestScreenWakeLock,
  setDispositivoId,
  toggleFullscreen,
  unlockKiosk
} from '../utils/tabletRelojKiosk'
import './TabletRelojPage.css'

type Modo = 'auto' | 'manual'
type Paso = 'esperando' | 'camara' | 'procesando' | 'exito' | 'error'

const COOLDOWN_MS = 2500
const EXITO_MS = 3200
const AUTO_RESET_ERROR_MS = 3500
const SELFIE_MAX_WIDTH = 640
const SELFIE_JPEG_QUALITY = 0.72

function tituloExitoMarcacion(tipo: 'entrada' | 'salida'): string {
  return tipo === 'entrada' ? '¡Entrada registrada!' : '¡Salida registrada!'
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

async function esperarVideoListo(video: HTMLVideoElement, maxMs = 2000): Promise<boolean> {
  if (video.readyState >= 2 && video.videoWidth > 64 && video.videoHeight > 64) return true
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (video.readyState >= 2 && video.videoWidth > 64 && video.videoHeight > 64) return true
    await new Promise((r) => window.setTimeout(r, 50))
  }
  return video.readyState >= 2 && video.videoWidth > 0
}

async function esperarElementoVideo(getVideo: () => HTMLVideoElement | null, maxMs = 3000): Promise<HTMLVideoElement | null> {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const video = getVideo()
    if (video) return video
    await new Promise((r) => window.setTimeout(r, 50))
  }
  return getVideo()
}

export default function TabletRelojPage() {
  const [empleados, setEmpleados] = useState<EmpleadoRelojTablet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCamara, setErrorCamara] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [modo, setModo] = useState<Modo>('auto')
  const [paso, setPaso] = useState<Paso>('esperando')
  const [seleccionado, setSeleccionado] = useState<EmpleadoRelojTablet | null>(null)
  const [resultado, setResultado] = useState<MarcacionTabletResult | null>(null)
  const [mensajeError, setMensajeError] = useState('')
  const [procesoHint, setProcesoHint] = useState('')
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(getRelojTabletApiKey())
  const [camaraLista, setCamaraLista] = useState(false)
  const [enCooldown, setEnCooldown] = useState(false)
  const [relojArgentina, setRelojArgentina] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [kioskUnlocked, setKioskUnlocked] = useState(() => isKioskUnlocked())
  const [pinModal, setPinModal] = useState<'manual' | 'config' | null>(null)
  const [pinDraft, setPinDraft] = useState('')
  const [pinError, setPinError] = useState('')
  const [dispositivoDraft, setDispositivoDraft] = useState(() => getDispositivoId())
  const pageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const standbyRef = useRef<HTMLDivElement>(null)
  const [kioscoAnchor, setKioscoAnchor] = useState<HTMLDivElement | null>(null)
  const [modalAnchor, setModalAnchor] = useState<HTMLDivElement | null>(null)
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
      void precalentarLegajosRelojTablet()
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
    let wake: WakeLockSentinel | null = null
    void requestScreenWakeLock().then((w) => {
      wake = w
    })
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void requestScreenWakeLock().then((w) => {
          wake = w
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void wake?.release()
    }
  }, [])

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
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no soporta cámara')
    }
    if (streamRef.current?.active) {
      const video = videoRef.current ?? (await esperarElementoVideo(() => videoRef.current))
      if (video) {
        video.srcObject = streamRef.current
        await video.play().catch(() => undefined)
      }
      setCamaraLista(true)
      setErrorCamara('')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    })
    streamRef.current = stream
    const video = videoRef.current ?? (await esperarElementoVideo(() => videoRef.current))
    if (video) {
      video.srcObject = stream
      await video.play().catch(() => undefined)
    }
    setCamaraLista(true)
    setErrorCamara('')
  }, [])

  const reintentarCamara = useCallback(() => {
    setErrorCamara('')
    void iniciarCamara().catch(() => {
      setErrorCamara('No se pudo acceder a la cámara. Revisá permisos del navegador.')
    })
  }, [iniciarCamara])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await esperarElementoVideo(() => videoRef.current)
      if (cancelled) return
      try {
        await iniciarCamara()
      } catch {
        if (!cancelled) {
          setErrorCamara('No se pudo acceder a la cámara. Revisá permisos del navegador.')
        }
      }
    })()
    return () => {
      cancelled = true
      detenerCamara()
    }
  }, [iniciarCamara, detenerCamara])

  const videoTarget = useMemo(() => {
    if (paso === 'camara' && modalAnchor) return modalAnchor
    if (modo === 'manual' && paso === 'procesando' && modalAnchor) return modalAnchor
    if (modo === 'auto' && kioscoAnchor && paso !== 'camara') return kioscoAnchor
    return standbyRef.current
  }, [modo, paso, kioscoAnchor, modalAnchor])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream?.active) return
    if (video.srcObject !== stream) {
      video.srcObject = stream
      void video.play().catch(() => undefined)
    }
  }, [videoTarget, camaraLista])

  const capturarSelfie = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas) return null
    const listo =
      video.readyState >= 2 && video.videoWidth > 64 && video.videoHeight > 64
        ? true
        : await esperarVideoListo(video, 600)
    if (!listo) return null
    const srcW = video.videoWidth
    const srcH = video.videoHeight
    if (srcW < 64 || srcH < 64) return null
    const scale = Math.min(1, SELFIE_MAX_WIDTH / srcW)
    canvas.width = Math.round(srcW * scale)
    canvas.height = Math.round(srcH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', SELFIE_JPEG_QUALITY)
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
    async (
      selfie: string,
      emp: EmpleadoRelojTablet,
      opts?: { confianza?: number; detalle?: string; omitirVerificacion?: boolean }
    ) => {
      setPaso('procesando')
      try {
        let confianza = opts?.confianza
        let detalle = opts?.detalle

        if (!opts?.omitirVerificacion) {
          const ver = await verificarSelfieRelojTablet(emp.id_usuario, selfie)
          confianza = ver.confianza
          detalle = ver.motivo || ver.mensaje
          if (!ver.omitir_verificacion && !ver.match) {
            throw new Error(ver.mensaje || 'La foto no coincide con el legajo')
          }
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
        playMarcacionSound('ok')
        iniciarCooldown()
        window.setTimeout(() => volverEspera(), EXITO_MS)
      } catch (e) {
        setPaso('error')
        setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
        playMarcacionSound('error')
        window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      } finally {
        procesandoRef.current = false
        setOcupado(false)
      }
    },
    [iniciarCooldown, volverEspera]
  )

  const ejecutarFlujoAuto = useCallback(async () => {
    const selfie = await capturarSelfie()
    if (!selfie) {
      setPaso('error')
      setMensajeError('No se pudo capturar la foto. Mantenete frente a la cámara.')
      procesandoRef.current = false
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      return
    }
    if (loading || empleados.length === 0) {
      setPaso('error')
      setMensajeError('Todavía se cargan los empleados. Esperá un segundo e intentá de nuevo.')
      procesandoRef.current = false
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
      return
    }
    setPaso('procesando')
    try {
      setProcesoHint('Mirá a la cámara — verificando rostro…')
      const presencia = await detectarPresenciaRelojTablet(selfie)
      if (!presencia.skipped && !presencia.ok) {
        const hint = presencia.sugerencia ? ` ${presencia.sugerencia}` : ''
        throw new Error((presencia.motivo || 'Parate frente a la cámara') + hint)
      }
      setProcesoHint('Identificando con IA…')
      const res = await marcarAutoRelojTablet(selfie)
      if (!res.match || !res.data) throw new Error(res.mensaje || 'No se reconoció ningún empleado')
      setSeleccionado(
        empleados.find((e) => e.id_usuario === res.data!.id_usuario) || {
          id_usuario: res.data.id_usuario,
          nombre: '',
          apellido: '',
          sector: '',
          foto_url: null,
          login: '',
          nombre_completo: res.data.nombre || res.nombre || 'Empleado'
        }
      )
      setResultado(res.data)
      setPaso('exito')
      playMarcacionSound('ok')
      iniciarCooldown()
      window.setTimeout(() => volverEspera(), EXITO_MS)
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'No se pudo identificar')
      playMarcacionSound('error')
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    } finally {
      setProcesoHint('')
      procesandoRef.current = false
      setOcupado(false)
    }
  }, [capturarSelfie, empleados, loading, iniciarCooldown, volverEspera])

  const dispararMarcacion = useCallback(() => {
    if (modo !== 'auto') return
    if (pasoRef.current !== 'esperando' || enCooldownRef.current || procesandoRef.current) return
    procesandoRef.current = true
    setOcupado(true)
    setPaso('procesando')
    void ejecutarFlujoAuto()
  }, [modo, ejecutarFlujoAuto])

  const { sensorActivo } = useFacePresence(
    videoRef,
    modo === 'auto' &&
      paso === 'esperando' &&
      camaraLista &&
      !enCooldown &&
      !ocupado &&
      !errorCamara &&
      !loading &&
      empleados.length > 0,
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
      const selfie = await capturarSelfie()
      if (!selfie) throw new Error('No se pudo capturar la foto. Mirá a la cámara e intentá de nuevo.')
      setPaso('procesando')
      await procesarMarcacion(selfie, seleccionado, {
        detalle: 'Marcación manual'
      })
    } catch (e) {
      setPaso('error')
      setMensajeError(e instanceof Error ? e.message : 'Error al marcar')
      procesandoRef.current = false
      setOcupado(false)
      window.setTimeout(() => volverEspera(), AUTO_RESET_ERROR_MS)
    }
  }

  const videoNode = useMemo(
    () => <video ref={videoRef} playsInline muted autoPlay className="tablet-reloj-video-fill" />,
    []
  )

  const cambiarModo = (nuevo: Modo) => {
    if (nuevo === modo) return
    volverEspera()
    setModo(nuevo)
    if (nuevo === 'auto') setBusqueda('')
  }

  const solicitarModoManual = () => {
    if (kioskUnlocked) {
      cambiarModo('manual')
      return
    }
    setPinDraft('')
    setPinError('')
    setPinModal('manual')
  }

  const solicitarConfig = () => {
    if (kioskUnlocked) {
      setMostrarConfig((v) => !v)
      return
    }
    setPinDraft('')
    setPinError('')
    setPinModal('config')
  }

  const confirmarPin = () => {
    if (!unlockKiosk(pinDraft)) {
      setPinError('PIN incorrecto. El PIN por defecto es 7531.')
      return
    }
    setKioskUnlocked(true)
    setPinDraft('')
    setPinError('')
    const dest = pinModal
    setPinModal(null)
    if (dest === 'manual') {
      cambiarModo('manual')
      void cargar()
    } else if (dest === 'config') {
      setMostrarConfig(true)
    }
  }

  const cerrarPinModal = () => {
    setPinModal(null)
    setPinDraft('')
    setPinError('')
  }

  const estadoTexto =
    paso === 'camara'
      ? 'Confirmá tu marcación'
      : paso === 'procesando'
        ? procesoHint || 'Identificando…'
          : paso === 'exito'
            ? 'Marcación registrada'
            : paso === 'error'
              ? mensajeError
              : errorCamara
                ? errorCamara
                : loading
                  ? 'Cargando empleados…'
                  : enCooldown
                    ? 'Esperá unos segundos antes de marcar de nuevo'
                    : camaraLista
                      ? 'Mirá de frente a la cámara — marcamos cuando detectamos tu rostro'
                      : 'Activando cámara…'

  const puedeMarcarAuto =
    modo === 'auto' &&
    paso === 'esperando' &&
    !enCooldown &&
    !ocupado &&
    camaraLista &&
    !errorCamara &&
    !loading &&
    empleados.length > 0

  return (
    <div
      ref={pageRef}
      className={`tablet-reloj-page ${modo === 'auto' ? 'tablet-reloj-page--kiosco' : ''}`}
    >
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
            <button type="button" className="tablet-reloj-btn-ghost" onClick={solicitarModoManual}>
              Manual
            </button>
          )}
          <button
            type="button"
            className="tablet-reloj-btn-ghost tablet-reloj-btn-icon"
            onClick={() => void toggleFullscreen(pageRef.current)}
            title="Pantalla completa"
          >
            ⛶
          </button>
          <button type="button" className="tablet-reloj-btn-ghost tablet-reloj-btn-icon" onClick={() => void cargar()}>
            ↻
          </button>
          <button
            type="button"
            className="tablet-reloj-btn-ghost tablet-reloj-btn-icon"
            onClick={solicitarConfig}
            title="Configuración"
          >
            ⚙
          </button>
        </div>
      </header>

      {mostrarConfig ? (
        <div className="tablet-reloj-config">
          <label>
            ID dispositivo
            <input
              type="text"
              value={dispositivoDraft}
              onChange={(e) => setDispositivoDraft(e.target.value)}
              placeholder="tablet-reloj-1"
            />
          </label>
          <label>
            Clave tablet (servidor)
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="RELOJ_TABLET_API_KEY en Vercel"
            />
          </label>
          <div className="tablet-reloj-config-actions">
            <button
              type="button"
              className="tablet-reloj-btn-ghost"
              onClick={() => {
                lockKiosk()
                setKioskUnlocked(false)
                setMostrarConfig(false)
                if (modo === 'manual') cambiarModo('auto')
              }}
            >
              Bloquear kiosco
            </button>
            <button
              type="button"
              className="tablet-reloj-btn-primary"
              onClick={() => {
                setDispositivoId(dispositivoDraft)
                setRelojTabletApiKey(apiKeyDraft)
                setMostrarConfig(false)
                void cargar()
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      ) : null}

      {error && modo === 'auto' ? (
        <div className="tablet-reloj-error-banner">
          <p>{error}</p>
          <p className="tablet-reloj-error-hint">Revisá en ⚙ que la clave tablet coincida con Vercel (RELOJ_TABLET_API_KEY).</p>
          <button type="button" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : modo === 'auto' ? (
        <div className="tablet-reloj-kiosco">
          {loading ? (
            <div className="tablet-reloj-loading-badge">
              <div className="tablet-reloj-spinner" />
              <span>Cargando empleados…</span>
            </div>
          ) : null}
          <div className="tablet-reloj-kiosco-video-wrap">
            <div ref={setKioscoAnchor} className="tablet-reloj-video-anchor" />
            <div className="tablet-reloj-kiosco-overlay">
              <div
                className={`tablet-reloj-sensor ${sensorActivo ? 'tablet-reloj-sensor--activo' : ''} ${paso !== 'esperando' ? 'tablet-reloj-sensor--busy' : ''}`}
              >
                <span className="tablet-reloj-sensor-dot" />
                {paso === 'esperando' ? 'Sensor activo' : 'Procesando'}
              </div>
              <p className="tablet-reloj-kiosco-hint">{estadoTexto}</p>
              {(paso === 'procesando') && (
                <div className="tablet-reloj-spinner tablet-reloj-spinner--lg" />
              )}
              {errorCamara && paso === 'esperando' && (
                <button type="button" className="tablet-reloj-btn-marcar" onClick={reintentarCamara}>
                  Activar cámara
                </button>
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
      ) : loading ? (
        <div className="tablet-reloj-loading">
          <div className="tablet-reloj-spinner" />
          <p>Cargando empleados…</p>
        </div>
      ) : (
        <>
          {error ? (
            <div className="tablet-reloj-error-banner tablet-reloj-error-banner--inline">
              <p>{error}</p>
              <button type="button" onClick={() => void cargar()}>
                Reintentar
              </button>
            </div>
          ) : null}
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
            {filtrados.length === 0 ? (
              <p className="tablet-reloj-empty">No hay empleados con ese criterio.</p>
            ) : (
              filtrados.map((emp) => {
                const foto = fotoEmpleadoUrl(emp)
                const estado = estadoMarcacionHoy(emp)
                const sinFoto = emp.tiene_foto_legajo === false
                const diaCompleto = Boolean(emp.salida_hoy)
                return (
                  <button
                    key={emp.id_usuario}
                    type="button"
                    className={`tablet-reloj-card${diaCompleto ? ' tablet-reloj-card--done' : ''}${sinFoto ? ' tablet-reloj-card--nofoto' : ''}`}
                    onClick={() => void elegirEmpleadoManual(emp)}
                    disabled={ocupado || paso !== 'esperando' || sinFoto || diaCompleto}
                    title={
                      sinFoto
                        ? 'Sin foto de legajo — pedí a RRHH que la carguen'
                        : diaCompleto
                          ? 'Ya marcó entrada y salida hoy'
                          : undefined
                    }
                  >
                    <div className="tablet-reloj-avatar">
                      {foto ? <img src={foto} alt="" /> : <span>{inicialesEmpleado(emp)}</span>}
                    </div>
                    <div className="tablet-reloj-card-text">
                      <strong>{emp.nombre_completo || emp.login}</strong>
                      {emp.sector ? <span>{emp.sector}</span> : null}
                      <span className={`tablet-reloj-estado tablet-reloj-estado--${estado.tone}`}>
                        {estado.label}
                      </span>
                      {sinFoto ? <span className="tablet-reloj-estado tablet-reloj-estado--warn">Sin foto legajo</span> : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </>
      )}

      <canvas ref={captureCanvasRef} className="tablet-reloj-canvas" aria-hidden />
      <div ref={standbyRef} className="tablet-reloj-video-standby" aria-hidden />
      {videoTarget ? createPortal(videoNode, videoTarget) : null}

      {paso === 'camara' && seleccionado && (
        <div className="tablet-reloj-overlay" role="dialog" aria-modal="true">
          <div className="tablet-reloj-modal tablet-reloj-modal--camara">
            <h2>{seleccionado.nombre_completo || seleccionado.login}</h2>
            <p className="tablet-reloj-modal-hint">Mirá a la cámara y confirmá tu marcación</p>
            <div ref={setModalAnchor} className="tablet-reloj-modal-video-hole" />
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
            {(paso === 'procesando') && (
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

      {pinModal
        ? createPortal(
            <div className="tablet-reloj-overlay tablet-reloj-overlay--pin" role="dialog" aria-modal="true">
              <div className="tablet-reloj-modal tablet-reloj-modal--pin">
                <h2>PIN de administración</h2>
                <p className="tablet-reloj-modal-hint">Solo personal autorizado</p>
                <input
                  className="tablet-reloj-pin-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pinDraft}
                  onChange={(e) => {
                    setPinDraft(e.target.value)
                    if (pinError) setPinError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmarPin()
                  }}
                  placeholder="PIN"
                  autoFocus
                />
                {pinError ? <p className="tablet-reloj-pin-error">{pinError}</p> : null}
                <div className="tablet-reloj-modal-actions">
                  <button type="button" className="tablet-reloj-btn-ghost" onClick={cerrarPinModal}>
                    Cancelar
                  </button>
                  <button type="button" className="tablet-reloj-btn-primary" onClick={confirmarPin}>
                    Confirmar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
