import { useEffect, useMemo, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { listCajas, listCierres, listDiferencias } from '../cajaRepository'
import type { CajaDiferencia, CajaRegistro } from '../types'

export default function CajaSectionDiferencias() {
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [manual, setManual] = useState<CajaDiferencia[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])

  useEffect(() => {
    void Promise.all([listCierres(), listDiferencias(), listCajas()]).then(([c, d, ca]) => {
      setCierres(c)
      setManual(d)
      setCajas(ca)
    })
  }, [])

  const cajaNombre = (slug?: string | null) =>
    slug ? cajas.find((c) => c.slug === slug)?.nombre ?? slug : '—'

  const todos = useMemo(() => {
    const auto = cierres
      .filter((c) => c.estado === 'REVISAR')
      .map(
        (c): CajaDiferencia => ({
          id: `auto_${c.id}`,
          fecha: c.fecha,
          caja_slug: c.caja_slug,
          tipo: (c.dif_total ?? 0) > 0 ? 'Sobrante' : 'Faltante',
          monto: Math.abs(c.dif_total ?? 0),
          motivo: 'Cierre con diferencia',
          responsable: c.cajera,
          estado: 'Pendiente',
          auto_desde_cierre: true
        })
      )
    return [...auto, ...manual].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [cierres, manual])

  return (
    <>
      <p className="caja-cc-sub">Faltantes y sobrantes con seguimiento hasta resolución.</p>
      <div className="caja-cc-card">
        {todos.length === 0 ? (
          <p className="caja-cc-empty">Ninguna diferencia pendiente. Todo cuadra.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Tipo</th>
                <th className="num">Monto</th>
                <th>Motivo</th>
                <th>Responsable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((d) => (
                <tr key={d.id}>
                  <td>{fmtDateAr(d.fecha)}</td>
                  <td>{cajaNombre(d.caja_slug)}</td>
                  <td>{d.tipo}</td>
                  <td className="num">$ {fmtArs(d.monto)}</td>
                  <td>{d.motivo || '—'}</td>
                  <td>{d.responsable || '—'}</td>
                  <td>
                    <span className={`caja-cc-badge ${d.estado === 'Resuelto' ? 'ok' : 'pen'}`}>
                      {d.estado}
                    </span>
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
