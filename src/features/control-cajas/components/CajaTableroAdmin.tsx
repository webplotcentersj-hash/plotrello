import { useEffect, useMemo, useState } from 'react'
import { kpisTableroMes, mesArgentina } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import { LIST_PAGE_SIZE } from '../listFilters'
import {
  listArqueos,
  listCajas,
  listCierres,
  listConcilBanco,
  listConcilMP,
  listMovimientos,
  listPlanillas
} from '../cajaRepository'
import CajaCollapsibleCard from './CajaCollapsibleCard'
import CajaMovimientosList from './CajaMovimientosList'
import CajaBadge from './CajaBadge'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { CajaCierre, CajaMovimiento, CajaRegistro } from '../types'

type Props = {
  onNuevoCierre: () => void
  onVerCierres: () => void
}

export default function CajaTableroAdmin({ onNuevoCierre, onVerCierres }: Props) {
  const [cierres, setCierres] = useState<CajaCierre[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [arqueos, setArqueos] = useState<Awaited<ReturnType<typeof listArqueos>>>([])
  const [concilMp, setConcilMp] = useState<Awaited<ReturnType<typeof listConcilMP>>>([])
  const [concilBanco, setConcilBanco] = useState<Awaited<ReturnType<typeof listConcilBanco>>>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])

  useEffect(() => {
    void Promise.all([
      listCierres(),
      listMovimientos(),
      listPlanillas(200),
      listArqueos(),
      listConcilMP(),
      listConcilBanco(),
      listCajas()
    ]).then(([c, m, p, a, mp, b, ca]) => {
      setCierres(c)
      setMovimientos(m)
      setPlanillas(p)
      setArqueos(a)
      setConcilMp(mp)
      setConcilBanco(b)
      setCajas(ca)
    })
  }, [])

  const mes = mesArgentina()
  const kpis = useMemo(
    () => kpisTableroMes(mes, cierres, planillas, arqueos, concilMp, concilBanco),
    [mes, cierres, planillas, arqueos, concilMp, concilBanco]
  )

  const ultimos = cierres.slice(0, 6)
  const movsRecientes = movimientos.slice(0, LIST_PAGE_SIZE)
  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const mesLabel = new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires'
  })

  const fuenteVentas = kpis.tienePlanillas
    ? `${kpis.planillasMes} planilla(s) del mes`
    : kpis.tieneCierres
      ? `${kpis.cierresMes} cierre(s) del mes`
      : 'sin planillas ni cierres'

  return (
    <>
      <div className="caja-cc-page-head">
        <div>
          <h2>Tablero</h2>
          <p>Resumen del mes en curso ({mesLabel})</p>
        </div>
        <div className="caja-cc-page-actions">
          <CajaVolverPlotLab small />
          <button type="button" className="btn-primary" onClick={onNuevoCierre}>
            Nuevo cierre
          </button>
        </div>
      </div>

      <div className="caja-cc-metrics">
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Cierres / planillas</span>
          <span className="caja-cc-metric-v">
            {kpis.cierresMes}
            {kpis.planillasMes > 0 ? ` · ${kpis.planillasMes} PDF` : ''}
          </span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">OK</span>
          <span className="caja-cc-metric-v ok">{kpis.ok}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">A revisar</span>
          <span className="caja-cc-metric-v bad">{kpis.revisar}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Diferencia neta</span>
          <span className="caja-cc-metric-v">$ {fmtArs(kpis.difNeta)}</span>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Ventas del mes</h3>
        <p className="caja-cc-ventas-mes">$ {fmtArs(kpis.ventasMes)}</p>
        <p className="caja-cc-sub">Fuente: {fuenteVentas}</p>
      </div>

      <div className="caja-cc-grid-2">
        <CajaCollapsibleCard
          title="Últimos cierres"
          count={cierres.length}
          defaultOpen={ultimos.length > 0 && ultimos.length <= 6}
        >
          <div className="caja-cc-card-head-row">
            <button type="button" className="btn-link" onClick={onVerCierres}>
              Ver todos →
            </button>
          </div>
          {ultimos.length === 0 ? (
            <p className="caja-cc-empty">
              Sin cierres. Las ventas del mes pueden venir de {planillas.length} planilla(s) importada(s).
            </p>
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
        </CajaCollapsibleCard>

        <CajaCollapsibleCard
          title="Últimos movimientos"
          count={movimientos.length}
          defaultOpen={false}
          bodyClassName="caja-cc-card-body-scroll"
        >
          {movsRecientes.length === 0 ? (
            <p className="caja-cc-empty">Sin movimientos</p>
          ) : (
            <CajaMovimientosList movimientos={movsRecientes} cajas={cajas} showUsuario />
          )}
        </CajaCollapsibleCard>
      </div>
    </>
  )
}
