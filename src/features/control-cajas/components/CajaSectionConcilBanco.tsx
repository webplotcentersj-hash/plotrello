import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { labelFuenteSistema, sistemaBancoParaFecha } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import {
  getParams,
  listCierres,
  listConcilBanco,
  listMovimientos,
  listPlanillas,
  saveConcilBanco
} from '../cajaRepository'
import CajaBadge from './CajaBadge'
import CajaMiniPlotAI from './CajaMiniPlotAI'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { CajaCierreEstado } from '../types'

export default function CajaSectionConcilBanco() {
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof listConcilBanco>>>([])
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [extracto, setExtracto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [tolerancia, setTolerancia] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => {
    void Promise.all([
      listConcilBanco(),
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
    () => sistemaBancoParaFecha(fecha, cierres, planillas, movimientos),
    [fecha, cierres, planillas, movimientos]
  )

  const extNum = parseFloat(extracto) || 0
  const dif = extNum - sistemaInfo.valor
  const estado: CajaCierreEstado = Math.abs(dif) <= tolerancia ? 'OK' : 'REVISAR'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!extracto.trim()) {
      setMsg('Ingresá el monto del extracto bancario.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await saveConcilBanco({
        fecha,
        sistema: sistemaInfo.valor,
        extracto: extNum,
        diferencia: dif,
        estado,
        observacion: observacion.trim() || undefined
      })
      setExtracto('')
      setObservacion('')
      setMsg('Conciliación bancaria guardada.')
      reload()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const ctxAi = `Conciliación banco — fecha ${fecha}.
Sistema (${labelFuenteSistema(sistemaInfo.fuente)}): $${fmtArs(sistemaInfo.valor)}.
Extracto: $${fmtArs(extNum)}. Diferencia: $${fmtArs(dif)}. Estado: ${estado}.`

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <p className="caja-cc-sub">
        Transferencias del sistema vs extracto bancario. El sistema usa cierres, planillas, ventas PlotLab o
        movimientos del día.
      </p>

      {msg && (
        <p className={msg.includes('Error') || msg.includes('Ingres') ? 'caja-cc-error' : 'caja-cc-ok'}>{msg}</p>
      )}

      <form className="caja-cc-card" onSubmit={(e) => void guardar(e)}>
        <h3>Nueva conciliación bancaria</h3>
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
            Extracto banco <span className="caja-cc-tag input">homebanking</span>
            <input
              type="number"
              step="0.01"
              value={extracto}
              onChange={(e) => setExtracto(e.target.value)}
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
        titulo="PlotAI — conciliar banco"
        contexto={ctxAi}
        preguntaDefault="¿Cómo concilio transferencias del día con el extracto y la planilla?"
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
                <th className="num">Extracto</th>
                <th className="num">Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateAr(r.fecha)}</td>
                  <td className="num">$ {fmtArs(r.sistema)}</td>
                  <td className="num">$ {fmtArs(r.extracto)}</td>
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
