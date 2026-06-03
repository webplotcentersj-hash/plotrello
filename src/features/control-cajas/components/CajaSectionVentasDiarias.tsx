import { useEffect, useMemo, useState } from 'react'
import { ventasDiariasAgregadas } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'
import { listCierres, listPlanillas } from '../cajaRepository'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'
import CajaVolverPlotLab from './CajaVolverPlotLab'

export default function CajaSectionVentasDiarias() {
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(LIST_PAGE_SIZE)

  useEffect(() => {
    void Promise.all([listCierres(), listPlanillas(200)]).then(([c, p]) => {
      setCierres(c)
      setPlanillas(p)
    })
  }, [])

  const byDate = useMemo(() => ventasDiariasAgregadas(cierres, planillas), [cierres, planillas])

  const days = useMemo(() => {
    const all = Object.keys(byDate).sort().reverse()
    return all.filter((d) =>
      matchSearchQuery(q, [d, fmtDateAr(d), fmtArs(byDate[d].tot), String(byDate[d].planillas)])
    )
  }, [byDate, q])

  const daysVisible = days.slice(0, limit)

  const totals = useMemo(
    () =>
      days.reduce(
        (acc, d) => {
          const x = byDate[d]
          acc.ef += x.ef
          acc.tj += x.tj
          acc.mp += x.mp
          acc.tr += x.tr
          acc.cc += x.cc
          acc.tot += x.tot
          return acc
        },
        { ef: 0, tj: 0, mp: 0, tr: 0, cc: 0, tot: 0 }
      ),
    [days, byDate]
  )

  const fuenteHint =
    planillas.length > 0
      ? `${planillas.length} planilla(s) importada(s) — ventas principales desde PDF.`
      : 'Importá planillas PDF en Mi arqueo o Movimientos para ver ventas por día.'

  const toolbar = (
    <div className="caja-cc-card-toolbar">
      <CajaListSearch value={q} onChange={(v) => { setQ(v); setLimit(LIST_PAGE_SIZE) }} placeholder="Buscar fecha o monto…" />
    </div>
  )

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <p className="caja-cc-sub">Vista agregada por día (todas las cajas). {fuenteHint}</p>

      <CajaCollapsibleCard
        title="Ventas diarias por canal"
        count={days.length}
        defaultOpen={days.length > 0 && days.length <= 12}
        toolbar={toolbar}
        bodyClassName="caja-cc-card-body-scroll"
      >
        {daysVisible.length === 0 ? (
          <p className="caja-cc-empty">
            {q ? 'Sin coincidencias.' : 'Sin datos. Importá planillas PDF o cargá cierres.'}
          </p>
        ) : (
          <>
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Efectivo</th>
                  <th className="num">Tarjetas</th>
                  <th className="num">QR MP</th>
                  <th className="num">Transfer.</th>
                  <th className="num">Cta. cte.</th>
                  <th className="num">TOTAL</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {daysVisible.map((d) => {
                  const x = byDate[d]
                  const fuente =
                    x.planillas > 0 ? `${x.planillas} planilla` : x.cierres > 0 ? `${x.cierres} cierre` : '—'
                  return (
                    <tr key={d}>
                      <td>{fmtDateAr(d)}</td>
                      <td className="num">{fmtArs(x.ef)}</td>
                      <td className="num">{fmtArs(x.tj)}</td>
                      <td className="num">{x.mp ? fmtArs(x.mp) : '—'}</td>
                      <td className="num">{fmtArs(x.tr)}</td>
                      <td className="num">{fmtArs(x.cc)}</td>
                      <td className="num">
                        <strong>{fmtArs(x.tot)}</strong>
                      </td>
                      <td className="caja-cc-fuente-cell">{fuente}</td>
                    </tr>
                  )
                })}
                <tr className="caja-cc-row-totals">
                  <td>TOTAL filtrado</td>
                  <td className="num">{fmtArs(totals.ef)}</td>
                  <td className="num">{fmtArs(totals.tj)}</td>
                  <td className="num">{fmtArs(totals.mp)}</td>
                  <td className="num">{fmtArs(totals.tr)}</td>
                  <td className="num">{fmtArs(totals.cc)}</td>
                  <td className="num">{fmtArs(totals.tot)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            {days.length > limit && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setLimit((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({days.length - limit} días)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>
    </>
  )
}
