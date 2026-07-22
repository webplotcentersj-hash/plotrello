import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import CuentaCorrienteAltaForm from '../components/CuentaCorrienteAltaForm'
import CuentaCorrienteScoringPanel from '../components/CuentaCorrienteScoringPanel'
import CuentaCorrienteDashboard from '../components/CuentaCorrienteDashboard'
import CuentaCorrienteRegistry from '../components/CuentaCorrienteRegistry'
import { calcCarteraStatsCuentaCorriente } from '../utils/cuentaCorrienteStats'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { downloadCarteraCsv } from '../utils/cuentaCorrienteExport'
import CcExportMenu from '../components/CcExportMenu'
import CuentaCorrienteCobranzasPanel from '../components/CuentaCorrienteCobranzasPanel'
import CuentaCorrienteVencimientoAlertas from '../components/CuentaCorrienteVencimientoAlertas'
import type { ClienteCuentaCorrienteRecord, ClienteRecord, CcCobranzasPanelData, ClienteCcEnriquecido } from '../types/api'
import { normalizeEstadoCc, type EstadoCuentaCorriente } from '../constants/cuentaCorriente'
import { CLIENTES_DASHBOARD } from '../utils/clientesRoutes'
import { nombreCompletoCliente } from '../utils/buscarClienteMatch'
import { clienteCoincideBusqueda } from '../utils/clienteDuplicados'
import { mergeClienteBusquedaCc } from '../utils/cuentaCorrienteClienteData'
import './CuentaCorrientePage.css'

const MIN_BUSQUEDA_VINCULAR = 1
const MAX_RESULTADOS_VINCULAR = 80

type CuentaCorrienteRow = ClienteCuentaCorrienteRecord & { cliente?: ClienteRecord }

const CuentaCorrientePage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin, usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<CuentaCorrienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroLista, setFiltroLista] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ClienteRecord[]>([])
  const [catalogoClientes, setCatalogoClientes] = useState<ClienteRecord[]>([])
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [vinculandoId, setVinculandoId] = useState<number | null>(null)
  const [clienteEnriquecido, setClienteEnriquecido] = useState<ClienteCcEnriquecido | null>(null)
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
  const [cobranzas, setCobranzas] = useState<CcCobranzasPanelData | null>(null)
  const [cobranzasLoading, setCobranzasLoading] = useState(false)
  const [cobranzasError, setCobranzasError] = useState<string | null>(null)

  const loadCobranzas = async () => {
    setCobranzasLoading(true)
    setCobranzasError(null)
    try {
      void apiService.verificarAlertasVencimientoCc().catch(() => undefined)
      const res = await apiService.listCobranzasCcPanel()
      if (res.success && res.data) setCobranzas(res.data)
      else setCobranzasError(res.error || 'No se pudieron cargar las cobranzas')
    } catch {
      setCobranzasError('Error de conexión al cargar cobranzas')
    } finally {
      setCobranzasLoading(false)
    }
  }

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
    void loadCobranzas()
  }, [])

  useEffect(() => {
    const raw = searchParams.get('altaCliente')
    if (!raw) return
    const idCliente = Number(raw)
    if (!Number.isFinite(idCliente) || idCliente <= 0) return

    let cancelled = false
    const run = async () => {
      const res = await apiService.getClienteEnriquecidoParaCc(idCliente)
      if (cancelled) return
      if (res.success && res.data) {
        setClienteEnriquecido(res.data)
        setClienteVincular(res.data.cliente)
        setModoForm('nuevo')
        setMensajeOk(`Completá el alta de cuenta corriente para ${nombreCompletoCliente(res.data.cliente)}`)
      } else if (res.success && !res.data) {
        setError('Cliente no encontrado')
      } else {
        setError(res.error || 'No se pudo cargar el cliente')
      }
      const next = new URLSearchParams(searchParams)
      next.delete('altaCliente')
      setSearchParams(next, { replace: true })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [searchParams, setSearchParams])

  const idsEnCartera = useMemo(() => new Set(registros.map((r) => r.id_cliente)), [registros])

  const clientesDisponibles = useMemo(
    () => catalogoClientes.filter((c) => !idsEnCartera.has(c.id)),
    [catalogoClientes, idsEnCartera]
  )

  const filtrarClientesVincular = useCallback(
    (lista: ClienteRecord[], q: string) => {
      const trimmed = q.trim()
      if (!trimmed) return lista.slice(0, MAX_RESULTADOS_VINCULAR)
      return lista
        .filter((c) => clienteCoincideBusqueda(c, trimmed))
        .slice(0, MAX_RESULTADOS_VINCULAR)
    },
    []
  )

  useEffect(() => {
    if (modoForm !== 'vincular') return
    let cancelled = false
    const run = async () => {
      setCargandoCatalogo(true)
      try {
        const res = await apiService.getClientes(true, { limit: 5000 })
        if (cancelled) return
        if (res.success && res.data) setCatalogoClientes(res.data)
      } finally {
        if (!cancelled) setCargandoCatalogo(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [modoForm])

  useEffect(() => {
    if (modoForm !== 'vincular') {
      setResultadosBusqueda([])
      return
    }

    const q = busqueda.trim()
    const locales = filtrarClientesVincular(clientesDisponibles, q)

    if (q.length < MIN_BUSQUEDA_VINCULAR) {
      setResultadosBusqueda(locales)
      return
    }

    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await apiService.buscarClientes(q, { limit: 120 })
        const remotos = (res.success && res.data ? res.data : []).filter((c) => !idsEnCartera.has(c.id))
        const merged = mergeClienteBusquedaCc(locales, remotos)
        setResultadosBusqueda(filtrarClientesVincular(merged, q))
      } catch {
        setResultadosBusqueda(locales)
      } finally {
        setBuscando(false)
      }
    }, 280)

    return () => clearTimeout(t)
  }, [busqueda, modoForm, clientesDisponibles, idsEnCartera, filtrarClientesVincular])

  const seleccionarClienteVincular = async (c: ClienteRecord) => {
    setVinculandoId(c.id)
    setError(null)
    try {
      const res = await apiService.getClienteEnriquecidoParaCc(c.id)
      if (!res.success) {
        setError(res.error || 'No se pudieron cargar los datos del cliente')
        return
      }
      if (!res.data) {
        setError('Cliente no encontrado')
        return
      }
      if (res.data.cuenta_corriente) {
        setError('Este cliente ya tiene ficha de cuenta corriente')
        return
      }
      setClienteEnriquecido(res.data)
      setClienteVincular(res.data.cliente)
      setModoForm('nuevo')
      setMensajeOk(
        `Datos cargados desde ficha y ${res.data.ordenes.length} OP(s) vinculada(s). Revisá y completá el alta.`
      )
    } catch {
      setError('Error al cargar datos del cliente')
    } finally {
      setVinculandoId(null)
    }
  }

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
    setClienteEnriquecido(null)
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
    const idCc = res.data?.id_cliente ?? payload.id_cliente
    if (!idCc) {
      throw new Error('No se recibió el identificador del cliente')
    }

    await loadRegistros({ silent: true })

    const rowRes = await apiService.getCuentaCorrientePorCliente(idCc)
    if (rowRes.success && rowRes.data) {
      setRegistros((prev) => {
        const rest = prev.filter((r) => r.id_cliente !== idCc)
        return [rowRes.data!, ...rest]
      })
    }

    if (res.data?.estado === 'aprobada') {
      await apiService.calcularScoringCuentaCorriente(idCc, usuario.id)
      await loadRegistros({ silent: true })
    }

    setFiltroEstado('todos')
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
    if (!confirm('¿Quitar a este cliente de cuenta corriente? Se eliminará la ficha (incluye rechazadas).')) return
    setQuitandoId(idCliente)
    setError(null)
    try {
      const res = await apiService.quitarClienteCuentaCorriente(idCliente)
      if (res.success) {
        setRegistros((prev) => prev.filter((r) => r.id_cliente !== idCliente))
        if (editando?.id_cliente === idCliente) cerrarForm()
        setMensajeOk('Cliente quitado de la cartera de cuenta corriente.')
      } else setError(res.error || 'Error al quitar')
    } catch {
      setError('Error al quitar')
    } finally {
      setQuitandoId(null)
    }
  }

  const abrirEdicion = async (r: CuentaCorrienteRow) => {
    setError(null)
    const enr = await apiService.getClienteEnriquecidoParaCc(r.id_cliente)
    if (enr.success && enr.data) {
      setClienteEnriquecido(enr.data)
      setClienteVincular(enr.data.cliente)
    }
    setEditando({
      ...r,
      cliente: enr.data?.cliente ?? r.cliente
    })
    setModoForm('editar')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <span className="cc-page-title__icon" aria-hidden>CC</span>
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
              onClick={() => navigate(CLIENTES_DASHBOARD)}
            >
              <span className="cc-header-btn__icon" aria-hidden>←</span>
              <span>Clientes</span>
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
            {modoForm === 'cerrado' && registros.length > 0 && (
              <CcExportMenu
                className="cc-header-export"
                items={[
                  {
                    id: 'cartera-filtro',
                    label: 'Cartera (vista actual) — CSV',
                    onClick: () =>
                      downloadCarteraCsv(registrosFiltrados, carteraStats, undefined)
                  },
                  {
                    id: 'cartera-total',
                    label: 'Cartera completa — CSV',
                    onClick: () => downloadCarteraCsv(registros, carteraStats, undefined)
                  }
                ]}
              />
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
        <>
          {cobranzas && cobranzas.ventas_abiertas.length > 0 && (
            <CuentaCorrienteVencimientoAlertas items={cobranzas.ventas_abiertas} />
          )}
          <CuentaCorrienteCobranzasPanel
            data={cobranzas}
            loading={cobranzasLoading}
            error={cobranzasError}
            onRefresh={() => void loadCobranzas()}
          />
          <CuentaCorrienteDashboard
            registros={registros}
            isAdmin={isAdmin}
            onAprobar={(id) => void resolverSolicitud(id, 'aprobar')}
            resolviendoId={resolviendoId}
          />
        </>
      )}

      {modoForm === 'vincular' && !clienteVincular && (
        <section className="cuenta-corriente-agregar">
          <header className="cc-section-head">
            <span className="cc-section-head__icon" aria-hidden>🔍</span>
            <h3>Vincular cliente existente</h3>
          </header>
          <p className="cuenta-corriente-vincular-hint">
            Buscá en todo el padrón de clientes. Al seleccionar uno se completan CUIT, contacto y domicilio
            desde su ficha y las OPs vinculadas.
          </p>
          <div className="cuenta-corriente-busqueda">
            <input
              type="search"
              placeholder="Nombre, apellido, empresa, CUIT, teléfono, email…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="cuenta-corriente-input"
              autoFocus
            />
            {(buscando || cargandoCatalogo) && (
              <span className="cuenta-corriente-buscando">
                {cargandoCatalogo ? 'Cargando clientes…' : 'Buscando…'}
              </span>
            )}
            {!cargandoCatalogo && (
              <span className="cuenta-corriente-buscando">
                {clientesDisponibles.length} disponibles
              </span>
            )}
          </div>
          {resultadosBusqueda.length > 0 ? (
            <ul className="cuenta-corriente-resultados">
              {resultadosBusqueda.map((c) => (
                <li key={c.id} className="cuenta-corriente-resultado-item">
                  <div className="cuenta-corriente-resultado-info">
                    <strong>{nombreCompletoCliente(c)}</strong>
                    {c.empresa && <span>Empresa: {c.empresa}</span>}
                    {c.dni_cuit && <span>CUIT/DNI: {c.dni_cuit}</span>}
                    {c.telefono && <span>Tel: {c.telefono}</span>}
                    {c.email && <span>Email: {c.email}</span>}
                    {c.direccion && <span>{c.direccion}</span>}
                  </div>
                  <button
                    type="button"
                    className="cc-btn cc-btn--primary"
                    disabled={vinculandoId === c.id}
                    onClick={() => void seleccionarClienteVincular(c)}
                  >
                    {vinculandoId === c.id ? 'Cargando…' : 'Completar alta'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !cargandoCatalogo &&
            !buscando && (
              <p className="cuenta-corriente-sin-resultados">
                {busqueda.trim()
                  ? 'Sin coincidencias. Probá con otro nombre, CUIT o teléfono.'
                  : 'No hay clientes disponibles para vincular (todos ya están en cuenta corriente).'}
              </p>
            )
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
            <h3>
              {editando
                ? normalizeEstadoCc(editando) === 'rechazada'
                  ? 'Corregir y reenviar solicitud'
                  : 'Actualizar ficha'
                : 'Alta en cuenta corriente'}
            </h3>
          </header>
          {editando && (
            <div className="cuenta-corriente-preview cuenta-corriente-preview--edit">
              <p>
                Editando ficha de <strong>{editando.razon_social || editando.cliente?.nombre}</strong>
                {normalizeEstadoCc(editando) === 'rechazada' && editando.motivo_rechazo && (
                  <>
                    {' '}
                    · <span className="cc-registry-rechazo">Rechazo: {editando.motivo_rechazo}</span>
                  </>
                )}
              </p>
              {editando.id_cliente > 0 && (
                <button
                  type="button"
                  className="cc-btn cc-btn--secondary cc-btn--sm"
                  onClick={() => navigate(`/clientes/cliente/${editando.id_cliente}`)}
                >
                  Ver ficha cliente
                </button>
              )}
            </div>
          )}
          {clienteEnriquecido && !editando && (
            <div className="cuenta-corriente-preview" role="status">
              <p>
                <strong>{nombreCompletoCliente(clienteEnriquecido.cliente)}</strong>
                {' · '}
                {clienteEnriquecido.ordenes.length} OP(s) en historial
                {clienteEnriquecido.ordenes_activas > 0 &&
                  ` · ${clienteEnriquecido.ordenes_activas} activa(s)`}
              </p>
              {clienteEnriquecido.ordenes.slice(0, 3).map((o) => (
                <span key={o.id} className="cuenta-corriente-preview__op">
                  OP {o.numero_op} — {o.estado}
                </span>
              ))}
            </div>
          )}
          <CuentaCorrienteAltaForm
            idCliente={editando?.id_cliente ?? clienteVincular?.id ?? null}
            clienteNombre={
              editando?.razon_social ?? nombreCompletoCliente(clienteVincular ?? { id: 0, nombre: '' })
            }
            initialRecord={editando}
            initialCliente={editando?.cliente ?? clienteVincular}
            datosSugeridos={editando ? null : clienteEnriquecido?.datos_sugeridos ?? null}
            isAdmin={isAdmin}
            onCancel={cerrarForm}
            onSubmit={handleSubmitAlta}
          />
        </section>
      )}

      <CuentaCorrienteRegistry
        registros={registros}
        registrosFiltrados={registrosFiltrados}
        filtroEstado={filtroEstado}
        filtroLista={filtroLista}
        pendientes={pendientes}
        aprobados={aprobados}
        totalRegistros={registros.length}
        isAdmin={isAdmin}
        resolviendoId={resolviendoId}
        quitandoId={quitandoId}
        onFiltroEstado={setFiltroEstado}
        onFiltroLista={setFiltroLista}
        onAprobar={(id) => void resolverSolicitud(id, 'aprobar')}
        onRechazar={(id) => void resolverSolicitud(id, 'rechazar')}
        onEditar={(r) => void abrirEdicion(r)}
        onQuitar={(id) => void quitar(id)}
        onScoring={setScoringCliente}
      />

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
