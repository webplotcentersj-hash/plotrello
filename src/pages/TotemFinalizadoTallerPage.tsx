import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { OrdenTrabajo } from '../types/api'
import apiService from '../services/api'
import { BOARD_COLUMNS } from '../data/mockData'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { isOpEnAlmacenEntrega, isOpFinalizadoEnTaller } from '../utils/totemConsultaOpEstado'
import { TOTEM_FINALIZADO_TALLER_PATH } from '../constants/totemFinalizadoTaller'
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

export default function TotemFinalizadoTallerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchOp, setSearchOp] = useState(() => searchParams.get('op')?.trim() ?? '')
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviandoAviso, setEnviandoAviso] = useState(false)
  const [lastInteraction, setLastInteraction] = useState(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const autoSearchRef = useRef<string | null>(null)

  const registrarInteraccion = () => setLastInteraction(Date.now())

  const ordenesEntradaTaller = useMemo(
    () => ordenes.filter((o) => isOpFinalizadoEnTaller(o.estado)),
    [ordenes]
  )

  const ordenesEnAlmacen = useMemo(
    () => ordenes.filter((o) => isOpEnAlmacenEntrega(o.estado)),
    [ordenes]
  )

  const mostrarResultado = ordenesEntradaTaller.length > 0

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

  const buscarPorOp = useCallback(async (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) {
      setError('Ingresá un número de OP.')
      return
    }
    const searchDigits = digitsOnly(trimmed)
    if (!searchDigits) {
      setError('El número de OP debe contener dígitos.')
      return
    }

    registrarInteraccion()
    setLoading(true)
    setError(null)
    setMensaje(null)
    setOrdenes([])

    try {
      const response = await apiService.getOrdenes()
      if (!response.success || !response.data) {
        setError('No pudimos buscar tu pedido. Intentá de nuevo.')
        return
      }

      const filtradas = response.data.filter(
        (orden) => digitsOnly(orden.numero_op ?? '') === searchDigits
      )

      if (filtradas.length === 0) {
        setError('No se encontraron trabajos con ese número de OP.')
        return
      }

      const entradaTaller = filtradas.filter((o) => isOpFinalizadoEnTaller(o.estado))
      if (entradaTaller.length === 0) {
        const enAlmacen = filtradas.some((o) => isOpEnAlmacenEntrega(o.estado))
        setError(
          enAlmacen
            ? 'Tu pedido ya está en almacén y listo para retirar. Usá «Averiguar OP» en el tótem principal.'
            : 'Tu pedido aún no está en Finalizado en Taller. Consultá el estado en «Averiguar OP».'
        )
        return
      }

      setOrdenes(filtradas)
      setSearchOp(trimmed)
      setSearchParams({ op: trimmed }, { replace: true })
    } catch {
      setError('Error al buscar el pedido.')
    } finally {
      setLoading(false)
    }
  }, [setSearchParams])

  useEffect(() => {
    const opFromUrl = searchParams.get('op')?.trim() ?? ''
    if (!opFromUrl || autoSearchRef.current === opFromUrl) return
    autoSearchRef.current = opFromUrl
    setSearchOp(opFromUrl)
    void buscarPorOp(opFromUrl)
  }, [buscarPorOp, searchParams])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (elapsed > INACTIVITY_MS || elapsed > IDLE_MS) {
        setOrdenes([])
        setSearchOp('')
        setError(null)
        setMensaje(null)
        setSearchParams({}, { replace: true })
        autoSearchRef.current = null
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, setSearchParams])

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
          `Cliente en tótem Finalizado en Taller (entrada a mostrador/caja). ` +
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
          '✅ Avisamos a Caja que estás esperando. No pudimos contactar a Taller Gráfico; un asesor te va a atender.'
        )
      } else {
        setMensaje(
          '✅ Aviso enviado: Caja y Taller Gráfico fueron notificados. Quedate en mostrador/caja, te llamamos en breve.'
        )
      }
    } catch (err) {
      console.error('Error avisando finalizado taller desde tótem:', err)
      setError('No se pudo enviar el aviso. Acercate a mostrador o caja.')
    } finally {
      setEnviandoAviso(false)
    }
  }

  const nuevaBusqueda = () => {
    registrarInteraccion()
    setOrdenes([])
    setSearchOp('')
    setError(null)
    setMensaje(null)
    setSearchParams({}, { replace: true })
    autoSearchRef.current = null
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

      <div className="consulta-container totem-container totem-step-finalizado-taller">
        <header className="totem-entrada-taller-top">
          <button
            type="button"
            className="totem-search-back"
            onClick={() => navigate('/totem/consulta-cliente')}
          >
            ← Tótem principal
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
          {!mostrarResultado ? (
            <div className="totem-entrada-taller-card totem-finalizado-taller-search-card">
              <span className="totem-entrada-taller-badge">Finalizado en taller</span>
              <h1 className="totem-entrada-taller-title">Retiro en mostrador / caja</h1>
              <p className="totem-entrada-taller-lead">
                Si tu trabajo ya terminó en taller, ingresá tu número de OP para avisar que estás
                esperando.
              </p>

              <div className="totem-finalizado-taller-search">
                <label htmlFor="totem-ft-op">Número de OP</label>
                <input
                  id="totem-ft-op"
                  type="text"
                  value={searchOp}
                  onChange={(e) => {
                    registrarInteraccion()
                    setSearchOp(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void buscarPorOp(searchOp)
                  }}
                  placeholder="Ej: 000123"
                  className="dni-input totem-input"
                  disabled={loading}
                  autoComplete="off"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="search-button totem-button totem-finalizado-taller-search-btn"
                  onClick={() => void buscarPorOp(searchOp)}
                  disabled={loading || !searchOp.trim()}
                >
                  {loading ? 'Buscando…' : 'Buscar mi OP'}
                </button>
              </div>

              {error && <div className="totem-error totem-entrada-taller-feedback">{error}</div>}
            </div>
          ) : (
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
                    Taller Gráfico recibe el aviso y prepara el material para mostrador.
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
                        {dniCuit && (
                          <span className="totem-entrada-taller-op-dni">DNI/CUIT {dniCuit}</span>
                        )}
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
                  <strong>También tenés trabajo listo en almacén.</strong> Un asesor puede ayudarte
                  con el retiro.
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
                <button
                  type="button"
                  className="totem-cta-button secondary totem-finalizado-taller-otra-op"
                  onClick={nuevaBusqueda}
                >
                  Buscar otra OP
                </button>
                <p className="totem-entrada-taller-cta-hint">
                  Avisamos a <strong>Caja</strong> y a <strong>Taller Gráfico</strong>.
                </p>
              </div>

              {mensaje && <div className="totem-message totem-entrada-taller-feedback">{mensaje}</div>}
              {error && <div className="totem-error totem-entrada-taller-feedback">{error}</div>}
            </div>
          )}
        </main>

        <footer className="consulta-footer totem-footer">
          <p>Plot Center · Finalizado en taller · {TOTEM_FINALIZADO_TALLER_PATH}</p>
        </footer>
      </div>
    </div>
  )
}
