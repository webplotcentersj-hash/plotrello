import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpImpuestosPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [facturasEmitidas, setFacturasEmitidas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return d.toISOString().split('T')[0]
  }, [today])
  const defaultTo = useMemo(() => today.toISOString().split('T')[0], [today])
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getFacturas({
        estado: 'Emitida',
        fechaDesde: range.from || undefined,
        fechaHasta: range.to || undefined
      })
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setFacturasEmitidas(Array.isArray(r.data) ? r.data : [])
        else {
          setFacturasEmitidas([])
          if (!r.success) setError(r.error || 'No se pudieron cargar facturas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to])

  const kpis = useMemo(() => {
    const monto = facturasEmitidas.reduce((sum: number, f: any) => sum + (Number(f?.total) || 0), 0)
    return { emitidas: facturasEmitidas.length, monto }
  }, [facturasEmitidas])

  const libroIvaVentas = useMemo(() => {
    const rows = (facturasEmitidas || []).map((f: any) => {
      const items = Array.isArray(f?.items) ? f.items : []
      const acc = {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0
      }

      for (const it of items) {
        const alic = Number(it?.iva_porcentaje)
        const neto = Number(it?.subtotal) || 0
        const iva = Number(it?.iva_monto) || 0
        if (Math.abs(alic - 21) < 0.0001) {
          acc.neto_21 += neto
          acc.iva_21 += iva
        } else if (Math.abs(alic - 10.5) < 0.0001) {
          acc.neto_105 += neto
          acc.iva_105 += iva
        } else if (Math.abs(alic - 0) < 0.0001) {
          acc.neto_0 += neto
          acc.iva_0 += iva
        } else {
          acc.otros_neto += neto
          acc.otros_iva += iva
        }
      }

      const fecha = (String(f?.fecha_emision || '').split('T')[0] || '').trim()
      return {
        id: f?.id,
        fecha,
        tipo: f?.tipo_comprobante || '—',
        pv: f?.punto_venta ?? '—',
        nro: f?.numero_comprobante ?? '—',
        cliente: f?.cliente_nombre || '—',
        cuit: f?.cliente_dni_cuit || '',
        ...acc,
        total: Number(f?.total) || 0
      }
    })

    const totals = rows.reduce(
      (t: any, r: any) => {
        for (const k of ['neto_21', 'iva_21', 'neto_105', 'iva_105', 'neto_0', 'iva_0', 'otros_neto', 'otros_iva'] as const) {
          t[k] += Number(r[k]) || 0
        }
        t.total += Number(r.total) || 0
        t.cantidad += 1
        return t
      },
      {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0,
        total: 0,
        cantidad: 0
      }
    )

    return { rows, totals }
  }, [facturasEmitidas])

  const exportLibroIvaVentasCsv = () => {
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const num = (n: any) => {
      const x = Number(n) || 0
      return x.toFixed(2)
    }

    const header = [
      'fecha',
      'tipo',
      'punto_venta',
      'numero',
      'cliente',
      'cuit',
      'neto_21',
      'iva_21',
      'neto_10_5',
      'iva_10_5',
      'neto_0',
      'iva_0',
      'otros_neto',
      'otros_iva',
      'total'
    ]
    const lines = [header.join(',')]
    for (const r of libroIvaVentas.rows) {
      lines.push(
        [
          esc(r.fecha),
          esc(r.tipo),
          esc(r.pv),
          esc(r.nro),
          esc(r.cliente),
          esc(r.cuit),
          num(r.neto_21),
          num(r.iva_21),
          num(r.neto_105),
          num(r.iva_105),
          num(r.neto_0),
          num(r.iva_0),
          num(r.otros_neto),
          num(r.otros_iva),
          num(r.total)
        ].join(',')
      )
    }
    lines.push('')
    lines.push('RESUMEN,,,,,,,,,,,,,,')
    lines.push(
      [
        'cantidad',
        libroIvaVentas.totals.cantidad,
        'total',
        num(libroIvaVentas.totals.total),
        'neto_21',
        num(libroIvaVentas.totals.neto_21),
        'iva_21',
        num(libroIvaVentas.totals.iva_21),
        'neto_10_5',
        num(libroIvaVentas.totals.neto_105),
        'iva_10_5',
        num(libroIvaVentas.totals.iva_105),
        'neto_0',
        num(libroIvaVentas.totals.neto_0),
        'iva_0',
        num(libroIvaVentas.totals.iva_0)
      ].join(',')
    )

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `libro-iva-ventas_${range.from || 'desde'}_${range.to || 'hasta'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🧾 Impuestos</h1>
          <p className="erp-section-sub">Libro IVA Ventas, reportes impositivos y control fiscal</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/configuracion-afip')}>
            Configuración AFIP
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs (rango)</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.emitidas}</div>
                <div className="erp-kpi-label">Facturas emitidas</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpis.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Monto emitido</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Libro IVA Ventas</h2>
          <div className="erp-section-actions" style={{ marginBottom: 10 }}>
            <label className="erp-muted">
              Desde{' '}
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className="erp-muted">
              Hasta{' '}
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            <button type="button" className="btn-primary" onClick={exportLibroIvaVentasCsv} disabled={loading}>
              Export CSV
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 0 }}>
            Totales por alícuota y detalle por factura (emitidas). Ideal para enviar al contador.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Resumen por alícuota</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Alícuota</th>
                  <th>Neto</th>
                  <th>IVA</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>21%</td>
                  <td>${libroIvaVentas.totals.neto_21.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${libroIvaVentas.totals.iva_21.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(libroIvaVentas.totals.neto_21 + libroIvaVentas.totals.iva_21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>10,5%</td>
                  <td>${libroIvaVentas.totals.neto_105.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${libroIvaVentas.totals.iva_105.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(libroIvaVentas.totals.neto_105 + libroIvaVentas.totals.iva_105).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>0% (exento/no gravado)</td>
                  <td>${libroIvaVentas.totals.neto_0.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${libroIvaVentas.totals.iva_0.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(libroIvaVentas.totals.neto_0 + libroIvaVentas.totals.iva_0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                {(libroIvaVentas.totals.otros_neto !== 0 || libroIvaVentas.totals.otros_iva !== 0) && (
                  <tr>
                    <td>Otros</td>
                    <td>${libroIvaVentas.totals.otros_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${libroIvaVentas.totals.otros_iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${(libroIvaVentas.totals.otros_neto + libroIvaVentas.totals.otros_iva).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr>
                  <td><strong>Total</strong></td>
                  <td colSpan={2} />
                  <td><strong>${libroIvaVentas.totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="erp-panel">
        <h2>Detalle (Libro IVA Ventas)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : libroIvaVentas.rows.length === 0 ? (
          <p className="erp-muted">Sin facturas emitidas para el rango.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>PV</th>
                  <th>N°</th>
                  <th>Cliente</th>
                  <th>CUIT</th>
                  <th>Neto 21</th>
                  <th>IVA 21</th>
                  <th>Neto 10,5</th>
                  <th>IVA 10,5</th>
                  <th>Neto 0</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {libroIvaVentas.rows
                  .sort((a: any, b: any) => (a.fecha < b.fecha ? -1 : 1))
                  .slice(0, 250)
                  .map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{r.tipo}</td>
                      <td>{r.pv}</td>
                      <td>{r.nro}</td>
                      <td>{r.cliente}</td>
                      <td>{r.cuit || '—'}</td>
                      <td>${Number(r.neto_21 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.iva_21 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.neto_105 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.iva_105 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.neto_0 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && libroIvaVentas.rows.length > 250 && (
          <p className="erp-muted" style={{ marginTop: 10 }}>
            Mostrando 250 filas. Usá Export CSV para el archivo completo.
          </p>
        )}
      </div>
    </div>
  )
}

