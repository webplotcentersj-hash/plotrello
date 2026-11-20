import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toDataURL } from 'qrcode'
import { useAuth } from '../hooks/useAuth'
import {
  crearSesionQrPantalla,
  leerSesionQrPantalla,
  listarEnviosArchivosQr,
  marcarEnvioArchivosQr,
  type EnvioArchivosQr,
  type EstadoEnvioArchivosQr
} from '../services/envioArchivosQrService'
import {
  ENVIAR_ARCHIVOS_PUBLICO,
  enviarArchivosSesion,
  esImagenVisible,
  esPdf,
  extensionDe,
  formatearBytes,
  type ArchivoEnviado
} from '../utils/envioArchivosQr'
import './RecibirArchivosQrPage.css'

type Filtro = EstadoEnvioArchivosQr | 'todos'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'nuevo', label: 'Nuevos' },
  { id: 'recibido', label: 'Recibidos' },
  { id: 'archivado', label: 'Archivados' },
  { id: 'todos', label: 'Todos' }
]

const POLL_SESION_MS = 2500
const POLL_BANDEJA_MS = 30000
const DURACION_SESION_MS = 20 * 60 * 1000

function hace(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

function segundosRestantes(expiresAt: string | null, ahora: number): number {
  if (!expiresAt) return 0
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - ahora) / 1000))
}

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** URL pública de Supabase Storage que fuerza la descarga con el nombre original. */
function urlDescarga(a: ArchivoEnviado): string {
  const sep = a.url.includes('?') ? '&' : '?'
  return `${a.url}${sep}download=${encodeURIComponent(a.nombre)}`
}

function descargarTodos(archivos: ArchivoEnviado[]) {
  archivos.forEach((a, i) => {
    window.setTimeout(() => {
      const link = document.createElement('a')
      link.href = urlDescarga(a)
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }, i * 400)
  })
}

// ——— Íconos ———
const Ico = {
  qr: (
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6ZM7 7h.01M17 7h.01M7 17h.01M14 14h2v2h-2v-2Zm4 4h2v2h-2v-2Zm0-4h2M14 20h2" />
  ),
  phone: <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h2" />,
  upload: <path d="M12 16V4m0 0-5 5m5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  monitor: <path d="M3 5h18v11H3V5Zm6 15h6m-3-4v4" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />,
  download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
  printer: <path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17M7 14h10v6.5H7V14Z" />,
  copy: <path d="M9 9h10v11H9V9Zm-4 6V4h10" />,
  refresh: <path d="M19.5 12A7.5 7.5 0 1 1 17.3 6.7M19.5 4v4h-4" />,
  search: <path d="M11 5.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6Zm8.3 14.1-3.4-3.4" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  archive: <path d="M4 5h16v4H4V5Zm1 4h14v10H5V9Zm5 4h4" />,
  undo: <path d="M9 7 4.5 11.5 9 16M5 11.5h9a5 5 0 0 1 0 10h-2" />,
  inbox: <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Zm0 0h5l1 2h4l1-2h5" />,
  whatsapp: (
    <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6L4.5 19.5Zm5-11c-.4 0-1 .5-1 1.4 0 1.7 2.4 4.6 5 5.2.9.2 1.6-.4 1.7-1l-1.6-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.8-1.6c-.2-.4-.5-.7-.9-.7Z" />
  )
}

function Icono({ d, size = 18 }: { d: keyof typeof Ico; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {Ico[d]}
    </svg>
  )
}

function Miniatura({ a }: { a: ArchivoEnviado }) {
  const [rota, setRota] = useState(false)
  if (esImagenVisible(a.nombre) && !rota) {
    return (
      <span className="rqr-thumb">
        <img src={a.url} alt="" loading="lazy" onError={() => setRota(true)} />
      </span>
    )
  }
  return (
    <span className="rqr-thumb" data-pdf={esPdf(a.nombre) || undefined}>
      {(extensionDe(a.nombre) || 'archivo').toUpperCase()}
    </span>
  )
}

function ListaArchivos({ archivos }: { archivos: ArchivoEnviado[] }) {
  return (
    <ul className="rqr-archivos">
      {archivos.map((a, i) => (
        <li key={`${a.url}-${i}`}>
          <Miniatura a={a} />
          <span className="rqr-archivo-nombre" title={a.nombre}>
            <strong>{a.nombre}</strong>
            {a.bytes ? <small>{formatearBytes(a.bytes)}</small> : null}
          </span>
          <a className="rqr-icon-btn" href={a.url} target="_blank" rel="noopener noreferrer" title="Ver">
            <Icono d="eye" size={17} />
          </a>
          <a className="rqr-icon-btn is-accent" href={urlDescarga(a)} title="Descargar">
            <Icono d="download" size={17} />
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function RecibirArchivosQrPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()

  // ——— QR en pantalla ———
  const [sesion, setSesion] = useState<{ id: string; expiresAt: string; qr: string; url: string } | null>(null)
  const [sesionEstado, setSesionEstado] = useState<'abierta' | 'completada' | 'expirada' | 'error'>('abierta')
  const [sesionArchivos, setSesionArchivos] = useState<ArchivoEnviado[]>([])
  const [creando, setCreando] = useState(false)
  const [errorSesion, setErrorSesion] = useState<string | null>(null)
  const [grande, setGrande] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  // ——— QR fijo ———
  const linkFijo = `${window.location.origin}${ENVIAR_ARCHIVOS_PUBLICO}`
  const [qrFijo, setQrFijo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  // ——— Bandeja ———
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtro, setFiltro] = useState<Filtro>('nuevo')
  const [envios, setEnvios] = useState<EnvioArchivosQr[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorBandeja, setErrorBandeja] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [destacarId, setDestacarId] = useState<number | null>(null)

  const nuevoQr = useCallback(async () => {
    setCreando(true)
    setErrorSesion(null)
    try {
      const r = await crearSesionQrPantalla()
      if (!r.success) {
        setErrorSesion(r.error)
        return
      }
      const url = `${window.location.origin}${enviarArchivosSesion(r.data.sessionId)}`
      const qr = await toDataURL(url, {
        width: 640,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b0d17', light: '#ffffff' }
      })
      setSesion({ id: r.data.sessionId, expiresAt: r.data.expiresAt, qr, url })
      setSesionEstado('abierta')
      setSesionArchivos([])
      setAhora(Date.now())
    } catch {
      setErrorSesion('No se pudo generar el QR.')
    } finally {
      setCreando(false)
    }
  }, [])

  // Sondeo de la sesión en pantalla mientras está abierta.
  const sesionId = sesion?.id
  useEffect(() => {
    if (!sesionId || sesionEstado !== 'abierta') return
    let vivo = true
    const tick = async () => {
      const s = await leerSesionQrPantalla(sesionId)
      if (!vivo) return
      if (s.estado !== 'error') {
        setSesionArchivos(s.archivos)
        setSesionEstado(s.estado)
      }
    }
    void tick()
    const t = window.setInterval(() => void tick(), POLL_SESION_MS)
    return () => {
      vivo = false
      window.clearInterval(t)
    }
  }, [sesionId, sesionEstado])

  // Reloj para la cuenta regresiva.
  useEffect(() => {
    if (!sesion || sesionEstado !== 'abierta') return
    const t = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [sesion, sesionEstado])

  useEffect(() => {
    if (sesion && sesionEstado === 'abierta' && new Date(sesion.expiresAt).getTime() <= ahora) {
      setSesionEstado('expirada')
    }
  }, [ahora, sesion, sesionEstado])

  // Al llegar archivos, salir de la vista grande.
  useEffect(() => {
    if (sesionEstado === 'completada') setGrande(false)
  }, [sesionEstado])

  useEffect(() => {
    if (!grande) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGrande(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grande])

  useEffect(() => {
    void toDataURL(linkFijo, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0d17', light: '#ffffff' }
    })
      .then(setQrFijo)
      .catch(() => setQrFijo(null))
  }, [linkFijo])

  const cargarBandeja = useCallback(
    async (silencioso = false) => {
      if (!usuario?.id) return
      if (!silencioso) setCargando(true)
      const r = await listarEnviosArchivosQr(usuario.id, null)
      if (r.success) {
        setEnvios(r.data)
        setErrorBandeja(null)
      } else {
        setErrorBandeja(r.error)
      }
      setCargando(false)
    },
    [usuario?.id]
  )

  useEffect(() => {
    void cargarBandeja()
    const t = window.setInterval(() => void cargarBandeja(true), POLL_BANDEJA_MS)
    return () => window.clearInterval(t)
  }, [cargarBandeja])

  /** Desde la campana / notificación del SO: ?id= o ?codigo= abre la bandeja en ese envío. */
  useEffect(() => {
    const idRaw = searchParams.get('id')
    const codigoRaw = searchParams.get('codigo')
    if (!idRaw && !codigoRaw) return
    if (envios.length === 0 && cargando) return

    const idNum = idRaw ? Number(idRaw) : NaN
    const codigo = (codigoRaw || '').replace(/\D/g, '').slice(0, 4)
    const match =
      (Number.isFinite(idNum) && idNum > 0 ? envios.find((e) => e.id === idNum) : undefined) ||
      (codigo ? envios.find((e) => e.codigo === codigo) : undefined)

    if (match) {
      setFiltro('todos')
      setBuscar(match.codigo)
      setDestacarId(match.id)
      window.setTimeout(() => {
        document.getElementById(`envio-qr-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    } else if (codigo) {
      setFiltro('todos')
      setBuscar(codigo)
    }

    const next = new URLSearchParams(searchParams)
    next.delete('id')
    next.delete('codigo')
    setSearchParams(next, { replace: true })
  }, [envios, cargando, searchParams, setSearchParams])

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { nuevo: 0, recibido: 0, archivado: 0, todos: envios.length }
    for (const e of envios) c[e.estado]++
    return c
  }, [envios])

  const visibles = useMemo(() => {
    const q = buscar.replace(/\D/g, '')
    return envios.filter((e) => (q ? e.codigo.includes(q) : filtro === 'todos' || e.estado === filtro))
  }, [envios, filtro, buscar])

  const marcar = async (e: EnvioArchivosQr, estado: EstadoEnvioArchivosQr) => {
    if (!usuario?.id) return
    setBusyId(e.id)
    const r = await marcarEnvioArchivosQr(e.id, usuario.id, estado)
    setBusyId(null)
    if (!r.success) {
      setErrorBandeja(r.error)
      return
    }
    setEnvios((prev) =>
      prev.map((x) =>
        x.id === e.id
          ? {
              ...x,
              estado,
              atendido_por: estado === 'nuevo' ? null : usuario.id,
              atendido_por_nombre: estado === 'nuevo' ? null : usuario.nombre || null,
              atendido_at: estado === 'nuevo' ? null : new Date().toISOString()
            }
          : x
      )
    )
  }

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkFijo)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      /* sin portapapeles */
    }
  }

  const imprimirCartel = () => {
    if (!qrFijo) return
    const w = window.open('', '_blank', 'width=820,height=1100')
    if (!w) return
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Enviá tus archivos · Plot Center</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0b0d17;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { width: 210mm; height: 297mm; padding: 16mm 16mm 12mm; display: flex; flex-direction: column; align-items: center;
    background: radial-gradient(circle at 100% 0%, #ffe3cf 0, transparent 45%), radial-gradient(circle at 0% 100%, #ece4ff 0, transparent 45%), #fff; }
  .marca { display: flex; align-items: center; gap: 4mm; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; font-size: 11pt; color: #444; }
  .marca img { height: 14mm; }
  h1 { margin: 10mm 0 2mm; font-size: 44pt; line-height: 1; letter-spacing: -.02em; text-align: center; }
  h1 span { color: #eb671b; }
  .sub { margin: 0 0 10mm; font-size: 16pt; color: #555; }
  .marco { position: relative; padding: 7mm; border-radius: 10mm; background: #fff; box-shadow: 0 6mm 16mm rgba(235,103,27,.25); border: 1.2mm solid #eb671b; }
  .marco img { width: 112mm; height: 112mm; display: block; }
  .tag { position: absolute; top: -6mm; left: 50%; transform: translateX(-50%); background: #eb671b; color: #fff; font-weight: 800;
    font-size: 13pt; padding: 2mm 7mm; border-radius: 99px; white-space: nowrap; letter-spacing: .04em; }
  .pasos { display: flex; gap: 6mm; margin-top: 13mm; width: 100%; }
  .paso { flex: 1; text-align: center; padding: 6mm 4mm; border-radius: 6mm; background: #fff7f1; border: .4mm solid #ffd7bd; }
  .num { width: 11mm; height: 11mm; border-radius: 50%; background: #eb671b; color: #fff; font-weight: 800; font-size: 15pt;
    display: inline-flex; align-items: center; justify-content: center; margin-bottom: 3mm; }
  .paso b { display: block; font-size: 14pt; margin-bottom: 1mm; }
  .paso small { font-size: 11pt; color: #555; }
  .pie { margin-top: auto; font-size: 10pt; color: #888; }
</style></head><body><div class="hoja">
<div class="marca"><img src="${window.location.origin}/plot-lab-logo.png" alt="" onerror="this.remove()">Plot Center</div>
<h1>Enviá tus <span>archivos</span></h1>
<p class="sub">PDF o fotos, directo desde tu celular</p>
<div class="marco"><span class="tag">ESCANEÁ CON LA CÁMARA</span><img src="${qrFijo}" alt="QR"></div>
<div class="pasos">
  <div class="paso"><span class="num">1</span><b>Escaneá</b><small>con la cámara del celular</small></div>
  <div class="paso"><span class="num">2</span><b>Elegí y enviá</b><small>tus PDF o fotos</small></div>
  <div class="paso"><span class="num">3</span><b>Decí tu código</b><small>de 4 números en el mostrador</small></div>
</div>
<div class="pie">${linkFijo.replace(/^https?:\/\//, '')}</div>
</div>
<script>window.onload = () => setTimeout(() => window.print(), 350)</script>
</body></html>`)
    w.document.close()
  }

  const vencida = sesionEstado === 'expirada'
  const llegaron = sesionEstado === 'completada'
  const seg = segundosRestantes(sesion?.expiresAt ?? null, ahora)
  const pctTiempo = Math.min(100, (seg * 1000 * 100) / DURACION_SESION_MS)

  return (
    <div className="rqr-page">
      <header className="rqr-hero">
        <div className="rqr-hero-copy">
          <button type="button" className="rqr-back" onClick={() => navigate('/mostrador')}>
            ← Mostrador
          </button>
          <div className="rqr-hero-title">
            <span className="rqr-hero-icon">
              <Icono d="qr" size={26} />
            </span>
            <div>
              <h1>Archivos por QR</h1>
              <p>El cliente escanea con su celular y los archivos llegan acá. Sin WhatsApp, mail ni pendrive.</p>
            </div>
          </div>
        </div>
        <ol className="rqr-flujo" aria-label="Cómo funciona">
          <li>
            <span><Icono d="qr" /></span>
            Mostrás el QR
          </li>
          <li>
            <span><Icono d="phone" /></span>
            El cliente sube
          </li>
          <li>
            <span><Icono d="monitor" /></span>
            Llega acá
          </li>
        </ol>
      </header>

      <div className="rqr-grid">
        {/* ——— QR en pantalla ——— */}
        <section className="rqr-card rqr-card--pantalla">
          <div className="rqr-card-head">
            <div>
              <span className="rqr-eyebrow">Atender ahora</span>
              <h2>QR en pantalla</h2>
            </div>
            {sesion && sesionEstado === 'abierta' && (
              <span className="rqr-live">
                <span className="rqr-pulso" aria-hidden />
                En vivo
              </span>
            )}
          </div>

          {!sesion ? (
            <div className="rqr-empty">
              <div className="rqr-empty-art" aria-hidden>
                <span className="rqr-empty-qr">
                  <Icono d="qr" size={64} />
                </span>
                <span className="rqr-empty-phone">
                  <Icono d="phone" size={40} />
                </span>
              </div>
              <div className="rqr-empty-copy">
                <h3>Generá un QR para este cliente</h3>
                <p>Lo escanea con la cámara, elige sus PDF o fotos y aparecen acá al instante. Dura 20 minutos.</p>
                <button type="button" className="rqr-cta" disabled={creando} onClick={() => void nuevoQr()}>
                  <Icono d="qr" size={20} />
                  {creando ? 'Generando…' : 'Generar QR'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rqr-sesion">
              <div className={`rqr-qr${vencida || llegaron ? ' is-off' : ''}`}>
                <span className="rqr-esq rqr-esq--tl" />
                <span className="rqr-esq rqr-esq--tr" />
                <span className="rqr-esq rqr-esq--bl" />
                <span className="rqr-esq rqr-esq--br" />
                <img src={sesion.qr} alt="QR para enviar archivos" />
                {sesionEstado === 'abierta' && <span className="rqr-scan" aria-hidden />}
                {vencida && (
                  <span className="rqr-qr-overlay">
                    <strong>Venció</strong>
                    <small>Generá uno nuevo</small>
                  </span>
                )}
                {llegaron && (
                  <span className="rqr-qr-overlay is-ok">
                    <span className="rqr-ok-badge">
                      <Icono d="check" size={30} />
                    </span>
                    <strong>¡Recibido!</strong>
                  </span>
                )}
              </div>

              <div className="rqr-sesion-info">
                <div className="rqr-status">
                  <span className="rqr-status-label">Estado</span>
                  <strong>
                    {llegaron
                      ? `Llegaron ${sesionArchivos.length} archivo${sesionArchivos.length === 1 ? '' : 's'}`
                      : vencida
                        ? 'QR vencido'
                        : sesionArchivos.length
                          ? `Subiendo… ${sesionArchivos.length}`
                          : 'Esperando al cliente'}
                  </strong>
                </div>
                {sesionEstado === 'abierta' && (
                  <div className="rqr-tiempo">
                    <div className="rqr-tiempo-top">
                      <span>Vence en</span>
                      <strong>{mmss(seg)}</strong>
                    </div>
                    <div className="rqr-tiempo-barra">
                      <span style={{ width: `${pctTiempo}%` }} />
                    </div>
                  </div>
                )}
                <div className="rqr-acciones">
                  {sesionEstado === 'abierta' && (
                    <button type="button" className="rqr-btn rqr-btn--primary" onClick={() => setGrande(true)}>
                      <Icono d="expand" size={17} />
                      Mostrar grande
                    </button>
                  )}
                  <button
                    type="button"
                    className={`rqr-btn${sesionEstado === 'abierta' ? '' : ' rqr-btn--primary'}`}
                    disabled={creando}
                    onClick={() => void nuevoQr()}
                  >
                    <Icono d="refresh" size={17} />
                    {creando ? 'Generando…' : 'Nuevo QR'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {errorSesion && <p className="rqr-error">{errorSesion}</p>}

          {sesionArchivos.length > 0 && (
            <div className="rqr-recibidos">
              <div className="rqr-recibidos-head">
                <strong>
                  <Icono d="inbox" size={17} />
                  {llegaron ? 'Recibidos' : 'Llegando'} · {sesionArchivos.length}
                </strong>
                {sesionArchivos.length > 1 && (
                  <button type="button" className="rqr-btn rqr-btn--sm" onClick={() => descargarTodos(sesionArchivos)}>
                    <Icono d="download" size={15} />
                    Descargar todos
                  </button>
                )}
              </div>
              <ListaArchivos archivos={sesionArchivos} />
            </div>
          )}
        </section>

        {/* ——— QR fijo ——— */}
        <section className="rqr-card rqr-card--fijo">
          <div className="rqr-card-head">
            <div>
              <span className="rqr-eyebrow rqr-eyebrow--alt">Siempre disponible</span>
              <h2>QR fijo para el mostrador</h2>
            </div>
          </div>
          <p className="rqr-help">
            Imprimilo y pegalo en el mostrador o la vidriera. El cliente sube sus archivos y recibe un código de 4
            números para decirte al llegar.
          </p>

          <div className="rqr-poster" aria-label="Vista previa del cartel">
            <span className="rqr-poster-kicker">Plot Center</span>
            <strong className="rqr-poster-title">
              Enviá tus <span>archivos</span>
            </strong>
            <div className="rqr-poster-qr">{qrFijo ? <img src={qrFijo} alt="QR fijo" /> : null}</div>
            <div className="rqr-poster-pasos">
              <span>1 Escaneá</span>
              <span>2 Enviá</span>
              <span>3 Decí tu código</span>
            </div>
          </div>

          <div className="rqr-fijo-acciones">
            <button type="button" className="rqr-btn rqr-btn--primary rqr-btn--full" disabled={!qrFijo} onClick={imprimirCartel}>
              <Icono d="printer" size={17} />
              Imprimir cartel A4
            </button>
            <div className="rqr-fijo-sec">
              <button type="button" className="rqr-btn" onClick={() => void copiarLink()}>
                <Icono d={copiado ? 'check' : 'copy'} size={16} />
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
              <a
                className="rqr-btn rqr-btn--wa"
                href={`https://wa.me/?text=${encodeURIComponent(`Enviá tus archivos a Plot Center desde acá: ${linkFijo}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icono d="whatsapp" size={16} />
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ——— Bandeja ——— */}
      <section className="rqr-card rqr-bandeja">
        <div className="rqr-bandeja-head">
          <div>
            <span className="rqr-eyebrow rqr-eyebrow--alt">QR fijo</span>
            <h2>
              Bandeja de envíos
              {conteo.nuevo > 0 && <span className="rqr-nuevos">{conteo.nuevo} nuevos</span>}
            </h2>
          </div>
          <div className="rqr-bandeja-tools">
            <label className="rqr-buscar">
              <Icono d="search" size={17} />
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="Código"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button type="button" className="rqr-btn rqr-btn--icon" title="Actualizar" onClick={() => void cargarBandeja()}>
              <Icono d="refresh" size={17} />
            </button>
          </div>
        </div>

        <div className="rqr-filtros" role="tablist">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id && !buscar}
              className={`rqr-filtro${filtro === f.id && !buscar ? ' is-on' : ''}`}
              onClick={() => {
                setFiltro(f.id)
                setBuscar('')
              }}
            >
              {f.label}
              <span>{conteo[f.id]}</span>
            </button>
          ))}
        </div>

        {errorBandeja && <p className="rqr-error">{errorBandeja}</p>}
        {cargando ? (
          <div className="rqr-envios">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rqr-skeleton" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="rqr-vacio">
            <span className="rqr-vacio-icon">
              <Icono d="inbox" size={30} />
            </span>
            <strong>
              {buscar ? `No hay envíos con el código ${buscar}` : filtro === 'nuevo' ? 'Todo al día' : 'Sin envíos'}
            </strong>
            <small>
              {buscar
                ? 'Revisá los números con el cliente.'
                : filtro === 'nuevo'
                  ? 'Cuando un cliente envíe archivos con el QR fijo, aparecen acá y te llega un aviso.'
                  : 'No hay envíos en esta categoría.'}
            </small>
          </div>
        ) : (
          <div className="rqr-envios">
            {visibles.map((e) => (
              <article
                key={e.id}
                id={`envio-qr-${e.id}`}
                className={`rqr-envio is-${e.estado}${destacarId === e.id ? ' is-destacado' : ''}`}
              >
                <div className="rqr-envio-head">
                  <span className="rqr-codigo" aria-label={`Código ${e.codigo}`}>
                    {e.codigo.split('').map((d, i) => (
                      <span key={i}>{d}</span>
                    ))}
                  </span>
                  <div className="rqr-envio-meta">
                    <strong>
                      {e.cantidad} archivo{e.cantidad === 1 ? '' : 's'} · {formatearBytes(e.bytes)}
                    </strong>
                    <small>
                      {hace(e.created_at)}
                      {e.atendido_por_nombre
                        ? ` · ${e.estado === 'archivado' ? 'archivó' : 'recibió'} ${e.atendido_por_nombre}`
                        : ''}
                    </small>
                  </div>
                  <span className={`rqr-estado is-${e.estado}`}>
                    {e.estado === 'nuevo' ? 'Nuevo' : e.estado === 'recibido' ? 'Recibido' : 'Archivado'}
                  </span>
                </div>
                <ListaArchivos archivos={e.archivos} />
                <div className="rqr-envio-acciones">
                  {e.archivos.length > 1 && (
                    <button type="button" className="rqr-btn rqr-btn--sm" onClick={() => descargarTodos(e.archivos)}>
                      <Icono d="download" size={15} />
                      Todos
                    </button>
                  )}
                  <span className="rqr-spacer" />
                  {e.estado === 'nuevo' && (
                    <button
                      type="button"
                      className="rqr-btn rqr-btn--sm rqr-btn--ok"
                      disabled={busyId === e.id}
                      onClick={() => void marcar(e, 'recibido')}
                    >
                      <Icono d="check" size={15} />
                      Recibido
                    </button>
                  )}
                  {e.estado !== 'archivado' && (
                    <button
                      type="button"
                      className="rqr-btn rqr-btn--sm"
                      disabled={busyId === e.id}
                      onClick={() => void marcar(e, 'archivado')}
                    >
                      <Icono d="archive" size={15} />
                      Archivar
                    </button>
                  )}
                  {e.estado !== 'nuevo' && (
                    <button
                      type="button"
                      className="rqr-btn rqr-btn--sm"
                      disabled={busyId === e.id}
                      onClick={() => void marcar(e, 'nuevo')}
                    >
                      <Icono d="undo" size={15} />
                      Volver a nuevo
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {grande && sesion && sesionEstado === 'abierta' && (
        <div className="rqr-grande" role="dialog" aria-label="QR para el cliente" onClick={() => setGrande(false)}>
          <div className="rqr-grande-box" onClick={(ev) => ev.stopPropagation()}>
            <span className="rqr-grande-kicker">Plot Center</span>
            <h2>
              Escaneá y enviá tus <span>archivos</span>
            </h2>
            <div className="rqr-qr rqr-qr--grande">
              <span className="rqr-esq rqr-esq--tl" />
              <span className="rqr-esq rqr-esq--tr" />
              <span className="rqr-esq rqr-esq--bl" />
              <span className="rqr-esq rqr-esq--br" />
              <img src={sesion.qr} alt="QR para enviar archivos" />
              <span className="rqr-scan" aria-hidden />
            </div>
            <div className="rqr-grande-pasos">
              <span>
                <b>1</b> Abrí la cámara
              </span>
              <span>
                <b>2</b> Elegí tus PDF o fotos
              </span>
              <span>
                <b>3</b> Tocá Enviar
              </span>
            </div>
            <p>
              {sesionArchivos.length ? `Recibiendo ${sesionArchivos.length} archivo(s)…` : 'Esperando archivos'} · vence en{' '}
              {mmss(seg)}
            </p>
            <button type="button" className="rqr-btn" onClick={() => setGrande(false)}>
              Cerrar (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
