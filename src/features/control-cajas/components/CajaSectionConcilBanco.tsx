import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { fmtArs, fmtDateAr } from '../format'
import {
  cierresEnFecha,
  getParams,
  listCierres,
  listConcilBanco,
  saveConcilBanco
} from '../cajaRepository'
import CajaBadge from './CajaBadge'
import type { CajaCierreEstado } from '../types'

export default function CajaSectionConcilBanco() {
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof listConcilBanco>>>([])
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [extracto, setExtracto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [tolerancia, setTolerancia] = useState(0)

  useEffect(() => {
    void Promise.all([listConcilBanco(), listCierres(), getParams()]).then(([h, c, p]) => {
      setHistorial(h)
      setCierres(c)
      setTolerancia(p.tolerancia)
    })
  }, [])

  const sistema = useMemo(() => {
    return cierresEnFecha(cierres, fecha).reduce((s, c) => s + c.trans, 0)
  }, [cierres, fecha])

  const extNum = parseFloat(extracto) || 0
  const dif = extNum - sistema
  const estado: CajaCierreEstado = Math.abs(dif) <= tolerancia ? 'OK' : 'REVISAR'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveConcilBanco({ fecha, sistema, extracto: extNum, diferencia: dif, estado, observacion })
    setExtracto('')
    setObservacion('')
    setHistorial(await listConcilBanco())
  }

  return (
    <>
      <p className="caja-cc-sub">Transferencias del sistema vs extracto bancario.</p>
      <form className="caja-cc-card" onSubmit={(e) => void guardar(e)}>
        <h3>Nueva conciliación bancaria</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Sistema (cierres) <span className="caja-cc-tag auto">auto</span>
            <input readOnly value={`$ ${fmtArs(sistema)}`} />
          </label>
          <label className="caja-cc-field">
            Extracto banco <span className="caja-cc-tag input">homebanking</span>
            <input type="number" step="0.01" value={extracto} onChange={(e) => setExtracto(e.target.value)} required />
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
          <button type="submit" className="btn-primary">
            Guardar conciliación
          </button>
        </div>
      </form>
      <div className="caja-cc-card">
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <p className="caja-cc-empty">Sin conciliaciones</p>
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
