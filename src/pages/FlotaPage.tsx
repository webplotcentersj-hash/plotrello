import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { Vehiculo, RegistroSalidaVehiculo } from '../types/api'
import {
  vehiculosParqueDesdeApi,
  type ItemParqueFlota,
  vehiculoPuedeSolicitarSalida,
  etiquetaEstadoParque
} from '../utils/flotaVehiculosCatalogo'
import RegistroSalidaModal from '../components/RegistroSalidaModal'
import MarcarLlegadaModal from '../components/MarcarLlegadaModal'
import FlotaMapa from '../components/FlotaMapa'
import FlotaReservasPanel from '../components/FlotaReservasPanel'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import './FlotaPage.css'

const HISTORIAL_LIMIT = 200
const POLL_MS = 15000

function RetrasoLive({ hasta }: { hasta: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const end = new Date(hasta).getTime()
  if (!Number.isFinite(end) || now <= end) return null
  const sec = Math.floor((now - end) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return (
    <div className="retraso-counter">
      Retraso: {h}h {m}m {s}s
    </div>
  )
}

function RelojCabecera() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const i = window.setInterval(() => setT(new Date()), 1000)
    return () => window.clearInterval(i)
  }, [])
  return (
    <time className="flota-reloj" dateTime={t.toISOString()}>
      {t.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </time>
  )
}

function regsPorVehiculo(vid: number, todos: RegistroSalidaVehiculo[]) {
  const same = todos.filter((r) => r.id_vehiculo === vid)
  const activo = same.find((r) => r.estado === 'en_uso' || r.estado === 'retrasado')
  const pendiente = same.find((r) => r.estado === 'pendiente_autorizacion')
  return { activo, pendiente }
}

const FlotaPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isCaja, usuario, loading: authLoading } = useAuth()
  const canAutorizar = !authLoading && (isAdmin || isCaja)

  const [itemsParque, setItemsParque] = useState<ItemParqueFlota[]>([])
  const [registros, setRegistros] = useState<RegistroSalidaVehiculo[]>([])
  const [historial, setHistorial] = useState<RegistroSalidaVehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null)
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null)
  const [llegadaRegistro, setLlegadaRegistro] = useState<RegistroSalidaVehiculo | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(true)
  /** Ayuda cuando la API devuelve vacío (típico: RLS solo para `authenticated` y la app usa rol `anon`). */
  const [vehiculosLoadHint, setVehiculosLoadHint] = useState<string | null>(null)

  const loadData = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = opts?.quiet === true
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      await apiService.actualizarEstadosRetrasados()

      const [vehiculosResp, activosResp, histResp] = await Promise.all([
        apiService.getVehiculos(),
        apiService.getRegistrosSalidasVehiculos({
          estados: ['en_uso', 'retrasado', 'pendiente_autorizacion']
        }),
        apiService.getRegistrosSalidasVehiculos({
          estado: 'finalizado',
          limit: HISTORIAL_LIMIT
        })
      ])

      const rawVehiculos = vehiculosResp.success ? (vehiculosResp.data ?? []) : []
      const mergedParque = vehiculosParqueDesdeApi(rawVehiculos)
      setItemsParque(mergedParque)

      if (!vehiculosResp.success) {
        setVehiculosLoadHint(vehiculosResp.error ?? 'No se pudieron cargar los vehículos desde Supabase.')
      } else if (rawVehiculos.length === 0) {
        setVehiculosLoadHint(
          'Supabase devolvió 0 vehículos. Si ya ejecutaste el INSERT, la causa habitual es RLS: Plotrello usa la clave anónima sin login de Supabase Auth (rol anon). Ejecutá en SQL el patch: supabase/patches/2026-03-28_flota_rls_anon_plotrello.sql'
        )
      } else if (mergedParque.every((m) => !m.enBase)) {
        setVehiculosLoadHint(
          'Hay filas en vehículos pero ningún nombre coincide con el catálogo (Amarok, Berlingo, Camión MB, Lifán, Máster, Ránger, Camión LED). Revisá la columna nombre en la tabla.'
        )
      } else {
        setVehiculosLoadHint(null)
      }

      if (activosResp.success && activosResp.data) {
        setRegistros(activosResp.data)
      } else {
        setRegistros([])
      }

      if (histResp.success && histResp.data) {
        setHistorial(histResp.data)
      } else {
        setHistorial([])
      }

      setUltimaSync(new Date())
    } catch (error) {
      console.error('Error cargando datos de flota:', error)
    } finally {
      if (quiet) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    const interval = window.setInterval(() => void loadData({ quiet: true }), POLL_MS)
    return () => window.clearInterval(interval)
  }, [loadData])

  const enMapa = useMemo(
    () => registros.filter((r) => r.estado === 'en_uso' || r.estado === 'retrasado'),
    [registros]
  )

  const pendientes = useMemo(
    () => registros.filter((r) => r.estado === 'pendiente_autorizacion'),
    [registros]
  )

  const handleRegistrarSalida = async (item: ItemParqueFlota) => {
    if (!item.enBase || item.id == null) return
    if (!vehiculoPuedeSolicitarSalida(item)) {
      alert(
        `Este vehículo no acepta solicitudes de salida ahora: ${etiquetaEstadoParque(item.estado_parque, item.estado_parque_detalle)}. Caja o Administración puede cambiar el estado en Panel admin.`
      )
      return
    }
    const chk = await apiService.verificarReservaFlotaSalida(item.id, usuario?.id ?? null)
    if (chk.success && chk.data && !chk.data.permitido) {
      alert(chk.data.mensaje ?? 'No podés solicitar salida con este vehículo hoy.')
      return
    }
    const v: Vehiculo = {
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      created_at: '',
      updated_at: ''
    }
    setVehiculoSeleccionado(v)
    setShowRegistroModal(true)
  }

  const handleAutorizar = async (idRegistro: number) => {
    if (!usuario) return
    if (!confirm('¿Autorizar esta salida y entregar el uso del vehículo?')) return
    const res = await apiService.autorizarRegistroSalidaVehiculo(
      idRegistro,
      usuario.id,
      usuario.nombre || 'Caja/Admin'
    )
    if (res.success) await loadData({ quiet: true })
    else alert(res.error || 'Error al autorizar')
  }

  const abrirLlegada = (r: RegistroSalidaVehiculo) => {
    setLlegadaRegistro(r)
  }

  const confirmarLlegada = async (litros: number) => {
    if (!llegadaRegistro) return
    const res = await apiService.marcarLlegadaRegistroSalidaVehiculo(llegadaRegistro.id, litros)
    if (res.success) {
      setLlegadaRegistro(null)
      await loadData({ quiet: true })
    } else {
      alert(res.error || 'Error')
    }
  }

  const handleFinalizarSalida = async (idRegistro: number) => {
    if (!confirm('¿Confirmar cierre del viaje y liberación del vehículo?')) return
    const response = await apiService.finalizarRegistroSalidaVehiculo(idRegistro)
    if (response.success) await loadData({ quiet: true })
    else alert(response.error || 'Error al finalizar')
  }

  const cardState = (item: ItemParqueFlota) => {
    if (!item.enBase || item.id == null) {
      return { tipo: 'disponible' as const, registro: null, retrasado: false, sinBase: true as const }
    }
    const { activo, pendiente } = regsPorVehiculo(item.id, registros)
    if (activo) {
      const ahora = new Date()
      const horaEst = activo.hora_estimada_llegada ? new Date(activo.hora_estimada_llegada) : null
      const retrasado =
        !!horaEst &&
        ahora > horaEst &&
        !activo.hora_llegada_real &&
        (activo.estado === 'retrasado' || activo.estado === 'en_uso')
      return { tipo: 'en_uso' as const, registro: activo, retrasado, sinBase: false as const }
    }
    if (pendiente) return { tipo: 'pendiente' as const, registro: pendiente, retrasado: false, sinBase: false as const }
    return { tipo: 'disponible' as const, registro: null, retrasado: false, sinBase: false as const }
  }

  if (loading && !ultimaSync) {
    return (
      <div className="flota-page">
        <div className="flota-container">
          <div className="flota-loading">
            <div className="flota-loading-orbit" aria-hidden />
            <p>Sincronizando flota…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flota-page">
      <div className="flota-bg-grid" aria-hidden />
      <div className="flota-container">
        <header className="flota-header">
          <div className="flota-header-main">
            <div className="flota-title-row">
              <h1>Flota en vivo</h1>
              <span className="flota-live-pill">
                <span className="flota-live-dot" />
                EN VIVO
              </span>
            </div>
            <p className="flota-tagline">
              Mapa y estado actualizado cada {POLL_MS / 1000}s · Solicitudes, salidas y historial de viajes
            </p>
            <div className="flota-meta-row">
              <RelojCabecera />
              {ultimaSync && (
                <span className="flota-ultima-sync">
                  Última sync: {ultimaSync.toLocaleTimeString('es-AR')}
                </span>
              )}
              {refreshing && <span className="flota-refreshing">Actualizando…</span>}
            </div>
          </div>
          <div className="flota-header-actions">
            <button type="button" className="flota-btn ghost" onClick={() => navigate('/')}>
              ← Tablero
            </button>
            {canAutorizar && (
              <button type="button" className="flota-btn accent" onClick={() => navigate('/flota/admin')}>
                Panel admin
              </button>
            )}
          </div>
        </header>

        {vehiculosLoadHint && (
          <div className="flota-rls-banner" role="status">
            <strong>Flota / Supabase:</strong> {vehiculosLoadHint}
          </div>
        )}

        <div className="flota-stats-strip">
          <div className="flota-stat">
            <span className="flota-stat-value">{enMapa.length}</span>
            <span className="flota-stat-label">En ruta</span>
          </div>
          <div className="flota-stat">
            <span className="flota-stat-value">{pendientes.length}</span>
            <span className="flota-stat-label">Pendientes</span>
          </div>
          <div className="flota-stat">
            <span className="flota-stat-value">{historial.length}</span>
            <span className="flota-stat-label">En historial</span>
          </div>
          <div className="flota-stat wide">
            <span className="flota-stat-label">Vehículos en parque</span>
            <span className="flota-stat-value subtle">{itemsParque.length}</span>
          </div>
        </div>

        <FlotaReservasPanel itemsParque={itemsParque} onReservasChanged={() => void loadData({ quiet: true })} />

        <section className="flota-panel flota-mapa-real">
          <div className="flota-panel-head">
            <h2>Mapa en tiempo real</h2>
            <p className="flota-panel-desc">
              Vista centrada en <strong>San Juan, Argentina</strong>. Marcadores: salidas autorizadas con ubicación.
            </p>
          </div>
          <div className="flota-mapa-frame">
            <FlotaMapa registros={enMapa} height={400} />
          </div>
        </section>

        {pendientes.length > 0 && (
          <section className="flota-panel flota-pendientes-section">
            <div className="flota-panel-head">
              <h2>Solicitudes pendientes</h2>
              <span className="flota-count-badge">{pendientes.length}</span>
            </div>
            <div className="flota-pendientes-grid">
              {pendientes.map((p) => (
                <div key={p.id} className="flota-pendiente-card">
                  <strong>{p.vehiculo?.nombre ?? 'Vehículo'}</strong>
                  <div className="info-row">
                    <span>Solicitante:</span> {etiquetaUsuarioNombre(p.nombre_usuario)}
                  </div>
                  <div className="info-row">
                    <span>Sector:</span> {p.sector}
                  </div>
                  {p.numero_op && (
                    <div className="info-row">
                      <span>OP:</span> {p.numero_op}
                    </div>
                  )}
                  <div className="info-row">
                    <span>Motivo:</span> {p.motivo_salida}
                  </div>
                  {canAutorizar ? (
                    <button type="button" className="flota-btn primary btn-block" onClick={() => void handleAutorizar(p.id)}>
                      Autorizar salida
                    </button>
                  ) : (
                    <p className="flota-espera-msg">Esperando Caja o Administración…</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="flota-panel flota-lista-section">
          <div className="flota-panel-head">
            <h2>Salidas activas</h2>
          </div>
          {enMapa.length === 0 ? (
            <p className="flota-sin-datos">Nadie en ruta con salida autorizada ahora mismo.</p>
          ) : (
            <div className="flota-tabla-wrap">
              <table className="flota-tabla">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Usuario</th>
                    <th>OP</th>
                    <th>Llegada est.</th>
                    <th>Llegada / Litros</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {enMapa.map((r) => {
                    const horaEst = r.hora_estimada_llegada ? new Date(r.hora_estimada_llegada) : null
                    const ahora = new Date()
                    const paso =
                      !!horaEst &&
                      ahora > horaEst &&
                      !r.hora_llegada_real &&
                      (r.estado === 'retrasado' || r.estado === 'en_uso')
                    const soyConductor = usuario?.id != null && r.id_usuario === usuario.id
                    const litros = r.litros_combustible_llegada
                    return (
                      <tr key={r.id} className={paso ? 'fila-retrasada' : ''}>
                        <td>{r.vehiculo?.nombre ?? '—'}</td>
                        <td>{etiquetaUsuarioNombre(r.nombre_usuario)}</td>
                        <td>{r.numero_op ?? '—'}</td>
                        <td>
                          {r.hora_estimada_llegada
                            ? new Date(r.hora_estimada_llegada).toLocaleString('es-AR')
                            : '—'}
                          {paso && r.hora_estimada_llegada && <RetrasoLive hasta={r.hora_estimada_llegada} />}
                        </td>
                        <td>
                          {r.hora_llegada_real ? (
                            <span className="flota-llegada-ok">
                              {new Date(r.hora_llegada_real).toLocaleTimeString('es-AR')}
                              {litros != null && (
                                <span className="flota-litros-chip">{Number(litros)} L</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{r.estado === 'retrasado' ? 'Retrasado' : 'En ruta'}</td>
                        <td className="flota-acciones-cel">
                          {soyConductor && !r.hora_llegada_real && (
                            <button type="button" className="flota-btn llegue" onClick={() => abrirLlegada(r)}>
                              Llegué
                            </button>
                          )}
                          <button
                            type="button"
                            className="flota-btn secondary sm"
                            onClick={() => void handleFinalizarSalida(r.id)}
                          >
                            Cerrar viaje
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flota-panel">
          <button
            type="button"
            className="flota-historial-toggle"
            onClick={() => setHistorialAbierto((v) => !v)}
            aria-expanded={historialAbierto}
          >
            <span className="flota-historial-toggle-title">Historial de viajes finalizados</span>
            <span className="flota-historial-toggle-meta">
              {historial.length} registros · combustible y horarios guardados
            </span>
            <span className="flota-historial-chevron">{historialAbierto ? '▼' : '▶'}</span>
          </button>
          {historialAbierto && (
            <div className="flota-historial-body">
              {historial.length === 0 ? (
                <p className="flota-sin-datos">Aún no hay viajes cerrados en el historial.</p>
              ) : (
                <div className="flota-tabla-wrap">
                  <table className="flota-tabla flota-tabla-historial">
                    <thead>
                      <tr>
                        <th>Salida</th>
                        <th>Vehículo</th>
                        <th>Conductor</th>
                        <th>KM salida</th>
                        <th>OP</th>
                        <th>Llegada real</th>
                        <th>Combustible (L)</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h) => (
                        <tr key={h.id}>
                          <td className="flota-cell-muted">
                            {h.hora_salida ? new Date(h.hora_salida).toLocaleString('es-AR') : '—'}
                          </td>
                          <td>{h.vehiculo?.nombre ?? '—'}</td>
                          <td>{etiquetaUsuarioNombre(h.nombre_usuario)}</td>
                          <td>{h.km_aproximado ?? '—'}</td>
                          <td>{h.numero_op ?? '—'}</td>
                          <td>
                            {h.hora_llegada_real
                              ? new Date(h.hora_llegada_real).toLocaleString('es-AR')
                              : '—'}
                          </td>
                          <td>
                            {h.litros_combustible_llegada != null
                              ? `${Number(h.litros_combustible_llegada)} L`
                              : '—'}
                          </td>
                          <td className="flota-cell-clip" title={h.motivo_salida}>
                            {h.motivo_salida}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="flota-panel flota-vehiculos-section">
          <div className="flota-panel-head">
            <h2>Parque de vehículos</h2>
          </div>
          <div className="vehiculos-grid">
            {itemsParque.map((item) => {
              const { tipo, registro, retrasado, sinBase } = cardState(item)

              return (
                <div
                  key={item.enBase && item.id != null ? `id-${item.id}` : `nom-${item.nombre}`}
                  className={`vehiculo-card ${tipo} ${retrasado ? 'retrasado' : ''} ${sinBase ? 'sin-base' : ''}`}
                >
                  <div className="vehiculo-header">
                    <h3>{item.nombre}</h3>
                    <div className="flota-badges-row">
                      <span className={`estado-badge ${tipo}`}>
                        {sinBase && 'Sin BD'}
                        {!sinBase && tipo === 'disponible' && 'Disponible'}
                        {!sinBase && tipo === 'pendiente' && 'Pendiente'}
                        {!sinBase && tipo === 'en_uso' && (retrasado ? 'Retrasado' : 'En ruta')}
                      </span>
                      {!sinBase && item.estado_parque !== 'disponible' && (
                        <span
                          className="flota-estado-parque-badge"
                          title={etiquetaEstadoParque(item.estado_parque, item.estado_parque_detalle)}
                        >
                          {etiquetaEstadoParque(item.estado_parque, item.estado_parque_detalle)}
                        </span>
                      )}
                    </div>
                  </div>

                  {sinBase && (
                    <p className="flota-sin-base-msg">
                      Este vehículo no está cargado en Supabase. Ejecutá el SQL de flota (insert en{' '}
                      <code>vehiculos</code>) para poder solicitar salidas.
                    </p>
                  )}

                  {tipo === 'pendiente' && registro && (
                    <div className="vehiculo-info">
                      <div className="info-row">
                        <span className="info-label">Solicitante:</span>
                        <span className="info-value">{etiquetaUsuarioNombre(registro.nombre_usuario)}</span>
                      </div>
                      <p className="flota-mini-hint">Bloqueado hasta autorizar o cancelar el flujo.</p>
                      {canAutorizar && (
                        <button
                          type="button"
                          className="flota-btn primary"
                          onClick={() => void handleAutorizar(registro.id)}
                        >
                          Autorizar salida
                        </button>
                      )}
                    </div>
                  )}

                  {tipo === 'en_uso' && registro && (
                    <div className="vehiculo-info">
                      <div className="info-row">
                        <span className="info-label">Operario:</span>
                        <span className="info-value">{etiquetaUsuarioNombre(registro.nombre_usuario)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Sector:</span>
                        <span className="info-value">{registro.sector}</span>
                      </div>
                      {registro.numero_op && (
                        <div className="info-row">
                          <span className="info-label">OP:</span>
                          <span className="info-value">{registro.numero_op}</span>
                        </div>
                      )}
                      {registro.hora_estimada_llegada && (
                        <div className="info-row">
                          <span className="info-label">Llegada est.:</span>
                          <span className={`info-value ${retrasado ? 'retrasado-text' : ''}`}>
                            {new Date(registro.hora_estimada_llegada).toLocaleString('es-AR')}
                          </span>
                        </div>
                      )}
                      {retrasado && registro.hora_estimada_llegada && (
                        <RetrasoLive hasta={registro.hora_estimada_llegada} />
                      )}
                      {registro.hora_llegada_real && (
                        <div className="info-row">
                          <span className="info-label">Llegó:</span>
                          <span className="info-value flota-llegada-ok">
                            {new Date(registro.hora_llegada_real).toLocaleTimeString('es-AR')}
                            {registro.litros_combustible_llegada != null && (
                              <span className="flota-litros-chip">
                                {Number(registro.litros_combustible_llegada)} L
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {registro.ubicacion_destino && (
                        <div className="info-row">
                          <span className="info-label">Destino:</span>
                          <span className="info-value">{registro.ubicacion_destino}</span>
                        </div>
                      )}
                      {registro.latitud && registro.longitud && (
                        <div className="info-row">
                          <a
                            href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link"
                          >
                            Abrir en mapa
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="vehiculo-actions">
                    {tipo === 'disponible' && !sinBase && vehiculoPuedeSolicitarSalida(item) && (
                      <button type="button" className="flota-btn primary" onClick={() => void handleRegistrarSalida(item)}>
                        Solicitar salida
                      </button>
                    )}
                    {tipo === 'disponible' && !sinBase && !vehiculoPuedeSolicitarSalida(item) && (
                      <>
                        <p className="flota-no-salida-msg">
                          No se puede solicitar salida:{' '}
                          <strong>
                            {etiquetaEstadoParque(item.estado_parque, item.estado_parque_detalle)}
                          </strong>
                        </p>
                        <button type="button" className="flota-btn secondary" disabled>
                          Solicitar salida
                        </button>
                      </>
                    )}
                    {sinBase && (
                      <button type="button" className="flota-btn secondary" disabled>
                        Solicitar salida (requiere BD)
                      </button>
                    )}
                    {tipo === 'pendiente' && !canAutorizar && (
                      <button type="button" className="flota-btn secondary" disabled>
                        En espera
                      </button>
                    )}
                    {tipo === 'en_uso' && registro && (
                      <>
                        {usuario?.id != null && registro.id_usuario === usuario.id && !registro.hora_llegada_real && (
                          <button type="button" className="flota-btn llegue" onClick={() => abrirLlegada(registro)}>
                            Llegué
                          </button>
                        )}
                        <button
                          type="button"
                          className="flota-btn secondary"
                          onClick={() => void handleFinalizarSalida(registro.id)}
                        >
                          Cerrar viaje
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {showRegistroModal && vehiculoSeleccionado && (
        <RegistroSalidaModal
          vehiculo={vehiculoSeleccionado}
          onClose={() => {
            setShowRegistroModal(false)
            setVehiculoSeleccionado(null)
          }}
          onSuccess={async () => {
            await loadData({ quiet: true })
            setShowRegistroModal(false)
            setVehiculoSeleccionado(null)
          }}
        />
      )}

      {llegadaRegistro && (
        <MarcarLlegadaModal
          registro={llegadaRegistro}
          onClose={() => setLlegadaRegistro(null)}
          onConfirm={(litros) => confirmarLlegada(litros)}
        />
      )}
    </div>
  )
}

export default FlotaPage
