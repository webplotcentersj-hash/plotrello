import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import apiService from '../services/api'
import type { CostoOPResumen } from '../types/api'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarCsv, fmtCorto, fmtMoney } from '../utils/erpUi'
import { sumarDias } from '../services/erpGestionApi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

type Agrupado = { clave: string; ingreso: number; costo: number; margen: number; pct: number | null; ops: number; perdidas: number }
type Vista = 'cliente' | 'sector'

function agrupar(ops: CostoOPResumen[], por: (o: CostoOPResumen) => string): Agrupado[] {
  const m = new Map<string, Agrupado>()
  for (const o of ops) {
    const k = por(o) || 'Sin dato'
    const a = m.get(k) ?? { clave: k, ingreso: 0, costo: 0, margen: 0, pct: null, ops: 0, perdidas: 0 }
    a.ingreso += o.ingreso
    a.costo += o.costo_total
    a.ops += 1
    if (o.ingreso > 0 && o.costo_total > o.ingreso) a.perdidas += 1
    m.set(k, a)
  }
  return [...m.values()].map((a) => ({ ...a, margen: a.ingreso - a.costo, pct: a.ingreso > 0 ? ((a.ingreso - a.costo) / a.ingreso) * 100 : null }))
}

const tonoMargen = (pct: number | null) => (pct === null ? 'info' : pct < 0 ? 'danger' : pct < 15 ? 'orange' : pct < 30 ? 'warn' : 'ok')

export default function ErpRentabilidadPage() {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const [ops, setOps] = useState<CostoOPResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dias, setDias] = useState(180)
  const [vista, setVista] = useState<Vista>('cliente')
  const [orden, setOrden] = useState<'margen' | 'pct' | 'ingreso'>('margen')

  useEffect(() => {
    void apiService.getResumenCostosOPDashboard({ limite: 3000 }).then((r) => {
      if (r.success && r.data) setOps(r.data)
      else setError(r.success ? null : r.error ?? 'Error')
      setCargando(false)
    })
  }, [])

  const enPeriodo = useMemo(() => {
    const desde = dias ? sumarDias(hoy, -dias) : '0000-01-01'
    return ops.filter((o) => o.ingreso > 0 && (!o.ultima_fecha_costo || String(o.ultima_fecha_costo).slice(0, 10) >= desde))
  }, [ops, dias, hoy])

  const totales = useMemo(() => {
    const ingreso = enPeriodo.reduce((s, o) => s + o.ingreso, 0)
    const costo = enPeriodo.reduce((s, o) => s + o.costo_total, 0)
    return { ingreso, costo, margen: ingreso - costo, pct: ingreso ? ((ingreso - costo) / ingreso) * 100 : null, perdidas: enPeriodo.filter((o) => o.costo_total > o.ingreso) }
  }, [enPeriodo])

  const grupos = useMemo(() => {
    const g = agrupar(enPeriodo, vista === 'cliente' ? (o) => o.cliente : (o) => o.sector || 'Sin sector')
    return g.sort((a, b) => (orden === 'ingreso' ? b.ingreso - a.ingreso : orden === 'pct' ? (b.pct ?? -999) - (a.pct ?? -999) : b.margen - a.margen))
  }, [enPeriodo, vista, orden])

  const insights = useMemo(() => {
    const out: { icono: string; tono: string; texto: string }[] = []
    const porSector = agrupar(enPeriodo, (o) => o.sector || 'Sin sector').filter((s) => s.ops >= 3 && s.pct !== null)
    if (porSector.length >= 2) {
      const ord = [...porSector].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      const mejor = ord[0]
      const peor = ord[ord.length - 1]
      out.push({
        icono: '🏆',
        tono: 'ok',
        texto: `${mejor.clave} es lo más rentable: ${Math.round(mejor.pct ?? 0)}% de margen en ${mejor.ops} trabajos. ${peor.clave} deja ${Math.round(peor.pct ?? 0)}%.`
      })
    }
    const clientes = agrupar(enPeriodo, (o) => o.cliente).filter((c) => c.ops >= 2)
    const malos = clientes.filter((c) => (c.pct ?? 100) < 10).sort((a, b) => a.margen - b.margen)
    if (malos.length) {
      out.push({
        icono: '⚠️',
        tono: 'danger',
        texto: `${malos.length} cliente${malos.length > 1 ? 's' : ''} con margen menor al 10%. El caso más fuerte: ${malos[0].clave} (${Math.round(malos[0].pct ?? 0)}% en ${malos[0].ops} trabajos). Revisá precios o condiciones.`
      })
    }
    if (totales.ingreso > 0 && clientes.length >= 3) {
      const ord = [...clientes].sort((a, b) => b.margen - a.margen)
      const top = ord.slice(0, Math.max(1, Math.ceil(ord.length * 0.2)))
      const pctTop = (top.reduce((s, c) => s + c.margen, 0) / Math.max(1, totales.margen)) * 100
      if (pctTop > 50 && pctTop <= 100) {
        out.push({ icono: '🎯', tono: 'info', texto: `El ${Math.round((top.length / ord.length) * 100)}% de tus clientes genera el ${Math.round(pctTop)}% de la ganancia. Cuidalos.` })
      }
    }
    return out
  }, [enPeriodo, totales])

  const maxIngreso = Math.max(1, ...grupos.map((g) => g.ingreso))
  const sinCostos = ops.length === 0

  return (
    <div className="erp-section gx">
      <ErpPageHeader icon="💹" titulo="Rentabilidad" subtitulo="Qué clientes y qué tipos de trabajo te dejan margen, según los costos cargados por OP." volverA="/erp" volverTexto="ERP">
        <button
          type="button"
          className="btn-secondary"
          disabled={!grupos.length}
          onClick={() =>
            descargarCsv(
              `rentabilidad_${vista}_${hoy}.csv`,
              [vista === 'cliente' ? 'Cliente' : 'Sector', 'Trabajos', 'Ingreso', 'Costo', 'Margen', 'Margen %', 'Con pérdida'],
              grupos.map((g) => [g.clave, g.ops, g.ingreso, g.costo, g.margen, g.pct === null ? '' : g.pct.toFixed(1), g.perdidas])
            )
          }
        >
          Exportar CSV
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate('/erp/costos')}>
          Cargar costos
        </button>
      </ErpPageHeader>

      {error && <p className="erpx-msg erpx-msg--error">{error}</p>}

      <div className="gx-controles">
        <label className="erp-field">
          <span className="erp-field__label">Período</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 3 meses</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={365}>Último año</option>
            <option value={0}>Todo</option>
          </select>
        </label>
      </div>

      {cargando ? (
        <div className="erp-panel">
          <p className="erp-muted">Cargando…</p>
        </div>
      ) : sinCostos ? (
        <div className="gx-banner">
          <span className="gx-banner__icono">ℹ️</span>
          <div>
            <strong>Todavía no hay costos cargados por OP.</strong> La rentabilidad se calcula con los costos de cada orden de trabajo (materiales, mano de obra,
            etc.). Cargalos en Control de costos.
          </div>
        </div>
      ) : (
        <>
          <div className="gx-tiles">
            <div className="gx-tile gx-tile--info">
              <span className="gx-tile__label">Facturado</span>
              <span className="gx-tile__valor">{fmtMoney(totales.ingreso)}</span>
              <span className="gx-tile__sub">{enPeriodo.length} trabajos con costos</span>
            </div>
            <div className="gx-tile gx-tile--warn">
              <span className="gx-tile__label">Costo</span>
              <span className="gx-tile__valor">{fmtMoney(totales.costo)}</span>
            </div>
            <div className={`gx-tile gx-tile--${(totales.pct ?? 0) < 15 ? 'danger' : 'ok'}`}>
              <span className="gx-tile__label">Margen</span>
              <span className="gx-tile__valor">{totales.pct === null ? '—' : `${totales.pct.toFixed(1)}%`}</span>
              <span className="gx-tile__sub">{fmtMoney(totales.margen)}</span>
            </div>
            <div className={`gx-tile gx-tile--${totales.perdidas.length ? 'danger' : 'ok'}`}>
              <span className="gx-tile__label">Trabajos a pérdida</span>
              <span className="gx-tile__valor">{totales.perdidas.length}</span>
              <span className="gx-tile__sub">{fmtMoney(totales.perdidas.reduce((s, o) => s + (o.ingreso - o.costo_total), 0))}</span>
            </div>
          </div>

          {insights.map((i, n) => (
            <div key={n} className={`gx-banner gx-banner--${i.tono}`}>
              <span className="gx-banner__icono">{i.icono}</span>
              <div>{i.texto}</div>
            </div>
          ))}

          <section className="erp-panel">
            <div className="gx-cab">
              <div className="gx-chips">
                <button type="button" className={`gx-chip ${vista === 'cliente' ? 'is-on' : ''}`} onClick={() => setVista('cliente')}>
                  Por cliente
                </button>
                <button type="button" className={`gx-chip ${vista === 'sector' ? 'is-on' : ''}`} onClick={() => setVista('sector')}>
                  Por tipo de trabajo (sector)
                </button>
              </div>
              <label className="gx-mini">
                Ordenar por{' '}
                <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
                  <option value="margen">Ganancia ($)</option>
                  <option value="pct">Margen (%)</option>
                  <option value="ingreso">Facturación</option>
                </select>
              </label>
            </div>
            <div className="gx-tabla-wrap">
              <table className="gx-tabla">
                <thead>
                  <tr>
                    <th>{vista === 'cliente' ? 'Cliente' : 'Sector'}</th>
                    <th className="num">Trabajos</th>
                    <th>Facturado</th>
                    <th className="num">Costo</th>
                    <th className="num">Ganancia</th>
                    <th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.slice(0, 200).map((g) => (
                    <tr key={g.clave}>
                      <td>
                        <strong>{g.clave}</strong>
                        {g.perdidas > 0 && <div className="gx-mini gx-neg">{g.perdidas} a pérdida</div>}
                      </td>
                      <td className="num">{g.ops}</td>
                      <td className="gx-hbar-wrap">
                        <div className="gx-mini">{fmtCorto(g.ingreso)}</div>
                        <div className="gx-hbar" style={{ width: `${(g.ingreso / maxIngreso) * 100}%` }} />
                      </td>
                      <td className="num">{fmtMoney(g.costo)}</td>
                      <td className={`num ${g.margen < 0 ? 'gx-neg' : ''}`}>
                        <strong>{fmtMoney(g.margen)}</strong>
                      </td>
                      <td>
                        <span className={`gx-pill gx-pill--${tonoMargen(g.pct)}`}>{g.pct === null ? '—' : `${g.pct.toFixed(1)}%`}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {totales.perdidas.length > 0 && (
            <section className="erp-panel">
              <div className="gx-cab">
                <h2>Trabajos a pérdida</h2>
                <span className="gx-mini">El costo cargado supera lo facturado</span>
              </div>
              <table className="gx-tabla">
                <thead>
                  <tr>
                    <th>OP</th>
                    <th>Cliente</th>
                    <th>Sector</th>
                    <th className="num">Facturado</th>
                    <th className="num">Costo</th>
                    <th className="num">Pérdida</th>
                  </tr>
                </thead>
                <tbody>
                  {[...totales.perdidas]
                    .sort((a, b) => a.ingreso - a.costo_total - (b.ingreso - b.costo_total))
                    .slice(0, 30)
                    .map((o) => (
                      <tr key={o.id_op}>
                        <td>
                          <strong>{o.numero_op}</strong>
                        </td>
                        <td>{o.cliente}</td>
                        <td>{o.sector || '—'}</td>
                        <td className="num">{fmtMoney(o.ingreso)}</td>
                        <td className="num">{fmtMoney(o.costo_total)}</td>
                        <td className="num gx-neg">{fmtMoney(o.ingreso - o.costo_total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}
          <p className="gx-mini">Sólo entran las OP con costos cargados y con ingreso (venta o factura). El período se toma por la fecha del último costo cargado.</p>
        </>
      )}
    </div>
  )
}
