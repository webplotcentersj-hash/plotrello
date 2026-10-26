import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { EASE_IN_OUT, SPRING, SPRING_SOFT, loop } from './totemMotion'
import './TotemChatHud.css'

/**
 * Piezas visuales del tótem PlotAI (/totem): barra superior, cartelitos que flotan
 * alrededor del robot, visualizador de voz, titular animado y cinta inferior.
 * Son solo presentación: la lógica de voz/cámara vive en TotemChatPage.
 */

const LOGO_URL = '/plot-lab-logo.png'

type Vars = Record<`--${string}`, string | number>
const vars = (v: Vars) => v as unknown as CSSProperties

export type HudState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking'

function formatHora(d: Date): string {
  try {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

/** Marca + hora arriba, con la franja CMYK que se dibuja al entrar. */
export function TotemTopBar() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <>
      <div className="totem-hud-cmyk" aria-hidden>
        {(['c', 'm', 'y', 'k'] as const).map((c, i) => (
          <motion.span
            key={c}
            className={`totem-hud-cmyk__seg totem-hud-cmyk__seg--${c}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 + i * 0.12 }}
          />
        ))}
      </div>

      <motion.header
        className="totem-hud-top"
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.45 }, delay: 0.3 }}
      >
        <div className="totem-hud-brand">
          <motion.span
            className="totem-hud-brand__logo"
            initial={{ opacity: 0, scale: 0.3, rotate: -28 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.3 }, delay: 0.5 }}
          >
            <motion.img
              src={LOGO_URL}
              alt="Plot Center"
              animate={{ rotate: [0, -9, 8, -4, 0], scale: [1, 1.1, 1.1, 1.04, 1] }}
              transition={loop(6, 1.1, 12)}
            />
          </motion.span>
          <span className="totem-hud-brand__text">
            <strong>
              Plot<em>AI</em>
            </strong>
            <small>Plot Center · Asistente con voz</small>
          </span>
        </div>
        <motion.span
          className="totem-hud-clock"
          aria-hidden
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: 0.6 }}
        >
          {formatHora(now)}
        </motion.span>
      </motion.header>
    </>
  )
}

const TAGS = [
  { icon: '🖨️', label: 'Impresión', cls: 'a' },
  { icon: '🎨', label: 'Diseño', cls: 'b' },
  { icon: '💬', label: 'Presupuestos', cls: 'c' }
] as const

/** Cartelitos de vidrio que flotan alrededor del robot mientras espera. */
export function TotemFloatingTags() {
  return (
    <div className="totem-hud-tags" aria-hidden>
      {TAGS.map((t, i) => (
        <motion.div
          key={t.cls}
          className={`totem-hud-tag totem-hud-tag--${t.cls}`}
          initial={{ opacity: 0, scale: 0.4, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: 1 + i * 0.18 }}
        >
          <motion.span
            className="totem-hud-tag__in"
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 3.6 + i * 0.7, repeat: Infinity, ease: EASE_IN_OUT, delay: i * 0.6 }}
          >
            <span className="totem-hud-tag__ico">{t.icon}</span>
            {t.label}
          </motion.span>
        </motion.div>
      ))}
    </div>
  )
}

/** Titular que "cae" palabra por palabra; la segunda línea va en degradé. */
export function TotemHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const words = (text: string, accent: boolean, offset: number) =>
    text.split(' ').map((w, i) => (
      <Fragment key={`${w}-${i}`}>
        <span className="totem-hl__mask" aria-hidden>
          <motion.span
            className={`totem-hl__word${accent ? ' totem-hl__word--accent' : ''}`}
            initial={{ y: '110%', rotate: 5 }}
            animate={{ y: '0%', rotate: 0 }}
            transition={{ ...SPRING, delay: 0.55 + (offset + i) * 0.1 }}
          >
            {w}
          </motion.span>
        </span>{' '}
      </Fragment>
    ))

  return (
    <h2 className="totem-hl" aria-label={`${line1} ${line2}`}>
      <span className="totem-hl__line">{words(line1, false, 0)}</span>
      <span className="totem-hl__line">{words(line2, true, line1.split(' ').length)}</span>
    </h2>
  )
}

const BAR_COUNT = 30

/** Amplitudes "al azar" pero fijas por barra, para que cada barra se mueva distinto. */
function amplitudes(i: number, peak: number): number[] {
  const a = (k: number) => 0.18 + (peak - 0.18) * (0.5 + 0.5 * Math.sin(i * 1.7 + k * 2.3))
  return [0.16, a(1), 0.26, a(2), 0.2, a(3), 0.16]
}

/** Visualizador de voz: ondas que se mueven distinto según el estado de la charla. */
export function TotemVoiceBars({ state }: { state: HudState }) {
  const peak = state === 'speaking' ? 1 : state === 'listening' ? 0.82 : state === 'thinking' ? 0.42 : 0.55
  const speed = state === 'thinking' ? 2.2 : state === 'speaking' ? 0.95 : 1.25

  return (
    <div className="totem-voice" data-state={state} aria-hidden>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <motion.span
          key={i}
          className="totem-voice__bar"
          style={vars({ '--i': i })}
          animate={{ scaleY: amplitudes(i, peak) }}
          transition={{
            duration: speed + (i % 5) * 0.12,
            repeat: Infinity,
            ease: EASE_IN_OUT,
            delay: state === 'thinking' ? i * 0.07 : (i % 7) * 0.05
          }}
        />
      ))}
    </div>
  )
}

/** Tres puntitos que saltan mientras PlotAI piensa. */
export function TotemTypingDots() {
  return (
    <div className="totem-typing" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -6, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: EASE_IN_OUT, delay: i * 0.16 }}
        />
      ))}
    </div>
  )
}

const TICKER_ITEMS = [
  'Impresión',
  'Diseño',
  'Comunicación visual',
  'Presupuestos al instante',
  'Lun – Vie 6:00 – 22:00 hs',
  'Sáb 9:00 – 18:00 hs',
  'Hablá con PlotAI'
]
const DOT_COLORS = ['#22d3ee', '#ec4899', '#facc15', '#94a3b8']

/** Cinta que corre abajo, como las de un local de impresión. */
export function TotemTicker() {
  const row = (key: string) => (
    <div className="totem-ticker__row" key={key} aria-hidden={key === 'b'}>
      {TICKER_ITEMS.map((t, i) => (
        <span className="totem-ticker__item" key={t}>
          {t}
          <i style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
        </span>
      ))}
    </div>
  )
  return (
    <motion.div
      className="totem-ticker"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SOFT, opacity: { duration: 0.5 }, delay: 1.1 }}
    >
      <div className="totem-ticker__track">
        {row('a')}
        {row('b')}
      </div>
    </motion.div>
  )
}

/** Ícono de micrófono para el botón principal. */
export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  )
}
