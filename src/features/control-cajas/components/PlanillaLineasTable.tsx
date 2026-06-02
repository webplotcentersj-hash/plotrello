import { PLANILLA_LINEA_COLUMNAS, type PlanillaLineaConMontos } from '../parsePlanillaCajaPdf'
import { fmtArs } from '../format'

type Linea = PlanillaLineaConMontos

type Props = {
  title: string
  lineas: Linea[]
  /** Máximo de filas; `null` = mostrar todas las líneas del PDF. */
  maxRows?: number | null
  /** Filtra por comprobante o concepto (insensible a mayúsculas). */
  searchQuery?: string
}

export default function PlanillaLineasTable({ title, lineas, maxRows = null, searchQuery = '' }: Props) {
  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? lineas.filter(
        (row) =>
          row.comprobante.toLowerCase().includes(q) || row.concepto.toLowerCase().includes(q)
      )
    : lineas
  if (!lineas.length) return null
  if (!filtered.length) return null
  const shown = maxRows == null ? filtered : filtered.slice(0, maxRows)
  const rest = filtered.length - shown.length

  return (
    <div className="caja-cc-planilla-lineas">
      <h4>
        {title}{' '}
        <span className="caja-cc-tag">
          ({q ? `${filtered.length}/${lineas.length}` : lineas.length})
        </span>
      </h4>
      <div className="caja-cc-table-scroll">
        <table className="caja-cc-table caja-cc-table-compact caja-cc-planilla-lineas-table">
          <thead>
            <tr>
              <th>Comprobante</th>
              <th>Concepto</th>
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <th key={c.key} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={`${row.comprobante}-${i}`}
                className={'cuadre_valido' in row && !row.cuadre_valido ? 'caja-cc-row-cuadre-bad' : undefined}
                title={
                  'cuadre_valido' in row && !row.cuadre_valido
                    ? `Total ≠ medios (Δ ${row.cuadre_diferencia})`
                    : undefined
                }
              >
                <td className="caja-cc-cell-comp">{row.comprobante}</td>
                <td className="caja-cc-cell-concept" title={row.concepto}>
                  {row.concepto}
                </td>
                {PLANILLA_LINEA_COLUMNAS.map((c) => (
                  <td key={c.key} className="num">
                    {row[c.key] ? fmtArs(row[c.key]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rest > 0 && (
        <p className="caja-cc-help">… y {rest} línea(s) más en el PDF (se guardan todas en la planilla).</p>
      )}
    </div>
  )
}
