import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../services/api'
import type { FechaPlotHoyItem, Notification } from '../types/api'
import {
  formatAnosEnEmpresa,
  fullYearsBetweenCalendar,
  getArgentinaDateString,
  legajoCalendarDateKey
} from '../utils/dateUtils'
import { fraseMotivacionalDelDia } from '../utils/fraseMotivacionalDia'
import './HeaderSpotlightCard.css'

type Props = { userId: number | null | undefined; compact?: boolean }

/** id desde props o localStorage (login guarda usuario_id; a veces el objeto usuario no trae id) */
function resolveSessionUserId(propId: number | null | undefined): number | null {
  const n = Number(propId)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  const fromLs = Number(localStorage.getItem('usuario_id'))
  if (Number.isFinite(fromLs) && fromLs > 0) return Math.floor(fromLs)
  try {
    const raw = localStorage.getItem('usuario')
    if (!raw) return null
    const u = JSON.parse(raw) as { id?: unknown }
    const id = Number(u?.id)
    if (Number.isFinite(id) && id > 0) return Math.floor(id)
  } catch {
    /* ignore */
  }
  return null
}

function sameMonthDayInArgentina(isoDate: string | undefined, todayYmd: string): boolean {
  if (!isoDate) return false
  const d = legajoCalendarDateKey(isoDate)
  return d.length >= 10 && d.slice(5, 10) === todayYmd.slice(5, 10)
}

/** dd/mm desde clave YYYY-MM-DD */
function ymdToDdMm(key: string): string {
  if (key.length < 10) return ''
  const [, m, d] = key.split('-')
  return `${d}/${m}`
}

function formatEquipoLinea(row: FechaPlotHoyItem): string {
  const bits: string[] = []
  if (row.cumple_hoy) bits.push('cumpleaños')
  if (row.aniversario_empresa_hoy) {
    const a = row.anios_en_empresa
    if (a != null && a > 0) bits.push(`${formatAnosEnEmpresa(a)} en la empresa`)
    else if (a === 0) bits.push('primera jornada en Plot')
    else bits.push('aniversario en la empresa')
  }
  return bits.length ? `${row.nombre_mostrar} — ${bits.join(' · ')}` : row.nombre_mostrar
}

/** Miniatura legajo en lista “Hoy en Plot” (cumple y/o aniversario empresa). */
function EquipoLegajoAvatar({
  nombreMostrar,
  fotoUrl,
  onOpenZoom
}: {
  nombreMostrar: string
  fotoUrl?: string | null
  onOpenZoom?: (src: string, label: string) => void
}) {
  const [imgErr, setImgErr] = useState(false)
  const trimmed = (fotoUrl ?? '').trim()
  const initialMatch = nombreMostrar.trim().match(/[\p{L}\p{N}]/u)
  const initial = (initialMatch?.[0] ?? '?').toUpperCase()
  const showImg = Boolean(trimmed) && !imgErr

  const inner = showImg ? (
    <img
      src={trimmed}
      alt=""
      className="header-spotlight-equipo-avatar-img"
      loading="lazy"
      decoding="async"
      onError={() => setImgErr(true)}
    />
  ) : (
    <span className="header-spotlight-equipo-avatar-letter">{initial}</span>
  )

  if (showImg && onOpenZoom) {
    return (
      <button
        type="button"
        className="header-spotlight-equipo-avatar header-spotlight-equipo-avatar--clickable"
        title={`${nombreMostrar} — clic para ampliar`}
        aria-label={`Ampliar foto de ${nombreMostrar}`}
        onClick={() => onOpenZoom(trimmed, nombreMostrar)}
      >
        {inner}
      </button>
    )
  }

  return <div className="header-spotlight-equipo-avatar">{inner}</div>
}

function ComunicadoDescripcion({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (expanded) return
    const el = descRef.current
    if (!el) return
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [text, expanded])

  return (
    <>
      <p
        ref={descRef}
        className={`header-spotlight-comunicado-desc${expanded ? ' is-expanded' : ''}`}
      >
        {text}
      </p>
      {truncated || expanded ? (
        <button
          type="button"
          className="header-spotlight-comunicado-more"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          aria-expanded={expanded}
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      ) : null}
    </>
  )
}

function comunicadoAccentClass(type: Notification['type']): string {
  switch (type) {
    case 'success':
      return 'header-spotlight-comunicado-item--success'
    case 'warning':
      return 'header-spotlight-comunicado-item--warning'
    case 'error':
      return 'header-spotlight-comunicado-item--error'
    case 'mention':
      return 'header-spotlight-comunicado-item--mention'
    default:
      return 'header-spotlight-comunicado-item--info'
  }
}

export default function HeaderSpotlightCard({ userId, compact = false }: Props) {
  const [cumple, setCumple] = useState(false)
  const [aniversario, setAniversario] = useState(false)
  const [aniosEmpresa, setAniosEmpresa] = useState<number | null>(null)
  const [tieneLegajoFechas, setTieneLegajoFechas] = useState(false)
  const [nacimientoDdMm, setNacimientoDdMm] = useState<string | null>(null)
  const [ingresoDdMmYyyy, setIngresoDdMmYyyy] = useState<string | null>(null)
  const [aniosEnEmpresaSiempre, setAniosEnEmpresaSiempre] = useState<number | null>(null)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [equipoHoy, setEquipoHoy] = useState<FechaPlotHoyItem[]>([])
  const [miFotoLegajoUrl, setMiFotoLegajoUrl] = useState<string | null>(null)
  const [celebrateFotoBlocked, setCelebrateFotoBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fotoZoom, setFotoZoom] = useState<{ src: string; label: string } | null>(null)

  const resolvedId = resolveSessionUserId(userId)

  useEffect(() => {
    setCelebrateFotoBlocked(false)
  }, [miFotoLegajoUrl])

  useEffect(() => {
    if (!fotoZoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFotoZoom(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fotoZoom])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const uid = resolvedId
      if (uid == null) {
        setTieneLegajoFechas(false)
        setNacimientoDdMm(null)
        setIngresoDdMmYyyy(null)
        setNotifs([])
        setEquipoHoy([])
        setMiFotoLegajoUrl(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const today = getArgentinaDateString()
      const [legRes, equipoRes, notRes] = await Promise.all([
        apiService.getLegajoEmpleado(uid).catch(() => ({ success: false as const, error: 'Error de red' })),
        apiService.listarFechasPlotHoy().catch(() => ({ success: false as const })),
        apiService.getUserNotificationsRrhhMasivos(uid, 6).catch(() => ({ success: false as const }))
      ])
      if (cancelled) return
      if (equipoRes.success && equipoRes.data) {
        setEquipoHoy(equipoRes.data)
      } else {
        setEquipoHoy([])
      }
      if (legRes.success && legRes.data) {
        const foto = (legRes.data.foto_url ?? '').trim()
        setMiFotoLegajoUrl(foto || null)
        const fn = legRes.data.fecha_nacimiento
        const fi = legRes.data.fecha_ingreso
        const fnKey = fn ? legajoCalendarDateKey(String(fn)) : ''
        const fiKey = fi ? legajoCalendarDateKey(String(fi)) : ''
        const hasDates = !!(fn || fi)
        setTieneLegajoFechas(hasDates)
        setNacimientoDdMm(fnKey.length >= 10 ? ymdToDdMm(fnKey) : null)
        if (fiKey.length >= 10) {
          const [y, m, d] = fiKey.split('-')
          setIngresoDdMmYyyy(`${d}/${m}/${y}`)
          setAniosEnEmpresaSiempre(fullYearsBetweenCalendar(fiKey, today))
        } else {
          setIngresoDdMmYyyy(null)
          setAniosEnEmpresaSiempre(null)
        }
        setCumple(sameMonthDayInArgentina(fn as string, today))
        const esAniv = sameMonthDayInArgentina(fi as string, today)
        setAniversario(esAniv)
        if (esAniv && fi) {
          const ing = legajoCalendarDateKey(String(fi))
          if (ing.length >= 10) {
            setAniosEmpresa(fullYearsBetweenCalendar(ing, today))
          }
        } else {
          setAniosEmpresa(null)
        }
      } else {
        setMiFotoLegajoUrl(null)
        setTieneLegajoFechas(false)
        setNacimientoDdMm(null)
        setIngresoDdMmYyyy(null)
        setAniosEnEmpresaSiempre(null)
        setCumple(false)
        setAniversario(false)
        setAniosEmpresa(null)
      }
      if (!cancelled && notRes.success && notRes.data) {
        setNotifs(notRes.data)
      } else if (!cancelled) {
        setNotifs([])
      }
      if (!cancelled) setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [resolvedId])

  const fraseDia = fraseMotivacionalDelDia()

  const cardClass = [
    'header-spotlight-card',
    compact ? 'header-spotlight-card--compact' : '',
    resolvedId == null ? 'header-spotlight-card--muted' : ''
  ]
    .filter(Boolean)
    .join(' ')

  if (resolvedId == null) {
    return (
      <div className={cardClass}>
        <span className="header-spotlight-kicker">Tu día en Plot</span>
        <div className="header-spotlight-day-slot" aria-hidden />
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <div className="header-spotlight-split">
        <div className="header-spotlight-split-col header-spotlight-split-col--plot">
          <span className="header-spotlight-kicker">Tu día en Plot</span>
          <div className="header-spotlight-day-slot">
            {loading ? (
              <p className="header-spotlight-line header-spotlight-line--muted">Cargando…</p>
            ) : (
              <>
                {equipoHoy.length > 0 && (
                  <div className="header-spotlight-equipo" aria-label="Cumples y aniversarios del equipo hoy">
                    <p className="header-spotlight-equipo-title">Hoy en Plot (equipo)</p>
                    <ul className="header-spotlight-equipo-list">
                      {equipoHoy.map((row) => (
                        <li key={row.id_usuario} className="header-spotlight-equipo-item">
                          <EquipoLegajoAvatar
                            nombreMostrar={row.nombre_mostrar}
                            fotoUrl={row.foto_url}
                            onOpenZoom={(src, label) => setFotoZoom({ src, label })}
                          />
                          <span className="header-spotlight-equipo-line">{formatEquipoLinea(row)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tieneLegajoFechas && (
                  <div className="header-spotlight-meta" aria-label="Fechas del legajo">
                    {nacimientoDdMm && (
                      <p className="header-spotlight-line">
                        <span className="header-spotlight-meta-label">Cumple</span>{' '}
                        {nacimientoDdMm}
                        {cumple && <span className="header-spotlight-today"> · ¡hoy!</span>}
                      </p>
                    )}
                    {ingresoDdMmYyyy && (
                      <p className="header-spotlight-line">
                        <span className="header-spotlight-meta-label">Alta en la empresa</span>{' '}
                        {ingresoDdMmYyyy}
                        {aniosEnEmpresaSiempre != null && aniosEnEmpresaSiempre > 0 && (
                          <span className="header-spotlight-meta-years">
                            {' '}
                            · {formatAnosEnEmpresa(aniosEnEmpresaSiempre)}
                          </span>
                        )}
                        {aniversario && <span className="header-spotlight-today"> · ¡aniversario hoy!</span>}
                      </p>
                    )}
                  </div>
                )}
                {(cumple || aniversario) && (
                  <div className="header-spotlight-celebrate" role="status">
                    {miFotoLegajoUrl && !celebrateFotoBlocked ? (
                      <button
                        type="button"
                        className="header-spotlight-celebrate-avatar header-spotlight-celebrate-avatar--clickable"
                        title="Tu foto del legajo — clic para ampliar"
                        aria-label="Ampliar tu foto del legajo"
                        onClick={() =>
                          setFotoZoom({
                            src: miFotoLegajoUrl,
                            label: 'Tu foto del legajo'
                          })
                        }
                      >
                        <img
                          src={miFotoLegajoUrl}
                          alt=""
                          className="header-spotlight-celebrate-img"
                          loading="lazy"
                          decoding="async"
                          onError={() => setCelebrateFotoBlocked(true)}
                        />
                      </button>
                    ) : null}
                    <div className="header-spotlight-badges">
                      {cumple && <span className="header-spotlight-badge">🎂 ¡Feliz cumple!</span>}
                      {aniversario && (
                        <span className="header-spotlight-badge">
                          {aniosEmpresa != null && aniosEmpresa > 0
                            ? `🎉 Aniversario en la empresa · ${formatAnosEnEmpresa(aniosEmpresa)}`
                            : '🎉 ¡Hoy empezás en Plot!'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="header-spotlight-split-col header-spotlight-split-col--rrhh">
          <div
            className="header-spotlight-comunicados"
            title="Comunicados enviados desde Recursos Humanos → Notificador masivo (/rrhh/notificaciones)."
          >
            <div className="header-spotlight-comunicados-head">
              <span className="header-spotlight-comunicados-head-icon" aria-hidden>
                📢
              </span>
              <span className="header-spotlight-comunicados-head-title">Comunicados RRHH</span>
            </div>
            {notifs.length > 0 ? (
              <ul className="header-spotlight-comunicados-list">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <div
                      className={`header-spotlight-comunicado-item ${comunicadoAccentClass(n.type)}${
                        n.is_read ? '' : ' header-spotlight-comunicado-item--nuevo'
                      }`}
                      onClick={() => {
                        if (n.is_read) return
                        void apiService.markNotificationAsRead(n.id)
                        setNotifs((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                        )
                      }}
                    >
                      <div className="header-spotlight-comunicado-copy">
                        <p className="header-spotlight-comunicado-title">{n.title}</p>
                        {n.description ? <ComunicadoDescripcion text={n.description} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="header-spotlight-split-col header-spotlight-split-col--frase">
          <div className="header-spotlight-frase" aria-label="Frase del día">
            <div className="header-spotlight-frase-head">
              <span className="header-spotlight-frase-head-icon" aria-hidden>
                ✨
              </span>
              <span className="header-spotlight-frase-head-title">Frase del día</span>
            </div>
            <blockquote className="header-spotlight-frase-quote">
              <p className="header-spotlight-frase-texto">“{fraseDia.texto}”</p>
              <footer className="header-spotlight-frase-autor">— {fraseDia.autor}</footer>
            </blockquote>
          </div>
        </div>
      </div>
      {fotoZoom &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="header-spotlight-foto-modal"
            role="dialog"
            aria-modal="true"
            aria-label={fotoZoom.label}
          >
            <button
              type="button"
              className="header-spotlight-foto-modal-backdrop"
              aria-label="Cerrar"
              onClick={() => setFotoZoom(null)}
            />
            <div className="header-spotlight-foto-modal-panel">
              <button
                type="button"
                className="header-spotlight-foto-modal-close"
                aria-label="Cerrar"
                onClick={() => setFotoZoom(null)}
              >
                ×
              </button>
              <img src={fotoZoom.src} alt={fotoZoom.label} className="header-spotlight-foto-modal-img" />
              <p className="header-spotlight-foto-modal-caption">{fotoZoom.label}</p>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
