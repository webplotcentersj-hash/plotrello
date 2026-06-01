import { PLANILLA_LINEA_COLUMNAS, type PlanillaMontosLinea } from '../parsePlanillaCajaPdf'
import { fmtArs } from '../format'

type Linea = PlanillaMontosLinea & {
  comprobante: string
  concepto: string
}

type Props = {
  title: string
  lineas: Linea[]
  maxRows?: number
}

export default function PlanillaLineasTable({ title, lineas, maxRows = 25 }: Props) {
  if (!lineas.length) return null
  const shown = lineas.slice(0, maxRows)
  const rest = lineas.length - shown.length

  return (
    <div className="caja-cc-planilla-lineas">
      <h4>
        {title} <span className="caja-cc-tag">({lineas.length})</span>
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
              <tr key={`${row.comprobante}-${i}`}>
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
