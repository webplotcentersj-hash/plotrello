import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { labelFuenteSistema, sistemaMpParaFecha } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import {
  getParams,
  listCierres,
  listConcilMP,
  listMovimientos,
  listPlanillas,
  saveConcilMP
} from '../cajaRepository'
import CajaBadge from './CajaBadge'
import CajaMiniPlotAI from './CajaMiniPlotAI'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { CajaCierreEstado } from '../types'

export default function CajaSectionConcilMP() {
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof listConcilMP>>>([])
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [dashboard, setDashboard] = useState('')
  const [observacion, setObservacion] = useState('')
  const [tolerancia, setTolerancia] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => {
    void Promise.all([
      listConcilMP(),
      listCierres(),
      listPlanillas(200),
      listMovimientos(),
      getParams()
    ]).then(([h, c, p, m, par]) => {
      setHistorial(h)
      setCierres(c)
      setPlanillas(p)
      setMovimientos(m)
      setTolerancia(par.tolerancia)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const sistemaInfo = useMemo(
    () => sistemaMpParaFecha(fecha, cierres, planillas, movimientos),
    [fecha, cierres, planillas, movimientos]
  )

  const dashNum = parseFloat(dashboard) || 0
  const dif = dashNum - sistemaInfo.valor
  const estado: CajaCierreEstado = Math.abs(dif) <= tolerancia ? 'OK' : 'REVISAR'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dashboard.trim()) {
      setMsg('Ingresá el monto del dashboard de Mercado Pago.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await saveConcilMP({
        fecha,
        sistema: sistemaInfo.valor,
        dashboard: dashNum,
        diferencia: dif,
        estado,
        observacion: observacion.trim() || undefined
      })
      setDashboard('')
      setObservacion('')
      setMsg('Conciliación MP guardada.')
      reload()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const ctxAi = `Conciliación MP — fecha ${fecha}.
Sistema (${labelFuenteSistema(sistemaInfo.fuente)}): $${fmtArs(sistemaInfo.valor)}.
Dashboard ingresado: $${fmtArs(dashNum)}. Diferencia: $${fmtArs(dif)}. Estado: ${estado}.
Historial reciente: ${historial
    .slice(0, 5)
    .map((r) => `${r.fecha} sist $${fmtArs(r.sistema)} dash $${fmtArs(r.dashboard)}`)
    .join('; ') || 'vacío'}.`

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <p className="caja-cc-sub">
        Sistema vs dashboard de Mercado Pago, por día. El sistema se calcula desde cierres, planillas PDF,
        ventas PlotLab o movimientos importados.
      </p>

      {msg && (
        <p className={msg.includes('Error') || msg.includes('Ingres') ? 'caja-cc-error' : 'caja-cc-ok'}>{msg}</p>
      )}

      <form className="caja-cc-card" onSubmit={(e) => void guardar(e)}>
        <h3>Nueva conciliación MP</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Sistema <span className="caja-cc-tag auto">auto</span>
            <input readOnly value={`$ ${fmtArs(sistemaInfo.valor)}`} />
            <span className="caja-cc-help">{labelFuenteSistema(sistemaInfo.fuente)}</span>
          </label>
          <label className="caja-cc-field">
            Dashboard MP <span className="caja-cc-tag input">app MP</span>
            <input
              type="number"
              step="0.01"
              value={dashboard}
              onChange={(e) => setDashboard(e.target.value)}
              required
            />
          </label>
        </div>
        <div className={`caja-cc-result ${estado === 'OK' ? 'ok' : 'bad'}`}>
          <span>
            Diferencia · <CajaBadge estado={estado} />
          </span>
          <strong>$ {fmtArs(dif)}</strong>
        </div>
        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
        </label>
        <div className="caja-cc-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar conciliación'}
          </button>
        </div>
      </form>

      <CajaMiniPlotAI
        titulo="PlotAI — conciliar Mercado Pago"
        contexto={ctxAi}
        preguntaDefault="¿Cómo concilio MP con la planilla y qué revisar si hay diferencia?"
      />

      <div className="caja-cc-card">
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <p className="caja-cc-empty">Sin conciliaciones guardadas todavía.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Sistema</th>
                <th className="num">Dashboard</th>
                <th className="num">Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateAr(r.fecha)}</td>
                  <td className="num">$ {fmtArs(r.sistema)}</td>
                  <td className="num">$ {fmtArs(r.dashboard)}</td>
                  <td className="num">$ {fmtArs(r.diferencia)}</td>
                  <td>
                    <CajaBadge estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
