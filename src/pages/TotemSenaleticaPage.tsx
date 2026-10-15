import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TotemKioskIcon } from '../components/totem/TotemKioskIcons'
import { useTotemKioskFullscreen, useTotemKioskMode } from '../hooks/useTotemKioskMode'
import {
  DIRECCION_DETALLE,
  DIRECCION_TEXTO,
  TOTEM_SECTORS_QUEHACER,
  type SectorDirection,
  type TotemSectorSenaletica
} from '../constants/totemSectoresSenaletica'
import './totemKioskGlobal.css'
import './TotemSenaleticaPage.css'

/**
 * Señalética animada para tablet. Replica las franjas del tótem de autogestión
 * (mismos sectores, colores CMYK y flechas) pero las pone "en escena" una por una.
 *
 * - /totem/senaletica               → rota: intro + cada franja a pantalla completa.
 * - /totem/senaletica?sector=diseno → fija un solo destino (tablet en la escalera, etc.).
 *   ids: presupuestos · recepcion · diseno · caja · base_operaciones
 */

const LOGO_URL = '/plot-lab-logo.png'
const INTRO_MS = 6000
const SECTOR_MS = 8000
const HOLD_MS = 25_000
const LEAVE_MS = 1000

/** Paso 0 = intro; 1..n = una franja del tótem. */
const STEPS: Array<TotemSectorSenaletica | null> = [null, ...TOTEM_SECTORS_QUEHACER]

type Vars = Record<`--${string}`, string | number>
const vars = (v: Vars) => v as unknown as CSSProperties
const sectorVars = (s: TotemSectorSenaletica) => vars({ '--bg': s.bg, '--fg': s.textColor })

function formatHora(d: Date): string {
  try {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

function Words({ text, className }: { text: string; className?: string }) {
  return (
    <h2 className={`sen-title${className ? ` ${className}` : ''}`} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="sen-word-mask" aria-hidden>
            <span className="sen-word" style={vars({ '--w': i })}>
              {w}
            </span>
          </span>{' '}
        </span>
      ))}
    </h2>
  )
}

/** Tres chevrones que "corren" en la dirección de la franja (▲ / ► / ▼). */
function BigArrow({ dir }: { dir: SectorDirection }) {
  return (
    <div className={`sen-bigarrow sen-bigarrow--${dir}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <svg key={i} className="sen-chev" viewBox="0 0 100 44" style={vars({ '--k': 2 - i })}>
          <path d="M8 38 50 8l42 30" />
        </svg>
      ))}
    </div>
  )
}

/** Recorrido "desde acá" hasta el destino; en el 1° piso se dibuja como escalera. */
function RouteStrip({ dir }: { dir: SectorDirection }) {
  const stairs = dir === 'primer-piso'
  const d = stairs
    ? 'M16 96H120V76H224V56H328V36H432V16H584'
    : 'M16 56H584'
  const [sx, sy] = stairs ? [16, 96] : [16, 56]
  const [ex, ey] = stairs ? [584, 16] : [584, 56]
  return (
    <div className="sen-route" aria-hidden>
      <svg viewBox="0 0 600 112">
        <path className="sen-route__track" d={d} />
        <circle className="sen-route__pulse" cx={sx} cy={sy} r="12" />
        <circle className="sen-route__start" cx={sx} cy={sy} r="9" />
        <circle className="sen-route__end" cx={ex} cy={ey} r="17" />
        <circle className="sen-route__end-dot" cx={ex} cy={ey} r="7" />
        <circle className="sen-route__walker" r="10">
          <animateMotion dur="2.8s" repeatCount="indefinite" path={d} />
        </circle>
      </svg>
      <div className="sen-route__labels">
        <span>Desde acá</span>
        <span>Tu destino</span>
      </div>
    </div>
  )
}

function SectorHero({ sector, leaving }: { sector: TotemSectorSenaletica; leaving: boolean }) {
  const dir = sector.direction
  return (
    <article
      className={`sen-hero sen-hero--${dir}${leaving ? ' sen-hero--leaving' : ''}`}
      style={sectorVars(sector)}
    >
      <div className={`sen-flow sen-flow--${dir}`} aria-hidden />
      <div className="sen-hero__inner">
        <div className="sen-hero__copy">
          <div className="sen-medal" aria-hidden>
            {[0, 1, 2].map((r) => (
              <span key={r} className="sen-medal__ring" style={vars({ '--r': r })} />
            ))}
            <span className="sen-medal__ico">
              <TotemKioskIcon name={sector.icon} size="lg" />
            </span>
          </div>
          <p className="sen-eyebrow">Dirigite a</p>
          <Words text={sector.label} />
          {dir === 'primer-piso' && <span className="sen-floor">1° piso</span>}
          <p className="sen-detail">{DIRECCION_DETALLE[dir]}</p>
          <RouteStrip dir={dir} />
        </div>
        <BigArrow dir={dir} />
      </div>
    </article>
  )
}

function IntroHero({ leaving }: { leaving: boolean }) {
  return (
    <article className={`sen-hero sen-hero--intro${leaving ? ' sen-hero--leaving' : ''}`}>
      <div className="sen-bands" aria-hidden>
        {(['c', 'm', 'y', 'k'] as const).map((c, i) => (
          <span key={c} className={`sen-band sen-band--${c}`} style={vars({ '--i': i })} />
        ))}
      </div>
      <div className="sen-intro">
        <div className="sen-logo-ring" aria-hidden>
          <img src={LOGO_URL} alt="" />
        </div>
        <p className="sen-eyebrow">Plot Center</p>
        <Words text="¿A dónde vas?" className="sen-title--intro" />
        <p className="sen-detail">Seguí la franja de tu color y las flechas del piso hasta tu destino.</p>
      </div>
    </article>
  )
}

export default function TotemSenaleticaPage() {
  useTotemKioskMode()
  const [params] = useSearchParams()
  const { toggle: toggleFullscreen } = useTotemKioskFullscreen()

  const fixedIdx = useMemo(() => {
    const id = params.get('sector')?.trim().toLowerCase()
    if (!id) return null
    const i = TOTEM_SECTORS_QUEHACER.findIndex((s) => s.id === id)
    return i >= 0 ? i + 1 : null
  }, [params])

  const [idx, setIdx] = useState(fixedIdx ?? 0)
  const [prevIdx, setPrevIdx] = useState<number | null>(null)
  const [hold, setHold] = useState(false)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const lastIdx = useRef(idx)

  useEffect(() => {
    if (fixedIdx != null) setIdx(fixedIdx)
  }, [fixedIdx])

  // Rotación automática; un toque la frena HOLD_MS y después sigue sola.
  useEffect(() => {
    if (fixedIdx != null) return
    const ms = hold ? HOLD_MS : idx === 0 ? INTRO_MS : SECTOR_MS
    const t = window.setTimeout(() => {
      setHold(false)
      setIdx((i) => (i + 1) % STEPS.length)
    }, ms)
    return () => window.clearTimeout(t)
  }, [idx, hold, tick, fixedIdx])

  // Deja el paso anterior debajo mientras el nuevo se revela encima.
  useEffect(() => {
    if (lastIdx.current === idx) return
    setPrevIdx(lastIdx.current)
    lastIdx.current = idx
    const t = window.setTimeout(() => setPrevIdx(null), LEAVE_MS)
    return () => window.clearTimeout(t)
  }, [idx])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  // La tablet no debe apagar la pantalla.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        /* el navegador puede rechazarlo (sin gesto / ahorro de batería) */
      }
    }
    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [])

  const goTo = useCallback(
    (i: number) => {
      if (fixedIdx != null) return
      setIdx(i)
      setHold(true)
      setTick((t) => t + 1)
    },
    [fixedIdx]
  )

  const intro = idx === 0
  const cycling = fixedIdx == null
  const current = STEPS[idx]
  const visibleSteps = [prevIdx, idx].filter((v): v is number => v != null && v !== undefined)

  return (
    <div className={`sen${intro ? ' sen--intro' : ''}`}>
      <div className="sen-fx" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s?.id ?? 'intro'}
            className={`sen-wash${s ? '' : ' sen-wash--intro'}${i === idx ? ' is-on' : ''}`}
            style={s ? vars({ '--bg': s.bg }) : undefined}
          />
        ))}
        <span className="sen-orb sen-orb--c" />
        <span className="sen-orb sen-orb--m" />
        <span className="sen-orb sen-orb--y" />
        <span className="sen-orb sen-orb--k" />
        <span className="sen-halftone" />
        <span className="sen-reg sen-reg--tl" />
        <span className="sen-reg sen-reg--tr" />
        <span className="sen-reg sen-reg--bl" />
        <span className="sen-reg sen-reg--br" />
      </div>

      <header className="sen-top">
        <div className="sen-brand">
          <img src={LOGO_URL} alt="Plot Center" />
          <div>
            <p className="sen-brand__kicker">Plot Center</p>
            <p className="sen-brand__title">Impresión · Diseño · Comunicación visual</p>
          </div>
        </div>
        <span className="sen-clock" aria-hidden>
          {formatHora(now)}
        </span>
        <button
          type="button"
          className="sen-fsbtn"
          onClick={() => void toggleFullscreen()}
          aria-label="Pantalla completa"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </header>

      <main className="sen-main">
        <section
          className="sen-stage"
          aria-live="polite"
          aria-label={current ? `Dirigite a ${current.label}` : '¿A dónde vas?'}
        >
          {visibleSteps.map((step) => {
            const s = STEPS[step]
            const leaving = step === prevIdx
            return s ? (
              <SectorHero key={step} sector={s} leaving={leaving} />
            ) : (
              <IntroHero key={step} leaving={leaving} />
            )
          })}
        </section>

        <div className="sen-list" role="list">
          {TOTEM_SECTORS_QUEHACER.map((sector, i) => {
            const active = idx === i + 1
            return (
              <button
                key={sector.id}
                type="button"
                role="listitem"
                className={`sen-sign sen-sign--${sector.direction}${active ? ' is-active' : ''}`}
                style={{ ...sectorVars(sector), ...vars({ '--i': i, '--dur': `${hold ? HOLD_MS : SECTOR_MS}ms` }) }}
                onClick={() => goTo(i + 1)}
                aria-pressed={active}
              >
                <span className="sen-sign__ico" aria-hidden>
                  <TotemKioskIcon name={sector.icon} size="strip" />
                </span>
                <span className="sen-sign__text">
                  <strong>{sector.label}</strong>
                  <small>{DIRECCION_TEXTO[sector.direction]}</small>
                </span>
                {sector.direction === 'primer-piso' && <span className="sen-sign__floor">1° piso</span>}
                <span className="sen-sign__arrow" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                  </svg>
                </span>
                {active && cycling && <span key={`${idx}-${tick}`} className="sen-sign__timer" aria-hidden />}
              </button>
            )
          })}
        </div>
      </main>

      <footer className="sen-foot">
        {cycling ? (
          <div className="sen-pips" role="group" aria-label="Destinos">
            {STEPS.map((s, i) => (
              <button
                key={s?.id ?? 'intro'}
                type="button"
                className={`sen-pip${i === idx ? ' is-on' : ''}`}
                style={vars({ '--c': s?.bg ?? '#ffffff' })}
                onClick={() => goTo(i)}
                aria-label={s ? s.label : 'Inicio'}
              >
                <span className="sen-pip__dot" />
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <p className="sen-hours">
          <b>Lun – Vie</b> 6:00 – 22:00 hs · <b>Sáb</b> 9:00 – 18:00 hs
        </p>
      </footer>
    </div>
  )
}
