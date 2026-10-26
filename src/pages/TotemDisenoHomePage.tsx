import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { EASE_IN_OUT, SPRING, SPRING_SOFT, loop } from '../components/totem/totemMotion'
import {
  listenDisenadorEnCamino,
  readPendingDisenadorAtencion
} from '../utils/totemSolicitarDisenador'
import './TotemDisenoPages.css'

const LOGO_URL = '/plot-lab-logo.png'

/** Cada cuántos segundos repite su "gesto" cada tarjeta (salto → ícono → brillo). */
const PERIOD_S = 8

type Tile = {
  id: 'brief' | 'call'
  path: string
  icon: string
  title: string
  desc: string
  /** Gesto del ícono: las chispas giran, el pincel pinta. */
  iconAnim: { x?: number[]; y?: number[]; rotate?: number[]; scale?: number[] }
}

const TILES: Tile[] = [
  {
    id: 'brief',
    path: '/totem/diseno/brief',
    icon: '✨',
    title: 'Contratar diseño',
    desc: 'Brief interactivo · mockup · imagen con IA',
    iconAnim: { rotate: [0, 25, -15, 0], scale: [1, 1.3, 1.15, 1] }
  },
  {
    id: 'call',
    path: '/totem/diseno/brief?llamar=1',
    icon: '🎨',
    title: 'Llamar a un diseñador',
    desc: 'Te avisamos en pantalla cuando alguien venga',
    iconAnim: { x: [0, 7, -5, 0], y: [0, -4, 2, 0], rotate: [0, 14, -10, 0] }
  }
]

/**
 * Una tarjeta del home de Diseño. Capas para que las animaciones no se pisen:
 * - slot: salto periódico
 * - botón: entrada con resorte, hover y toque
 * - contenido: ícono con gesto propio, flecha que empuja y brillo que cruza
 */
function DisenoTile({ tile, index, onGo }: { tile: Tile; index: number; onGo: () => void }) {
  const [entered, setEntered] = useState(false)
  const entryDelay = entered ? 0 : 0.5 + index * 0.16
  const offset = index * 0.9

  return (
    <motion.div
      className="totem-diseno-home-slot"
      animate={{ y: [0, -9, 0, -3, 0] }}
      transition={loop(2.2 + offset, 0.9, PERIOD_S)}
    >
      <motion.button
        type="button"
        className={`totem-diseno-home-tile totem-diseno-home-tile--${tile.id}`}
        initial={{ opacity: 0, y: 70, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: entryDelay }}
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.95 }}
        onAnimationComplete={() => setEntered(true)}
        onClick={onGo}
      >
        <motion.span
          className="totem-diseno-home-shine"
          aria-hidden
          style={{ skewX: -18 }}
          initial={{ x: '-160%' }}
          animate={{ x: ['-160%', '420%'] }}
          transition={loop(4 + offset, 1.4, PERIOD_S)}
        />
        <span className="totem-diseno-home-go" aria-hidden>
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: EASE_IN_OUT, delay: index * 0.25 }}
          >
            <path d="M5 12h14M12.5 5.5 19 12l-6.5 6.5" />
          </motion.svg>
        </span>
        <motion.span
          className="totem-diseno-home-tile-icon"
          aria-hidden
          animate={tile.iconAnim}
          transition={loop(3.3 + offset, 1.2, PERIOD_S)}
        >
          {tile.icon}
        </motion.span>
        <strong>{tile.title}</strong>
        <span>{tile.desc}</span>
      </motion.button>
    </motion.div>
  )
}

/**
 * Tótem 1° piso — Diseño: contratar servicio o llamar diseñador.
 */
function DisenoHome() {
  const navigate = useNavigate()
  const [respuestaDisenador, setRespuestaDisenador] = useState<string | null>(null)
  const [esperando, setEsperando] = useState(false)

  useEffect(() => {
    const pending = readPendingDisenadorAtencion()
    if (!pending?.atencionId) return
    setEsperando(true)
    const unsub = listenDisenadorEnCamino(
      { atencionId: pending.atencionId, requestNonce: pending.requestNonce },
      (payload) => {
        setRespuestaDisenador(`✅ ${payload.mensaje}`)
        setEsperando(false)
      }
    )
    return () => unsub()
  }, [])

  return (
    <div className="totem-diseno-page">
      <div className="totem-diseno-ambient" aria-hidden>
        <span className="totem-diseno-orb totem-diseno-orb--1" />
        <span className="totem-diseno-orb totem-diseno-orb--2" />
      </div>

      <motion.header
        className="totem-diseno-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.45 } }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -28 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ ...SPRING, opacity: { duration: 0.3 }, delay: 0.2 }}
        >
          <motion.img
            src={LOGO_URL}
            alt="Plot Center"
            className="totem-diseno-logo"
            animate={{ rotate: [0, -9, 8, -4, 0], scale: [1, 1.1, 1.1, 1.04, 1] }}
            transition={loop(5, 1.1, 10)}
          />
        </motion.div>
        <div>
          <motion.p
            className="totem-diseno-kicker"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.3 }}
          >
            1° piso · Diseño gráfico
          </motion.p>
          <motion.h1
            className="totem-diseno-title"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.38 }}
          >
            Bienvenido a Diseño
          </motion.h1>
          <motion.p
            className="totem-diseno-lead"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 0.46 }}
          >
            Armá tu brief, mirá un mockup en vivo y avisá al equipo. O llamá a un diseñador si preferís
            atención personal.
          </motion.p>
        </div>
      </motion.header>

      <AnimatePresence>
        {(esperando || respuestaDisenador) && (
          <motion.div
            key={respuestaDisenador ? 'ok' : 'espera'}
            className={`totem-diseno-home-alert${respuestaDisenador ? ' totem-diseno-home-alert--ok' : ''}`}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
            transition={{ ...SPRING, opacity: { duration: 0.3 } }}
          >
            {respuestaDisenador ? (
              respuestaDisenador
            ) : (
              <>
                <motion.span
                  className="totem-diseno-home-alert__ico"
                  aria-hidden
                  animate={{ rotate: [0, 14, -12, 8, 0], y: [0, -3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: EASE_IN_OUT }}
                >
                  🎨
                </motion.span>{' '}
                Ya avisamos a un diseñador. En breve te responden acá…
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="totem-diseno-home-grid">
        {TILES.map((tile, i) => (
          <DisenoTile key={tile.id} tile={tile} index={i} onGo={() => navigate(tile.path)} />
        ))}
      </main>

      <motion.footer
        className="totem-diseno-footer"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay: 1 }}
      >
        <motion.button
          type="button"
          className="totem-diseno-back"
          whileTap={{ scale: 0.94 }}
          whileHover={{ x: -4 }}
          onClick={() => navigate('/totem/consulta-cliente')}
        >
          ← Volver al tótem de planta baja
        </motion.button>
      </motion.footer>
    </div>
  )
}

export default function TotemDisenoHomePage() {
  // "user": si la pantalla tiene movimiento reducido, motion deja todo quieto.
  return (
    <MotionConfig reducedMotion="user">
      <DisenoHome />
    </MotionConfig>
  )
}
