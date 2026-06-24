import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { OrdenTrabajo } from '../types/api'
import type { TotemConsultaOpNavigationState } from '../types/totemConsulta'
import apiService from '../services/api'
import { BOARD_COLUMNS } from '../data/mockData'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { isOpEnAlmacenEntrega, isOpFinalizadoEnTaller } from '../utils/totemConsultaOpEstado'
import './TotemConsultaClientePage.css'
import './TotemConsultaEntradaTallerPage.css'

const INACTIVITY_MS = 90000
const IDLE_MS = 60000

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

function TotemAmbientBackdrop() {
  return (
    <div className="totem-ambient" aria-hidden>
      <span className="totem-orb totem-orb--1" />
      <span className="totem-orb totem-orb--2" />
      <span className="totem-orb totem-orb--3" />
      <span className="totem-shine" />
    </div>
  )
}

export default function TotemConsultaEntradaTallerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as TotemConsultaOpNavigationState | null

  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>(navState?.ordenes ?? [])
  const [searchOp] = useState(navState?.searchOp ?? '')
  const [loading, setLoading] = useState(!navState?.ordenes?.length)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviandoAviso, setEnviandoAviso] = useState(false)
  const [lastInteraction, setLastInteraction] = useState(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  const registrarInteraccion = () => setLastInteraction(Date.now())

  const ordenesEntradaTaller = useMemo(
    () => ordenes.filter((o) => isOpFinalizadoEnTaller(o.estado)),
    [ordenes]
  )

  const ordenesEnAlmacen = useMemo(
    () => ordenes.filter((o) => isOpEnAlmacenEntrega(o.estado)),
    [ordenes]
  )

  const getEstadoLabel = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.label || estado
  }

  const getEstadoColor = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.accent || '#6b7280'
  }

  useEffect(() => {
    if (navState?.ordenes?.length) return

    const term = searchOp.trim()
    if (!term) {
      navigate('/totem/consulta-cliente', { replace: true })
      return
    }

    const searchDigits = digitsOnly(term)
    if (!searchDigits) {
      navigate('/totem/consulta-cliente', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const response = await apiService.getOrdenes()
        if (!response.success || !response.data) {
          setError('No pudimos cargar tu pedido. Volvé a buscar en el tótem.')
          return
        }
        const filtradas = response.data.filter(
          (orden) => digitsOnly(orden.numero_op ?? '') === searchDigits
        )
        const entradaTaller = filtradas.filter((o) => isOpFinalizadoEnTaller(o.estado))
        if (entradaTaller.length === 0) {
          navigate('/totem/consulta-cliente', { replace: true })
          return
        }
        setOrdenes(filtradas)
        const ids = filtradas
          .map((o) => o.id)
          .filter((id): id is number => typeof id === 'number' && id > 0)
        if (ids.length > 0) {
          await apiService.getHistorialMovimientos({
            ordenIds: ids,
            limit: 400
          })
        }
      } catch {
        setError('Error al cargar el pedido.')
      } finally {
        setLoading(false)
      }
    })()
  }, [navState?.ordenes?.length, navigate, searchOp])

  useEffect(() => {
    if (ordenesEntradaTaller.length === 0 && !loading && ordenes.length > 0) {
      navigate('/totem/consulta-cliente', { replace: true })
    }
  }, [loading, navigate, ordenes.length, ordenesEntradaTaller.length])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (elapsed > INACTIVITY_MS || elapsed > IDLE_MS) {
        navigate('/totem/consulta-cliente', { replace: true })
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, navigate])

  const toggleFullscreen = async () => {
    registrarInteraccion()
    const el = pageRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) await el.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      /* ignore */
    }
  }

  const handleAvisarEsperando = async () => {
    registrarInteraccion()
    if (ordenesEntradaTaller.length === 0) return

    setEnviandoAviso(true)
    setError(null)
    setMensaje(null)

    try {
      const primerOrden = ordenesEntradaTaller[0]
      const numerosOp = [
        ...new Set(ordenesEntradaTaller.map((o) => String(o.numero_op ?? '').trim()).filter(Boolean))
      ]
      const opLabel = numerosOp.length === 1 ? numerosOp[0] : numerosOp.join(', ')

      const atencionRes = await apiService.crearAtencionMostrador({
        cliente_nombre: primerOrden.cliente || 'Cliente tótem',
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden.id,
        notas:
          `Cliente en tótem con OP en Finalizado en Taller (entrada a mostrador/caja). ` +
          `OP: ${opLabel}. Aviso enviado a Taller Gráfico para traer el pedido.`,
        sector_destino: 'Caja',
        orden_numero_op: primerOrden.numero_op ?? undefined
      })

      if (!atencionRes.success) {
        setError(atencionRes.error || 'No se pudo avisar a mostrador. Pedí ayuda en caja.')
        return
      }

      let tgOk = 0
      let tgFail = 0
      for (const orden of ordenesEntradaTaller) {
        if (!orden.id) continue
        const tgRes = await apiService.broadcastPedidoTallerGraficoDesdeEntrega({
          idOrden: orden.id,
          numeroOp: String(orden.numero_op ?? '').trim(),
          cliente: String(orden.cliente ?? '').trim(),
          solicitanteNombre: 'Cliente en tótem',
          solicitanteRol: 'totem'
        })
        if (tgRes.success) tgOk++
        else tgFail++
      }

      if (tgOk === 0 && tgFail > 0) {
        setMensaje(
          '✅ Avisamos a Caja que estás esperando. No pudimos contactar a Taller Gráfico en este momento; un asesor te va a atender.'
        )
      } else {
        setMensaje(
          '✅ Aviso enviado: Caja y Taller Gráfico fueron notificados. Quedate en mostrador/caja, te llamamos en breve.'
        )
      }
    } catch (err) {
      console.error('Error avisando entrada taller desde tótem:', err)
      setError('No se pudo enviar el aviso. Acercate a mostrador o caja.')
    } finally {
      setEnviandoAviso(false)
    }
  }

  const volverABuscar = () => {
    registrarInteraccion()
    navigate('/totem/consulta-cliente')
  }

  if (loading) {
    return (
      <div className="cliente-consulta-page totem-consulta-page totem-entrada-taller-page">
        <div className="totem-entrada-taller-loading">
          <div className="totem-spinner" />
          <p>Cargando tu pedido…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={`cliente-consulta-page totem-consulta-page totem-entrada-taller-page${
        isFullscreen ? ' totem-consulta-page--fs' : ''
      }`}
      onClick={registrarInteraccion}
      onKeyDown={registrarInteraccion}
    >
      <TotemAmbientBackdrop />

      <div className="consulta-container totem-container totem-step-entrada-taller">
        <header className="totem-entrada-taller-top">
          <button type="button" className="totem-search-back" onClick={volverABuscar}>
            ← Volver
          </button>
          <button
            type="button"
            className="totem-fullscreen-btn"
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? '⊡ Salir pantalla grande' : '⛶ Pantalla grande'}
          </button>
        </header>

        <main className="totem-entrada-taller-main">
          <div className="totem-entrada-taller-card">
            <div className="totem-entrada-taller-led totem-entrada-taller-led--top" aria-hidden />
            <div className="totem-entrada-taller-led totem-entrada-taller-led--bottom" aria-hidden />
            <div className="totem-entrada-taller-pulse" aria-hidden />

            <span className="totem-entrada-taller-badge">Finalizado en taller · Entrada a mostrador</span>

            <h1 className="totem-entrada-taller-title">
              {ordenesEntradaTaller.length === 1
                ? `OP #${ordenesEntradaTaller[0].numero_op}`
                : `OP #${searchOp || ordenesEntradaTaller[0]?.numero_op}`}
            </h1>

            <p className="totem-entrada-taller-lead">
              Tu trabajo ya terminó en taller. Estamos preparándolo para entregártelo en{' '}
              <strong>mostrador / caja</strong>.
            </p>

            <div className="totem-entrada-taller-steps">
              <div className="totem-entrada-taller-step">
                <span className="totem-entrada-taller-step-num">1</span>
                <p>
                  Taller Gráfico recibe el aviso (como cuando Caja pide el pedido) y prepara el
                  material.
                </p>
              </div>
              <div className="totem-entrada-taller-step">
                <span className="totem-entrada-taller-step-num">2</span>
                <p>Te atendemos en mostrador o caja para entregarte el trabajo.</p>
              </div>
            </div>

            {ordenesEntradaTaller.map((orden) => {
              const dniCuit = orden.dni_cuit ? digitsOnly(orden.dni_cuit) : null
              return (
                <article key={orden.id} className="totem-entrada-taller-op">
                  <div className="totem-entrada-taller-op-head">
                    <div>
                      <span className="totem-entrada-taller-op-label">Cliente</span>
                      <strong>{orden.cliente}</strong>
                      {dniCuit && <span className="totem-entrada-taller-op-dni">DNI/CUIT {dniCuit}</span>}
                    </div>
                    <span
                      className="totem-entrada-taller-op-estado"
                      style={{ backgroundColor: getEstadoColor(orden.estado) }}
                    >
                      {getEstadoLabel(orden.estado)}
                    </span>
                  </div>
                  {orden.sector && (
                    <p className="totem-entrada-taller-op-sector">
                      Último sector registrado: <strong>{orden.sector}</strong>
                    </p>
                  )}
                </article>
              )
            })}

            {ordenesEnAlmacen.length > 0 && (
              <div className="totem-entrada-taller-almacen-hint">
                <strong>También tenés trabajo listo en almacén.</strong> Después de avisar acá, un
                asesor puede ayudarte con el retiro.
              </div>
            )}

            <div className="totem-entrada-taller-actions">
              <button
                type="button"
                className="totem-cta-button totem-entrada-taller-cta"
                onClick={() => void handleAvisarEsperando()}
                disabled={enviandoAviso}
              >
                {enviandoAviso ? '⏳ Enviando aviso…' : '🖐️ Ya llegué, estoy esperando'}
              </button>
              <p className="totem-entrada-taller-cta-hint">
                Avisamos a <strong>Caja</strong> y a <strong>Taller Gráfico</strong> (mismo sistema que
                usa mostrador al pedir el pedido).
              </p>
            </div>

            {mensaje && <div className="totem-message totem-entrada-taller-feedback">{mensaje}</div>}
            {error && <div className="totem-error totem-entrada-taller-feedback">{error}</div>}
          </div>
        </main>

        <footer className="consulta-footer totem-footer">
          <p>Plot Center · Autogestión</p>
        </footer>
      </div>
    </div>
  )
}
