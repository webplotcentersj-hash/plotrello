import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord, CuentaPorCobrarRecord } from '../types/api'
import './ERPDashboardPage.css'

export default function ERPDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    facturasPendientes: 0,
    facturasEmitidas: 0,
    cuentasPorCobrar: 0,
    montoPorCobrar: 0,
    asientosPendientes: 0,
    facturasRecientes: [] as FacturaVentaRecord[],
    cuentasVencidas: [] as CuentaPorCobrarRecord[]
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      // Cargar facturas
      const facturasResponse = await apiService.getFacturas({
        fechaDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      })

      // Cargar cuentas por cobrar
      const cxcResponse = await apiService.getCuentasPorCobrar()

      // Cargar asientos
      const asientosResponse = await apiService.getAsientosContables({
        estado: 'Borrador'
      })

      if (facturasResponse.success && facturasResponse.data) {
        const facturas = facturasResponse.data
        const pendientes = facturas.filter(f => f.estado === 'Borrador').length
        const emitidas = facturas.filter(f => f.estado === 'Emitida').length
        const recientes = facturas.slice(0, 5)

        setStats(prev => ({
          ...prev,
          facturasPendientes: pendientes,
          facturasEmitidas: emitidas,
          facturasRecientes: recientes
        }))
      }

      if (cxcResponse.success && cxcResponse.data) {
        const cuentas = cxcResponse.data
        const pendientes = cuentas.filter(c => c.estado === 'Pendiente' || c.estado === 'Parcial')
        const montoTotal = pendientes.reduce((sum, c) => sum + c.monto_pendiente, 0)
        const vencidas = cuentas.filter(c => {
          if (!c.fecha_vencimiento) return false
          return new Date(c.fecha_vencimiento) < new Date() && c.estado !== 'Pagado'
        })

        setStats(prev => ({
          ...prev,
          cuentasPorCobrar: pendientes.length,
          montoPorCobrar: montoTotal,
          cuentasVencidas: vencidas
        }))
      }

      if (asientosResponse.success && asientosResponse.data) {
        setStats(prev => ({
          ...prev,
          asientosPendientes: asientosResponse.data?.length || 0
        }))
      }
    } catch (error) {
      console.error('Error cargando estadísticas ERP:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="erp-dashboard">
        <div className="erp-loading">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="erp-dashboard">
      <div className="erp-header">
        <h1>💰 Sistema ERP</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Volver
        </button>
      </div>

      <div className="erp-stats-grid">
        <div className="erp-stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.facturasPendientes}</div>
            <div className="stat-label">Facturas Pendientes</div>
          </div>
          <button className="stat-action" onClick={() => navigate('/erp/facturas?estado=Borrador')}>
            Ver →
          </button>
        </div>

        <div className="erp-stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.facturasEmitidas}</div>
            <div className="stat-label">Facturas Emitidas (Mes)</div>
          </div>
          <button className="stat-action" onClick={() => navigate('/erp/facturas?estado=Emitida')}>
            Ver →
          </button>
        </div>

        <div className="erp-stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <div className="stat-value">${stats.montoPorCobrar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            <div className="stat-label">Por Cobrar</div>
          </div>
          <button className="stat-action" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
            Ver →
          </button>
        </div>

        <div className="erp-stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.asientosPendientes}</div>
            <div className="stat-label">Asientos Pendientes</div>
          </div>
          <button className="stat-action" onClick={() => navigate('/erp/asientos?estado=Borrador')}>
            Ver →
          </button>
        </div>
      </div>

      {stats.cuentasVencidas.length > 0 && (
        <div className="erp-alert">
          <div className="alert-icon">⚠️</div>
          <div className="alert-content">
            <strong>Cuentas Vencidas</strong>
            <p>{stats.cuentasVencidas.length} cuenta(s) con fecha de vencimiento vencida</p>
          </div>
          <button className="alert-action" onClick={() => navigate('/erp/cuentas-por-cobrar?estado=Vencido')}>
            Revisar
          </button>
        </div>
      )}

      <div className="erp-modules-grid">
        <div className="erp-module-card" onClick={() => navigate('/erp/facturas')}>
          <div className="module-icon">🧾</div>
          <h3>Facturación</h3>
          <p>Crear y gestionar facturas de venta</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/asientos')}>
          <div className="module-icon">📝</div>
          <h3>Asientos Contables</h3>
          <p>Gestión de contabilidad con partida doble</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/plan-cuentas')}>
          <div className="module-icon">📋</div>
          <h3>Plan de Cuentas</h3>
          <p>Configurar estructura contable</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/costos')}>
          <div className="module-icon">💰</div>
          <h3>Control de Costos</h3>
          <p>Gestionar costos por orden de trabajo</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
          <div className="module-icon">💳</div>
          <h3>Cuentas por Cobrar</h3>
          <p>Gestión de cobranzas</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/cuentas-por-pagar')}>
          <div className="module-icon">💸</div>
          <h3>Cuentas por Pagar</h3>
          <p>Gestión de pagos a proveedores</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/reportes')}>
          <div className="module-icon">📊</div>
          <h3>Reportes Financieros</h3>
          <p>Estado de resultados, balance, flujo de caja</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/configuracion-afip')}>
          <div className="module-icon">🔧</div>
          <h3>Configuración AFIP</h3>
          <p>Configurar facturación electrónica</p>
        </div>
      </div>

      {stats.facturasRecientes.length > 0 && (
        <div className="erp-recent-section">
          <h2>Facturas Recientes</h2>
          <div className="erp-table">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stats.facturasRecientes.map(factura => (
                  <tr key={factura.id}>
                    <td>{factura.numero_factura}</td>
                    <td>{factura.cliente_nombre}</td>
                    <td>{new Date(factura.fecha_emision).toLocaleDateString('es-AR')}</td>
                    <td>${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-small"
                        onClick={() => navigate(`/erp/facturas/${factura.id}`)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

