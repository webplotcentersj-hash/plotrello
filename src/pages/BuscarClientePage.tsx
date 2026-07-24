import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type {
  ClienteCuentaCorrienteRecord,
  ClienteRecord,
  OrdenTrabajo
} from '../types/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import ClienteDuplicadosPanel from '../components/ClienteDuplicadosPanel'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import { detectarGruposDuplicados } from '../utils/clienteDuplicados'
import {
  ESTADO_CC_LABELS,
  isClienteCcOperativo,
  normalizeEstadoCc
} from '../constants/cuentaCorriente'
import {
  CLIENTES_DASHBOARD,
  clientesCcPerfil,
  clientesPerfil
} from '../utils/clientesRoutes'
import './BuscarClientePage.css'

const MIN_BUSQUEDA = 1

type ClienteEnriquecido = ClienteRecord & {
  esVIP?: boolean
  preferencias?: string | null
  notasInternas?: string | null
  cuentaCorriente?: ClienteCuentaCorrienteRecord | null
  ccOperativa?: boolean
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

function OrdenFichaBuscar({
  orden,
  onVer
}: {
  orden: OrdenTrabajo
  onVer: () => void
}) {
  const status = mapEstadoToStatus(orden.estado)
  const column = BOARD_COLUMNS.find((col) => col.id === status)
  const label = column?.label || orden.estado
  const accent = column?.accent || '#6b7280'
  const entregada = orden.estado === 'Entregado o Instalado' || orden.entregado

  return (
    <article className={`bc-orden${entregada ? ' bc-orden--entregada' : ''}`}>
      <div className="bc-orden__main">
        <span className="bc-orden__op">OP {orden.numero_op}</span>
        <span className="bc-orden__estado" style={{ backgroundColor: accent }}>
          {label}
        </span>
      </div>
      {orden.descripcion && <p className="bc-orden__desc">{orden.descripcion}</p>}
      <div className="bc-orden__meta">
        <span>Creada: {formatDate(orden.fecha_creacion)}</span>
        {orden.fecha_entrega && <span>Entrega: {formatDate(orden.fecha_entrega)}</span>}
        {orden.sector && <span>{orden.sector}</span>}
      </div>
      <button type="button" className="bc-btn bc-btn--ghost bc-btn--sm" onClick={onVer}>
        Ver OP
      </button>
    </article>
  )
}

const BuscarClientePage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteEnriquecido | null>(null)
  const [ordenesCliente, setOrdenesCliente] = useState<OrdenTrabajo[]>([])
  const [loadingOrdenes, setLoadingOrdenes] = useState(false)
  const [vistaOrdenes, setVistaOrdenes] = useState<'activas' | 'todas'>('activas')
  const [duplicadosRelacionados, setDuplicadosRelacionados] = useState<ClienteRecord[]>([])
  const [loadingDuplicados, setLoadingDuplicados] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 280)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    if (debouncedTerm.length < MIN_BUSQUEDA) {
      setClientesEncontrados([])
      setLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const response = await apiService.buscarClientes(debouncedTerm)
        if (!cancelled && response.success && response.data) {
          setClientesEncontrados(response.data)
        }
      } catch (error) {
        console.error('Error buscando clientes:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debouncedTerm])

  const cargarDuplicados = useCallback(async (cliente: ClienteRecord) => {
    setLoadingDuplicados(true)
    setDuplicadosRelacionados([])
    try {
      const res = await apiService.buscarDuplicadosCliente(cliente.id)
      if (res.success && res.data) setDuplicadosRelacionados(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDuplicados(false)
    }
  }, [])

  const cargarDatosCliente = useCallback(async (cliente: ClienteRecord) => {
    setLoadingOrdenes(true)
    setOrdenesCliente([])
    setVistaOrdenes('activas')
    void cargarDuplicados(cliente)

    try {
      const [prefRes, ccRes, ordRes] = await Promise.all([
        cliente.dni_cuit
          ? apiService.obtenerPreferenciasCliente(cliente.dni_cuit)
          : Promise.resolve({ success: true, data: null }),
        apiService.getCuentaCorrientePorCliente(cliente.id),
        apiService.getOrdenesPorCliente(cliente)
      ])

      const prefs = prefRes.success ? prefRes.data : null
      const cc = ccRes.success ? ccRes.data : null
      let ccOperativa = false
      if (cliente.id) {
        const hab = await apiService.clienteHabilitadoCuentaCorriente(cliente.id)
        ccOperativa = hab.success && !!hab.data
      }

      const enriquecido: ClienteEnriquecido = {
        ...cliente,
        esVIP: prefs?.es_vip ?? false,
        preferencias: prefs?.preferencias ?? null,
        notasInternas: prefs?.notas_internas ?? null,
        cuentaCorriente: cc ?? null,
        ccOperativa
      }

      setClienteSeleccionado(enriquecido)
      if (ordRes.success && ordRes.data) setOrdenesCliente(ordRes.data)
    } catch (error) {
      console.error('Error cargando datos del cliente:', error)
      setClienteSeleccionado({ ...cliente })
    } finally {
      setLoadingOrdenes(false)
    }
  }, [cargarDuplicados])

  const gruposDuplicadosEnBusqueda = useMemo(
    () => detectarGruposDuplicados(clientesEncontrados),
    [clientesEncontrados]
  )

  const ordenesActivas = useMemo(
    () =>
      ordenesCliente.filter(
        (o) => o.estado !== 'Entregado o Instalado' && !o.entregado
      ),
    [ordenesCliente]
  )

  const ordenesVista = vistaOrdenes === 'activas' ? ordenesActivas : ordenesCliente

  const limpiarSeleccion = () => {
    setClienteSeleccionado(null)
    setOrdenesCliente([])
    setDuplicadosRelacionados([])
  }

  const trasFusionar = async (principal: ClienteRecord, idsFusionados: number[]) => {
    const idsOut = new Set(idsFusionados.filter((id) => id !== principal.id))
    setClientesEncontrados((prev) => {
      const sinRepetidos = prev.filter((c) => !idsOut.has(c.id))
      const sinPrincipal = sinRepetidos.filter((c) => c.id !== principal.id)
      return [principal, ...sinPrincipal]
    })
    setDuplicadosRelacionados([])
    await cargarDatosCliente(principal)
    if (debouncedTerm.length >= MIN_BUSQUEDA) {
      const res = await apiService.buscarClientes(debouncedTerm)
      if (res.success && res.data) {
        // Tras unificar, la búsqueda no debe volver a listar las fichas desactivadas.
        setClientesEncontrados(res.data.filter((c) => c.activo !== false))
      }
    }
  }

  const buscando = debouncedTerm.length >= MIN_BUSQUEDA

  return (
    <div className="buscar-cliente-page">
      <header className="bc-header">
        <button
          type="button"
          className="bc-btn bc-btn--ghost bc-header__back"
          onClick={() => navigate(CLIENTES_DASHBOARD)}
        >
          Volver a Clientes
        </button>
      </header>

      <div className="bc-hero">
        <h1>Buscar cliente</h1>
        <p className="bc-hero__hint">
          Nombre, DNI, CUIT, teléfono o email — podés separar con espacios (ej:{' '}
          <em>García 20123456789</em>). Detectamos duplicados para unificar fichas.
        </p>

        <label className="bc-search-wrap">
          <span className="bc-search-label">Buscar cliente</span>
          <input
            type="search"
            placeholder="Ej: García 20-12345678 o Plot Lab…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              if (!e.target.value.trim()) limpiarSeleccion()
            }}
            className="bc-search-input"
            autoComplete="off"
            autoFocus
          />
          {loading && <span className="bc-search-loading" aria-live="polite" />}
        </label>

        {buscando && !clienteSeleccionado && (
          <p className="bc-search-meta">
            {loading
              ? 'Buscando…'
              : `${clientesEncontrados.length} resultado${clientesEncontrados.length === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      <main className="bc-main">
        {buscando && !clienteSeleccionado && gruposDuplicadosEnBusqueda.length > 0 && (
          <div className="bc-duplicados-busqueda">
            <ClienteDuplicadosPanel
              candidatos={clientesEncontrados}
              onFusionCompleta={(p, ids) => void trasFusionar(p, ids)}
              onVerCliente={(c) => void cargarDatosCliente(c)}
              onClienteActualizado={(c) => {
                setClientesEncontrados((prev) => prev.map((x) => (x.id === c.id ? c : x)))
              }}
            />
          </div>
        )}

        {buscando && !clienteSeleccionado && clientesEncontrados.length > 0 && (
          <ul className="bc-clientes-list">
            {clientesEncontrados.map((cliente) => (
              <li key={cliente.id}>
                <button
                  type="button"
                  className="bc-cliente-row"
                  onClick={() => void cargarDatosCliente(cliente)}
                >
                  <span className="bc-cliente-row__name">{nombreCompletoCliente(cliente)}</span>
                  {cliente.empresa && (
                    <span className="bc-cliente-row__empresa">{cliente.empresa}</span>
                  )}
                  <span className="bc-cliente-row__meta">
                    {cliente.dni_cuit && <span>{cliente.dni_cuit}</span>}
                    {cliente.telefono && <span>{cliente.telefono}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando && !loading && !clienteSeleccionado && clientesEncontrados.length === 0 && (
          <div className="bc-empty">
            <p>No encontramos clientes con «{debouncedTerm}»</p>
            <p className="bc-empty__hint">Probá con otro dato o menos caracteres.</p>
          </div>
        )}

        {!buscando && !clienteSeleccionado && (
          <div className="bc-empty bc-empty--soft">
            <p>Escribí en el buscador para ver resultados</p>
          </div>
        )}

        {clienteSeleccionado && (
          <section className="bc-detalle">
            {(loadingDuplicados || duplicadosRelacionados.length > 0) && (
              <div className="bc-duplicados-detalle">
                {loadingDuplicados ? (
                  <p className="bc-duplicados-loading">Analizando posibles duplicados…</p>
                ) : (
                  <ClienteDuplicadosPanel
                    clienteReferencia={clienteSeleccionado}
                    candidatos={duplicadosRelacionados}
                    onFusionCompleta={(p, ids) => void trasFusionar(p, ids)}
                    onClienteActualizado={(c) => {
                      setClienteSeleccionado((prev) =>
                        prev && prev.id === c.id ? { ...prev, ...c } : prev
                      )
                      setDuplicadosRelacionados((prev) =>
                        prev.map((x) => (x.id === c.id ? c : x))
                      )
                    }}
                  />
                )}
              </div>
            )}

            <div className="bc-detalle__head">
              <div>
                <div className="bc-detalle__title-row">
                  <h2>{nombreCompletoCliente(clienteSeleccionado)}</h2>
                  <div className="bc-badges">
                    {clienteSeleccionado.esVIP && (
                      <span className="bc-badge bc-badge--vip">VIP</span>
                    )}
                    {clienteSeleccionado.cuentaCorriente && (
                      <span
                        className={`bc-badge bc-badge--cc bc-badge--cc-${normalizeEstadoCc(clienteSeleccionado.cuentaCorriente)}`}
                      >
                        Cuenta corriente ·{' '}
                        {ESTADO_CC_LABELS[normalizeEstadoCc(clienteSeleccionado.cuentaCorriente)]}
                        {clienteSeleccionado.ccOperativa ? ' · operativa' : ''}
                      </span>
                    )}
                    {clienteSeleccionado.es_cliente_web && (
                      <span className="bc-badge bc-badge--web">Portal web</span>
                    )}
                  </div>
                </div>
                {clienteSeleccionado.empresa && (
                  <p className="bc-detalle__empresa">{clienteSeleccionado.empresa}</p>
                )}
                <dl className="bc-detalle__grid">
                  {clienteSeleccionado.dni_cuit && (
                    <div>
                      <dt>DNI / CUIT</dt>
                      <dd>{clienteSeleccionado.dni_cuit}</dd>
                    </div>
                  )}
                  {clienteSeleccionado.telefono && (
                    <div>
                      <dt>Teléfono</dt>
                      <dd>{clienteSeleccionado.telefono}</dd>
                    </div>
                  )}
                  {clienteSeleccionado.email && (
                    <div>
                      <dt>Email</dt>
                      <dd>{clienteSeleccionado.email}</dd>
                    </div>
                  )}
                  {clienteSeleccionado.direccion && (
                    <div className="bc-detalle__grid--wide">
                      <dt>Dirección</dt>
                      <dd>{clienteSeleccionado.direccion}</dd>
                    </div>
                  )}
                  {clienteSeleccionado.cuentaCorriente && (
                    <>
                      <div>
                        <dt>CC — Razón social</dt>
                        <dd>{clienteSeleccionado.cuentaCorriente.razon_social || '—'}</dd>
                      </div>
                      <div>
                        <dt>Saldo CC</dt>
                        <dd>
                          {clienteSeleccionado.cuentaCorriente.saldo_actual != null
                            ? new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: 'ARS'
                              }).format(Number(clienteSeleccionado.cuentaCorriente.saldo_actual))
                            : '—'}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {(clienteSeleccionado.preferencias || clienteSeleccionado.notasInternas) && (
                  <div className="bc-notas">
                    {clienteSeleccionado.preferencias && (
                      <p>
                        <strong>Preferencias:</strong> {clienteSeleccionado.preferencias}
                      </p>
                    )}
                    {clienteSeleccionado.notasInternas && (
                      <p>
                        <strong>Notas:</strong> {clienteSeleccionado.notasInternas}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="bc-detalle__actions">
                <button
                  type="button"
                  className="bc-btn bc-btn--secondary"
                  onClick={() => navigate(clientesPerfil(clienteSeleccionado.id))}
                >
                  Ver ficha completa
                </button>
                {isClienteCcOperativo(clienteSeleccionado.cuentaCorriente ?? {}) && (
                  <button
                    type="button"
                    className="bc-btn bc-btn--secondary"
                    onClick={() =>
                      navigate(
                        clientesCcPerfil(clienteSeleccionado.id)
                      )
                    }
                  >
                    Ver cuenta corriente
                  </button>
                )}
                <button type="button" className="bc-btn bc-btn--ghost" onClick={limpiarSeleccion}>
                  Otra búsqueda
                </button>
              </div>
            </div>

            <div className="bc-ordenes-block">
              <div className="bc-ordenes-block__head">
                <h3>Órdenes del cliente</h3>
                <div className="bc-ordenes-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={vistaOrdenes === 'activas'}
                    className={`bc-ordenes-tab${vistaOrdenes === 'activas' ? ' bc-ordenes-tab--active' : ''}`}
                    onClick={() => setVistaOrdenes('activas')}
                  >
                    Activas ({ordenesActivas.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={vistaOrdenes === 'todas'}
                    className={`bc-ordenes-tab${vistaOrdenes === 'todas' ? ' bc-ordenes-tab--active' : ''}`}
                    onClick={() => setVistaOrdenes('todas')}
                  >
                    Historial ({ordenesCliente.length})
                  </button>
                </div>
              </div>

              {loadingOrdenes ? (
                <div className="bc-loading">
                  <div className="bc-spinner" />
                  <p>Cargando órdenes…</p>
                </div>
              ) : ordenesVista.length === 0 ? (
                <div className="bc-empty bc-empty--inline">
                  <p>
                    {vistaOrdenes === 'activas'
                      ? 'Sin órdenes activas para este cliente'
                      : 'Sin órdenes registradas'}
                  </p>
                </div>
              ) : (
                <ul className="bc-ordenes-list">
                  {ordenesVista.map((orden) => (
                    <li key={orden.id}>
                      <OrdenFichaBuscar
                        orden={orden}
                        onVer={() => navigate(`/op/${orden.numero_op}`)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default BuscarClientePage
