import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Venta, OrdenTrabajo, CuentaPorCobrarRecord, CuentaPorPagarRecord } from '../types/api'
import { formatArgentinaDate } from '../utils/dateUtils'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CajaDashboardPage.css'

type TotemImpresionRow = {
  id: number
  cliente_nombre: string
  cliente_dni: string
  cliente_telefono: string
  cantidad_hojas: number
  tipo_impresion: string
  archivo_url: string
  archivo_nombre: string
  numero_op: string | null
  estado_pago: string
  created_at: string
  pagado_at: string | null
  id_venta?: number | null
  numero_venta_crm?: string | null
  valor_venta?: number | null
  estado_pago_venta?: string | null
}

const CajaDashboardPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isCaja, usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totemImpresion, setTotemImpresion] = useState<TotemImpresionRow[]>([])
  const [totemImpresionLoading, setTotemImpresionLoading] = useState(false)
  const [totemImpresionErr, setTotemImpresionErr] = useState<string | null>(null)
  
  // Estados principales
  const [ventasHoy, setVentasHoy] = useState<Venta[]>([])
  const [ordenesPendientesFacturacion, setOrdenesPendientesFacturacion] = useState<OrdenTrabajo[]>([])
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrarRecord[]>([])
  const [cuentasPorPagar, setCuentasPorPagar] = useState<CuentaPorPagarRecord[]>([])
  const [flujoCaja, setFlujoCaja] = useState<Array<{
    fecha: string
    concepto: string
    tipo: string
    ingreso: number
    egreso: number
    saldo_acumulado: number
  }>>([])

  // Estadísticas
  const [estadisticas, setEstadisticas] = useState({
    ingresosHoy: 0,
    egresosHoy: 0,
    saldoCaja: 0,
    ventasPagadas: 0,
    ventasPendientes: 0,
    montoPendienteCobro: 0,
    montoPendientePago: 0,
    ordenesPendientesFacturacion: 0
  })

  // Filtros de fecha
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date()
    hoy.setDate(hoy.getDate() - 7) // Últimos 7 días por defecto
    return hoy.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Cargar ventas del día
  const loadVentasHoy = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const response = await apiService.obtenerVentas(undefined, hoy, hoy)
      if (response.success && response.data) {
        setVentasHoy(response.data)
        
        const ingresosHoy = response.data
          .filter(v => v.estado_pago === 'Pagado')
          .reduce((sum, v) => sum + v.valor_total, 0)
        
        const ventasPagadas = response.data.filter(v => v.estado_pago === 'Pagado').length
        const ventasPendientes = response.data.filter(v => v.estado_pago === 'Pendiente').length
        
        setEstadisticas(prev => ({
          ...prev,
          ingresosHoy,
          ventasPagadas,
          ventasPendientes
        }))
      }
    } catch (error) {
      console.error('Error cargando ventas:', error)
    }
  }, [])

  // Cargar órdenes pendientes de facturación
  const loadOrdenesPendientesFacturacion = useCallback(async () => {
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        // Órdenes que están en estado finalizado (listas para facturar)
        const pendientes = response.data.filter(orden => 
          orden.estado === 'Finalizado en Taller' || 
          orden.estado === 'Almacén de Entrega' ||
          orden.estado === 'Entregado o Instalado'
        )
        setOrdenesPendientesFacturacion(pendientes)
        setEstadisticas(prev => ({
          ...prev,
          ordenesPendientesFacturacion: pendientes.length
        }))
      }
    } catch (error) {
      console.error('Error cargando órdenes pendientes:', error)
    }
  }, [])

  // Cargar cuentas por cobrar
  const loadCuentasPorCobrar = useCallback(async () => {
    try {
      const response = await apiService.getCuentasPorCobrar({
        estado: 'Pendiente'
      })
      if (response.success && response.data) {
        setCuentasPorCobrar(response.data)
        const montoPendiente = response.data.reduce((sum, c) => sum + c.monto_pendiente, 0)
        setEstadisticas(prev => ({
          ...prev,
          montoPendienteCobro: montoPendiente
        }))
      }
    } catch (error) {
      console.error('Error cargando cuentas por cobrar:', error)
    }
  }, [])

  // Cargar cuentas por pagar
  const loadCuentasPorPagar = useCallback(async () => {
    try {
      const response = await apiService.getCuentasPorPagar({
        estado: 'Pendiente'
      })
      if (response.success && response.data) {
        setCuentasPorPagar(response.data)
        const montoPendiente = response.data.reduce((sum, c) => sum + c.monto_pendiente, 0)
        setEstadisticas(prev => ({
          ...prev,
          montoPendientePago: montoPendiente
        }))
      }
    } catch (error) {
      console.error('Error cargando cuentas por pagar:', error)
    }
  }, [])

  // Cargar flujo de caja
  const loadFlujoCaja = useCallback(async () => {
    try {
      const response = await apiService.getFlujoCaja(fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setFlujoCaja(response.data)
        
        // Calcular estadísticas del período
        const ingresos = response.data.reduce((sum, m) => sum + (m.ingreso || 0), 0)
        const egresos = response.data.reduce((sum, m) => sum + (m.egreso || 0), 0)
        const saldoFinal = response.data.length > 0 
          ? response.data[response.data.length - 1].saldo_acumulado 
          : 0
        
        setEstadisticas(prev => ({
          ...prev,
          ingresosHoy: ingresos,
          egresosHoy: egresos,
          saldoCaja: saldoFinal
        }))
      }
    } catch (error) {
      console.error('Error cargando flujo de caja:', error)
    }
  }, [fechaDesde, fechaHasta])

  const loadTotemImpresion = useCallback(async () => {
    if (!usuario?.id) return
    setTotemImpresionLoading(true)
    setTotemImpresionErr(null)
    try {
      const res = await apiService.listarSolicitudesImpresionTotem(usuario.id, 80)
      if (res.success && res.data) setTotemImpresion(res.data as TotemImpresionRow[])
      else setTotemImpresionErr(res.error || 'No se pudieron cargar las solicitudes del tótem')
    } catch (e) {
      setTotemImpresionErr(e instanceof Error ? e.message : 'Error al cargar solicitudes del tótem')
    } finally {
      setTotemImpresionLoading(false)
    }
  }, [usuario?.id])

  // Cargar todos los datos
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadVentasHoy(),
        loadOrdenesPendientesFacturacion(),
        loadCuentasPorCobrar(),
        loadCuentasPorPagar(),
        loadFlujoCaja(),
        loadTotemImpresion()
      ])
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [loadVentasHoy, loadOrdenesPendientesFacturacion, loadCuentasPorCobrar, loadCuentasPorPagar, loadFlujoCaja, loadTotemImpresion])

  useEffect(() => {
    console.log('CajaDashboardPage - Montado')
    console.log('CajaDashboardPage - isAdmin:', isAdmin, 'isCaja:', isCaja)
    
    // Pequeño delay para asegurar que el componente se renderice antes de verificar permisos
    const timer = setTimeout(() => {
      if (!isAdmin && !isCaja) {
        console.log('CajaDashboardPage - Sin permisos, redirigiendo...')
        navigate('/')
        return
      }
      console.log('CajaDashboardPage - Cargando datos...')
      loadDashboardData().catch(err => {
        console.error('Error en loadDashboardData:', err)
        setError('Error al cargar los datos del dashboard')
        setLoading(false)
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [isAdmin, isCaja, navigate, loadDashboardData])

  useEffect(() => {
    if (usuario?.id && (isCaja || isAdmin)) void loadTotemImpresion()
  }, [usuario?.id, isCaja, isAdmin, loadTotemImpresion])

  // Preparar datos para gráficos
  const datosFlujoCaja = flujoCaja.map(m => ({
    fecha: formatArgentinaDate(m.fecha),
    ingresos: m.ingreso || 0,
    egresos: m.egreso || 0,
    saldo: m.saldo_acumulado || 0
  }))

  const datosVentasPorEstado = [
    { name: 'Pagadas', value: estadisticas.ventasPagadas, color: '#10b981' },
    { name: 'Pendientes', value: estadisticas.ventasPendientes, color: '#f59e0b' }
  ].filter(item => item.value > 0)

  // Mostrar mensaje de verificación de permisos mientras se carga
  if (!isAdmin && !isCaja) {
    return (
      <div className="caja-dashboard-page">
        <div className="loading-container">
          <p>Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="caja-dashboard-page">
        <div className="loading-container">
          <p>Cargando Dashboard de Caja...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="caja-dashboard-page">
        <div className="error-container" style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Recargar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="caja-dashboard-page">
      <header className="caja-header">
        <div className="caja-header-content">
          <h1>💰 Dashboard de Caja</h1>
          <div className="caja-header-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate('/clientes-web/dashboard')}
            >
              👤 Clientes
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/clientes-web/articulos')}
            >
              📦 Artículos
            </button>
            <button 
              className="btn-primary"
              onClick={() => navigate('/crm-ventas')}
            >
              💼 Ver CRM de Ventas
            </button>
            <button 
              className="btn-primary"
              onClick={() => navigate('/erp')}
            >
              📊 Ver ERP
            </button>
          </div>
        </div>
      </header>

      <section className="caja-totem-impresion" aria-label="Pedidos de impresión tótem">
        <div className="caja-totem-impresion-header">
          <h2>🖨️ Pedidos de impresión (tótem)</h2>
          <button type="button" className="btn-secondary btn-small" onClick={() => loadTotemImpresion()} disabled={totemImpresionLoading}>
            {totemImpresionLoading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        <p className="caja-totem-impresion-lead">
          El cliente dejó el pedido en el tótem; usá la venta CRM y el archivo para cobrar y cerrar la venta.
        </p>
        {totemImpresionErr && <p className="caja-totem-impresion-err">{totemImpresionErr}</p>}
        {!totemImpresionErr && totemImpresion.length === 0 && !totemImpresionLoading && (
          <p className="caja-totem-impresion-empty">No hay pedidos recientes del tótem.</p>
        )}
        {totemImpresion.length > 0 && (
          <div className="caja-totem-impresion-table-wrap">
            <table className="caja-totem-impresion-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Venta CRM</th>
                  <th>Hojas</th>
                  <th>Tipo</th>
                  <th>Pago tótem</th>
                  <th>Archivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {totemImpresion.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      {row.cliente_nombre}
                      <br />
                      <small>
                        DNI {row.cliente_dni} · {row.cliente_telefono}
                      </small>
                    </td>
                    <td>
                      {row.numero_venta_crm ? (
                        <>
                          <button
                            type="button"
                            className="caja-totem-link-venta"
                            onClick={() => navigate('/crm-ventas')}
                          >
                            {row.numero_venta_crm}
                          </button>
                          {row.valor_venta != null ? (
                            <div>
                              <small>
                                ${Number(row.valor_venta).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ·{' '}
                                {row.estado_pago_venta ?? '—'}
                              </small>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="caja-totem-sin-venta">—</span>
                      )}
                    </td>
                    <td>{row.cantidad_hojas}</td>
                    <td>{row.tipo_impresion}</td>
                    <td>
                      {row.estado_pago === 'pagado' ? (
                        <span className="caja-totem-pagado">Pagado</span>
                      ) : (
                        <span className="caja-totem-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td>
                      <a href={row.archivo_url} target="_blank" rel="noopener noreferrer">
                        {row.archivo_nombre}
                      </a>
                    </td>
                    <td>
                      {row.estado_pago === 'pendiente' && usuario?.id ? (
                        <button
                          type="button"
                          className="btn-primary btn-small"
                          onClick={async () => {
                            const r = await apiService.marcarPagoSolicitudImpresionTotem(row.id, usuario.id)
                            if (r.success) await loadTotemImpresion()
                            else alert(r.error || 'No se pudo marcar el pago')
                          }}
                        >
                          Marcar pagado (MP)
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="caja-totem-impresion-hint">
          Al marcar pagado se notifica de nuevo a imprenta, mostrador y caja.
        </p>
      </section>

      {/* Tarjetas de estadísticas */}
      <div className="caja-stats-grid">
        <div className="stat-card ingresos">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Ingresos Hoy</h3>
            <p className="stat-value">${estadisticas.ingresosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="stat-card egresos">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <h3>Egresos (Período)</h3>
            <p className="stat-value">${estadisticas.egresosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="stat-card saldo">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <h3>Saldo de Caja</h3>
            <p className="stat-value">${estadisticas.saldoCaja.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="stat-card pendientes-cobro">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>Pendiente de Cobro</h3>
            <p className="stat-value">${estadisticas.montoPendienteCobro.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            <p className="stat-subtitle">{cuentasPorCobrar.length} cuentas</p>
          </div>
        </div>

        <div className="stat-card pendientes-pago">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <h3>Pendiente de Pago</h3>
            <p className="stat-value">${estadisticas.montoPendientePago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            <p className="stat-subtitle">{cuentasPorPagar.length} cuentas</p>
          </div>
        </div>

        <div className="stat-card ordenes-pendientes">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>Órdenes Pendientes Facturación</h3>
            <p className="stat-value">{estadisticas.ordenesPendientesFacturacion}</p>
          </div>
        </div>
      </div>

      {/* Filtros de fecha para flujo de caja */}
      <div className="caja-filters">
        <h2>Flujo de Caja</h2>
        <div className="date-filters">
          <label>
            Desde:
            <input 
              type="date" 
              value={fechaDesde} 
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </label>
          <label>
            Hasta:
            <input 
              type="date" 
              value={fechaHasta} 
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </label>
          <button 
            className="btn-secondary"
            onClick={loadFlujoCaja}
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Gráficos */}
      <div className="caja-charts-grid">
        <div className="chart-card">
          <h3>Flujo de Caja</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosFlujoCaja}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#10b981" name="Ingresos" />
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" name="Egresos" />
              <Line type="monotone" dataKey="saldo" stroke="#3b82f6" name="Saldo" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Ventas por Estado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={datosVentasPorEstado}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {datosVentasPorEstado.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secciones de gestión */}
      <div className="caja-sections-grid">
        {/* Ventas de hoy */}
        <div className="section-card">
          <div className="section-header">
            <h2>💼 Ventas de Hoy</h2>
            <button 
              className="btn-link"
              onClick={() => navigate('/crm-ventas')}
            >
              Ver todas →
            </button>
          </div>
          <div className="section-content">
            {ventasHoy.length === 0 ? (
              <p className="empty-state">No hay ventas registradas hoy</p>
            ) : (
              <div className="ventas-list">
                {ventasHoy.slice(0, 5).map(venta => (
                  <div key={venta.id} className="venta-item">
                    <div className="venta-info">
                      <span className="venta-numero">{venta.numero_venta}</span>
                      <span className="venta-cliente">{venta.cliente_nombre}</span>
                    </div>
                    <div className="venta-details">
                      <span className={`venta-estado ${venta.estado_pago?.toLowerCase()}`}>
                        {venta.estado_pago}
                      </span>
                      <span className="venta-monto">
                        ${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Órdenes pendientes de facturación */}
        <div className="section-card">
          <div className="section-header">
            <h2>📄 Órdenes Pendientes de Facturación</h2>
            <button 
              className="btn-link"
              onClick={() => navigate('/')}
            >
              Ver todas →
            </button>
          </div>
          <div className="section-content">
            {ordenesPendientesFacturacion.length === 0 ? (
              <p className="empty-state">No hay órdenes pendientes de facturación</p>
            ) : (
              <div className="ordenes-list">
                {ordenesPendientesFacturacion.slice(0, 5).map(orden => (
                  <div key={orden.id} className="orden-item">
                    <div className="orden-info">
                      <span className="orden-numero">OP: {orden.numero_op}</span>
                      <span className="orden-cliente">{orden.cliente}</span>
                    </div>
                    <div className="orden-details">
                      <span className="orden-estado">{orden.estado}</span>
                      <button 
                        className="btn-small"
                        onClick={() => navigate(`/op/${orden.id}`)}
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cuentas por cobrar */}
        <div className="section-card">
          <div className="section-header">
            <h2>📋 Cuentas por Cobrar</h2>
            <button 
              className="btn-link"
              onClick={() => navigate('/erp/cuentas-por-cobrar')}
            >
              Ver todas →
            </button>
          </div>
          <div className="section-content">
            {cuentasPorCobrar.length === 0 ? (
              <p className="empty-state">No hay cuentas por cobrar pendientes</p>
            ) : (
              <div className="cuentas-list">
                {cuentasPorCobrar.slice(0, 5).map(cuenta => (
                  <div key={cuenta.id} className="cuenta-item">
                    <div className="cuenta-info">
                      <span className="cuenta-cliente">{cuenta.cliente_nombre}</span>
                      <span className="cuenta-fecha">
                        Vence: {cuenta.fecha_vencimiento ? formatArgentinaDate(cuenta.fecha_vencimiento) : 'N/A'}
                      </span>
                    </div>
                    <div className="cuenta-details">
                      <span className={`cuenta-estado ${cuenta.estado?.toLowerCase()}`}>
                        {cuenta.estado}
                      </span>
                      <span className="cuenta-monto">
                        ${cuenta.monto_pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cuentas por pagar */}
        <div className="section-card">
          <div className="section-header">
            <h2>💳 Cuentas por Pagar</h2>
            <button 
              className="btn-link"
              onClick={() => navigate('/erp/cuentas-por-pagar')}
            >
              Ver todas →
            </button>
          </div>
          <div className="section-content">
            {cuentasPorPagar.length === 0 ? (
              <p className="empty-state">No hay cuentas por pagar pendientes</p>
            ) : (
              <div className="cuentas-list">
                {cuentasPorPagar.slice(0, 5).map(cuenta => (
                  <div key={cuenta.id} className="cuenta-item">
                    <div className="cuenta-info">
                      <span className="cuenta-cliente">{cuenta.proveedor_nombre}</span>
                      <span className="cuenta-fecha">
                        Vence: {cuenta.fecha_vencimiento ? formatArgentinaDate(cuenta.fecha_vencimiento) : 'N/A'}
                      </span>
                    </div>
                    <div className="cuenta-details">
                      <span className={`cuenta-estado ${cuenta.estado?.toLowerCase()}`}>
                        {cuenta.estado}
                      </span>
                      <span className="cuenta-monto">
                        ${cuenta.monto_pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CajaDashboardPage

