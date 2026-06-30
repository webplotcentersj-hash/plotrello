import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TotemAutogestionPlotAiChat } from '@/components/ui/TotemAutogestionPlotAiChat'
import './TotemAutogestionHomePage.css'

const IDLE_MS = 90_000

export default function TotemAutogestionHomePage() {
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
        <header className="totem-auto-header">
          <div className="totem-auto-brand">
            <div className="totem-auto-logo-ring">
              <img src="/plot-lab-logo.png" alt="Plot Center" />
            </div>
            <div>
              <p className="totem-auto-kicker">Plot Center · Totem</p>
              <h1>Autogestión</h1>
              <p>Consultá tu OP, elegí productos o imprimir escaneando el código con el celular.</p>
            </div>
          </div>
          <div className="totem-auto-idle" title="Auto reinicio por inactividad">
            Inactividad: {idleSeconds}s
          </div>
        </header>

        <main className="totem-auto-main" role="main">
          <div className="totem-auto-grid">
            <button
              type="button"
              className="totem-auto-tile totem-auto-tile--print"
              onClick={() => navigate('/totem/autogestion/imprimir')}
            >
              <span className="totem-auto-ico-ring totem-auto-ico-ring--pink" aria-hidden>
                <span className="totem-auto-ico">🖨️</span>
              </span>
              <span className="totem-auto-title">Imprimir</span>
              <span className="totem-auto-desc">Escanear código con el celular para subir el archivo; se paga en caja.</span>
            </button>

            <button
              type="button"
              className="totem-auto-tile totem-auto-tile--op"
              onClick={() => navigate('/totem/consulta-cliente')}
            >
              <span className="totem-auto-ico-ring totem-auto-ico-ring--blue" aria-hidden>
                <span className="totem-auto-ico">🔎</span>
              </span>
              <span className="totem-auto-title">Averiguar OP</span>
              <span className="totem-auto-desc">Ver el estado de tu pedido con número de OP o DNI/CUIT.</span>
            </button>

            <button
              type="button"
              className="totem-auto-tile totem-auto-tile--catalogo"
              onClick={() => navigate('/totem/autogestion/catalogo')}
            >
              <span className="totem-auto-ico-ring totem-auto-ico-ring--emerald" aria-hidden>
                <span className="totem-auto-ico">🛒</span>
              </span>
              <span className="totem-auto-title">Elegir productos</span>
              <span className="totem-auto-desc">Seleccioná del catálogo del Portal de Clientes.</span>
            </button>
          </div>
        </main>

        <footer className="totem-auto-footer">
          <TotemAutogestionPlotAiChat />
        </footer>
      </div>
  )
}

