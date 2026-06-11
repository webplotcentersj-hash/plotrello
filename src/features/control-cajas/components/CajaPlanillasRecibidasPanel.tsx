import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { getPlanillaById, listPlanillas } from '../cajaRepository'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { PlanillaCajaGuardada } from '../types'
import PlanillaDetalleView from './PlanillaDetalleView'

type Props = {
  /** Al abrir una planilla completa (p. ej. alimentar concordancia). */
  onPlanillaLoaded?: (planilla: PlanillaCajaParsed | null) => void
  titulo?: string
}

export default function CajaPlanillasRecibidasPanel({
  onPlanillaLoaded,
  titulo = 'Planillas PDF en el sistema'
}: Props) {
  const [planillas, setPlanillas] = useState<PlanillaCajaGuardada[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<PlanillaCajaParsed | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [search, setSearch] = useState('')

  const planillasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return planillas
    return planillas.filter((p) => {
      const blob = [
        p.archivo_nombre,
        p.caja_nombre,
        p.caja_slug,
        p.usuario_nombre,
        p.fecha_desde,
        p.fecha_hasta,
        String(p.resumen.cantidad_ventas),
        p.totales?.neto != null ? String(p.totales.neto) : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [planillas, search])

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listPlanillas(30)
    setPlanillas(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const abrir = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDetalle(null)
      onPlanillaLoaded?.(null)
      return
    }
    setSelectedId(id)
    setLoadingDetalle(true)
    try {
      const full = await getPlanillaById(id)
      setDetalle(full)
      onPlanillaLoaded?.(full)
    } finally {
      setLoadingDetalle(false)
    }
  }

  return (
    <div className="caja-cc-card caja-cc-planillas-recibidas">
      <div className="caja-cc-card-head-row caja-cc-planillas-head">
        <div className="caja-cc-planillas-head-text">
          <h3>{titulo}</h3>
          <p className="caja-cc-sub">
            Misma información que sube caja (PlotAI o local): ventas, egresos, MEC y medios de pago.
          </p>
        </div>
        <div className="caja-cc-planillas-toolbar">
          <label className="caja-cc-search">
            <span className="caja-cc-search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              className="caja-cc-search-input"
              placeholder="Buscar planilla, caja, usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar planillas"
            />
          </label>
          <button type="button" className="btn-tiny" onClick={() => void reload()} title="Actualizar lista">
            ↻
          </button>
        </div>
      </div>

      {loading ? (
        <p className="caja-cc-empty">Cargando planillas…</p>
      ) : planillas.length === 0 ? (
        <p className="caja-cc-empty">
          Todavía no hay planillas guardadas. La cajera las sube en Mi arqueo, o podés importar
          abajo.
        </p>
      ) : planillasFiltradas.length === 0 ? (
        <p className="caja-cc-empty">Ninguna planilla coincide con «{search.trim()}».</p>
      ) : (
        <div className="caja-cc-table-scroll caja-cc-planillas-table-wrap">
          <table className="caja-cc-table caja-cc-table-compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Archivo</th>
                <th className="num">Ventas</th>
                <th className="num">Neto</th>
                <th>Usuario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {planillasFiltradas.map((p) => (
                <tr key={p.id} className={selectedId === p.id ? 'caja-cc-row-selected' : undefined}>
                  <td>{fmtDateAr(p.fecha_hasta || p.fecha_desde)}</td>
                  <td>{p.caja_nombre || p.caja_slug || '—'}</td>
                  <td className="caja-cc-cell-concept" title={p.archivo_nombre}>
                    {p.archivo_nombre}
                  </td>
                  <td className="num">{p.resumen.cantidad_ventas}</td>
                  <td className="num">{p.totales?.neto != null ? fmtArs(p.totales.neto) : '—'}</td>
                  <td>{p.usuario_nombre || '—'}</td>
                  <td>
                    <button type="button" className="btn-link" onClick={() => void abrir(p.id)}>
                      {selectedId === p.id ? 'Ocultar' : 'Ver todo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && loadingDetalle && <p className="caja-cc-help">Cargando detalle completo…</p>}
      {selectedId && !loadingDetalle && detalle && <PlanillaDetalleView planilla={detalle} />}
      {selectedId && !loadingDetalle && !detalle && (
        <p className="caja-cc-error">
          No se pudo cargar el detalle. Volvé a importar el PDF para guardar los datos completos.
        </p>
      )}
    </div>
  )
}
