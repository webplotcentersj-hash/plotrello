import { TIPO_PLANILLA_LABEL, clasificarPlanillaPorContenido } from '../cajaCoherencia'
import { fmtDateAr } from '../format'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'

type Props = {
  planilla: PlanillaCajaParsed
}

export default function CajaPlanillaResumenActiva({ planilla }: Props) {
  const tipo = clasificarPlanillaPorContenido(planilla)
  const lineas =
    planilla.ventas.length +
    planilla.ingresos_varios.length +
    planilla.egresos.length +
    planilla.movimientos_mec.length

  return (
    <div className="caja-cc-planilla-resumen-activa">
      <strong>Planilla del día cargada</strong>
      <span>
        {planilla.archivo_nombre} · {TIPO_PLANILLA_LABEL[tipo]} · {lineas} líneas ·{' '}
        {fmtDateAr(planilla.fecha_hasta || planilla.fecha_desde)}
      </span>
    </div>
  )
}
