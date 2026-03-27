import { useEffect, useState } from 'react'
import apiService from '../services/api'
import type { FechaPlotHoyItem, Notification } from '../types/api'
import { getArgentinaDateString, legajoCalendarDateKey } from '../utils/dateUtils'
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

function yearsInCompany(ingresoKey: string, todayYmd: string): number | null {
  if (ingresoKey.length < 10) return null
  const yIn = parseInt(ingresoKey.slice(0, 4), 10)
  const yNow = parseInt(todayYmd.slice(0, 4), 10)
  const diff = yNow - yIn
  return diff >= 0 ? diff : null
}

function formatEquipoLinea(row: FechaPlotHoyItem): string {
  const bits: string[] = []
  if (row.cumple_hoy) bits.push('cumpleaños')
  if (row.aniversario_empresa_hoy) {
    const a = row.anios_en_empresa
    if (a != null && a > 0) bits.push(`${a} años en la empresa`)
    else if (a === 0) bits.push('primera jornada en Plot')
    else bits.push('aniversario en la empresa')
  }
  return bits.length ? `${row.nombre_mostrar} — ${bits.join(' · ')}` : row.nombre_mostrar
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
  const [loading, setLoading] = useState(false)

  const resolvedId = resolveSessionUserId(userId)

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
          setAniosEnEmpresaSiempre(yearsInCompany(fiKey, today))
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
            const yIn = parseInt(ing.slice(0, 4), 10)
            const yNow = parseInt(today.slice(0, 4), 10)
            const years = yNow - yIn
            setAniosEmpresa(years >= 0 ? years : null)
          }
        } else {
          setAniosEmpresa(null)
        }
      } else {
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
                        <li key={row.id_usuario} className="header-spotlight-equipo-line">
                          {formatEquipoLinea(row)}
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
                          <span className="header-spotlight-meta-years"> · {aniosEnEmpresaSiempre} años</span>
                        )}
                        {aniversario && <span className="header-spotlight-today"> · ¡aniversario hoy!</span>}
                      </p>
                    )}
                  </div>
                )}
                {(cumple || aniversario) && (
                  <div className="header-spotlight-badges" role="status">
                    {cumple && <span className="header-spotlight-badge">🎂 ¡Feliz cumple!</span>}
                    {aniversario && (
                      <span className="header-spotlight-badge">
                        {aniosEmpresa != null && aniosEmpresa > 0
                          ? `🎉 Aniversario en la empresa · ${aniosEmpresa} años`
                          : '🎉 ¡Hoy empezás en Plot!'}
                      </span>
                    )}
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
                    <article
                      className={`header-spotlight-comunicado-item ${comunicadoAccentClass(n.type)}${
                        n.is_read ? '' : ' header-spotlight-comunicado-item--nuevo'
                      }`}
                    >
                      <div className="header-spotlight-comunicado-copy">
                        <p className="header-spotlight-comunicado-title">{n.title}</p>
                        {n.description ? (
                          <p className="header-spotlight-comunicado-desc">{n.description}</p>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
