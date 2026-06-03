import { useEffect, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { deleteCierre, listCajas, listCierres } from '../cajaRepository'
import CajaBadge from './CajaBadge'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { CajaCierre, CajaRegistro } from '../types'

type Props = {
  onNuevo: () => void
  onEditar: (id: string) => void
}

export default function CajaSectionCierresList({ onNuevo, onEditar }: Props) {
  const [cierres, setCierres] = useState<CajaCierre[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])

  const reload = () => {
    void Promise.all([listCierres(), listCajas()]).then(([c, ca]) => {
      setCierres(c)
      setCajas(ca)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  return (
    <>
      <div className="caja-cc-page-head">
        <div>
          <h2>Cierres</h2>
          <p>Historial de cierres de caja</p>
        </div>
        <div className="caja-cc-page-actions">
          <CajaVolverPlotLab small />
          <button type="button" className="btn-primary" onClick={onNuevo}>
            Nuevo cierre
          </button>
        </div>
      </div>
      <div className="caja-cc-card">
        {cierres.length === 0 ? (
          <p className="caja-cc-empty">Sin cierres cargados. Empezá con el cierre de hoy.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Cajera</th>
                <th className="num">Total ventas</th>
                <th className="num">Diferencia</th>
                <th>Cuadre</th>
                <th>Cierre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id}>
                  <td>{fmtDateAr(c.fecha)}</td>
                  <td>{cajaNombre(c.caja_slug)}</td>
                  <td>{c.cajera || '—'}</td>
                  <td className="num">$ {fmtArs(c.total_ventas)}</td>
                  <td className="num">{c.dif_total ? fmtArs(c.dif_total) : '—'}</td>
                  <td>
                    <CajaBadge estado={c.estado} />
                  </td>
                  <td>
                    <span className={`caja-cc-tag ${c.estado_cierre === 'cerrado' ? 'ok' : c.estado_cierre === 'observado' ? 'warn' : ''}`}>
                      {c.estado_cierre === 'cerrado'
                        ? 'Cerrado'
                        : c.estado_cierre === 'observado'
                          ? 'Observado'
                          : 'Abierto'}
                    </span>
                  </td>
                  <td className="caja-cc-actions-cell">
                    <button type="button" className="btn-small" onClick={() => onEditar(c.id)}>
                      {c.estado_cierre === 'cerrado' || c.estado_cierre === 'observado' ? 'Ver' : 'Editar'}
                    </button>
                    {(c.estado_cierre === 'abierto' || !c.estado_cierre) && (
                      <button
                        type="button"
                        className="btn-small danger"
                        onClick={() => {
                          if (confirm('¿Eliminar este cierre? Se desvincularán los movimientos.')) {
                            void deleteCierre(c.id).then(reload)
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    )}
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
