import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { CostoClienteResumen, CostoOPRecord, CostoOPResumen } from '../types/api'
import './ErpSectionPage.css'
import './ErpCostosPage.css'

const TIPOS_COSTO = [
  'Materiales',
  'Mano de Obra',
  'Gastos Generales',
  'Subcontratación',
  'Otros'
] as const

type TabVista = 'ops' | 'clientes' | 'detalle'

function money(n: number): string {
  return `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function pct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}

function margenClass(r: CostoOPResumen): string {
  if (r.alerta === 'costo_supera_ingreso' || r.alerta === 'sin_ingreso') return 'costos-margen--bad'
  if (r.alerta === 'margen_bajo') return 'costos-margen--warn'
  return 'costos-margen--ok'
}

function alertaLabel(a: CostoOPResumen['alerta']): string {
  if (a === 'costo_supera_ingreso') return 'Costo > ingreso'
  if (a === 'margen_bajo') return 'Margen bajo'
  if (a === 'sin_ingreso') return 'Sin ingreso'
  return 'OK'
}

function alertaPillClass(a: CostoOPResumen['alerta']): string {
  if (a === 'costo_supera_ingreso' || a === 'sin_ingreso') return 'costos-alerta-pill--bad'
  if (a === 'margen_bajo') return 'costos-alerta-pill--warn'
  return 'costos-alerta-pill--ok'
}

const emptyForm = () => ({
  tipo_costo: 'Materiales' as (typeof TIPOS_COSTO)[number],
  concepto: '',
  cantidad: '1',
  costo_unitario: '',
  fecha_costo: new Date().toISOString().split('T')[0],
  observaciones: ''
})

export default function ErpCostosPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumenes, setResumenes] = useState<CostoOPResumen[]>([])
  const [buscar, setBuscar] = useState('')
  const [buscarInput, setBuscarInput] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [tab, setTab] = useState<TabVista>('ops')
  const [selected, setSelected] = useState<CostoOPResumen | null>(null)
  const [lineas, setLineas] = useState<CostoOPRecord[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [opLookup, setOpLookup] = useState('')
  const [importing, setImporting] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await apiService.getResumenCostosOPDashboard({ buscar: buscar || undefined, limite: 100 })
    if (r.success && r.data) {
      setResumenes(r.data)
    } else {
      setResumenes([])
      setError(r.error || 'No se pudo cargar el resumen de costos.')
    }
    setLoading(false)
  }, [buscar])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const filtrados = useMemo(() => {
    return resumenes.filter((r) => {
      if (soloAlertas && r.alerta === 'ok') return false
      return true
    })
  }, [resumenes, soloAlertas])

  const kpis = useMemo(() => {
    const ops = filtrados.length
    const costo = filtrados.reduce((s, r) => s + r.costo_total, 0)
    const ingreso = filtrados.reduce((s, r) => s + r.ingreso, 0)
    const margen = ingreso - costo
    const alertas = filtrados.filter((r) => r.alerta !== 'ok').length
    const conIngreso = filtrados.filter((r) => r.ingreso > 0)
    const margenPctProm =
      conIngreso.length > 0
        ? conIngreso.reduce((s, r) => s + (r.margen_pct ?? 0), 0) / conIngreso.length
        : null
    return { ops, costo, ingreso, margen, alertas, margenPctProm }
  }, [filtrados])

  const porCliente = useMemo((): CostoClienteResumen[] => {
    const map = new Map<string, CostoClienteResumen>()
    for (const r of filtrados) {
      const key = r.cliente.trim() || 'Sin cliente'
      const prev = map.get(key) ?? {
        cliente: key,
        ops: 0,
        costo_total: 0,
        ingreso_total: 0,
        margen_abs: 0,
        margen_pct: null,
        alertas: 0
      }
      prev.ops += 1
      prev.costo_total += r.costo_total
      prev.ingreso_total += r.ingreso
      prev.margen_abs += r.margen_abs
      if (r.alerta !== 'ok') prev.alertas += 1
      map.set(key, prev)
    }
    return [...map.values()]
      .map((c) => ({
        ...c,
        margen_pct: c.ingreso_total > 0 ? (c.margen_abs / c.ingreso_total) * 100 : null
      }))
      .sort((a, b) => b.ingreso_total - a.ingreso_total)
  }, [filtrados])

  const loadDetalle = async (r: CostoOPResumen) => {
    setSelected(r)
    setTab('detalle')
    setLoadingDetalle(true)
    setMsg(null)
    const [res, calc] = await Promise.all([
      apiService.getCostosOP(r.id_op),
      apiService.calcularCostosOP(r.id_op)
    ])
    const rows = res.success && res.data ? res.data : []
    setLineas(rows)

    const sumLog = rows
      .filter((l) => l.tipo_costo === 'Subcontratación' || l.tipo_costo === 'Otros')
      .reduce((s, l) => s + (Number(l.costo_total) || 0), 0)

    let updated: CostoOPResumen = { ...r, cantidad_lineas: rows.length, costo_logistica: sumLog }
    if (calc.success && calc.data) {
      updated = {
        ...updated,
        costo_materiales: Number(calc.data.costo_materiales) || 0,
        costo_mano_obra: Number(calc.data.costo_mano_obra) || 0,
        costo_gastos_generales: Number(calc.data.costo_gastos_generales) || 0,
        costo_total: Number(calc.data.costo_total) || 0,
        costo_logistica: sumLog,
        margen_abs: r.ingreso - (Number(calc.data.costo_total) || 0),
        margen_pct: r.ingreso > 0 ? ((r.ingreso - (Number(calc.data.costo_total) || 0)) / r.ingreso) * 100 : null,
        ultima_fecha_costo: rows[0]?.fecha_costo ?? null
      }
      if (updated.ingreso <= 0 && updated.costo_total > 0) updated.alerta = 'sin_ingreso'
      else if (updated.ingreso > 0 && updated.costo_total > updated.ingreso) updated.alerta = 'costo_supera_ingreso'
      else if (updated.ingreso > 0 && updated.margen_pct != null && updated.margen_pct < 15) updated.alerta = 'margen_bajo'
      else updated.alerta = 'ok'
    }
    setSelected(updated)
    setLoadingDetalle(false)
  }

  const handleBuscarOp = async () => {
    const q = opLookup.trim()
    if (!q) return
    setMsg(null)
    const r = await apiService.getOrdenByOpNumber(q)
    if (!r.success || !r.data) {
      setMsg(r.error || 'OP no encontrada')
      return
    }
    const op = r.data
    const dash = await apiService.getResumenCostosOPDashboard({ buscar: op.numero_op, limite: 20 })
    const match = dash.data?.find((x) => x.id_op === op.id)
    if (match) {
      await loadDetalle(match)
      return
    }
    const resumen: CostoOPResumen = {
      id_op: op.id,
      numero_op: op.numero_op,
      cliente: op.cliente ?? '—',
      sector: op.sector ?? null,
      entregado: op.entregado ?? null,
      reclamo_costo_monto: op.reclamo_costo_monto ?? null,
      costo_materiales: 0,
      costo_mano_obra: 0,
      costo_gastos_generales: 0,
      costo_logistica: 0,
      costo_total: 0,
      ingreso: 0,
      margen_abs: 0,
      margen_pct: null,
      alerta: 'ok',
      cantidad_lineas: 0,
      ultima_fecha_costo: null
    }
    await loadDetalle(resumen)
  }

  const handleGuardarLinea = async () => {
    if (!selected) return
    const cantidad = Number(form.cantidad)
    const costo_unitario = Number(form.costo_unitario)
    if (!form.concepto.trim() || !cantidad || cantidad <= 0 || costo_unitario < 0) {
      setMsg('Completá concepto, cantidad y costo unitario.')
      return
    }
    setSaving(true)
    setMsg(null)
    const r = await apiService.crearCostoOP({
      id_op: selected.id_op,
      numero_op: selected.numero_op,
      tipo_costo: form.tipo_costo,
      concepto: form.concepto.trim(),
      cantidad,
      costo_unitario,
      fecha_costo: form.fecha_costo,
      observaciones: form.observaciones.trim() || null
    })
    setSaving(false)
    if (!r.success) {
      setMsg(r.error || 'No se pudo guardar el costo')
      return
    }
    setForm(emptyForm())
    setMsg('Costo registrado.')
    await Promise.all([loadDashboard(), loadDetalle(selected)])
  }

  const handleImportStock = async () => {
    if (!selected) return
    setImporting(true)
    setMsg(null)
    const r = await apiService.importarCostosMaterialesDesdeStock(selected.id_op, selected.numero_op)
    setImporting(false)
    if (!r.success) {
      setMsg(r.error || 'Error al importar desde stock')
      return
    }
    setMsg(`Importados ${r.data?.importados ?? 0} movimientos (${r.data?.omitidos ?? 0} omitidos).`)
    await Promise.all([loadDashboard(), loadDetalle(selected)])
  }

  const costoParts = selected
    ? [
        { key: 'mat', pct: selected.costo_total > 0 ? (selected.costo_materiales / selected.costo_total) * 100 : 0, cls: 'costos-bar__mat' },
        { key: 'mo', pct: selected.costo_total > 0 ? (selected.costo_mano_obra / selected.costo_total) * 100 : 0, cls: 'costos-bar__mo' },
        { key: 'gg', pct: selected.costo_total > 0 ? (selected.costo_gastos_generales / selected.costo_total) * 100 : 0, cls: 'costos-bar__gg' },
        { key: 'log', pct: selected.costo_total > 0 ? (selected.costo_logistica / selected.costo_total) * 100 : 0, cls: 'costos-bar__log' }
      ]
    : []

  return (
    <div className="erp-section costos-page">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            💰
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Plot Lab · Contable</p>
            <h1>Control de costos</h1>
            <p className="erp-section-sub">Costos por OP, margen por cliente y alertas de desvío</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/plan-cuentas')}>
            Plan de cuentas
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span>{' '}
          <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">📦</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.ops}</div>
            <div className="erp-stat-card__label">OPs con costos</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--cyan">
          <div className="erp-stat-card__icon">📉</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : money(kpis.costo)}</div>
            <div className="erp-stat-card__label">Costo acumulado</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">📈</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : money(kpis.ingreso)}</div>
            <div className="erp-stat-card__label">Ingreso (ventas / facturas)</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">⚠️</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.alertas}</div>
            <div className="erp-stat-card__label">
              Alertas · margen prom. {kpis.margenPctProm != null ? pct(kpis.margenPctProm) : '—'}
            </div>
          </div>
        </article>
      </div>

      <div className="erp-panel">
        <div className="erp-toolbar">
          <div className="erp-field">
            <label htmlFor="costos-buscar">Buscar OP o cliente</label>
            <input
              id="costos-buscar"
              type="search"
              placeholder="N° OP, cliente…"
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBuscar(buscarInput.trim())
              }}
            />
          </div>
          <button type="button" className="btn-primary" onClick={() => setBuscar(buscarInput.trim())}>
            Buscar
          </button>
          <div className="erp-field">
            <label htmlFor="costos-op-directa">Ir a OP</label>
            <input
              id="costos-op-directa"
              type="text"
              placeholder="Ej. 1234 o OP-1234"
              value={opLookup}
              onChange={(e) => setOpLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleBuscarOp()
              }}
            />
          </div>
          <button type="button" className="btn-secondary" onClick={() => void handleBuscarOp()}>
            Abrir OP
          </button>
          <label className="erp-check">
            <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
            Solo alertas
          </label>
          <button type="button" className="btn-secondary" onClick={() => void loadDashboard()}>
            Actualizar
          </button>
        </div>

        <div className="costos-tabs">
          <button
            type="button"
            className={`costos-tab ${tab === 'ops' ? 'costos-tab--active' : ''}`}
            onClick={() => setTab('ops')}
          >
            Por OP
          </button>
          <button
            type="button"
            className={`costos-tab ${tab === 'clientes' ? 'costos-tab--active' : ''}`}
            onClick={() => setTab('clientes')}
          >
            Por cliente
          </button>
          {selected && (
            <button
              type="button"
              className={`costos-tab ${tab === 'detalle' ? 'costos-tab--active' : ''}`}
              onClick={() => setTab('detalle')}
            >
              Detalle {selected.numero_op}
            </button>
          )}
        </div>

        {msg && (
          <p className="erp-muted" style={{ marginBottom: 12 }}>
            {msg}
          </p>
        )}

        {tab === 'ops' && (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Cliente</th>
                  <th>Sector</th>
                  <th>Materiales</th>
                  <th>MO</th>
                  <th>GG + log.</th>
                  <th>Costo</th>
                  <th>Ingreso</th>
                  <th>Margen</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="erp-muted">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="erp-muted">
                      No hay costos registrados{buscar ? ' para esa búsqueda' : ''}. Usá «Abrir OP» para cargar líneas.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtrados.map((r) => (
                    <tr
                      key={r.id_op}
                      className={`costos-op-row ${selected?.id_op === r.id_op ? 'costos-op-row--selected' : ''}`}
                      onClick={() => void loadDetalle(r)}
                    >
                      <td>
                        <strong>{r.numero_op}</strong>
                        <div className="erp-muted" style={{ fontSize: '0.78rem' }}>
                          {r.cantidad_lineas} líneas
                        </div>
                      </td>
                      <td>{r.cliente}</td>
                      <td>{r.sector || '—'}</td>
                      <td>{money(r.costo_materiales)}</td>
                      <td>{money(r.costo_mano_obra)}</td>
                      <td>{money(r.costo_gastos_generales + r.costo_logistica)}</td>
                      <td>{money(r.costo_total)}</td>
                      <td>{r.ingreso > 0 ? money(r.ingreso) : '—'}</td>
                      <td className={margenClass(r)}>
                        {r.ingreso > 0 ? (
                          <>
                            {money(r.margen_abs)} <span className="erp-muted">({pct(r.margen_pct)})</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`costos-alerta-pill ${alertaPillClass(r.alerta)}`}>{alertaLabel(r.alerta)}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'clientes' && (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>OPs</th>
                  <th>Costo</th>
                  <th>Ingreso</th>
                  <th>Margen</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {porCliente.length === 0 && (
                  <tr>
                    <td colSpan={6} className="erp-muted">
                      Sin datos agregados.
                    </td>
                  </tr>
                )}
                {porCliente.map((c) => (
                  <tr key={c.cliente}>
                    <td>{c.cliente}</td>
                    <td>{c.ops}</td>
                    <td>{money(c.costo_total)}</td>
                    <td>{c.ingreso_total > 0 ? money(c.ingreso_total) : '—'}</td>
                    <td className={c.margen_pct != null && c.margen_pct < 15 ? 'costos-margen--warn' : 'costos-margen--ok'}>
                      {c.ingreso_total > 0 ? (
                        <>
                          {money(c.margen_abs)} ({pct(c.margen_pct)})
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{c.alertas > 0 ? c.alertas : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'detalle' && selected && (
          <>
            <div className="costos-detail-grid">
              <div className="costos-detail-chip">
                <div className="costos-detail-chip__label">OP</div>
                <div className="costos-detail-chip__value">{selected.numero_op}</div>
              </div>
              <div className="costos-detail-chip">
                <div className="costos-detail-chip__label">Cliente</div>
                <div className="costos-detail-chip__value">{selected.cliente}</div>
              </div>
              <div className="costos-detail-chip">
                <div className="costos-detail-chip__label">Costo total</div>
                <div className="costos-detail-chip__value">{money(selected.costo_total)}</div>
              </div>
              <div className="costos-detail-chip">
                <div className="costos-detail-chip__label">Ingreso</div>
                <div className="costos-detail-chip__value">
                  {selected.ingreso > 0 ? money(selected.ingreso) : '—'}
                </div>
              </div>
              <div className="costos-detail-chip">
                <div className="costos-detail-chip__label">Margen</div>
                <div className={`costos-detail-chip__value ${margenClass(selected)}`}>
                  {selected.ingreso > 0 ? `${money(selected.margen_abs)} (${pct(selected.margen_pct)})` : '—'}
                </div>
              </div>
              {selected.reclamo_costo_monto != null && selected.reclamo_costo_monto > 0 && (
                <div className="costos-detail-chip">
                  <div className="costos-detail-chip__label">Reclamo costo OP</div>
                  <div className="costos-detail-chip__value">{money(selected.reclamo_costo_monto)}</div>
                </div>
              )}
            </div>

            {selected.costo_total > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="erp-muted" style={{ fontSize: '0.82rem' }}>
                  Composición: materiales · MO · gastos generales · logística (subcontratación + otros)
                </div>
                <div className="costos-bar">
                  {costoParts.map((p) => (
                    <span key={p.key} className={p.cls} style={{ width: `${p.pct}%` }} />
                  ))}
                </div>
              </div>
            )}

            <div className="erp-toolbar" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={importing}
                onClick={() => void handleImportStock()}
              >
                {importing ? 'Importando…' : 'Importar materiales desde stock'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/op/${encodeURIComponent(selected.numero_op)}`)}
              >
                Ver OP en tablero
              </button>
            </div>

            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Registrar costo</h3>
            <div className="costos-form-grid">
              <div className="erp-field">
                <label htmlFor="tipo-costo">Tipo</label>
                <select
                  id="tipo-costo"
                  value={form.tipo_costo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo_costo: e.target.value as (typeof TIPOS_COSTO)[number] }))
                  }
                >
                  {TIPOS_COSTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="erp-field erp-field--wide">
                <label htmlFor="concepto-costo">Concepto</label>
                <input
                  id="concepto-costo"
                  value={form.concepto}
                  onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
                  placeholder="Descripción del costo"
                />
              </div>
              <div className="erp-field">
                <label htmlFor="cantidad-costo">Cantidad</label>
                <input
                  id="cantidad-costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                />
              </div>
              <div className="erp-field">
                <label htmlFor="unit-costo">Costo unitario</label>
                <input
                  id="unit-costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo_unitario}
                  onChange={(e) => setForm((f) => ({ ...f, costo_unitario: e.target.value }))}
                />
              </div>
              <div className="erp-field">
                <label htmlFor="fecha-costo">Fecha</label>
                <input
                  id="fecha-costo"
                  type="date"
                  value={form.fecha_costo}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_costo: e.target.value }))}
                />
              </div>
              <div className="erp-field erp-field--wide">
                <label htmlFor="obs-costo">Observaciones</label>
                <input
                  id="obs-costo"
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleGuardarLinea()}>
                {saving ? 'Guardando…' : 'Agregar línea'}
              </button>
            </div>

            <h3 style={{ margin: '20px 0 12px', fontSize: '1rem' }}>Líneas de costo</h3>
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th>Cant.</th>
                    <th>Unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDetalle && (
                    <tr>
                      <td colSpan={6} className="erp-muted">
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loadingDetalle && lineas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="erp-muted">
                        Sin líneas. Agregá costos manualmente o importá salidas de stock.
                      </td>
                    </tr>
                  )}
                  {!loadingDetalle &&
                    lineas.map((l) => (
                      <tr key={l.id}>
                        <td>{l.fecha_costo}</td>
                        <td>{l.tipo_costo}</td>
                        <td>
                          {l.concepto}
                          {l.observaciones && (
                            <div className="erp-muted" style={{ fontSize: '0.75rem' }}>
                              {l.observaciones}
                            </div>
                          )}
                        </td>
                        <td>{l.cantidad}</td>
                        <td>{money(l.costo_unitario)}</td>
                        <td>{money(l.costo_total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
