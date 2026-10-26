import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import { TotemAutogestionPlotAiChat } from '@/components/ui/TotemAutogestionPlotAiChat'
import { EASE_IN_OUT, SPRING, SPRING_SOFT, loop } from '@/components/totem/totemMotion'
import './TotemAutogestionHomePage.css'

const IDLE_MS = 90_000

/** Cada cuántos segundos repite su "gesto" cada tarjeta (salto → ícono → brillo). */
const PERIOD_S = 8

type Tile = {
  id: string
  path: string
  ring: 'pink' | 'blue' | 'emerald'
  icon: string
  title: string
  desc: string
  /** Gesto propio del ícono: la impresora sacude, la lupa escanea, el carrito rueda. */
  iconAnim: { x?: number[]; y?: number[]; rotate?: number[] }
}

const TILES: Tile[] = [
  {
    id: 'print',
    path: '/totem/autogestion/imprimir',
    ring: 'pink',
    icon: '🖨️',
    title: 'Imprimir',
    desc: 'Escanear código con el celular para subir el archivo; se paga en caja.',
    iconAnim: { y: [0, -5, 0, -3, 0], rotate: [0, -8, 8, -4, 0] }
  },
  {
    id: 'op',
    path: '/totem/consulta-cliente',
    ring: 'blue',
    icon: '🔎',
    title: 'Averiguar OP',
    desc: 'Ver el estado de tu pedido con número de OP o DNI/CUIT.',
    iconAnim: { x: [0, 6, -6, 0], y: [0, -4, 4, 0], rotate: [0, 10, -10, 0] }
  },
  {
    id: 'catalogo',
    path: '/totem/autogestion/catalogo',
    ring: 'emerald',
    icon: '🛒',
    title: 'Elegir productos',
    desc: 'Seleccioná del catálogo del Portal de Clientes.',
    iconAnim: { x: [0, -6, 8, 0], rotate: [0, -6, 6, 0] }
  }
]

/** Se muestra al entrar: aparece de a poco, sin pisar la animación de cada elemento. */
function Reveal({ delay, children, className }: { delay: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SOFT, opacity: { duration: 0.4 }, delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Una tarjeta del home. Capas para que las animaciones no se pisen:
 * - slot: salto periódico
 * - botón: entrada con resorte, hover y toque
 * - contenido: ícono con gesto propio, flecha que empuja y brillo que cruza
 */
function HomeTile({ tile, index, onGo }: { tile: Tile; index: number; onGo: () => void }) {
  const [entered, setEntered] = useState(false)
  const entryDelay = entered ? 0 : 0.5 + index * 0.14
  const offset = index * 0.7

  return (
    <motion.div
      className="totem-auto-slot"
      animate={{ y: [0, -9, 0, -3, 0] }}
      transition={loop(2.2 + offset, 0.9, PERIOD_S)}
    >
      <motion.button
        type="button"
        className={`totem-auto-tile totem-auto-tile--${tile.id}`}
        initial={{ opacity: 0, y: 70, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: entryDelay }}
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.95 }}
        onAnimationComplete={() => setEntered(true)}
        onClick={onGo}
      >
        <span className={`totem-auto-ico-ring totem-auto-ico-ring--${tile.ring}`} aria-hidden>
          <motion.span
            className="totem-auto-ico"
            animate={tile.iconAnim}
            transition={loop(3.3 + offset, 1.2, PERIOD_S)}
          >
            {tile.icon}
          </motion.span>
        </span>
        <span className="totem-auto-title">{tile.title}</span>
        <span className="totem-auto-desc">{tile.desc}</span>

        <span className="totem-auto-go" aria-hidden>
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
          className="totem-auto-shine"
          aria-hidden
          style={{ skewX: -18 }}
          initial={{ x: '-160%' }}
          animate={{ x: ['-160%', '380%'] }}
          transition={loop(4 + offset, 1.4, PERIOD_S)}
        />
      </motion.button>
    </motion.div>
  )
}

function AutogestionHome() {
  const navigate = useNavigate()
  const [lastInteraction, setLastInteraction] = useState(() => Date.now())

  const touch = () => setLastInteraction(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction > IDLE_MS) {
        // Solo refrescar el estado visual: estamos ya en home.
        setLastInteraction(Date.now())
      }
    }, 2500)
    return () => window.clearInterval(id)
  }, [lastInteraction])

  const idleSeconds = useMemo(() => Math.max(0, Math.floor((IDLE_MS - (Date.now() - lastInteraction)) / 1000)), [lastInteraction])

  return (
    <div className="totem-auto-page" onClick={touch} onTouchStart={touch}>
      <motion.header
        className="totem-auto-header"
        initial={{ opacity: 0, y: -36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.45 } }}
      >
        <div className="totem-auto-brand">
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -28 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.3 }, delay: 0.25 }}
          >
            <div className="totem-auto-logo-ring">
              <motion.img
                src="/plot-lab-logo.png"
                alt="Plot Center"
                animate={{ rotate: [0, -9, 8, -4, 0], scale: [1, 1.1, 1.1, 1.04, 1] }}
                transition={loop(5, 1.1, 10)}
              />
            </div>
          </motion.div>
          <div>
            <Reveal delay={0.35}>
              <p className="totem-auto-kicker">Plot Center · Totem</p>
            </Reveal>
            <Reveal delay={0.42}>
              <h1>Autogestión</h1>
            </Reveal>
            <Reveal delay={0.5}>
              <p>Consultá tu OP, elegí productos o imprimir escaneando el código con el celular.</p>
            </Reveal>
          </div>
        </div>
        <motion.div
          className="totem-auto-idle"
          title="Auto reinicio por inactividad"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...SPRING, opacity: { duration: 0.4 }, delay: 0.6 }}
        >
          Inactividad: {idleSeconds}s
        </motion.div>
      </motion.header>

      <main className="totem-auto-main" role="main">
        <div className="totem-auto-grid">
          {TILES.map((tile, i) => (
            <HomeTile key={tile.id} tile={tile} index={i} onGo={() => navigate(tile.path)} />
          ))}
        </div>
      </main>

      <motion.footer
        className="totem-auto-footer"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, opacity: { duration: 0.5 }, delay: 1 }}
      >
        <TotemAutogestionPlotAiChat />
      </motion.footer>
    </div>
  )
}

export default function TotemAutogestionHomePage() {
  // "user": si la pantalla tiene movimiento reducido, motion deja todo quieto.
  return (
    <MotionConfig reducedMotion="user">
      <AutogestionHome />
    </MotionConfig>
  )
}
