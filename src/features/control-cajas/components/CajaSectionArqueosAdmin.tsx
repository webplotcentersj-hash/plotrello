import { useEffect, useMemo, useState } from 'react'
import { deleteArqueo, getParams, listArqueos, listCajas, mismoCajaSlug } from '../cajaRepository'
import { resolveUsuarioCajaEtiqueta } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS, TURNOS_CAJA } from '../constants'
import { fmtArs, fmtDateAr } from '../format'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'
import type { CajaArqueo, CajaCajera, CajaRegistro } from '../types'
import { downloadArqueoPdf } from '../exportArqueoPdf'
import CajaArqueoDetalleModal from './CajaArqueoDetalleModal'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'
import CajaVolverPlotLab from './CajaVolverPlotLab'

export default function CajaSectionArqueosAdmin() {
  const [arqueos, setArqueos] = useState<CajaArqueo[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [detalle, setDetalle] = useState<CajaArqueo | null>(null)
  const [cajeras, setCajeras] = useState<CajaCajera[]>(DEFAULT_CAJERAS)
  const [listSearch, setListSearch] = useState('')
  const [filtCaja, setFiltCaja] = useState('')
  const [filtTurno, setFiltTurno] = useState('')
  const [filtCajera, setFiltCajera] = useState('')
  const [filtDesde, setFiltDesde] = useState('')
  const [filtHasta, setFiltHasta] = useState('')
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE)

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

  const cajerasEnLista = useMemo(() => {
    const labels = arqueos.map((a) => cajeraLabel(a)).filter(Boolean)
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b, 'es'))
  }, [arqueos, cajeras])

  const arqueosFiltrados = useMemo(() => {
    return arqueos.filter((a) => {
      if (filtCaja && !mismoCajaSlug(a.caja_slug, filtCaja)) return false
      if (filtTurno && a.turno !== filtTurno) return false
      if (filtCajera && cajeraLabel(a) !== filtCajera) return false
      if (filtDesde && a.fecha < filtDesde) return false
      if (filtHasta && a.fecha > filtHasta) return false
      return matchSearchQuery(listSearch, [
        a.fecha,
        fmtDateAr(a.fecha),
        cajaNombre(a.caja_slug),
        a.caja_slug,
        a.turno,
        cajeraLabel(a),
        a.usuario_nombre,
        fmtArs(a.total)
      ])
    })
  }, [arqueos, listSearch, filtCaja, filtTurno, filtCajera, filtDesde, filtHasta, cajas, cajeras])

  const arqueosVisibles = arqueosFiltrados.slice(0, listLimit)

  const hayFiltrosActivos =
    Boolean(listSearch || filtCaja || filtTurno || filtCajera || filtDesde || filtHasta)

  const listaToolbar = (
    <div className="caja-cc-card-toolbar caja-cc-card-toolbar--stack">
      <CajaListSearch
        value={listSearch}
        onChange={(v) => {
          setListSearch(v)
          setListLimit(LIST_PAGE_SIZE)
        }}
        placeholder="Buscar fecha, caja, cajera, turno, monto…"
      />
      <div className="caja-cc-filters-row">
        <label className="caja-cc-filter-chip">
          <span>Caja</span>
          <select
            value={filtCaja}
            onChange={(e) => {
              setFiltCaja(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todas</option>
            {cajas.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Turno</span>
          <select
            value={filtTurno}
            onChange={(e) => {
              setFiltTurno(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todos</option>
            {TURNOS_CAJA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Cajera</span>
          <select
            value={filtCajera}
            onChange={(e) => {
              setFiltCajera(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todas</option>
            {cajerasEnLista.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Desde</span>
          <input
            type="date"
            value={filtDesde}
            onChange={(e) => {
              setFiltDesde(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        <label className="caja-cc-filter-chip">
          <span>Hasta</span>
          <input
            type="date"
            value={filtHasta}
            onChange={(e) => {
              setFiltHasta(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        {hayFiltrosActivos && (
          <button
            type="button"
            className="btn-tiny"
            onClick={() => {
              setListSearch('')
              setFiltCaja('')
              setFiltTurno('')
              setFiltCajera('')
              setFiltDesde('')
              setFiltHasta('')
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>

      <CajaCollapsibleCard
        title="Arqueos firmados por cajeras"
        count={arqueosFiltrados.length}
        defaultOpen={arqueos.length > 0 && arqueos.length <= 8}
        toolbar={listaToolbar}
        bodyClassName="caja-cc-card-body-scroll"
      >
        <p className="caja-cc-help">
          Hacé clic en una fila o en Ver para el detalle completo y descargar PDF.
        </p>
        {arqueosVisibles.length === 0 ? (
          <p className="caja-cc-empty">
            {hayFiltrosActivos ? 'Sin coincidencias con los filtros.' : 'Las cajeras todavía no cargaron arqueos.'}
          </p>
        ) : (
          <>
            <div className="caja-cc-table-scroll">
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
                  {arqueosVisibles.map((a) => (
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
            </div>
            {arqueosFiltrados.length > listLimit && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setListLimit((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({arqueosFiltrados.length - listLimit} restantes)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>

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
