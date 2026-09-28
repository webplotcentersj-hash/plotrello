import { lazy, Suspense, useEffect, useState } from 'react'
import TotemPlotAIRobot, { type TotemRobotState } from './TotemPlotAIRobot'
import './TotemPlotAIRobotStage.css'

const Robot3D = lazy(() => import('./TotemPlotAIRobot3D'))

type Props = {
  state: TotemRobotState
  /** Imagen generada que el robot proyecta en su pantalla. */
  imageUrl?: string | null
  /** true mientras se genera la imagen: la pantalla aparece con animación de carga. */
  imageGenerating?: boolean
  /** Avisa si el robot 3D está activo y si tiene pantalla abierta (para ajustar el layout). */
  onHoloChange?: (info: { capable: boolean; active: boolean }) => void
}

function canUse3D(): boolean {
  if (new URLSearchParams(window.location.search).get('robot') === 'css') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const LABEL: Record<TotemRobotState, string> = {
  idle: 'PlotAI en espera',
  greeting: 'PlotAI saludando',
  listening: 'PlotAI escuchando',
  thinking: 'PlotAI pensando',
  speaking: 'PlotAI hablando'
}

const DEMO_ORDER: TotemRobotState[] = ['idle', 'greeting', 'listening', 'thinking', 'speaking']

function demoParam(): string | null {
  return import.meta.env.DEV ? new URLSearchParams(window.location.search).get('robotdemo') : null
}

/** Solo en desarrollo: ?robotdemo=cycle recorre los estados; ?robotdemo=speaking fija uno. */
function useDemoState(real: TotemRobotState): TotemRobotState {
  const demo = demoParam()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (demo !== 'cycle') return
    const id = window.setInterval(() => setI((n) => (n + 1) % DEMO_ORDER.length), 4500)
    return () => window.clearInterval(id)
  }, [demo])
  if (demo === 'cycle') return DEMO_ORDER[i]
  if (demo && (DEMO_ORDER as string[]).includes(demo)) return demo as TotemRobotState
  return real
}

function drawDemoImage(): string {
  const c = document.createElement('canvas')
  c.width = c.height = 768
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 768, 768)
  bg.addColorStop(0, '#0f2a5c')
  bg.addColorStop(0.5, '#e6007e')
  bg.addColorStop(1, '#ffb347')
  g.fillStyle = bg
  g.fillRect(0, 0, 768, 768)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath()
  g.arc(384, 330, 150, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#0f2a5c'
  g.font = '700 84px sans-serif'
  g.textAlign = 'center'
  g.fillText('DEMO', 384, 620)
  return c.toDataURL('image/png')
}

/** Solo en desarrollo: ?holodemo=1 simula una generación cada 14 s; ?holodemo=img o =gen deja una fase fija. */
function useDemoImage(): { url: string | null; generating: boolean } | null {
  const param = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('holodemo') : null
  const enabled = param !== null
  const [phase, setPhase] = useState<'off' | 'gen' | 'img'>('off')
  const [url] = useState(() => (enabled ? drawDemoImage() : null))
  useEffect(() => {
    if (!enabled) return
    if (param === 'img' || param === 'gen') {
      const id = window.setTimeout(() => setPhase(param), 1200)
      return () => window.clearTimeout(id)
    }
    let alive = true
    const timers: number[] = []
    const cycle = () => {
      if (!alive) return
      setPhase('gen')
      timers.push(window.setTimeout(() => alive && setPhase('img'), 3500))
      timers.push(window.setTimeout(() => alive && setPhase('off'), 11000))
      timers.push(window.setTimeout(cycle, 14000))
    }
    timers.push(window.setTimeout(cycle, 2500))
    return () => {
      alive = false
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [enabled, param])
  if (!enabled) return null
  return { url: phase === 'img' ? url : null, generating: phase === 'gen' }
}

export default function TotemPlotAIRobotStage({ state: realState, imageUrl = null, imageGenerating = false, onHoloChange }: Props) {
  const state = useDemoState(realState)
  const demoImage = useDemoImage()
  const screenUrl = demoImage ? demoImage.url : imageUrl
  const screenGenerating = demoImage ? demoImage.generating : imageGenerating
  const [use3D, setUse3D] = useState(canUse3D)
  const [ready, setReady] = useState(false)

  const capable = use3D && ready
  const active = capable && (screenUrl !== null || screenGenerating)
  useEffect(() => {
    onHoloChange?.({ capable, active })
  }, [capable, active, onHoloChange])

  if (!use3D) return <TotemPlotAIRobot state={state} />

  return (
    <div className="totem-robot3d" data-state={state} data-ready={ready ? 'yes' : 'no'} role="img" aria-label={LABEL[state]}>
      {!ready && (
        <div className="totem-robot3d__fallback">
          <TotemPlotAIRobot state={state} />
        </div>
      )}
      <Suspense fallback={null}>
        <Robot3D
          state={state}
          screenUrl={screenUrl}
          screenGenerating={screenGenerating}
          onReady={() => setReady(true)}
          onFail={() => setUse3D(false)}
        />
      </Suspense>
    </div>
  )
}
