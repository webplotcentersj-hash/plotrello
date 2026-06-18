import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import apiService from '../services/api'
import type {
  CcPerfilCliente,
  ClienteCuentaCorrienteRecord,
  ClienteRecord,
  OrdenTrabajo,
  PedidoClienteRecord,
  Venta
} from '../types/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import {
  ESTADO_CC_LABELS,
  isClienteCcOperativo,
  normalizeEstadoCc
} from '../constants/cuentaCorriente'
import { formatMontoArs, movimientosConSaldoCorrido } from '../utils/cuentaCorrienteLedger'
import { CLIENTES_BUSCAR, CLIENTES_DASHBOARD, clientesCcPerfil } from '../utils/clientesRoutes'
import { formatArgentinaDate } from '../utils/dateUtils'
import './ClientePerfilPage.css'

type TabId = 'datos' | 'ops' | 'compras' | 'cuenta'

function formatDateShort(dateString: string | null | undefined): string {
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

function OpMiniCard({ orden, onVer }: { orden: OrdenTrabajo; onVer: () => void }) {
  const status = mapEstadoToStatus(orden.estado)
  const column = BOARD_COLUMNS.find((col) => col.id === status)
  const entregada = orden.estado === 'Entregado o Instalado' || orden.entregado

  return (
    <article className={`cpf-op${entregada ? ' cpf-op--done' : ''}`}>
      <div className="cpf-op__head">
        <span className="cpf-op__num">OP {orden.numero_op}</span>
        <span className="cpf-op__badge" style={{ backgroundColor: column?.accent || '#6b7280' }}>
          {column?.label || orden.estado}
        </span>
      </div>
      {orden.descripcion ? <p className="cpf-op__desc">{orden.descripcion}</p> : null}
      <div className="cpf-op__meta">
        <span>{formatDateShort(orden.fecha_creacion)}</span>
        {orden.sector ? <span>{orden.sector}</span> : null}
      </div>
      <button type="button" className="cpf-btn cpf-btn--ghost cpf-btn--xs" onClick={onVer}>
        Ver OP
      </button>
    </article>
  )
}

export default function ClientePerfilPage() {
  const { idCliente: idParam } = useParams<{ idCliente: string }>()
  const idCliente = Number(idParam)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('datos')
  const [cliente, setCliente] = useState<ClienteRecord | null>(null)
  const [esVIP, setEsVIP] = useState(false)
  const [preferencias, setPreferencias] = useState<string | null>(null)
  const [notasInternas, setNotasInternas] = useState<string | null>(null)
  const [cuentaCorriente, setCuentaCorriente] = useState<ClienteCuentaCorrienteRecord | null>(null)
  const [ccOperativa, setCcOperativa] = useState(false)
  const [perfilCc, setPerfilCc] = useState<CcPerfilCliente | null>(null)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [vistaOps, setVistaOps] = useState<'activas' | 'todas'>('activas')

  const cargarPerfil = useCallback(async () => {
    if (!Number.isFinite(idCliente) || idCliente <= 0) {
      setError('Cliente inválido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const clienteRes = await apiService.getClientePorId(idCliente)
      if (!clienteRes.success || !clienteRes.data) {
        throw new Error(clienteRes.error || 'Cliente no encontrado')
      }
      const c = clienteRes.data
      setCliente(c)

      const [prefRes, ccRes, ccHab, ordRes, ventasRes, pedidosRes] = await Promise.all([
        c.dni_cuit
          ? apiService.obtenerPreferenciasCliente(c.dni_cuit)
          : Promise.resolve({ success: true, data: null }),
        apiService.getCuentaCorrientePorCliente(c.id),
        apiService.clienteHabilitadoCuentaCorriente(c.id),
        apiService.getOrdenesPorCliente(c),
        apiService.obtenerVentasPorCliente(c.id),
        apiService.getPedidosCliente(c.id)
      ])

      setEsVIP(!!prefRes.success && !!prefRes.data?.es_vip)
      setPreferencias(prefRes.success ? prefRes.data?.preferencias ?? null : null)
      setNotasInternas(prefRes.success ? prefRes.data?.notas_internas ?? null : null)
      setCuentaCorriente(ccRes.success ? ccRes.data ?? null : null)
      setCcOperativa(ccHab.success && !!ccHab.data)
      setOrdenes(ordRes.success && ordRes.data ? ordRes.data : [])
      setVentas(ventasRes.success && ventasRes.data ? ventasRes.data : [])
      setPedidos(pedidosRes.success && pedidosRes.data ? pedidosRes.data : [])

      if (ccRes.success && ccRes.data && isClienteCcOperativo(ccRes.data)) {
        const perfilRes = await apiService.getPerfilCuentaCorriente(c.id)
        if (perfilRes.success && perfilRes.data) setPerfilCc(perfilRes.data)
        else setPerfilCc(null)
      } else {
        setPerfilCc(null)
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al cargar el perfil')
      setCliente(null)
    } finally {
      setLoading(false)
    }
  }, [idCliente])

  useEffect(() => {
    void cargarPerfil()
  }, [cargarPerfil])

  const nombre = cliente ? nombreCompletoCliente(cliente) : `Cliente #${idCliente}`

  const ordenesActivas = useMemo(
    () => ordenes.filter((o) => o.estado !== 'Entregado o Instalado' && !o.entregado),
    [ordenes]
  )

  const ordenesVista = vistaOps === 'activas' ? ordenesActivas : ordenes

  const movimientosCc = useMemo(() => {
    if (!perfilCc) return []
    return [...movimientosConSaldoCorrido(perfilCc.movimientos)].reverse().slice(0, 15)
  }, [perfilCc])

  const totalCompras = useMemo(
    () => ventas.reduce((sum, v) => sum + Number(v.valor_total || 0), 0),
    [ventas]
  )

  const saldoCc = perfilCc?.resumen.saldo_actual ?? cuentaCorriente?.saldo_actual

  if (loading && !cliente) {
    return (
      <div className="cpf-page">
        <div className="cpf-loading">
          <div className="cpf-spinner" />
          <p>Cargando perfil del cliente…</p>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="cpf-page">
        <p className="cpf-error">{error || 'No se encontró el cliente'}</p>
        <button type="button" className="cpf-btn cpf-btn--ghost" onClick={() => navigate(CLIENTES_BUSCAR)}>
          Buscar cliente
        </button>
      </div>
    )
  }

  return (
    <div className="cpf-page">
      <header className="cpf-hero">
        <button type="button" className="cpf-back" onClick={() => navigate(-1)}>
          ← Volver
        </button>
        <div className="cpf-hero__main">
          <div>
            <div className="cpf-hero__title-row">
              <h1>{nombre}</h1>
              <div className="cpf-badges">
                {esVIP ? <span className="cpf-badge cpf-badge--vip">VIP</span> : null}
                {cliente.es_cliente_web ? (
                  <span className="cpf-badge cpf-badge--web">Portal web</span>
                ) : null}
                {cuentaCorriente ? (
                  <span
                    className={`cpf-badge cpf-badge--cc cpf-badge--cc-${normalizeEstadoCc(cuentaCorriente)}`}
                  >
                    CC · {ESTADO_CC_LABELS[normalizeEstadoCc(cuentaCorriente)]}
                    {ccOperativa ? ' · operativa' : ''}
                  </span>
                ) : null}
              </div>
            </div>
            {cliente.empresa ? <p className="cpf-hero__empresa">{cliente.empresa}</p> : null}
            <p className="cpf-hero__id">Ficha #{cliente.id}</p>
          </div>
          <div className="cpf-hero__stats">
            <div className="cpf-stat">
              <span className="cpf-stat__val">{ordenes.length}</span>
              <span className="cpf-stat__lbl">OPs</span>
            </div>
            <div className="cpf-stat">
              <span className="cpf-stat__val">{ventas.length}</span>
              <span className="cpf-stat__lbl">Ventas</span>
            </div>
            <div className="cpf-stat">
              <span className="cpf-stat__val">{pedidos.length}</span>
              <span className="cpf-stat__lbl">Pedidos web</span>
            </div>
            {saldoCc != null && ccOperativa ? (
              <div className="cpf-stat cpf-stat--debt">
                <span className="cpf-stat__val">{formatMontoArs(Number(saldoCc))}</span>
                <span className="cpf-stat__lbl">Saldo CC</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="cpf-tabs" role="tablist" aria-label="Secciones del perfil">
        {(
          [
            { id: 'datos' as const, label: 'Datos' },
            { id: 'ops' as const, label: `OPs (${ordenes.length})` },
            { id: 'compras' as const, label: `Compras (${ventas.length + pedidos.length})` },
            ...(cuentaCorriente
              ? [{ id: 'cuenta' as const, label: 'Cuenta corriente' }]
              : [])
          ]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`cpf-tab${tab === id ? ' cpf-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="cpf-panel">
        {tab === 'datos' && (
          <section className="cpf-section">
            <dl className="cpf-datos-grid">
              {cliente.dni_cuit ? (
                <div>
                  <dt>DNI / CUIT</dt>
                  <dd>{cliente.dni_cuit}</dd>
                </div>
              ) : null}
              {cliente.telefono ? (
                <div>
                  <dt>Teléfono</dt>
                  <dd>{cliente.telefono}</dd>
                </div>
              ) : null}
              {cliente.email ? (
                <div>
                  <dt>Email</dt>
                  <dd>{cliente.email}</dd>
                </div>
              ) : null}
              {cliente.usuario ? (
                <div>
                  <dt>Usuario portal</dt>
                  <dd>{cliente.usuario}</dd>
                </div>
              ) : null}
              {cliente.direccion ? (
                <div className="cpf-datos-grid--wide">
                  <dt>Dirección</dt>
                  <dd>{cliente.direccion}</dd>
                </div>
              ) : null}
              {cliente.ubicacion_link ? (
                <div className="cpf-datos-grid--wide">
                  <dt>Ubicación</dt>
                  <dd>
                    <a href={cliente.ubicacion_link} target="_blank" rel="noreferrer">
                      Ver mapa
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            {(preferencias || notasInternas) && (
              <div className="cpf-notas">
                {preferencias ? (
                  <p>
                    <strong>Preferencias:</strong> {preferencias}
                  </p>
                ) : null}
                {notasInternas ? (
                  <p>
                    <strong>Notas internas:</strong> {notasInternas}
                  </p>
                ) : null}
              </div>
            )}
            <div className="cpf-links">
              <Link to={CLIENTES_BUSCAR} className="cpf-btn cpf-btn--ghost">
                Buscar otro cliente
              </Link>
              <Link to={CLIENTES_DASHBOARD} className="cpf-btn cpf-btn--ghost">
                Hub Clientes
              </Link>
            </div>
          </section>
        )}

        {tab === 'ops' && (
          <section className="cpf-section">
            <div className="cpf-section__head">
              <h2>Órdenes de trabajo</h2>
              <div className="cpf-mini-tabs" role="tablist">
                <button
                  type="button"
                  className={`cpf-mini-tab${vistaOps === 'activas' ? ' cpf-mini-tab--on' : ''}`}
                  onClick={() => setVistaOps('activas')}
                >
                  Activas ({ordenesActivas.length})
                </button>
                <button
                  type="button"
                  className={`cpf-mini-tab${vistaOps === 'todas' ? ' cpf-mini-tab--on' : ''}`}
                  onClick={() => setVistaOps('todas')}
                >
                  Historial ({ordenes.length})
                </button>
              </div>
            </div>
            {ordenesVista.length === 0 ? (
              <p className="cpf-empty">Sin órdenes en esta vista</p>
            ) : (
              <ul className="cpf-op-list">
                {ordenesVista.map((orden) => (
                  <li key={orden.id}>
                    <OpMiniCard orden={orden} onVer={() => navigate(`/op/${orden.numero_op}`)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'compras' && (
          <section className="cpf-section">
            <div className="cpf-section__head">
              <h2>Compras y pedidos</h2>
              {ventas.length > 0 ? (
                <span className="cpf-section__hint">
                  Total ventas CRM: {formatMontoArs(totalCompras)}
                </span>
              ) : null}
            </div>

            <h3 className="cpf-subtitle">Ventas (mostrador / CRM)</h3>
            {ventas.length === 0 ? (
              <p className="cpf-empty cpf-empty--inline">Sin ventas registradas con este cliente</p>
            ) : (
              <ul className="cpf-compras-list">
                {ventas.map((v) => (
                  <li key={v.id} className="cpf-compra">
                    <div className="cpf-compra__main">
                      <span className="cpf-compra__num">{v.numero_venta}</span>
                      <span className="cpf-compra__monto">{formatMontoArs(Number(v.valor_total || 0))}</span>
                    </div>
                    <div className="cpf-compra__meta">
                      <span>{formatArgentinaDate(v.fecha_venta)}</span>
                      <span>{v.estado_pago}</span>
                      {v.numero_op ? <span>{v.numero_op}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="cpf-subtitle">Pedidos portal web</h3>
            {pedidos.length === 0 ? (
              <p className="cpf-empty cpf-empty--inline">Sin pedidos del portal</p>
            ) : (
              <ul className="cpf-compras-list">
                {pedidos.map((p) => (
                  <li key={p.id} className="cpf-compra">
                    <div className="cpf-compra__main">
                      <span className="cpf-compra__num">Pedido #{p.id}</span>
                      <span className="cpf-compra__estado">{p.estado}</span>
                    </div>
                    <div className="cpf-compra__meta">
                      <span>{formatDateShort(p.created_at || p.fecha_pedido)}</span>
                      {p.observaciones_cliente ? (
                        <span>{p.observaciones_cliente.slice(0, 60)}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="cpf-btn cpf-btn--ghost cpf-btn--xs"
                      onClick={() => navigate(`/clientes-web/pedidos/${p.id}/detalle`)}
                    >
                      Ver pedido
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'cuenta' && cuentaCorriente && (
          <section className="cpf-section">
            <div className="cpf-section__head">
              <h2>Cuenta corriente</h2>
              {isClienteCcOperativo(cuentaCorriente) ? (
                <button
                  type="button"
                  className="cpf-btn cpf-btn--primary"
                  onClick={() => navigate(clientesCcPerfil(cliente.id))}
                >
                  Gestión completa CC
                </button>
              ) : null}
            </div>

            <div className="cpf-cc-resumen">
              <div>
                <span className="cpf-cc-resumen__lbl">Saldo actual</span>
                <strong className="cpf-cc-resumen__val">
                  {saldoCc != null ? formatMontoArs(Number(saldoCc)) : '—'}
                </strong>
              </div>
              {perfilCc ? (
                <>
                  <div>
                    <span className="cpf-cc-resumen__lbl">Límite crédito</span>
                    <strong>{formatMontoArs(Number(perfilCc.resumen.limite_credito || 0))}</strong>
                  </div>
                  <div>
                    <span className="cpf-cc-resumen__lbl">Pendiente ventas</span>
                    <strong className="cpf-cc-resumen__warn">
                      {formatMontoArs(Number(perfilCc.resumen.monto_pendiente_ventas || 0))}
                    </strong>
                  </div>
                </>
              ) : null}
            </div>

            {movimientosCc.length > 0 ? (
              <>
                <h3 className="cpf-subtitle">Últimos movimientos</h3>
                <div className="cpf-mov-table-wrap">
                  <table className="cpf-mov-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Débito</th>
                        <th>Crédito</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosCc.map((m) => (
                        <tr key={m.id}>
                          <td>{formatDateShort(m.fecha)}</td>
                          <td>{m.concepto || m.tipo}</td>
                          <td>{m.debe > 0 ? formatMontoArs(m.debe) : '—'}</td>
                          <td>{m.haber > 0 ? formatMontoArs(m.haber) : '—'}</td>
                          <td>{formatMontoArs(m.saldo_acumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="cpf-empty cpf-empty--inline">
                {ccOperativa
                  ? 'Sin movimientos cargados'
                  : 'La cuenta corriente no está operativa aún'}
              </p>
            )}

            {perfilCc && perfilCc.ventas_cc.length > 0 ? (
              <>
                <h3 className="cpf-subtitle">Ventas en cuenta corriente</h3>
                <ul className="cpf-compras-list">
                  {perfilCc.ventas_cc.slice(0, 12).map((v) => (
                    <li key={v.id} className="cpf-compra">
                      <div className="cpf-compra__main">
                        <span className="cpf-compra__num">{v.numero_venta}</span>
                        <span className="cpf-compra__monto">
                          {formatMontoArs(Number(v.monto_pendiente ?? v.valor_total))}
                        </span>
                      </div>
                      <div className="cpf-compra__meta">
                        <span>{formatDateShort(v.fecha_venta)}</span>
                        <span>{v.estado_pago}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        )}
      </main>
    </div>
  )
}
