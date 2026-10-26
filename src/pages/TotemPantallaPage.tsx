import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionStyle,
  type Variants
} from 'motion/react'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import HudClock from '../components/HudClock'
import { EASE_IN_OUT, SPRING, SPRING_SOFT, loop } from '../components/totem/totemMotion'
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

/** La tarjeta entra con resorte y va soltando sus líneas de a una; sale hacia arriba. */
const CARD: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 36 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...SPRING, opacity: { duration: 0.35 }, staggerChildren: 0.09, delayChildren: 0.15 }
  },
  exit: { opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.28, ease: 'easeIn' } }
}

const LINE: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { ...SPRING_SOFT, opacity: { duration: 0.3 } } }
}

/** Para lo que tiene que "caer" con peso: el nombre y la insignia. */
const POP: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: { ...SPRING, opacity: { duration: 0.25 } } }
}

const cardVars = (v: Record<`--${string}`, string>) => v as unknown as MotionStyle

/** Contador que "sube" hasta el valor nuevo y rebota al cambiar. */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, (v) => String(Math.round(v)))

  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.9, ease: 'easeOut' })
    return () => controls.stop()
  }, [value, reduce, mv])

  return (
    <motion.strong key={value} initial={{ scale: 1.45 }} animate={{ scale: 1 }} transition={SPRING}>
      {text}
    </motion.strong>
  )
}

/** Una pasada de brillo al entrar la tarjeta. */
function CardShine() {
  return (
    <span className="totem-pantalla-shine" aria-hidden>
      <motion.span
        className="totem-pantalla-shine__band"
        style={{ skewX: -18 }}
        initial={{ x: '-130%' }}
        animate={{ x: '430%' }}
        transition={{ duration: 1.5, delay: 0.9, ease: EASE_IN_OUT }}
      />
    </span>
  )
}

function PantallaCard({ slide }: { slide: Slide }) {
  if (slide.kind === 'visita') {
    return (
      <motion.article
        className="totem-pantalla-card totem-pantalla-card--visita"
        style={cardVars({ '--card-bg': slide.bg, '--card-fg': slide.textColor })}
        variants={CARD}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <CardShine />
        <motion.p variants={LINE} className="totem-pantalla-card-tag">
          Cliente en camino
        </motion.p>
        <motion.h2 variants={POP} className="totem-pantalla-card-name">
          {slide.nombre}
        </motion.h2>
        <motion.p variants={LINE} className="totem-pantalla-card-sector">
          <motion.span
            className="totem-pantalla-arrow"
            aria-hidden
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: EASE_IN_OUT }}
          >
            →
          </motion.span>{' '}
          {slide.sectorLabel}
        </motion.p>
        {slide.motivo && (
          <motion.p variants={LINE} className="totem-pantalla-card-detail">
            {slide.motivo}
          </motion.p>
        )}
        <motion.p variants={LINE} className="totem-pantalla-card-time">
          {slide.hora} hs
        </motion.p>
      </motion.article>
    )
  }

  if (slide.kind === 'impresion') {
    return (
      <motion.article
        className={`totem-pantalla-card totem-pantalla-card--impresion${slide.pagado ? ' totem-pantalla-card--pagado' : ''}`}
        variants={CARD}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <CardShine />
        <motion.p variants={LINE} className="totem-pantalla-card-tag">
          Pedido de impresión
        </motion.p>
        <motion.h2 variants={POP} className="totem-pantalla-card-name">
          {slide.nombre}
        </motion.h2>
        <motion.p variants={LINE} className="totem-pantalla-card-sector">
          {slide.hojas} hoja{slide.hojas === 1 ? '' : 's'} · {slide.tipo}
        </motion.p>
        {slide.numeroOp && (
          <motion.p variants={LINE} className="totem-pantalla-card-detail">
            OP {slide.numeroOp}
          </motion.p>
        )}
        <motion.p variants={POP} className="totem-pantalla-card-badge">
          {slide.pagado ? (
            <motion.span
              className="totem-pantalla-badge-ico"
              aria-hidden
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...SPRING, delay: 0.7 }}
            >
              ✓
            </motion.span>
          ) : (
            <motion.span
              className="totem-pantalla-badge-ico"
              aria-hidden
              animate={{ rotate: [0, -16, 16, -8, 0] }}
              transition={loop(1, 1.3, 3)}
            >
              ⏳
            </motion.span>
          )}{' '}
          {slide.pagado ? 'Pagado — preparar impresión' : 'Pendiente de pago en caja'}
        </motion.p>
        <motion.p variants={LINE} className="totem-pantalla-card-time">
          {slide.hora} hs
        </motion.p>
      </motion.article>
    )
  }

  return (
    <motion.article
      className="totem-pantalla-card totem-pantalla-card--idle"
      variants={CARD}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <motion.div variants={POP}>
        <motion.img
          src={LOGO_URL}
          alt=""
          className="totem-pantalla-card-idle-logo"
          animate={{ y: [0, -9, 0], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: EASE_IN_OUT }}
        />
      </motion.div>
      <motion.h2 variants={LINE} className="totem-pantalla-card-name">
        {slide.title}
      </motion.h2>
      <motion.p variants={LINE} className="totem-pantalla-card-detail">
        {slide.subtitle}
      </motion.p>
    </motion.article>
  )
}

function PantallaScreen() {
  const reduceMotion = useReducedMotion()
  const [now, setNow] = useState(() => new Date())
  const [visitas, setVisitas] = useState<VisitaRow[]>([])
  const [impresiones, setImpresiones] = useState<ImpresionRow[]>([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [tick, setTick] = useState(0)
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
      setSlideIndex((i) => (i + 1) % slides.length)
      setTick((t) => t + 1)
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

      <motion.header
        className="totem-pantalla-header"
        initial={{ opacity: 0, y: -36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.45 } }}
      >
        <div className="totem-pantalla-brand">
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -28 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.3 }, delay: 0.25 }}
          >
            <motion.img
              src={LOGO_URL}
              alt="Plot Center"
              className="totem-pantalla-logo"
              animate={{ rotate: [0, -9, 8, -4, 0], scale: [1, 1.1, 1.1, 1.04, 1] }}
              transition={loop(5, 1.1, 10)}
            />
          </motion.div>
          <div>
            <motion.p
              className="totem-pantalla-kicker"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.35 }}
            >
              Plot Center
            </motion.p>
            <motion.h1
              className="totem-pantalla-title"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.43 }}
            >
              Mostrador en vivo
            </motion.h1>
          </div>
        </div>

        <div className="totem-pantalla-meta">
          <motion.div
            className="totem-pantalla-clock"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: 0.45 }}
          >
            <HudClock now={now} />
          </motion.div>
          <motion.div
            className="totem-pantalla-weather"
            title={weatherDesc}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: 0.58 }}
          >
            <motion.span
              className="totem-pantalla-weather-icon"
              animate={{ y: [0, -4, 0], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: EASE_IN_OUT }}
            >
              {weatherIcon}
            </motion.span>
            <span className="totem-pantalla-weather-temp">
              {temp != null ? `${temp}°C` : '—°C'}
            </span>
            <span className="totem-pantalla-weather-place">San Juan</span>
          </motion.div>
        </div>
      </motion.header>

      <main className="totem-pantalla-main">
        <div className="totem-pantalla-carousel">
          <AnimatePresence mode="wait">{current && <PantallaCard key={current.key} slide={current} />}</AnimatePresence>
        </div>

        {!reduceMotion && (
          <div className="totem-pantalla-timer" aria-hidden>
            <motion.span
              key={`${slides.length}-${tick}`}
              className="totem-pantalla-timer__fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: ROTATE_MS / 1000, ease: 'linear' }}
            />
          </div>
        )}

        <div className="totem-pantalla-dots" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={s.key}
              className={`totem-pantalla-dot${i === slideIndex ? ' totem-pantalla-dot--active' : ''}`}
            />
          ))}
        </div>
      </main>

      <motion.footer
        className="totem-pantalla-footer"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.8 }}
      >
        <span className="totem-pantalla-stat totem-pantalla-stat--visita">
          <CountUp value={visitas.length} /> avisos tótem
        </span>
        <span className="totem-pantalla-stat totem-pantalla-stat--impresion">
          <CountUp value={impresiones.length} /> impresiones en cola
        </span>
        <AnimatePresence>
          {loadError && (
            <motion.span
              className="totem-pantalla-footer-warn"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              {loadError}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.footer>
    </div>
  )
}

export default function TotemPantallaPage() {
  // "user": si la pantalla tiene movimiento reducido, motion deja todo quieto.
  return (
    <MotionConfig reducedMotion="user">
      <PantallaScreen />
    </MotionConfig>
  )
}
