import { useEffect, useMemo, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { listCierres } from '../cajaRepository'

export default function CajaSectionVentasDiarias() {
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])

  useEffect(() => {
    void listCierres().then(setCierres)
  }, [])

  const byDate = useMemo(() => {
    const m: Record<string, { ef: number; tj: number; mp: number; tr: number; cc: number; tot: number }> =
      {}
    for (const c of cierres) {
      if (!m[c.fecha]) m[c.fecha] = { ef: 0, tj: 0, mp: 0, tr: 0, cc: 0, tot: 0 }
      m[c.fecha].ef += c.ing_ef
      m[c.fecha].tj += c.tarj_sist
      m[c.fecha].mp += c.mp_qr
      m[c.fecha].tr += c.trans
      m[c.fecha].cc += c.cta_cte
      m[c.fecha].tot += c.total_ventas
    }
    return m
  }, [cierres])

  const days = useMemo(() => Object.keys(byDate).sort().reverse(), [byDate])

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

  return (
    <>
      <p className="caja-cc-sub">Vista agregada por día. Suma de todas las cajas, por canal.</p>
      <div className="caja-cc-card">
        {days.length === 0 ? (
          <p className="caja-cc-empty">Sin datos. Cargá cierres para ver ventas diarias.</p>
        ) : (
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
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const x = byDate[d]
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
                  </tr>
                )
              })}
              <tr className="caja-cc-row-totals">
                <td>TOTAL</td>
                <td className="num">{fmtArs(totals.ef)}</td>
                <td className="num">{fmtArs(totals.tj)}</td>
                <td className="num">{fmtArs(totals.mp)}</td>
                <td className="num">{fmtArs(totals.tr)}</td>
                <td className="num">{fmtArs(totals.cc)}</td>
                <td className="num">{fmtArs(totals.tot)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
