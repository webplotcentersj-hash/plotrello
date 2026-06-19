import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesCcPerfil, clientesPerfil } from '../utils/clientesRoutes'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import {
  ESTADO_CC_LABELS,
  TIPO_CLIENTE_CC_LABELS,
  labelCondicionIva,
  normalizeEstadoCc,
  type EstadoCuentaCorriente
} from '../constants/cuentaCorriente'
import type { CcScoreNivel } from '../constants/cuentaCorrienteScoring'
import CuentaCorrienteScoreBadge from './CuentaCorrienteScoreBadge'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { descargarArchivoUrl } from '../utils/cuentaCorrienteExport'
import './CuentaCorrienteRegistry.css'

export type CuentaCorrienteRegistryRow = ClienteCuentaCorrienteRecord & {
  cliente?: ClienteRecord
}

type Props = {
  registros: CuentaCorrienteRegistryRow[]
  registrosFiltrados: CuentaCorrienteRegistryRow[]
  filtroEstado: 'todos' | EstadoCuentaCorriente
  filtroLista: string
  pendientes: CuentaCorrienteRegistryRow[]
  aprobados: CuentaCorrienteRegistryRow[]
  totalRegistros: number
  isAdmin: boolean
  resolviendoId: number | null
  quitandoId: number | null
  onFiltroEstado: (est: 'todos' | EstadoCuentaCorriente) => void
  onFiltroLista: (q: string) => void
  onAprobar: (idCliente: number) => void
  onRechazar: (idCliente: number) => void
  onEditar: (row: CuentaCorrienteRegistryRow) => void
  onQuitar: (idCliente: number) => void
  onScoring: (row: CuentaCorrienteRegistryRow) => void
}

function CcRegistryDoc({ label, url }: { label: string; url?: string | null }) {
  if (!url) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd className="cc-registry-doc-actions">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="cc-registry-link"
          onClick={(e) => e.stopPropagation()}
        >
          Ver
        </a>
        <button
          type="button"
          className="cc-registry-link cc-registry-link--btn"
          onClick={(e) => {
            e.stopPropagation()
            descargarArchivoUrl(url, label)
          }}
        >
          Descargar
        </button>
      </dd>
    </div>
  )
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CuentaCorrienteRegistry({
  registros,
  registrosFiltrados,
  filtroEstado,
  filtroLista,
  pendientes,
  aprobados,
  totalRegistros,
  isAdmin,
  resolviendoId,
  quitandoId,
  onFiltroEstado,
  onFiltroLista,
  onAprobar,
  onRechazar,
  onEditar,
  onQuitar,
  onScoring
}: Props) {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const rechazadosCount = registros.filter((r) => normalizeEstadoCc(r) === 'rechazada').length

  return (
    <section className="cc-registry" aria-labelledby="cc-registry-title">
      <header className="cc-registry__toolbar">
        <div>
          <h2 id="cc-registry-title">Cartera de clientes</h2>
          <p className="cc-registry__subtitle">
            {totalRegistros} {totalRegistros === 1 ? 'cuenta registrada' : 'cuentas registradas'} ·
            expandí una fila para ver el detalle completo
          </p>
        </div>
        <div className="cc-registry__filters">
          <div className="cc-estado-tabs" role="tablist" aria-label="Filtrar por estado">
            {(['todos', 'pendiente', 'aprobada', 'rechazada'] as const).map((est) => {
              const count =
                est === 'todos'
                  ? registros.length
                  : est === 'pendiente'
                    ? pendientes.length
                    : est === 'aprobada'
                      ? aprobados.length
                      : rechazadosCount
              return (
                <button
                  key={est}
                  type="button"
                  role="tab"
                  aria-selected={filtroEstado === est}
                  className={`cc-estado-tab${filtroEstado === est ? ' cc-estado-tab--active' : ''}${est === 'pendiente' && pendientes.length > 0 ? ' cc-estado-tab--alert' : ''}${est === 'aprobada' ? ' cc-estado-tab--ok' : ''}`}
                  onClick={() => onFiltroEstado(est)}
                >
                  {est === 'todos' ? `Todos (${count})` : `${ESTADO_CC_LABELS[est]} (${count})`}
                </button>
              )
            })}
          </div>
          {registros.length > 0 && (
            <input
              type="search"
              className="cc-registry__search cuenta-corriente-input"
              placeholder="Buscar nombre o CUIT…"
              value={filtroLista}
              onChange={(e) => onFiltroLista(e.target.value)}
            />
          )}
        </div>
      </header>

      {registros.length === 0 ? (
        <div className="cc-registry__empty">
          <p>No hay clientes en cuenta corriente.</p>
          <p className="cc-registry__empty-hint">Utilizá «Nuevo alta» para cargar la documentación.</p>
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="cc-registry__empty">
          <p>Sin resultados para «{filtroLista}».</p>
        </div>
      ) : (
        <div className="cc-registry__table-wrap">
          <div className="cc-registry__thead" role="row">
            <span className="cc-registry__col cc-registry__col--toggle" aria-hidden />
            <span className="cc-registry__col cc-registry__col--cliente">Cliente</span>
            <span className="cc-registry__col cc-registry__col--estado">Estado</span>
            <span className="cc-registry__col cc-registry__col--tipo">Tipo</span>
            <span className="cc-registry__col cc-registry__col--saldo num">Saldo</span>
            <span className="cc-registry__col cc-registry__col--cuit">CUIT / DNI</span>
            <span className="cc-registry__col cc-registry__col--score">Scoring</span>
          </div>
          <ul className="cc-registry__rows">
            {registrosFiltrados.map((r) => {
              const nombre = r.razon_social || r.cliente?.nombre || 'Sin nombre'
              const estado = normalizeEstadoCc(r)
              const expanded = expandedId === r.id
              const saldo = Number(r.saldo_actual) || 0
              const tipo =
                r.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa'

              return (
                <li
                  key={r.id}
                  className={`cc-registry-row cc-registry-row--${estado}${expanded ? ' cc-registry-row--open' : ''}${!r.alta_completa ? ' cc-registry-row--incompleto' : ''}`}
                >
                  <button
                    type="button"
                    className="cc-registry-row__summary"
                    aria-expanded={expanded}
                    onClick={() => toggleExpand(r.id)}
                  >
                    <span className="cc-registry__col cc-registry__col--toggle">
                      <span className="cc-registry-row__chevron" aria-hidden />
                    </span>
                    <span className="cc-registry__col cc-registry__col--cliente">
                      <span className="cc-registry-row__avatar" aria-hidden>
                        {iniciales(nombre)}
                      </span>
                      <span className="cc-registry-row__name">{nombre}</span>
                    </span>
                    <span className="cc-registry__col cc-registry__col--estado">
                      <span className={`cc-registry-estado cc-registry-estado--${estado}`}>
                        {ESTADO_CC_LABELS[estado]}
                      </span>
                    </span>
                    <span className="cc-registry__col cc-registry__col--tipo">
                      {TIPO_CLIENTE_CC_LABELS[tipo]}
                    </span>
                    <span className="cc-registry__col cc-registry__col--saldo num">
                      {estado === 'aprobada' ? (
                        <span
                          className={
                            saldo > 0 ? 'cc-registry-saldo cc-registry-saldo--deuda' : 'cc-registry-saldo'
                          }
                        >
                          {formatMontoArs(saldo)}
                        </span>
                      ) : (
                        <span className="cc-registry-muted">—</span>
                      )}
                    </span>
                    <span className="cc-registry__col cc-registry__col--cuit">
                      {r.cuit || '—'}
                    </span>
                    <span className="cc-registry__col cc-registry__col--score">
                      {estado === 'aprobada' ? (
                        <CuentaCorrienteScoreBadge
                          score={r.score}
                          nivel={r.score_nivel as CcScoreNivel | undefined}
                          compact
                        />
                      ) : (
                        <span className="cc-registry-muted">—</span>
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="cc-registry-row__detail">
                      <dl className="cc-registry-detail-grid">
                        <div>
                          <dt>Condición IVA</dt>
                          <dd>{labelCondicionIva(r.condicion_iva)}</dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{r.email || '—'}</dd>
                        </div>
                        <div>
                          <dt>WhatsApp</dt>
                          <dd>{r.whatsapp || '—'}</dd>
                        </div>
                        {r.persona_contacto && (
                          <div>
                            <dt>Contacto</dt>
                            <dd>{r.persona_contacto}</dd>
                          </div>
                        )}
                        <div className="cc-registry-detail-grid--wide">
                          <dt>Domicilio</dt>
                          <dd>
                            {[r.domicilio, r.localidad, r.provincia, r.codigo_postal]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </dd>
                        </div>
                        <CcRegistryDoc label="Constancia AFIP" url={r.url_constancia_afip} />
                        <CcRegistryDoc label="Estatuto" url={r.url_estatuto} />
                        <CcRegistryDoc label="Domicilio" url={r.url_comprobante_domicilio} />
                        <CcRegistryDoc label="DNI" url={r.url_documento_dni} />
                        <CcRegistryDoc label="Pagaré" url={r.url_pagare} />
                        {estado === 'rechazada' && r.motivo_rechazo && (
                          <div className="cc-registry-detail-grid--wide">
                            <dt>Motivo de rechazo</dt>
                            <dd className="cc-registry-rechazo">{r.motivo_rechazo}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="cc-registry-row__actions">
                        <button
                          type="button"
                          className="cc-btn cc-btn--secondary cc-btn--sm"
                          onClick={() => navigate(clientesPerfil(r.id_cliente))}
                        >
                          Ficha cliente
                        </button>
                        {isAdmin && estado === 'pendiente' && (
                          <>
                            <button
                              type="button"
                              className="cc-btn cc-btn--primary cc-btn--sm"
                              disabled={resolviendoId === r.id_cliente}
                              onClick={() => onAprobar(r.id_cliente)}
                            >
                              {resolviendoId === r.id_cliente ? 'Procesando…' : 'Aprobar'}
                            </button>
                            <button
                              type="button"
                              className="cc-btn cc-btn--danger cc-btn--sm"
                              disabled={resolviendoId === r.id_cliente}
                              onClick={() => onRechazar(r.id_cliente)}
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {estado === 'aprobada' && (
                          <>
                            <button
                              type="button"
                              className="cc-btn cc-btn--primary cc-btn--sm"
                              onClick={() =>
                                navigate(clientesCcPerfil(r.id_cliente))
                              }
                            >
                              Ver cuenta
                            </button>
                            <button
                              type="button"
                              className="cc-btn cc-btn--secondary cc-btn--sm"
                              onClick={() => onScoring(r)}
                            >
                              Scoring
                            </button>
                          </>
                        )}
                        {(isAdmin || estado !== 'aprobada') && (
                          <button
                            type="button"
                            className="cc-btn cc-btn--secondary cc-btn--sm"
                            onClick={() => onEditar(r)}
                          >
                            {estado === 'rechazada'
                              ? 'Reenviar solicitud'
                              : r.alta_completa
                                ? 'Editar ficha'
                                : 'Completar ficha'}
                          </button>
                        )}
                        {(isAdmin || estado === 'rechazada' || estado === 'pendiente') && (
                          <button
                            type="button"
                            className="cc-btn cc-btn--danger cc-btn--sm"
                            onClick={() => onQuitar(r.id_cliente)}
                            disabled={quitandoId === r.id_cliente}
                          >
                            {quitandoId === r.id_cliente ? 'Quitando…' : 'Quitar de cartera'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
