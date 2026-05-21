import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import CuentaCorrienteAltaForm from '../components/CuentaCorrienteAltaForm'
import CuentaCorrienteScoringPanel from '../components/CuentaCorrienteScoringPanel'
import CuentaCorrienteScoreBadge from '../components/CuentaCorrienteScoreBadge'
import CuentaCorrienteDashboard from '../components/CuentaCorrienteDashboard'
import { calcCarteraStatsCuentaCorriente } from '../utils/cuentaCorrienteStats'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import type { CcScoreNivel } from '../constants/cuentaCorrienteScoring'
import {
  ESTADO_CC_LABELS,
  TIPO_CLIENTE_CC_LABELS,
  labelCondicionIva,
  normalizeEstadoCc,
  type EstadoCuentaCorriente
} from '../constants/cuentaCorriente'
import './CuentaCorrientePage.css'

type CuentaCorrienteRow = ClienteCuentaCorrienteRecord & { cliente?: ClienteRecord }

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const CuentaCorrientePage = () => {
  const navigate = useNavigate()
  const { isAdmin, usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<CuentaCorrienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroLista, setFiltroLista] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ClienteRecord[]>([])
  const [buscando, setBuscando] = useState(false)
  const [modoForm, setModoForm] = useState<'cerrado' | 'nuevo' | 'editar' | 'vincular'>('cerrado')
  const [clienteVincular, setClienteVincular] = useState<ClienteRecord | null>(null)
  const [editando, setEditando] = useState<CuentaCorrienteRow | null>(null)
  const [quitandoId, setQuitandoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoCuentaCorriente>('todos')
  const [resolviendoId, setResolviendoId] = useState<number | null>(null)
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [scoringCliente, setScoringCliente] = useState<CuentaCorrienteRow | null>(null)
  const [recalculandoTodos, setRecalculandoTodos] = useState(false)

  const loadRegistros = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const res = await apiService.listClientesCuentaCorriente()
      if (res.success && res.data) {
        setRegistros(res.data)
      } else {
        setError(res.error || 'Error al cargar el listado de cuenta corriente')
      }
    } catch {
      setError('Error de conexión al cargar cuenta corriente')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }

  useEffect(() => {
    void loadRegistros()
  }, [])

  useEffect(() => {
    if (modoForm !== 'vincular' || busqueda.trim().length < 2) {
      setResultadosBusqueda([])
      return
    }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await apiService.buscarClientes(busqueda.trim())
        if (res.success && res.data) {
          const ids = new Set(registros.map((r) => r.id_cliente))
          setResultadosBusqueda(res.data.filter((c) => !ids.has(c.id)))
        } else setResultadosBusqueda([])
      } catch {
        setResultadosBusqueda([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda, modoForm, registros])

  const registrosFiltrados = useMemo(() => {
    let list = registros
    if (filtroEstado !== 'todos') {
      list = list.filter((r) => normalizeEstadoCc(r) === filtroEstado)
    }
    const q = filtroLista.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const blob = [
        r.razon_social,
        r.cuit,
        r.email,
        r.whatsapp,
        r.persona_contacto,
        r.localidad,
        r.provincia,
        r.cliente?.nombre,
        r.estado
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [registros, filtroLista, filtroEstado])

  const pendientes = useMemo(
    () => registros.filter((r) => normalizeEstadoCc(r) === 'pendiente'),
    [registros]
  )

  const aprobados = useMemo(
    () => registros.filter((r) => normalizeEstadoCc(r) === 'aprobada'),
    [registros]
  )

  const cerrarForm = () => {
    setModoForm('cerrado')
    setClienteVincular(null)
    setEditando(null)
    setBusqueda('')
    setResultadosBusqueda([])
  }

  const handleSubmitAlta = async (payload: {
    tipo_cliente: 'empresa' | 'persona_fisica'
    values: {
      cuit: string
      razon_social: string
      nombre: string
      apellido: string
      condicion_iva: string
      email: string
      whatsapp: string
      persona_contacto: string
      domicilio: string
      localidad: string
      provincia: string
      codigo_postal: string
    }
    urls: {
      constancia_afip: string
      estatuto: string
      domicilio: string
      documento_dni: string
      pagare: string
    }
    id_cliente?: number | null
  }) => {
    if (!usuario?.id) throw new Error('Sesión no válida')

    const res = await apiService.registrarAltaCuentaCorriente({
      tipo_cliente: payload.tipo_cliente,
      nombre: payload.values.nombre.trim(),
      apellido: payload.values.apellido.trim(),
      cuit: payload.values.cuit.trim(),
      razon_social: payload.values.razon_social.trim(),
      condicion_iva: payload.values.condicion_iva,
      email: payload.values.email.trim(),
      whatsapp: payload.values.whatsapp.trim(),
      persona_contacto: payload.values.persona_contacto.trim(),
      domicilio: payload.values.domicilio.trim(),
      localidad: payload.values.localidad.trim(),
      provincia: payload.values.provincia.trim(),
      codigo_postal: payload.values.codigo_postal.trim(),
      url_constancia_afip: payload.urls.constancia_afip,
      url_estatuto: payload.urls.estatuto,
      url_comprobante_domicilio: payload.urls.domicilio,
      url_documento_dni: payload.urls.documento_dni,
      url_pagare: payload.urls.pagare || undefined,
      id_cliente: payload.id_cliente ?? editando?.id_cliente ?? clienteVincular?.id ?? null,
      id_usuario_solicita: usuario.id
    })
    if (!res.success) {
      throw new Error(res.error || 'No se pudo registrar')
    }
    await loadRegistros({ silent: true })
    const idCc = res.data?.id_cliente ?? payload.id_cliente
    if (idCc && res.data?.estado === 'aprobada') {
      await apiService.calcularScoringCuentaCorriente(idCc, usuario.id)
      await loadRegistros({ silent: true })
    }
    cerrarForm()
    if (res.data?.estado === 'aprobada') {
      setMensajeOk(`Alta aprobada: ${res.data.razon_social} ya puede operar en cuenta corriente.`)
    } else {
      setMensajeOk(
        `Solicitud enviada para ${res.data?.razon_social ?? 'el cliente'}. Administración debe aprobarla.`
      )
    }
  }

  const resolverSolicitud = async (idCliente: number, accion: 'aprobar' | 'rechazar') => {
    if (!usuario?.id) return
    let motivo: string | undefined
    if (accion === 'rechazar') {
      const m = window.prompt('Motivo del rechazo (obligatorio):')
      if (m === null) return
      if (!m.trim()) {
        setError('Debés indicar el motivo del rechazo')
        return
      }
      motivo = m.trim()
    } else if (!window.confirm('¿Aprobar esta solicitud de cuenta corriente?')) {
      return
    }

    setResolviendoId(idCliente)
    setError(null)
    try {
      const res = await apiService.resolverSolicitudCuentaCorriente(
        idCliente,
        accion,
        usuario.id,
        motivo
      )
      if (!res.success) setError(res.error || 'No se pudo resolver')
      else {
        if (accion === 'aprobar') {
          await apiService.calcularScoringCuentaCorriente(idCliente, usuario.id)
        }
        await loadRegistros()
        setMensajeOk(
          accion === 'aprobar'
            ? `Solicitud aprobada: ${res.data?.razon_social ?? 'cliente'}.`
            : `Solicitud rechazada.`
        )
      }
    } catch {
      setError('Error al resolver solicitud')
    } finally {
      setResolviendoId(null)
    }
  }

  const recalcularScoringTodos = async () => {
    if (!usuario?.id) return
    setRecalculandoTodos(true)
    setError(null)
    try {
      const res = await apiService.recalcularScoringCuentaCorrienteTodos(usuario.id)
      if (!res.success) setError(res.error || 'No se pudo recalcular')
      else {
        await loadRegistros()
        setMensajeOk(`Scoring recalculado para ${res.data?.recalculados ?? 0} clientes.`)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setRecalculandoTodos(false)
    }
  }

  const quitar = async (idCliente: number) => {
    if (!confirm('¿Quitar a este cliente de cuenta corriente?')) return
    setQuitandoId(idCliente)
    setError(null)
    try {
      const res = await apiService.quitarClienteCuentaCorriente(idCliente)
      if (res.success) setRegistros((prev) => prev.filter((r) => r.id_cliente !== idCliente))
      else setError(res.error || 'Error al quitar')
    } catch {
      setError('Error al quitar')
    } finally {
      setQuitandoId(null)
    }
  }

  const habilitadosCount = aprobados.length
  const carteraStats = useMemo(() => calcCarteraStatsCuentaCorriente(registros), [registros])

  if (loading) {
    return (
      <div className="cuenta-corriente-page">
        <div className="cuenta-corriente-loading">
          <div className="cuenta-corriente-spinner" />
          <p>Cargando cuenta corriente…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cuenta-corriente-page">
      <header className="cc-dashboard-header">
        <div className="cc-header-content">
          <div className="cc-page-title">
            <span className="cc-page-title__icon" aria-hidden>📒</span>
            <div>
              <h1>Cuenta corriente</h1>
              <p>
                {isAdmin
                  ? 'Aprobá solicitudes, scoring interno y límites de crédito.'
                  : 'Completá requisitos y documentación; administración aprueba y asigna scoring.'}
              </p>
              <span className="cc-count-pill">
                {habilitadosCount} aprobados · {pendientes.length} pendientes
              </span>
              <span className="cc-deuda-total-pill" title="Suma de saldos positivos de clientes aprobados">
                Deuda total: {formatMontoArs(carteraStats.deudaTotal)}
              </span>
              {isAdmin && <span className="cc-admin-badge">Acceso administración</span>}
            </div>
          </div>
          <div className="cc-header-actions">
            <button
              type="button"
              className="cc-header-btn cc-header-btn--back"
              onClick={() => navigate('/mostrador/dashboard')}
            >
              <span className="cc-header-btn__icon" aria-hidden>←</span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`cc-header-btn cc-header-btn--add${modoForm !== 'cerrado' ? ' cc-header-btn--active' : ''}`}
              onClick={() => {
                if (modoForm !== 'cerrado') cerrarForm()
                else setModoForm('nuevo')
              }}
            >
              <span className="cc-header-btn__icon" aria-hidden>{modoForm !== 'cerrado' ? '✕' : '➕'}</span>
              <span>{modoForm !== 'cerrado' ? 'Cerrar' : 'Nuevo alta'}</span>
            </button>
            {modoForm === 'cerrado' && (
              <button
                type="button"
                className="cc-header-btn cc-header-btn--link"
                onClick={() => setModoForm('vincular')}
              >
                <span className="cc-header-btn__icon" aria-hidden>🔗</span>
                <span>Cliente existente</span>
              </button>
            )}
            {isAdmin && modoForm === 'cerrado' && registros.length > 0 && (
              <button
                type="button"
                className="cc-header-btn cc-header-btn--link"
                disabled={recalculandoTodos}
                onClick={() => void recalcularScoringTodos()}
              >
                <span className="cc-header-btn__icon" aria-hidden>📊</span>
                <span>{recalculandoTodos ? 'Calculando…' : 'Recalcular scoring'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {mensajeOk && (
        <div className="cuenta-corriente-ok" role="status">
          {mensajeOk}
          <button type="button" onClick={() => setMensajeOk(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="cuenta-corriente-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      {modoForm === 'cerrado' && (
        <CuentaCorrienteDashboard
          registros={registros}
          isAdmin={isAdmin}
          onAprobar={(id) => void resolverSolicitud(id, 'aprobar')}
          onScoring={setScoringCliente}
          resolviendoId={resolviendoId}
        />
      )}

      {modoForm === 'vincular' && !clienteVincular && (
        <section className="cuenta-corriente-agregar">
          <header className="cc-section-head">
            <span className="cc-section-head__icon" aria-hidden>🔍</span>
            <h3>Vincular cliente existente</h3>
          </header>
          <div className="cuenta-corriente-busqueda">
            <input
              type="search"
              placeholder="Buscar por nombre, CUIT, teléfono…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="cuenta-corriente-input"
              autoFocus
            />
            {buscando && <span className="cuenta-corriente-buscando">Buscando…</span>}
          </div>
          {resultadosBusqueda.length > 0 && (
            <ul className="cuenta-corriente-resultados">
              {resultadosBusqueda.map((c) => (
                <li key={c.id} className="cuenta-corriente-resultado-item">
                  <div className="cuenta-corriente-resultado-info">
                    <strong>{c.nombre}</strong>
                    {c.dni_cuit && <span>CUIT/DNI: {c.dni_cuit}</span>}
                  </div>
                  <button
                    type="button"
                    className="cc-btn cc-btn--primary"
                    onClick={() => {
                      setClienteVincular(c)
                      setModoForm('nuevo')
                    }}
                  >
                    Completar alta
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="cc-btn cc-btn--secondary" onClick={cerrarForm}>
            Cancelar
          </button>
        </section>
      )}

      {(modoForm === 'nuevo' || modoForm === 'editar') && (
        <section className="cuenta-corriente-agregar cuenta-corriente-agregar--form">
          <header className="cc-section-head">
            <span className="cc-section-head__icon" aria-hidden>📋</span>
            <h3>{editando ? 'Actualizar ficha' : 'Alta en cuenta corriente'}</h3>
          </header>
          <CuentaCorrienteAltaForm
            idCliente={editando?.id_cliente ?? clienteVincular?.id ?? null}
            clienteNombre={editando?.razon_social ?? clienteVincular?.nombre}
            initialRecord={editando}
            initialCliente={editando?.cliente ?? clienteVincular}
            isAdmin={isAdmin}
            onCancel={cerrarForm}
            onSubmit={handleSubmitAlta}
          />
        </section>
      )}

      <section className="cuenta-corriente-lista">
        <div className="cc-lista-toolbar">
          <h2>Clientes registrados</h2>
          <div className="cc-lista-toolbar__filters">
            <div className="cc-estado-tabs" role="tablist" aria-label="Filtrar por estado">
              {(['todos', 'pendiente', 'aprobada', 'rechazada'] as const).map((est) => {
                const count =
                  est === 'todos'
                    ? registros.length
                    : est === 'pendiente'
                      ? pendientes.length
                      : est === 'aprobada'
                        ? aprobados.length
                        : registros.filter((r) => normalizeEstadoCc(r) === 'rechazada').length
                return (
                <button
                  key={est}
                  type="button"
                  role="tab"
                  aria-selected={filtroEstado === est}
                  className={`cc-estado-tab${filtroEstado === est ? ' cc-estado-tab--active' : ''}${est === 'pendiente' && pendientes.length > 0 ? ' cc-estado-tab--alert' : ''}${est === 'aprobada' ? ' cc-estado-tab--ok' : ''}`}
                  onClick={() => setFiltroEstado(est)}
                >
                  {est === 'todos' ? `Todos (${count})` : `${ESTADO_CC_LABELS[est]} (${count})`}
                </button>
              )})}
            </div>
            {registros.length > 0 && (
              <div className="cc-filtro-wrap">
                <input
                  type="search"
                  className="cuenta-corriente-input"
                  placeholder="Filtrar por nombre, CUIT…"
                  value={filtroLista}
                  onChange={(e) => setFiltroLista(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {registros.length === 0 ? (
          <div className="cuenta-corriente-empty">
            <div className="cuenta-corriente-empty__icon" aria-hidden>📒</div>
            <p>No hay clientes en cuenta corriente.</p>
            <p>Usá <strong>Nuevo alta</strong> para cargar requisitos y documentación.</p>
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="cuenta-corriente-empty">
            <p>Sin coincidencias para «{filtroLista}».</p>
          </div>
        ) : (
          <ul className="cuenta-corriente-cards">
            {registrosFiltrados.map((r) => {
              const nombre = r.razon_social || r.cliente?.nombre || 'Sin nombre'
              const estado = normalizeEstadoCc(r)
              return (
                <li
                  key={r.id}
                  className={`cuenta-corriente-card cuenta-corriente-card--${estado}${!r.alta_completa ? ' cuenta-corriente-card--incompleto' : ''}`}
                >
                  <span className="cc-card-avatar" aria-hidden>
                    {iniciales(nombre)}
                  </span>
                  <div className="cuenta-corriente-card-body">
                    <div className="cc-card-top">
                      <strong className="cuenta-corriente-card-nombre">{nombre}</strong>
                      <div className="cc-card-top__badges">
                        {estado === 'aprobada' && (
                          <CuentaCorrienteScoreBadge
                            score={r.score}
                            nivel={r.score_nivel as CcScoreNivel | undefined}
                            compact
                            onClick={() => setScoringCliente(r)}
                          />
                        )}
                        <span className={`cc-status cc-status--${estado}`}>
                          {ESTADO_CC_LABELS[estado]}
                        </span>
                      </div>
                    </div>
                    <div className="cc-card-meta">
                      {r.tipo_cliente && (
                        <span className="cc-tipo-badge">
                          {TIPO_CLIENTE_CC_LABELS[
                            r.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa'
                          ]}
                        </span>
                      )}
                      {estado === 'aprobada' && r.saldo_actual != null && (
                        <span
                          className={`cc-saldo-badge${Number(r.saldo_actual) > 0 ? ' cc-saldo-badge--deuda' : ''}`}
                        >
                          Saldo {formatMontoArs(Number(r.saldo_actual))}
                        </span>
                      )}
                      {r.cuit && <span>CUIT {r.cuit}</span>}
                      {r.condicion_iva && <span>{labelCondicionIva(r.condicion_iva)}</span>}
                      {r.email && <span>✉️ {r.email}</span>}
                      {r.whatsapp && <span>📱 {r.whatsapp}</span>}
                      {r.url_pagare && (
                        <a
                          href={r.url_pagare}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cc-pagare-link"
                        >
                          🧾 Pagaré
                        </a>
                      )}
                    </div>
                    {(r.localidad || r.provincia) && (
                      <span className="cc-card-domicilio">
                        📍 {[r.domicilio, r.localidad, r.provincia, r.codigo_postal]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                    {estado === 'rechazada' && r.motivo_rechazo && (
                      <p className="cc-card-rechazo">Motivo: {r.motivo_rechazo}</p>
                    )}
                  </div>
                  <div className="cc-card-actions">
                    {isAdmin && estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          className="cc-btn cc-btn--primary cc-btn--sm"
                          disabled={resolviendoId === r.id_cliente}
                          onClick={() => void resolverSolicitud(r.id_cliente, 'aprobar')}
                        >
                          {resolviendoId === r.id_cliente ? '…' : 'Aprobar'}
                        </button>
                        <button
                          type="button"
                          className="cc-btn cc-btn--danger cc-btn--sm"
                          disabled={resolviendoId === r.id_cliente}
                          onClick={() => void resolverSolicitud(r.id_cliente, 'rechazar')}
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
                          onClick={() => navigate(`/mostrador/cuenta-corriente/cliente/${r.id_cliente}`)}
                        >
                          Ver cuenta
                        </button>
                        <button
                          type="button"
                          className="cc-btn cc-btn--secondary cc-btn--sm"
                          onClick={() => setScoringCliente(r)}
                        >
                          Scoring
                        </button>
                      </>
                    )}
                    {(isAdmin || estado !== 'aprobada') && (
                      <button
                        type="button"
                        className="cc-btn cc-btn--secondary cc-btn--sm"
                        onClick={() => {
                          setEditando(r)
                          setModoForm('editar')
                        }}
                      >
                        {estado === 'rechazada' ? 'Reenviar' : r.alta_completa ? 'Editar' : 'Completar'}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="cc-btn cc-btn--danger cc-btn--sm"
                        onClick={() => void quitar(r.id_cliente)}
                        disabled={quitandoId === r.id_cliente}
                      >
                        {quitandoId === r.id_cliente ? '…' : 'Quitar'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {scoringCliente && usuario?.id && (
        <CuentaCorrienteScoringPanel
          record={
            registros.find((x) => x.id_cliente === scoringCliente.id_cliente) ?? scoringCliente
          }
          isAdmin={isAdmin}
          idUsuario={usuario.id}
          onClose={() => setScoringCliente(null)}
          onUpdated={() => void loadRegistros()}
        />
      )}
    </div>
  )
}

export default CuentaCorrientePage
