import { PLANILLA_LINEA_COLUMNAS, type PlanillaMontosLinea } from '../parsePlanillaCajaPdf'
import { fmtArs } from '../format'

type Props = {
  ingresos: PlanillaMontosLinea
  egresos: PlanillaMontosLinea
  neto: PlanillaMontosLinea
}

export default function PlanillaMediosResumen({ ingresos, egresos, neto }: Props) {
  return (
    <div className="caja-cc-planilla-medios-resumen">
      <h4>Totales por medio de pago (todo el PDF)</h4>
      <div className="caja-cc-table-scroll">
        <table className="caja-cc-table caja-cc-table-compact">
          <thead>
            <tr>
              <th />
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <th key={c.key} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ingresos</td>
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <td key={c.key} className="num">
                  {ingresos[c.key] ? fmtArs(ingresos[c.key]) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Egresos</td>
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <td key={c.key} className="num">
                  {egresos[c.key] ? fmtArs(egresos[c.key]) : '—'}
                </td>
              ))}
            </tr>
            <tr className="caja-cc-row-total">
              <td>
                <strong>Neto</strong>
              </td>
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <td key={c.key} className="num">
                  <strong>{neto[c.key] ? fmtArs(neto[c.key]) : '—'}</strong>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
