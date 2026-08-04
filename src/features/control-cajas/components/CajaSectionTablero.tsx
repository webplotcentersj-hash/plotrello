import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../../../services/api'
import type { Venta, OrdenTrabajo, CuentaPorCobrarRecord, CuentaPorPagarRecord } from '../../../types/api'
import {
  formatArgentinaDate,
  formatArgentinaDateOnly,
  getArgentinaDateString,
  parseArgentinaDate
} from '../../../utils/dateUtils'
import { VENTAS } from '../../../utils/ventasRoutes'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Props = { canViewIngresos: boolean }

export default function CajaSectionTablero({ canViewIngresos }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ventasHoy, setVentasHoy] = useState<Venta[]>([])
  const [ordenesPendientesFacturacion, setOrdenesPendientesFacturacion] = useState<OrdenTrabajo[]>([])
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrarRecord[]>([])
  const [cuentasPorPagar, setCuentasPorPagar] = useState<CuentaPorPagarRecord[]>([])
  const [flujoCaja, setFlujoCaja] = useState<
    Array<{ fecha: string; concepto: string; tipo: string; ingreso: number; egreso: number; saldo_acumulado: number }>
  >([])
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
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = parseArgentinaDate(getArgentinaDateString())
    d.setDate(d.getDate() - 7)
    return formatArgentinaDateOnly(d)
  })
  const [fechaHasta, setFechaHasta] = useState(() => getArgentinaDateString())

  const loadFlujoCaja = useCallback(async () => {
    try {
      const response = await apiService.getFlujoCaja(fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setFlujoCaja(response.data)
        const ingresos = response.data.reduce((sum, m) => sum + (m.ingreso || 0), 0)
        const egresos = response.data.reduce((sum, m) => sum + (m.egreso || 0), 0)
        const saldoFinal =
          response.data.length > 0 ? response.data[response.data.length - 1].saldo_acumulado : 0
        setEstadisticas((prev) => ({
          ...prev,
          egresosHoy: egresos,
          saldoCaja: saldoFinal,
          ...(canViewIngresos ? { ingresosHoy: ingresos } : {})
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }, [fechaDesde, fechaHasta, canViewIngresos])

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hoy = getArgentinaDateString()
      const [ventasR, ordenesR, cxcR, cxpR] = await Promise.all([
        apiService.obtenerVentas(undefined, hoy, hoy),
        apiService.getOrdenes(),
        apiService.getCuentasPorCobrar({ estado: 'Pendiente' }),
        apiService.getCuentasPorPagar({ estado: 'Pendiente' })
      ])
      if (ventasR.success && ventasR.data) {
        setVentasHoy(ventasR.data)
        const ingresosHoy = ventasR.data
          .filter((v) => v.estado_pago === 'Pagado')
          .reduce((sum, v) => sum + v.valor_total, 0)
        setEstadisticas((prev) => ({
          ...prev,
          ventasPagadas: ventasR.data!.filter((v) => v.estado_pago === 'Pagado').length,
          ventasPendientes: ventasR.data!.filter((v) => v.estado_pago === 'Pendiente').length,
          ...(canViewIngresos ? { ingresosHoy } : {})
        }))
      }
      if (ordenesR.success && ordenesR.data) {
        const pendientes = ordenesR.data.filter(
          (o) =>
            o.estado === 'Finalizado en Taller' ||
            o.estado === 'Entregas taller de Imprenta' ||
            o.estado === 'Almacén de Entrega' ||
            o.estado === 'Entregas taller gráfico' ||
            o.estado === 'Entregas taller grafico' ||
            o.estado === 'Entregado o Instalado'
        )
        setOrdenesPendientesFacturacion(pendientes)
        setEstadisticas((prev) => ({ ...prev, ordenesPendientesFacturacion: pendientes.length }))
      }
      if (cxcR.success && cxcR.data) {
        setCuentasPorCobrar(cxcR.data)
        setEstadisticas((prev) => ({
          ...prev,
          montoPendienteCobro: cxcR.data!.reduce((s, c) => s + c.monto_pendiente, 0)
        }))
      }
      if (cxpR.success && cxpR.data) {
        setCuentasPorPagar(cxpR.data)
        setEstadisticas((prev) => ({
          ...prev,
          montoPendientePago: cxpR.data!.reduce((s, c) => s + c.monto_pendiente, 0)
        }))
      }
      await loadFlujoCaja()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el tablero')
    } finally {
      setLoading(false)
    }
  }, [canViewIngresos, loadFlujoCaja])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  if (loading) return <p className="caja-cc-empty">Cargando tablero…</p>
  if (error) return <p className="caja-cc-error">{error}</p>

  const datosFlujoCaja = flujoCaja.map((m) => ({
    fecha: formatArgentinaDate(m.fecha),
    ...(canViewIngresos ? { ingresos: m.ingreso || 0 } : {}),
    egresos: m.egreso || 0,
    saldo: m.saldo_acumulado || 0
  }))
  const datosVentasPorEstado = [
    { name: 'Pagadas', value: estadisticas.ventasPagadas, color: '#10b981' },
    { name: 'Pendientes', value: estadisticas.ventasPendientes, color: '#f59e0b' }
  ].filter((item) => item.value > 0)

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <div className="caja-stats-grid">
        {canViewIngresos && (
          <div className="stat-card ingresos">
            <div className="stat-icon" aria-hidden>↑</div>
            <div className="stat-content">
              <h3>Ingresos (período)</h3>
              <p className="stat-value">${estadisticas.ingresosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        )}
        <div className="stat-card egresos">
          <div className="stat-icon" aria-hidden>↓</div>
          <div className="stat-content">
            <h3>Egresos (período)</h3>
            <p className="stat-value">${estadisticas.egresosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="stat-card saldo">
          <div className="stat-icon" aria-hidden>=</div>
          <div className="stat-content">
            <h3>Saldo ERP</h3>
            <p className="stat-value">${estadisticas.saldoCaja.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="stat-card pendientes-cobro">
          <div className="stat-icon" aria-hidden>C</div>
          <div className="stat-content">
            <h3>Pendiente de cobro</h3>
            <p className="stat-value">${estadisticas.montoPendienteCobro.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            <p className="stat-subtitle">{cuentasPorCobrar.length} cuentas</p>
          </div>
        </div>
        <div className="stat-card pendientes-pago">
          <div className="stat-icon" aria-hidden>P</div>
          <div className="stat-content">
            <h3>Pendiente de pago</h3>
            <p className="stat-value">${estadisticas.montoPendientePago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            <p className="stat-subtitle">{cuentasPorPagar.length} cuentas</p>
          </div>
        </div>
        <div className="stat-card ordenes-pendientes">
          <div className="stat-icon" aria-hidden>OP</div>
          <div className="stat-content">
            <h3>OP pendientes facturación</h3>
            <p className="stat-value">{estadisticas.ordenesPendientesFacturacion}</p>
          </div>
        </div>
      </div>

      <div className="caja-filters">
        <h2>Flujo de caja (ERP)</h2>
        <div className="date-filters">
          <label>
            Desde:
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </label>
          <label>
            Hasta:
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={() => void loadFlujoCaja()}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="caja-charts-grid">
        <div className="chart-card">
          <h3>Flujo de caja</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={datosFlujoCaja}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d4" />
              <XAxis dataKey="fecha" tick={{ fill: '#0a0a0a' }} stroke="#525252" />
              <YAxis tick={{ fill: '#0a0a0a' }} stroke="#525252" />
              <Tooltip />
              <Legend />
              {canViewIngresos && <Line type="monotone" dataKey="ingresos" stroke="#10b981" name="Ingresos" />}
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" name="Egresos" />
              <Line type="monotone" dataKey="saldo" stroke="#3b82f6" name="Saldo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Ventas por estado (hoy)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={datosVentasPorEstado} dataKey="value" nameKey="name" outerRadius={80} label>
                {datosVentasPorEstado.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="caja-sections-grid">
        <div className="caja-section-card">
          <div className="caja-section-header">
            <h2>Ventas de hoy</h2>
            <button type="button" className="btn-link" onClick={() => navigate(VENTAS)}>
              Ver todas →
            </button>
          </div>
          <div className="caja-section-content">
            {ventasHoy.length === 0 ? (
              <p className="empty-state">No hay ventas hoy</p>
            ) : (
              ventasHoy.slice(0, 5).map((venta) => (
                <div key={venta.id} className="venta-item">
                  <div className="venta-info">
                    <span className="venta-numero">{venta.numero_venta}</span>
                    <span className="venta-cliente">{venta.cliente_nombre}</span>
                  </div>
                  <div className="venta-details">
                    <span className={`venta-estado ${venta.estado_pago?.toLowerCase()}`}>{venta.estado_pago}</span>
                    {canViewIngresos && (
                      <span className="venta-monto">
                        ${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="caja-section-card">
          <div className="caja-section-header">
            <h2>OP pendientes facturación</h2>
            <button type="button" className="btn-link" onClick={() => navigate('/')}>
              Tablero →
            </button>
          </div>
          <div className="caja-section-content">
            {ordenesPendientesFacturacion.length === 0 ? (
              <p className="empty-state">Sin OP pendientes</p>
            ) : (
              ordenesPendientesFacturacion.slice(0, 5).map((orden) => (
                <div key={orden.id} className="orden-item">
                  <div className="orden-info">
                    <span className="orden-numero">OP: {orden.numero_op}</span>
                    <span className="orden-cliente">{orden.cliente}</span>
                  </div>
                  <div className="orden-details">
                    <span className="orden-estado">{orden.estado}</span>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => navigate(`/op/${orden.numero_op ?? orden.id}`)}
                    >
                      Ver
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
