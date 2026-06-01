import { useEffect, useMemo, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { listCajas, listCierres, listMovimientos } from '../cajaRepository'
import CajaMovimientosList from './CajaMovimientosList'
import CajaBadge from './CajaBadge'
import type { CajaCierre, CajaMovimiento, CajaRegistro } from '../types'

type Props = {
  onNuevoCierre: () => void
  onVerCierres: () => void
}

export default function CajaTableroAdmin({ onNuevoCierre, onVerCierres }: Props) {
  const [cierres, setCierres] = useState<CajaCierre[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])

  useEffect(() => {
    void Promise.all([listCierres(), listMovimientos(), listCajas()]).then(([c, m, ca]) => {
      setCierres(c)
      setMovimientos(m.slice(0, 5))
      setCajas(ca)
    })
  }, [])

  const mes = new Date().toISOString().slice(0, 7)
  const kpis = useMemo(() => {
    const mc = cierres.filter((c) => c.fecha.startsWith(mes))
    const ok = mc.filter((c) => c.estado === 'OK').length
    const rev = mc.filter((c) => c.estado === 'REVISAR').length
    const dif = mc.reduce((s, c) => s + (c.dif_total || 0), 0)
    const ventasMes = mc.reduce((s, c) => s + (c.total_ventas || 0), 0)
    return { mc, ok, rev, dif, ventasMes }
  }, [cierres, mes])

  const ultimos = cierres.slice(0, 6)
  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  return (
    <>
      <div className="caja-cc-page-head">
        <div>
          <h2>Tablero</h2>
          <p>Resumen del mes en curso</p>
        </div>
        <button type="button" className="btn-primary" onClick={onNuevoCierre}>
          Nuevo cierre
        </button>
      </div>

      <div className="caja-cc-metrics">
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Cierres del mes</span>
          <span className="caja-cc-metric-v">{kpis.mc.length}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">OK</span>
          <span className="caja-cc-metric-v ok">{kpis.ok}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">A revisar</span>
          <span className="caja-cc-metric-v bad">{kpis.rev}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Diferencia neta</span>
          <span className="caja-cc-metric-v">$ {fmtArs(kpis.dif)}</span>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Ventas del mes (suma cierres)</h3>
        <p className="caja-cc-ventas-mes">$ {fmtArs(kpis.ventasMes)}</p>
        <p className="caja-cc-sub">
          {kpis.mc.length} cierre{kpis.mc.length !== 1 ? 's' : ''} en{' '}
          {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="caja-cc-grid-2">
        <div className="caja-cc-card">
          <div className="caja-cc-card-head-row">
            <h3>Últimos cierres</h3>
            <button type="button" className="btn-link" onClick={onVerCierres}>
              Ver todos →
            </button>
          </div>
          {ultimos.length === 0 ? (
            <p className="caja-cc-empty">Sin cierres todavía</p>
          ) : (
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Caja</th>
                  <th className="num">Dif.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDateAr(c.fecha)}</td>
                    <td>{cajaNombre(c.caja_slug)}</td>
                    <td className="num">{c.dif_total ? fmtArs(c.dif_total) : '—'}</td>
                    <td>
                      <CajaBadge estado={c.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="caja-cc-card">
          <h3>Últimos movimientos</h3>
          <CajaMovimientosList movimientos={movimientos} cajas={cajas} showUsuario />
        </div>
      </div>
    </>
  )
}
