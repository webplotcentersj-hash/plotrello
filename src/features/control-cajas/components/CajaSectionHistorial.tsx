import { useEffect, useMemo, useState } from 'react'
import { listArqueos, listCajas, listMovimientos } from '../cajaRepository'
import { fmtArs, fmtDateAr, montoVisibleMovimiento } from '../format'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'
import type { CajaArqueo, CajaMovimiento, CajaRegistro } from '../types'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'

type Props = { usuarioNombre: string; usuarioId?: number }

export default function CajaSectionHistorial({ usuarioNombre, usuarioId }: Props) {
  const [arqueos, setArqueos] = useState<CajaArqueo[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [qArqueos, setQArqueos] = useState('')
  const [qMovs, setQMovs] = useState('')
  const [limitArq, setLimitArq] = useState(LIST_PAGE_SIZE)
  const [limitMov, setLimitMov] = useState(LIST_PAGE_SIZE)

  useEffect(() => {
    void Promise.all([
      listArqueos({ usuario: usuarioNombre, usuarioId }),
      listMovimientos({ usuario: usuarioNombre, usuarioId }),
      listCajas()
    ]).then(([a, m, c]) => {
      setArqueos(a)
      setMovimientos(m)
      setCajas(c)
    })
  }, [usuarioNombre, usuarioId])

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const arqueosFiltrados = useMemo(() => {
    return arqueos.filter((a) =>
      matchSearchQuery(qArqueos, [a.fecha, cajaNombre(a.caja_slug), fmtArs(a.total)])
    )
  }, [arqueos, qArqueos, cajas])

  const movsFiltrados = useMemo(() => {
    return movimientos.filter((m) =>
      matchSearchQuery(qMovs, [
        m.fecha,
        m.concepto,
        m.observacion,
        cajaNombre(m.origen_slug),
        cajaNombre(m.destino_slug),
        fmtArs(montoVisibleMovimiento(m))
      ])
    )
  }, [movimientos, qMovs, cajas])

  const arqueosVisibles = arqueosFiltrados.slice(0, limitArq)
  const movsVisibles = movsFiltrados.slice(0, limitMov)

  const toolbarArqueos = (
    <div className="caja-cc-card-toolbar">
      <CajaListSearch value={qArqueos} onChange={setQArqueos} placeholder="Buscar arqueo, caja, monto…" />
    </div>
  )

  const toolbarMovs = (
    <div className="caja-cc-card-toolbar">
      <CajaListSearch value={qMovs} onChange={setQMovs} placeholder="Buscar concepto, caja, monto…" />
    </div>
  )

  return (
    <div className="caja-cc-grid-2 caja-cc-historial-grid">
      <CajaCollapsibleCard
        title="Últimos arqueos"
        count={arqueosFiltrados.length}
        toolbar={toolbarArqueos}
        bodyClassName="caja-cc-card-body-scroll"
      >
        {arqueosVisibles.length === 0 ? (
          <p className="caja-cc-empty">{qArqueos ? 'Sin coincidencias.' : 'Sin arqueos'}</p>
        ) : (
          <>
            <div className="caja-cc-table-scroll">
              <table className="caja-cc-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Caja</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {arqueosVisibles.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDateAr(a.fecha)}</td>
                      <td>{cajaNombre(a.caja_slug)}</td>
                      <td className="num">$ {fmtArs(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {arqueosFiltrados.length > limitArq && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setLimitArq((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({arqueosFiltrados.length - limitArq} restantes)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>

      <CajaCollapsibleCard
        title="Últimos movimientos"
        count={movsFiltrados.length}
        toolbar={toolbarMovs}
        bodyClassName="caja-cc-card-body-scroll"
      >
        {movsVisibles.length === 0 ? (
          <p className="caja-cc-empty">{qMovs ? 'Sin coincidencias.' : 'Sin movimientos'}</p>
        ) : (
          <>
            <div className="caja-cc-table-scroll">
              <table className="caja-cc-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {movsVisibles.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtDateAr(m.fecha)}</td>
                      <td>{m.concepto}</td>
                      <td className="num">$ {fmtArs(montoVisibleMovimiento(m))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {movsFiltrados.length > limitMov && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setLimitMov((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({movsFiltrados.length - limitMov} restantes)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>
    </div>
  )
}

export { default as CajaSectionArqueosAdmin } from './CajaSectionArqueosAdmin'
