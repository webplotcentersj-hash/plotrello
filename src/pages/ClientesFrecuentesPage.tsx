import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo, ClienteRecord } from '../types/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { clienteCoincideBusqueda } from '../utils/clienteDuplicados'
import { CLIENTES_DASHBOARD, clientesPerfil } from '../utils/clientesRoutes'
import './ClientesFrecuentesPage.css'

type ClienteFrecuente = ClienteRecord & {
  totalOrdenes: number
  ordenesActivas: number
  ultimaOrden?: string | null
  esVIP?: boolean
  preferencias?: string
  notas?: string
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

function OrdenFichaCf({
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
    <article className={`cf-orden${entregada ? ' cf-orden--hist' : ''}`}>
      <div className="cf-orden__head">
        <span className="cf-orden__op">OP {orden.numero_op}</span>
        <span className="cf-orden__badge" style={{ backgroundColor: accent }}>
          {label}
        </span>
      </div>
      {orden.descripcion && <p className="cf-orden__desc">{orden.descripcion}</p>}
      <div className="cf-orden__meta">
        {orden.fecha_creacion && <span>Creada {formatDate(orden.fecha_creacion)}</span>}
        {orden.fecha_entrega && <span>Entrega {formatDate(orden.fecha_entrega)}</span>}
      </div>
      <button type="button" className="cf-btn cf-btn--ghost cf-btn--sm" onClick={onVer}>
        Ver OP
      </button>
    </article>
  )
}

const ClientesFrecuentesPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteFrecuente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteFrecuente | null>(null)
  const [ordenesCliente, setOrdenesCliente] = useState<OrdenTrabajo[]>([])
  const [historialCompleto, setHistorialCompleto] = useState<OrdenTrabajo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroVIP, setFiltroVIP] = useState<boolean | null>(null)
  const [editandoPreferencias, setEditandoPreferencias] = useState(false)
  const [preferencias, setPreferencias] = useState('')
  const [notas, setNotas] = useState('')
  const [loadingOrdenes, setLoadingOrdenes] = useState(false)
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [vistaHistorial, setVistaHistorial] = useState<'activas' | 'todas'>('activas')

  useEffect(() => {
    void loadClientesFrecuentes()
  }, [])

  const loadClientesFrecuentes = async () => {
    setLoading(true)
    try {
      const res = await apiService.listarClientesFrecuentes({ minOps: 1 })
      if (!res.success || !res.data) {
        console.error('Error cargando clientes frecuentes:', res.error)
        return
      }

      setClientes(
        res.data.map((r) => ({
          id: r.id_cliente || 0,
          nombre: r.nombre,
          apellido: r.apellido,
          empresa: r.empresa,
          dni_cuit: r.dni_cuit,
          telefono: r.telefono || undefined,
          email: r.email || undefined,
          totalOrdenes: r.total_ordenes,
          ordenesActivas: r.ordenes_activas,
          ultimaOrden: r.ultima_orden,
          esVIP: r.es_vip,
          preferencias: r.preferencias || undefined,
          notas: r.notas_internas || undefined
        }))
      )
    } catch (error) {
      console.error('Error cargando clientes frecuentes:', error)
    } finally {
      setLoading(false)
    }
  }

  const normalizarDniCuit = (dniCuit: string | null | undefined): string => {
    if (!dniCuit) return ''
    return dniCuit.replace(/[-\s]/g, '').toUpperCase().trim()
  }

  const seleccionarCliente = useCallback(async (cliente: ClienteFrecuente) => {
    setClienteSeleccionado(cliente)
    setPreferencias(cliente.preferencias || '')
    setNotas(cliente.notas || '')
    setEditandoPreferencias(false)
    setMensajeOk(null)
    setVistaHistorial('activas')
    setLoadingOrdenes(true)

    try {
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        const dniClienteNormalized = normalizarDniCuit(cliente.dni_cuit)
        const nombreClienteLower = cliente.nombre?.toLowerCase().trim() || ''
        const apellidoClienteLower = cliente.apellido?.toLowerCase().trim() || ''
        const nombreCompleto = `${nombreClienteLower} ${apellidoClienteLower}`.trim()
        const telefonoCliente = cliente.telefono?.trim() || ''
        const emailCliente = cliente.email?.toLowerCase().trim() || ''

        const ordenesFiltradas = ordenesResponse.data.filter((orden) => {
          if (dniClienteNormalized) {
            const dniOrdenNormalized = normalizarDniCuit(orden.dni_cuit)
            if (dniOrdenNormalized && dniOrdenNormalized === dniClienteNormalized) return true
          }
          if (nombreClienteLower) {
            const nombreOrdenLower = orden.cliente?.toLowerCase().trim() || ''
            if (
              nombreOrdenLower &&
              (nombreOrdenLower === nombreCompleto ||
                nombreOrdenLower === nombreClienteLower ||
                nombreOrdenLower.includes(nombreClienteLower) ||
                (apellidoClienteLower && nombreOrdenLower.includes(apellidoClienteLower)))
            ) {
              return true
            }
          }
          if (telefonoCliente && orden.telefono_cliente) {
            const tO = orden.telefono_cliente.replace(/[-\s()]/g, '').trim()
            const tC = telefonoCliente.replace(/[-\s()]/g, '').trim()
            if (tO === tC) return true
          }
          if (emailCliente && orden.email_cliente) {
            if (orden.email_cliente.toLowerCase().trim() === emailCliente) return true
          }
          return false
        })

        const activas = ordenesFiltradas.filter(
          (o) => o.estado !== 'Entregado o Instalado' && !o.entregado
        )
        setOrdenesCliente(activas)
        setHistorialCompleto(
          [...ordenesFiltradas].sort(
            (a, b) =>
              new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
          )
        )
      }
    } catch (error) {
      console.error('Error cargando órdenes del cliente:', error)
    } finally {
      setLoadingOrdenes(false)
    }
  }, [])

  const guardarPreferencias = async () => {
    if (!clienteSeleccionado?.dni_cuit) return
    setGuardandoPrefs(true)
    setMensajeOk(null)
    try {
      const response = await apiService.guardarPreferenciasCliente(
        clienteSeleccionado.dni_cuit,
        preferencias || null,
        notas || null,
        clienteSeleccionado.esVIP
      )
      if (!response.success) {
        setMensajeOk(response.error || 'Error al guardar')
        return
      }
      setClientes((prev) =>
        prev.map((c) =>
          c.dni_cuit === clienteSeleccionado.dni_cuit ? { ...c, preferencias, notas } : c
        )
      )
      setClienteSeleccionado({ ...clienteSeleccionado, preferencias, notas })
      setEditandoPreferencias(false)
      setMensajeOk('Preferencias guardadas')
      setTimeout(() => setMensajeOk(null), 3000)
    } catch {
      setMensajeOk('No se pudieron guardar las preferencias')
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const toggleVIP = async () => {
    if (!clienteSeleccionado?.dni_cuit) return
    const nuevoEstadoVIP = !clienteSeleccionado.esVIP
    try {
      const response = await apiService.guardarPreferenciasCliente(
        clienteSeleccionado.dni_cuit,
        clienteSeleccionado.preferencias || null,
        clienteSeleccionado.notas || null,
        nuevoEstadoVIP
      )
      if (!response.success) return
      setClienteSeleccionado({ ...clienteSeleccionado, esVIP: nuevoEstadoVIP })
      setClientes((prev) =>
        prev.map((c) =>
          c.dni_cuit === clienteSeleccionado.dni_cuit ? { ...c, esVIP: nuevoEstadoVIP } : c
        )
      )
    } catch (error) {
      console.error('Error actualizando VIP:', error)
    }
  }

  const stats = useMemo(
    () => ({
      total: clientes.length,
      vip: clientes.filter((c) => c.esVIP).length,
      conActivas: clientes.filter((c) => c.ordenesActivas > 0).length
    }),
    [clientes]
  )

  const clientesFiltrados = useMemo(() => {
    const q = searchTerm.trim()
    return clientes.filter((cliente) => {
      const matchesSearch =
        !q ||
        clienteCoincideBusqueda(
          {
            id: cliente.id,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            dni_cuit: cliente.dni_cuit,
            telefono: cliente.telefono,
            email: cliente.email,
            empresa: cliente.empresa
          },
          q
        ) ||
        cliente.nombre.toLowerCase().includes(q.toLowerCase()) ||
        cliente.dni_cuit?.toLowerCase().includes(q.toLowerCase())

      const matchesVIP = filtroVIP === null || cliente.esVIP === filtroVIP
      return matchesSearch && matchesVIP
    })
  }, [clientes, searchTerm, filtroVIP])

  const ordenesVista = vistaHistorial === 'activas' ? ordenesCliente : historialCompleto

  const cerrarDetalle = () => {
    setClienteSeleccionado(null)
    setEditandoPreferencias(false)
    setMensajeOk(null)
  }

  if (loading) {
    return (
      <div className="clientes-frecuentes-page">
        <div className="cf-loading">
          <div className="cf-spinner" />
          <p>Cargando clientes frecuentes…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="clientes-frecuentes-page">
      <header className="cf-header">
        <div className="cf-header__row">
          <div className="cf-header__title-block">
            <span className="cf-header__icon" aria-hidden>
              CF
            </span>
            <div>
              <h1>Clientes frecuentes</h1>
              <p className="cf-header__subtitle">
                {stats.total} clientes con OP · {stats.vip} VIP · {stats.conActivas} con OP activas
                {' '}· ranking por historial completo
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cf-btn cf-btn--ghost"
            onClick={() => navigate(CLIENTES_DASHBOARD)}
          >
            Volver a Clientes
          </button>
        </div>
      </header>

      <section className="cf-search-hero" aria-label="Buscar y filtrar">
        <label className="cf-search-wrap">
          <span className="cf-search-label">Buscar</span>
          <input
            type="search"
            placeholder="Nombre, DNI o varias palabras separadas por espacio…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cf-search-input"
            autoComplete="off"
          />
        </label>
        <div className="cf-filters" role="tablist" aria-label="Filtrar por tipo">
          {(
            [
              [null, 'Todos', stats.total],
              [true, 'VIP', stats.vip],
              [false, 'Regulares', stats.total - stats.vip]
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={String(key)}
              type="button"
              role="tab"
              aria-selected={filtroVIP === key}
              className={`cf-filter-pill${filtroVIP === key ? ' cf-filter-pill--active' : ''}${key === true ? ' cf-filter-pill--vip' : ''}`}
              onClick={() => setFiltroVIP(key)}
            >
              {label}
              <span className="cf-filter-pill__count">{count}</span>
            </button>
          ))}
        </div>
        {searchTerm.trim() && (
          <p className="cf-search-meta">
            {clientesFiltrados.length} resultado{clientesFiltrados.length === 1 ? '' : 's'}
          </p>
        )}
      </section>

      <div className={`cf-layout${clienteSeleccionado ? ' cf-layout--split' : ''}`}>
        <aside className="cf-lista" aria-label="Ranking de clientes">
          <div className="cf-lista__head">
            <h2>Por volumen de órdenes</h2>
            <span className="cf-lista__count">{clientesFiltrados.length}</span>
          </div>

          {clientesFiltrados.length === 0 ? (
            <div className="cf-empty">
              <p>No hay clientes con ese criterio</p>
              <button type="button" className="cf-btn cf-btn--ghost" onClick={() => setSearchTerm('')}>
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <ul className="cf-clientes">
              {clientesFiltrados.map((cliente, index) => {
                const selected = clienteSeleccionado?.dni_cuit === cliente.dni_cuit
                return (
                  <li key={cliente.dni_cuit}>
                    <button
                      type="button"
                      className={`cf-cliente-row${selected ? ' cf-cliente-row--selected' : ''}${cliente.esVIP ? ' cf-cliente-row--vip' : ''}`}
                      onClick={() => void seleccionarCliente(cliente)}
                    >
                      <span className="cf-cliente-row__rank" aria-hidden>
                        {index + 1}
                      </span>
                      <span className="cf-cliente-row__body">
                        <span className="cf-cliente-row__top">
                          <strong>{cliente.nombre}</strong>
                          {cliente.esVIP && <span className="cf-badge cf-badge--vip">VIP</span>}
                        </span>
                        <span className="cf-cliente-row__meta">
                          <span className="cf-cliente-row__ordenes">{cliente.totalOrdenes} OP</span>
                          {cliente.dni_cuit && <span>{cliente.dni_cuit}</span>}
                          {cliente.ordenesActivas > 0 && (
                            <span className="cf-cliente-row__activas">
                              {cliente.ordenesActivas} activa{cliente.ordenesActivas === 1 ? '' : 's'}
                            </span>
                          )}
                        </span>
                        {cliente.preferencias && (
                          <span className="cf-cliente-row__hint">{cliente.preferencias}</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <main className="cf-detalle">
          {!clienteSeleccionado ? (
            <div className="cf-placeholder">
              <p className="cf-placeholder__title">Elegí un cliente</p>
              <p className="cf-placeholder__text">
                Tocá un nombre de la lista para ver órdenes activas, historial y preferencias de
                atención.
              </p>
            </div>
          ) : (
            <>
              <div className="cf-detalle__head">
                <div>
                  <div className="cf-detalle__title-row">
                    <h2>{clienteSeleccionado.nombre}</h2>
                    {clienteSeleccionado.esVIP && (
                      <span className="cf-badge cf-badge--vip">VIP</span>
                    )}
                  </div>
                  {clienteSeleccionado.dni_cuit && (
                    <p className="cf-detalle__dni">{clienteSeleccionado.dni_cuit}</p>
                  )}
                </div>
                <div className="cf-detalle__actions">
                  {clienteSeleccionado.id > 0 && (
                    <button
                      type="button"
                      className="cf-btn cf-btn--primary"
                      onClick={() => navigate(clientesPerfil(clienteSeleccionado.id))}
                    >
                      Ver ficha completa
                    </button>
                  )}
                  <button
                    type="button"
                    className={`cf-btn cf-btn--vip${clienteSeleccionado.esVIP ? ' cf-btn--vip-on' : ''}`}
                    onClick={() => void toggleVIP()}
                  >
                    {clienteSeleccionado.esVIP ? 'Quitar VIP' : 'Marcar VIP'}
                  </button>
                  <button type="button" className="cf-btn cf-btn--ghost" onClick={cerrarDetalle}>
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="cf-kpis">
                <div className="cf-kpi">
                  <span className="cf-kpi__val">{clienteSeleccionado.totalOrdenes}</span>
                  <span className="cf-kpi__lbl">Órdenes totales</span>
                </div>
                <div className="cf-kpi cf-kpi--accent">
                  <span className="cf-kpi__val">{clienteSeleccionado.ordenesActivas}</span>
                  <span className="cf-kpi__lbl">Activas</span>
                </div>
                <div className="cf-kpi">
                  <span className="cf-kpi__val">
                    {clienteSeleccionado.ultimaOrden
                      ? formatDate(clienteSeleccionado.ultimaOrden)
                      : '—'}
                  </span>
                  <span className="cf-kpi__lbl">Última OP</span>
                </div>
              </div>

              <section className="cf-prefs">
                <div className="cf-prefs__head">
                  <h3>Preferencias y notas</h3>
                  {!editandoPreferencias && (
                    <button
                      type="button"
                      className="cf-btn cf-btn--ghost cf-btn--sm"
                      onClick={() => setEditandoPreferencias(true)}
                    >
                      Editar
                    </button>
                  )}
                </div>
                {mensajeOk && (
                  <p
                    className={`cf-toast${mensajeOk.includes('Error') || mensajeOk.includes('No se') ? ' cf-toast--err' : ''}`}
                    role="status"
                  >
                    {mensajeOk}
                  </p>
                )}
                {editandoPreferencias ? (
                  <div className="cf-prefs__form">
                    <label>
                      <span>Preferencias de atención</span>
                      <textarea
                        rows={3}
                        value={preferencias}
                        onChange={(e) => setPreferencias(e.target.value)}
                        placeholder="Materiales, horarios, formas de contacto…"
                      />
                    </label>
                    <label>
                      <span>Notas internas</span>
                      <textarea
                        rows={3}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder="Solo visible para el equipo…"
                      />
                    </label>
                    <div className="cf-prefs__actions">
                      <button
                        type="button"
                        className="cf-btn cf-btn--ghost"
                        onClick={() => {
                          setEditandoPreferencias(false)
                          setPreferencias(clienteSeleccionado.preferencias || '')
                          setNotas(clienteSeleccionado.notas || '')
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="cf-btn cf-btn--primary"
                        disabled={guardandoPrefs}
                        onClick={() => void guardarPreferencias()}
                      >
                        {guardandoPrefs ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cf-prefs__view">
                    {clienteSeleccionado.preferencias ? (
                      <p>
                        <strong>Preferencias</strong>
                        {clienteSeleccionado.preferencias}
                      </p>
                    ) : (
                      <p className="cf-prefs__empty">Sin preferencias cargadas</p>
                    )}
                    {clienteSeleccionado.notas && (
                      <p>
                        <strong>Notas</strong>
                        {clienteSeleccionado.notas}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section className="cf-ordenes">
                <div className="cf-ordenes__head">
                  <h3>Órdenes</h3>
                  <div className="cf-ordenes-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={vistaHistorial === 'activas'}
                      className={`cf-ordenes-tab${vistaHistorial === 'activas' ? ' cf-ordenes-tab--active' : ''}`}
                      onClick={() => setVistaHistorial('activas')}
                    >
                      Activas ({ordenesCliente.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={vistaHistorial === 'todas'}
                      className={`cf-ordenes-tab${vistaHistorial === 'todas' ? ' cf-ordenes-tab--active' : ''}`}
                      onClick={() => setVistaHistorial('todas')}
                    >
                      Historial ({historialCompleto.length})
                    </button>
                  </div>
                </div>

                {loadingOrdenes ? (
                  <div className="cf-loading cf-loading--inline">
                    <div className="cf-spinner" />
                    <p>Cargando órdenes…</p>
                  </div>
                ) : ordenesVista.length === 0 ? (
                  <div className="cf-empty cf-empty--inline">
                    <p>
                      {vistaHistorial === 'activas'
                        ? 'Sin órdenes activas'
                        : 'Sin historial para este cliente'}
                    </p>
                  </div>
                ) : (
                  <ul className="cf-ordenes-list">
                    {ordenesVista.map((orden) => (
                      <li key={orden.id}>
                        <OrdenFichaCf
                          orden={orden}
                          onVer={() => navigate(`/op/${orden.numero_op}`)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default ClientesFrecuentesPage
