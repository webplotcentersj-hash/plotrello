import { PLANILLA_LINEA_COLUMNAS } from '../parsePlanillaCajaPdf'
import { totalPorClasificacion } from '../planillaMediosPago'
import { fmtArs } from '../format'
import type { PlanillaMontosLinea } from '../parsePlanillaCajaPdf'

type Snapshot = {
  periodo?: { desde?: string; hasta?: string }
  caja_slug?: string
  ingresos?: PlanillaMontosLinea
  egresos?: PlanillaMontosLinea
  neto?: PlanillaMontosLinea
  generado_en?: string
  movimientos_vinculados?: number
}

type Props = {
  snapshot: Record<string, unknown>
}

function filaMontos(label: string, m?: PlanillaMontosLinea) {
  if (!m) return null
  const clasif = totalPorClasificacion(m)
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        <span className="caja-cc-field-hint">
          {' '}
          · fís. $ {fmtArs(clasif.fisico)} · electr. $ {fmtArs(clasif.electronico)}
        </span>
      </td>
      {PLANILLA_LINEA_COLUMNAS.map((col) => (
        <td key={col.key} className="num">
          $ {fmtArs(m[col.key] ?? 0)}
        </td>
      ))}
    </tr>
  )
}

export default function CajaCierreSnapshotPanel({ snapshot }: Props) {
  const s = snapshot as Snapshot
  const periodo = s.periodo

  return (
    <div className="caja-cc-card caja-cc-snapshot">
      <h3>Snapshot al cerrar</h3>
      {periodo && (
        <p className="caja-cc-sub">
          Período {periodo.desde}
          {periodo.hasta && periodo.hasta !== periodo.desde ? ` → ${periodo.hasta}` : ''}
          {s.movimientos_vinculados != null && (
            <> · {s.movimientos_vinculados} movimiento(s) vinculados</>
          )}
          {s.generado_en && (
            <span className="caja-cc-field-hint"> · {new Date(s.generado_en).toLocaleString('es-AR')}</span>
          )}
        </p>
      )}
      <div className="caja-cc-table-wrap">
        <table className="caja-cc-table caja-cc-table-compact">
          <thead>
            <tr>
              <th>Bloque</th>
              {PLANILLA_LINEA_COLUMNAS.map((c) => (
                <th key={c.key} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filaMontos('Ingresos', s.ingresos)}
            {filaMontos('Egresos', s.egresos)}
            {filaMontos('Neto', s.neto)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
