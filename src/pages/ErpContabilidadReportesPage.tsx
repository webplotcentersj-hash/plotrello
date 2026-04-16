import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

type BalanceRow = {
  tipo_cuenta: string
  codigo_cuenta: string
  nombre_cuenta: string
  saldo_deudor: number
  saldo_acreedor: number
  saldo_final: number
}

type ResumenRow = {
  tipo_cuenta: string
  total_deudor: number
  total_acreedor: number
  saldo_final: number
}

export default function ErpContabilidadReportesPage() {
  const navigate = useNavigate()
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [fechaCorte, setFechaCorte] = useState(todayStr)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<BalanceRow[]>([])
  const [resumen, setResumen] = useState<ResumenRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([apiService.getBalanceGeneral(fechaCorte), apiService.getResumenCuentas(fechaCorte)])
      .then(([b, r]) => {
        if (cancelled) return
        if (b.success && b.data) setBalance((b.data as any[]) as BalanceRow[])
        else setBalance([])
        if (r.success && r.data) setResumen((r.data as any[]) as ResumenRow[])
        else setResumen([])
        if (!b.success || !r.success) setError(b.error || r.error || 'No se pudieron cargar reportes contables.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fechaCorte])

  const totals = useMemo(() => {
    const debe = balance.reduce((s, x) => s + (Number(x?.saldo_deudor) || 0), 0)
    const haber = balance.reduce((s, x) => s + (Number(x?.saldo_acreedor) || 0), 0)
    const saldo = balance.reduce((s, x) => s + (Number(x?.saldo_final) || 0), 0)
    return { debe, haber, saldo }
  }, [balance])

  const exportBalanceCsv = () => {
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const num = (n: any) => (Number(n) || 0).toFixed(2)

    const lines: string[] = []
    lines.push(['tipo_cuenta', 'codigo', 'nombre', 'saldo_deudor', 'saldo_acreedor', 'saldo_final'].join(','))
    for (const r of balance) {
      lines.push(
        [
          esc(r.tipo_cuenta),
          esc(r.codigo_cuenta),
          esc(r.nombre_cuenta),
          num(r.saldo_deudor),
          num(r.saldo_acreedor),
          num(r.saldo_final)
        ].join(',')
      )
    }
    lines.push('')
    lines.push(['RESUMEN', '', '', '', '', ''].join(','))
    lines.push(['fecha_corte', esc(fechaCorte)].join(','))
    lines.push(['total_debe', num(totals.debe)].join(','))
    lines.push(['total_haber', num(totals.haber)].join(','))
    lines.push(['saldo_final_suma', num(totals.saldo)].join(','))

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance_general_${fechaCorte}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📚 Reportes contables</h1>
          <p className="erp-section-sub">Balance general + resumen por tipo de cuenta</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/contabilidad')}>
            ← Volver a Contabilidad
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ERP
          </button>
        </div>
      </div>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-panel">
        <h2>Parámetros</h2>
        <div className="erp-section-actions" style={{ marginBottom: 10 }}>
          <label className="erp-muted">
            Fecha de corte{' '}
            <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <button type="button" className="btn-secondary" onClick={exportBalanceCsv} disabled={loading}>
            Export CSV
          </button>
        </div>
        <p className="erp-section-sub" style={{ marginTop: 0 }}>
          Considera solo asientos <strong>Contabilizados</strong> hasta la fecha de corte.
        </p>
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Resumen por tipo</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : resumen.length === 0 ? (
            <p className="erp-muted">Sin datos.</p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Total debe</th>
                    <th>Total haber</th>
                    <th>Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((r) => (
                    <tr key={r.tipo_cuenta}>
                      <td>{r.tipo_cuenta}</td>
                      <td>${Number(r.total_deudor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.total_acreedor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.saldo_final || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Totales (balance)</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${totals.debe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Total debe</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${totals.haber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Total haber</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">${totals.saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="erp-kpi-label">Suma saldos finales</div>
              </div>
            </div>
          )}
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Nota: “suma saldos” sirve como control rápido, pero el balance se interpreta por tipos (Activo/Pasivo/Patrimonio).
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Balance general (detalle por cuenta)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : balance.length === 0 ? (
          <p className="erp-muted">Sin movimientos.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Cuenta</th>
                  <th>Debe</th>
                  <th>Haber</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {balance.slice(0, 400).map((r, idx) => (
                  <tr key={`${r.codigo_cuenta}-${idx}`}>
                    <td>{r.tipo_cuenta}</td>
                    <td>{r.codigo_cuenta}</td>
                    <td>{r.nombre_cuenta}</td>
                    <td>${Number(r.saldo_deudor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${Number(r.saldo_acreedor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${Number(r.saldo_final || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && balance.length > 400 && (
          <p className="erp-muted" style={{ marginTop: 10 }}>
            Mostrando 400 filas. Usá Export CSV para el archivo completo.
          </p>
        )}
      </div>
    </div>
  )
}

