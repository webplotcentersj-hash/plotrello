import { useEffect, useState } from 'react'
import apiService from '../services/api'
import type { Notification } from '../types/api'
import { getArgentinaDateString, isoToArgentinaDateKey } from '../utils/dateUtils'
import './HeaderSpotlightCard.css'

type Props = { userId: number | null | undefined; compact?: boolean }

function sameMonthDayInArgentina(isoDate: string | undefined, todayYmd: string): boolean {
  if (!isoDate) return false
  const d = isoToArgentinaDateKey(isoDate)
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

export default function HeaderSpotlightCard({ userId, compact = false }: Props) {
  const [cumple, setCumple] = useState(false)
  const [aniversario, setAniversario] = useState(false)
  const [aniosEmpresa, setAniosEmpresa] = useState<number | null>(null)
  const [tieneLegajoFechas, setTieneLegajoFechas] = useState(false)
  const [nacimientoDdMm, setNacimientoDdMm] = useState<string | null>(null)
  const [ingresoDdMmYyyy, setIngresoDdMmYyyy] = useState<string | null>(null)
  const [aniosEnEmpresaSiempre, setAniosEnEmpresaSiempre] = useState<number | null>(null)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId == null) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const today = getArgentinaDateString()
      const [legRes, notRes] = await Promise.all([
        apiService.getLegajoEmpleado(userId),
        apiService.getUserNotificationsRrhhMasivos(userId, 8)
      ])
      if (cancelled) return
      if (legRes.success && legRes.data) {
        const fn = legRes.data.fecha_nacimiento
        const fi = legRes.data.fecha_ingreso
        const fnKey = fn ? isoToArgentinaDateKey(String(fn)) : ''
        const fiKey = fi ? isoToArgentinaDateKey(String(fi)) : ''
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
          const ing = isoToArgentinaDateKey(String(fi))
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
      if (notRes.success && notRes.data) {
        setNotifs(notRes.data)
      } else {
        setNotifs([])
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [userId])

  const cardClass = [
    'header-spotlight-card',
    compact ? 'header-spotlight-card--compact' : '',
    userId == null ? 'header-spotlight-card--muted' : ''
  ]
    .filter(Boolean)
    .join(' ')

  if (userId == null) {
    return (
      <div className={cardClass}>
        <span className="header-spotlight-kicker">Tu día en Plot</span>
        <div className="header-spotlight-day-slot" aria-hidden />
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <span className="header-spotlight-kicker">Tu día en Plot</span>
      <div className="header-spotlight-day-slot">
        {loading ? (
          <p className="header-spotlight-line header-spotlight-line--muted">Cargando…</p>
        ) : (
          <>
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
                    🎉 Aniversario en la empresa
                    {aniosEmpresa != null && aniosEmpresa > 0 ? ` · ${aniosEmpresa} años` : ''}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div
        className="header-spotlight-notifs"
        title="Comunicados enviados desde Recursos Humanos → Notificador masivo (/rrhh/notificaciones)."
      >
        <span className="header-spotlight-notifs-label">Comunicados RRHH</span>
        {notifs.length > 0 && (
          <ul className="header-spotlight-notifs-list">
            {notifs.slice(0, 3).map((n) => (
              <li key={n.id} className={n.is_read ? '' : 'unread'} title={n.description || n.title}>
                {n.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
