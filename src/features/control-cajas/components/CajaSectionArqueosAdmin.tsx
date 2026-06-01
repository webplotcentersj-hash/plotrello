import { useEffect, useState } from 'react'
import { deleteArqueo, getParams, listArqueos, listCajas } from '../cajaRepository'
import { resolveUsuarioCajaEtiqueta } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
import { fmtArs, fmtDateAr } from '../format'
import type { CajaArqueo, CajaCajera, CajaRegistro } from '../types'
import { downloadArqueoPdf } from '../exportArqueoPdf'
import CajaArqueoDetalleModal from './CajaArqueoDetalleModal'

export default function CajaSectionArqueosAdmin() {
  const [arqueos, setArqueos] = useState<CajaArqueo[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [detalle, setDetalle] = useState<CajaArqueo | null>(null)
  const [cajeras, setCajeras] = useState<CajaCajera[]>(DEFAULT_CAJERAS)

  const reload = () => {
    void Promise.all([listArqueos(), listCajas(), getParams()]).then(([a, c, p]) => {
      setArqueos(a)
      setCajas(c)
      setCajeras(p.cajeras?.length ? p.cajeras : DEFAULT_CAJERAS)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const cajeraLabel = (a: CajaArqueo) =>
    resolveUsuarioCajaEtiqueta(a.usuario_nombre ?? '', cajeras)

  return (
    <>
      <div className="caja-cc-card">
        <h3>Arqueos firmados por cajeras</h3>
        <p className="caja-cc-help">Hacé clic en una fila o en Ver para el detalle completo y descargar PDF.</p>
        {arqueos.length === 0 ? (
          <p className="caja-cc-empty">Las cajeras todavía no cargaron arqueos.</p>
        ) : (
          <table className="caja-cc-table caja-cc-table-clickable">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Turno</th>
                <th>Cajera</th>
                <th className="num">Total</th>
                <th>Firma</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {arqueos.map((a) => (
                <tr
                  key={a.id}
                  className="caja-cc-row-clickable"
                  onClick={() => setDetalle(a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetalle(a)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver arqueo ${fmtDateAr(a.fecha)} ${cajaNombre(a.caja_slug)}`}
                >
                  <td>{fmtDateAr(a.fecha)}</td>
                  <td>{cajaNombre(a.caja_slug)}</td>
                  <td>{a.turno}</td>
                  <td>{cajeraLabel(a)}</td>
                  <td className="num">$ {fmtArs(a.total)}</td>
                  <td>
                    {a.firma_data_url ? (
                      <img src={a.firma_data_url} alt="" className="caja-cc-firma-thumb" />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="caja-cc-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn-small" onClick={() => setDetalle(a)}>
                      Ver
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      title="Descargar PDF"
                      onClick={() =>
                        downloadArqueoPdf(a, cajaNombre(a.caja_slug), cajeraLabel(a))
                      }
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className="btn-small danger"
                      onClick={() => {
                        if (confirm('¿Eliminar arqueo?')) {
                          void deleteArqueo(a.id).then(() => {
                            if (detalle?.id === a.id) setDetalle(null)
                            reload()
                          })
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalle && (
        <CajaArqueoDetalleModal
          arqueo={detalle}
          cajaNombre={cajaNombre(detalle.caja_slug)}
          cajeraNombre={cajeraLabel(detalle)}
          onClose={() => setDetalle(null)}
          onDelete={() => {
            void deleteArqueo(detalle.id).then(() => {
              setDetalle(null)
              reload()
            })
          }}
        />
      )}
    </>
  )
}
