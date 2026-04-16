import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

type TopClienteRow = {
  cliente_nombre: string
  total: number
  cantidad: number
}

export default function ErpCrmPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facturasMes, setFacturasMes] = useState<any[]>([])
  const [cxc, setCxc] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const firstDayMonth = useMemo(() => {
    const d = new Date()
    const f = new Date(d.getFullYear(), d.getMonth(), 1)
    return f.toISOString().split('T')[0]
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([
      apiService.getFacturas({ fechaDesde: firstDayMonth, fechaHasta: todayStr }),
      apiService.getCuentasPorCobrar(),
      apiService.getClientes(true)
    ])
      .then(([rf, rc, rcl]) => {
        if (cancelled) return
        if (rf.success && rf.data) setFacturasMes(Array.isArray(rf.data) ? (rf.data as any[]) : [])
        else setFacturasMes([])
        if (rc.success && rc.data) setCxc(Array.isArray(rc.data) ? (rc.data as any[]) : [])
        else setCxc([])
        if (rcl.success && rcl.data) setClientes(Array.isArray(rcl.data) ? (rcl.data as any[]) : [])
        else setClientes([])
        if (!rf.success || !rc.success || !rcl.success) setError(rf.error || rc.error || rcl.error || 'No se pudo cargar CRM.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [firstDayMonth, todayStr])

  const kpis = useMemo(() => {
    const emitidas = facturasMes.filter((f) => String(f.estado || '') === 'Emitida')
    const ventasTotal = emitidas.reduce((s, f) => s + (Number(f.total) || 0), 0)
    const ticket = emitidas.length ? ventasTotal / emitidas.length : 0

    const pendientes = cxc.filter((x) => x.estado === 'Pendiente' || x.estado === 'Parcial' || x.estado === 'Vencido')
    const montoPendiente = pendientes.reduce((s, x) => s + (Number(x.monto_pendiente) || 0), 0)

    return {
      clientes: clientes.length,
      facturasEmitidasMes: emitidas.length,
      ventasMes: ventasTotal,
      ticketPromedio: ticket,
      cxcPendientes: pendientes.length,
      montoPendiente
    }
  }, [facturasMes, cxc, clientes])

  const topClientes = useMemo((): TopClienteRow[] => {
    const emitidas = facturasMes.filter((f) => String(f.estado || '') === 'Emitida')
    const acc = new Map<string, { total: number; cantidad: number }>()
    for (const f of emitidas) {
      const nombre = String(f.cliente_nombre || 'Sin cliente')
      const curr = acc.get(nombre) || { total: 0, cantidad: 0 }
      curr.total += Number(f.total) || 0
      curr.cantidad += 1
      acc.set(nombre, curr)
    }
    return Array.from(acc.entries())
      .map(([cliente_nombre, v]) => ({ cliente_nombre, total: v.total, cantidad: v.cantidad }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [facturasMes])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🤝 CRM / Gestión comercial</h1>
          <p className="erp-section-sub">Clientes, ventas, oportunidades y seguimiento</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/crm-ventas')}>
            Abrir CRM Ventas
          </button>
        </div>
      </div>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs (mes)</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.clientes}</div>
                <div className="erp-kpi-label">Clientes</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.facturasEmitidasMes}</div>
                <div className="erp-kpi-label">Facturas emitidas</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${kpis.ventasMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Ventas ($)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${kpis.ticketPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Ticket promedio</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.cxcPendientes}</div>
                <div className="erp-kpi-label">CxC pendientes</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${kpis.montoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Monto pendiente</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Accesos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/crm-ventas')}>
              CRM Ventas
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/crm-ventas/reportes')}>
              Reportes ventas (CRM)
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/mostrador/ventas')}>
              Ventas (Mostrador)
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/facturas?estado=Emitida')}>
              Facturas emitidas
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
              Cuentas por cobrar
            </button>
          </div>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Top clientes (por $ facturado, mes)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : topClientes.length === 0 ? (
          <p className="erp-muted">Sin facturas emitidas en el período.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Facturas</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {topClientes.map((t) => (
                  <tr key={t.cliente_nombre}>
                    <td>{t.cliente_nombre}</td>
                    <td>{t.cantidad}</td>
                    <td>${t.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

