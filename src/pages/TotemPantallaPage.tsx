import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import { estiloSectorPorDestino, parsearNotasTotem } from '../utils/totemPantallaSectores'
import './TotemPantallaPage.css'

const LOGO_URL = '/plot-lab-logo.png'
const ROTATE_MS = 8000
const POLL_MS = 30_000
const HORAS_DATOS = 48

type VisitaRow = {
  id: number
  cliente_nombre: string
  notas: string | null
  fecha_atencion: string
  tipo: string
}

type ImpresionRow = {
  id: number
  cliente_nombre: string
  cantidad_hojas: number
  tipo_impresion: string
  estado_pago: string
  numero_op: string | null
  created_at: string
  impreso_at: string | null
}

type Slide =
  | {
      key: string
      kind: 'visita'
      nombre: string
      sectorLabel: string
      motivo: string | null
      hora: string
      bg: string
      textColor: string
    }
  | {
      key: string
      kind: 'impresion'
      nombre: string
      hojas: number
      tipo: string
      estadoPago: string
      numeroOp: string | null
      hora: string
      pagado: boolean
    }
  | { key: string; kind: 'idle'; title: string; subtitle: string }

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    return ''
  }
}

function formatReloj(d: Date): string {
  try {
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return '--:--:--'
  }
}

function formatFecha(d: Date): string {
  try {
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  } catch {
    return ''
  }
}

function weatherEmoji(code: string): string {
  const n = parseInt(code, 10)
  if (n >= 113 && n <= 116) return '☀️'
  if (n >= 119 && n <= 122) return '☁️'
  if (n >= 143 && n <= 248) return '🌫️'
  if (n >= 260 && n <= 321) return '🌧️'
  if (n >= 386 && n <= 395) return '⛈️'
  if (n >= 227 && n <= 230) return '❄️'
  return '🌤️'
}

function buildSlides(visitas: VisitaRow[], impresiones: ImpresionRow[]): Slide[] {
  type Timed = { at: number; slide: Slide }
  const timed: Timed[] = []

  for (const v of visitas) {
    const { sectorDestino, motivo } = parsearNotasTotem(v.notas)
    const estilo = estiloSectorPorDestino(sectorDestino)
    timed.push({
      at: new Date(v.fecha_atencion).getTime() || 0,
      slide: {
        key: `v-${v.id}`,
        kind: 'visita',
        nombre: v.cliente_nombre,
        sectorLabel: estilo.label,
        motivo,
        hora: formatHora(v.fecha_atencion),
        bg: estilo.bg,
        textColor: estilo.textColor
      }
    })
  }

  for (const i of impresiones) {
    timed.push({
      at: new Date(i.created_at).getTime() || 0,
      slide: {
        key: `i-${i.id}`,
        kind: 'impresion',
        nombre: i.cliente_nombre,
        hojas: i.cantidad_hojas,
        tipo: i.tipo_impresion,
        estadoPago: i.estado_pago,
        numeroOp: i.numero_op,
        hora: formatHora(i.created_at),
        pagado: i.estado_pago === 'pagado'
      }
    })
  }

  timed.sort((a, b) => b.at - a.at)
  const slides = timed.map((t) => t.slide)

  if (slides.length === 0) {
    return [
      {
        key: 'idle-1',
        kind: 'idle',
        title: 'Plot Center',
        subtitle: 'Acá verás quién se dirige a cada sector y los pedidos de impresión del tótem.'
      },
      {
        key: 'idle-2',
        kind: 'idle',
        title: 'Bienvenidos',
        subtitle: 'Usá el tótem para avisar tu visita o enviar archivos a imprimir.'
      }
    ]
  }

  return slides
}

export default function TotemPantallaPage() {
  const [now, setNow] = useState(() => new Date())
  const [visitas, setVisitas] = useState<VisitaRow[]>([])
  const [impresiones, setImpresiones] = useState<ImpresionRow[]>([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [temp, setTemp] = useState<number | null>(null)
  const [weatherDesc, setWeatherDesc] = useState('San Juan')
  const [weatherIcon, setWeatherIcon] = useState('🌤️')

  const slides = useMemo(() => buildSlides(visitas, impresiones), [visitas, impresiones])

  const load = useCallback(async () => {
    const res = await apiService.listarPantallaTotemPublica(HORAS_DATOS, 40, 40)
    if (res.success && res.data) {
      setVisitas(res.data.visitas)
      setImpresiones(res.data.impresiones)
      setLoadError(null)
    } else {
      setLoadError(res.error || 'Sin datos')
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('https://wttr.in/-31.5375,-68.5364?format=j1&lang=es', {
          headers: { Accept: 'application/json' }
        })
        if (!response.ok) return
        const data = await response.json()
        const current = data.current_condition?.[0]
        if (!current) return
        const tempC = current.temp_C ?? current.tempC
        const t = typeof tempC === 'string' ? parseInt(tempC, 10) : Math.round(Number(tempC))
        if (!Number.isNaN(t)) setTemp(t)
        setWeatherDesc(
          current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'San Juan'
        )
        setWeatherIcon(weatherEmoji(String(current.weatherCode || current.code || '')))
      } catch {
        /* clima opcional */
      }
    }
    void fetchWeather()
    const id = window.setInterval(() => void fetchWeather(), 10 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('totem-pantalla-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atenciones_mostrador' }, () => {
        void load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'totem_impresion_solicitudes' }, () => {
        void load()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'totem_impresion_solicitudes' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void channel.unsubscribe()
    }
  }, [load])

  useEffect(() => {
    if (slides.length === 0) return
    const id = window.setInterval(() => {
      setFade(false)
      window.setTimeout(() => {
        setSlideIndex((i) => (i + 1) % slides.length)
        setFade(true)
      }, 380)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [slides.length])

  useEffect(() => {
    if (slideIndex >= slides.length) setSlideIndex(0)
  }, [slideIndex, slides.length])

  const current = slides[slideIndex] ?? slides[0]

  return (
    <div className="totem-pantalla">
      <div className="totem-pantalla-ambient" aria-hidden>
        <span className="totem-pantalla-orb totem-pantalla-orb--1" />
        <span className="totem-pantalla-orb totem-pantalla-orb--2" />
        <span className="totem-pantalla-orb totem-pantalla-orb--3" />
      </div>

      <header className="totem-pantalla-header">
        <div className="totem-pantalla-brand">
          <img src={LOGO_URL} alt="Plot Center" className="totem-pantalla-logo" />
          <div>
            <p className="totem-pantalla-kicker">Plot Center</p>
            <h1 className="totem-pantalla-title">Mostrador en vivo</h1>
          </div>
        </div>

        <div className="totem-pantalla-meta">
          <div className="totem-pantalla-clock" aria-live="polite">
            <span className="totem-pantalla-clock-time">{formatReloj(now)}</span>
            <span className="totem-pantalla-clock-date">{formatFecha(now)}</span>
          </div>
          <div className="totem-pantalla-weather" title={weatherDesc}>
            <span className="totem-pantalla-weather-icon">{weatherIcon}</span>
            <span className="totem-pantalla-weather-temp">
              {temp != null ? `${temp}°C` : '—°C'}
            </span>
            <span className="totem-pantalla-weather-place">San Juan</span>
          </div>
        </div>
      </header>

      <main className="totem-pantalla-main">
        <div className={`totem-pantalla-carousel${fade ? ' totem-pantalla-carousel--in' : ' totem-pantalla-carousel--out'}`}>
          {current?.kind === 'visita' && (
            <article
              className="totem-pantalla-card totem-pantalla-card--visita"
              style={{
                ['--card-bg' as string]: current.bg,
                ['--card-fg' as string]: current.textColor
              }}
            >
              <p className="totem-pantalla-card-tag">Cliente en camino</p>
              <h2 className="totem-pantalla-card-name">{current.nombre}</h2>
              <p className="totem-pantalla-card-sector">→ {current.sectorLabel}</p>
              {current.motivo && (
                <p className="totem-pantalla-card-detail">{current.motivo}</p>
              )}
              <p className="totem-pantalla-card-time">{current.hora} hs</p>
            </article>
          )}

          {current?.kind === 'impresion' && (
            <article
              className={`totem-pantalla-card totem-pantalla-card--impresion${current.pagado ? ' totem-pantalla-card--pagado' : ''}`}
            >
              <p className="totem-pantalla-card-tag">Pedido de impresión</p>
              <h2 className="totem-pantalla-card-name">{current.nombre}</h2>
              <p className="totem-pantalla-card-sector">
                {current.hojas} hoja{current.hojas === 1 ? '' : 's'} · {current.tipo}
              </p>
              {current.numeroOp && (
                <p className="totem-pantalla-card-detail">OP {current.numeroOp}</p>
              )}
              <p className="totem-pantalla-card-badge">
                {current.pagado ? '✓ Pagado — preparar impresión' : '⏳ Pendiente de pago en caja'}
              </p>
              <p className="totem-pantalla-card-time">{current.hora} hs</p>
            </article>
          )}

          {current?.kind === 'idle' && (
            <article className="totem-pantalla-card totem-pantalla-card--idle">
              <img src={LOGO_URL} alt="" className="totem-pantalla-card-idle-logo" />
              <h2 className="totem-pantalla-card-name">{current.title}</h2>
              <p className="totem-pantalla-card-detail">{current.subtitle}</p>
            </article>
          )}
        </div>

        <div className="totem-pantalla-dots" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={s.key}
              className={`totem-pantalla-dot${i === slideIndex ? ' totem-pantalla-dot--active' : ''}`}
            />
          ))}
        </div>
      </main>

      <footer className="totem-pantalla-footer">
        <span className="totem-pantalla-stat totem-pantalla-stat--visita">
          <strong>{visitas.length}</strong> avisos tótem
        </span>
        <span className="totem-pantalla-stat totem-pantalla-stat--impresion">
          <strong>{impresiones.length}</strong> impresiones en cola
        </span>
        {loadError && <span className="totem-pantalla-footer-warn">{loadError}</span>}
      </footer>
    </div>
  )
}
