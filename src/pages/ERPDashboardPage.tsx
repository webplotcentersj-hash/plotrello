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
        <div className="erp-module-card" onClick={() => navigate('/erp/tesoreria')}>
          <div className="module-icon">🏦</div>
          <h3>Tesorería</h3>
          <p>Cobros, pagos, vencimientos, flujo de caja</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/contabilidad')}>
          <div className="module-icon">📚</div>
          <h3>Contabilidad</h3>
          <p>Asientos, plan de cuentas, reportes contables</p>
        </div>

        <div className="erp-module-card" onClick={() => navigate('/erp/impuestos')}>
          <div className="module-icon">🧾</div>
          <h3>Impuestos</h3>
          <p>AFIP, IVA, reportes impositivos</p>
        </div>

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

      <div className="erp-guide">
        <details className="erp-guide-card">
          <summary className="erp-guide-summary">
            <span className="erp-guide-title">📌 Guía rápida: qué incluye un ERP</span>
            <span className="erp-guide-hint">Ver / ocultar</span>
          </summary>

          <div className="erp-guide-body">
            <div className="erp-guide-grid">
              <div className="erp-guide-item">
                <h3>1. ERP / sistema de gestión integral</h3>
                <p>
                  Centraliza la operación del negocio: ventas, compras, stock, cuentas corrientes, tesorería,
                  contabilidad, impuestos y (a veces) producción. Es el sistema “madre” para evitar que cada área
                  trabaje aislada.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>2. Facturación electrónica y punto de venta</h3>
                <p>
                  Emite comprobantes, notas de crédito, remitos; maneja caja, listas de precios, clientes y cobranzas.
                  En Argentina suele estar ligado al cumplimiento con ARCA/AFIP y factura electrónica.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>3. Contable y fiscal</h3>
                <p>
                  Asientos, balances, IVA, conciliaciones, activos fijos, cierres mensuales y reportes contables.
                  La parte impositiva requiere control fino y periodicidad.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>4. Compras y proveedores</h3>
                <p>
                  Solicitudes de compra, órdenes de compra, cotizaciones, control presupuestario, recepción de
                  mercadería, cuentas a pagar y seguimiento de proveedores.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>5. Stock / inventario / depósitos</h3>
                <p>
                  Control de existencias, movimientos, valuación, depósitos, lotes, remitos y reposición. Incluye
                  alertas de mínimos y rotación/mercadería inmovilizada.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>6. RR. HH. y sueldos</h3>
                <p>
                  Legajos, licencias, novedades, fichadas y liquidación de haberes, convenios, centros de costo e
                  informes laborales (en Argentina es crítico por cumplimiento).
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>7. CRM / gestión comercial</h3>
                <p>
                  Prospectos, clientes, presupuestos, seguimiento de ventas, historial comercial y cobranzas; suele
                  integrarse con ventas y cuentas corrientes.
                </p>
              </div>

              <div className="erp-guide-item">
                <h3>8. BI / tableros de control</h3>
                <p>
                  Dashboards y KPIs: ventas, márgenes, cobranzas, compras, rentabilidad, stock inmovilizado y flujo de
                  caja.
                </p>
              </div>
            </div>

            <div className="erp-guide-item erp-guide-item--full">
              <h3>Reportes sugeridos</h3>
              <div className="erp-guide-lists">
                <div>
                  <h4>Ventas</h4>
                  <ul>
                    <li>ventas por día/semana/mes/año</li>
                    <li>ventas por producto/rubro/cliente/vendedor/sucursal</li>
                    <li>ticket promedio</li>
                    <li>productos más vendidos</li>
                    <li>márgenes y rentabilidad</li>
                  </ul>
                </div>
                <div>
                  <h4>Financieros</h4>
                  <ul>
                    <li>flujo de caja</li>
                    <li>cuentas a cobrar / cuentas a pagar</li>
                    <li>saldos de clientes y proveedores</li>
                    <li>posición bancaria y tesorería</li>
                    <li>presupuesto vs. real</li>
                  </ul>
                </div>
                <div>
                  <h4>Contables e impositivos</h4>
                  <ul>
                    <li>libro IVA compras/ventas</li>
                    <li>balance de sumas y saldos</li>
                    <li>estado de resultados</li>
                    <li>mayor y diario</li>
                    <li>percepciones/retenciones e IIBB</li>
                  </ul>
                </div>
                <div>
                  <h4>Stock</h4>
                  <ul>
                    <li>stock actual</li>
                    <li>stock mínimo y reposición</li>
                    <li>valorización de inventario</li>
                    <li>movimientos por depósito</li>
                    <li>mercadería inmovilizada y quiebres</li>
                  </ul>
                </div>
                <div>
                  <h4>RR. HH.</h4>
                  <ul>
                    <li>liquidaciones</li>
                    <li>costo salarial por sector/centro de costo</li>
                    <li>ausentismo, licencias y novedades</li>
                    <li>dotación por área/sucursal</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="erp-guide-foot">
              <div className="erp-guide-foot-col">
                <h4>Escalado típico (Argentina)</h4>
                <ol>
                  <li>micro/pequeña: facturación + caja + cuentas corrientes + stock</li>
                  <li>pyme: ventas + compras + stock + tesorería + contabilidad + impuestos</li>
                  <li>grande: ERP completo + RRHH + BI + CRM + integraciones (bancos, e-commerce, logística, APIs)</li>
                </ol>
              </div>
              <div className="erp-guide-foot-col">
                <h4>Ir a módulos</h4>
                <div className="erp-guide-actions">
                  <button className="btn-small" onClick={() => navigate('/erp/tesoreria')}>Tesorería</button>
                  <button className="btn-small" onClick={() => navigate('/erp/contabilidad')}>Contabilidad</button>
                  <button className="btn-small" onClick={() => navigate('/erp/impuestos')}>Impuestos</button>
                  <button className="btn-small" onClick={() => navigate('/erp/reportes')}>Reportes</button>
                </div>
              </div>
            </div>
          </div>
        </details>
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

