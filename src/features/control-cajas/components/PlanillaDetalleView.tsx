import { calcularTotalesDesdePlanilla } from '../cajaTotales'
import { fmtArs, fmtDateAr } from '../format'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import PlanillaLineasTable from './PlanillaLineasTable'
import PlanillaMediosResumen from './PlanillaMediosResumen'

type Props = {
  planilla: PlanillaCajaParsed
  /** Pie opcional (acciones de importación, etc.) */
  footer?: React.ReactNode
}

export default function PlanillaDetalleView({ planilla, footer }: Props) {
  const t = planilla.totales
  const resumen = calcularTotalesDesdePlanilla(planilla)
  const egresosLineas = [
    ...planilla.egresos,
    ...planilla.egresos_compras,
    ...planilla.egresos_pagos_proveedores
  ]
  const totalLineas =
    planilla.ventas.length +
    planilla.ingresos_varios.length +
    planilla.ingresos_pagos_clientes.length +
    egresosLineas.length +
    planilla.movimientos_mec.length

  const leidaConIa = planilla.warnings.some((w) => w.includes('PlotAI'))

  return (
    <div className="caja-cc-planilla-result">
      <div className="caja-cc-planilla-result-head">
        <div>
          <h3>
            {totalLineas} líneas{' '}
            <span className="caja-cc-planilla-ia-badge">{leidaConIa ? '✨ PlotAI' : '📋 Local'}</span>
          </h3>
          <p className="caja-cc-planilla-result-sub">
            {planilla.caja_nombre || 'Caja'} · {fmtDateAr(planilla.fecha_desde)}
            {planilla.fecha_hasta !== planilla.fecha_desde ? ` → ${fmtDateAr(planilla.fecha_hasta)}` : ''}
            {planilla.empresa ? ` · ${planilla.empresa}` : ''}
          </p>
        </div>
      </div>

      {planilla.warnings.length > 0 && (
        <ul className="caja-cc-planilla-warns">
          {planilla.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="caja-cc-metrics">
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Ventas FA/FB</span>
          <span className="caja-cc-metric-v">{planilla.ventas.length}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Ingresos IV</span>
          <span className="caja-cc-metric-v">{planilla.ingresos_varios.length}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">IPC</span>
          <span className="caja-cc-metric-v">{planilla.ingresos_pagos_clientes.length}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">Egresos EG</span>
          <span className="caja-cc-metric-v">{egresosLineas.length}</span>
        </div>
        <div className="caja-cc-metric">
          <span className="caja-cc-metric-l">MEC</span>
          <span className="caja-cc-metric-v">{planilla.movimientos_mec.length}</span>
        </div>
        {t && (
          <>
            <div className="caja-cc-metric highlight">
              <span className="caja-cc-metric-l">Ingresos</span>
              <span className="caja-cc-metric-v">$ {fmtArs(t.ingresos_total)}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">Egresos</span>
              <span className="caja-cc-metric-v">$ {fmtArs(t.egresos_total)}</span>
            </div>
            <div className="caja-cc-metric highlight">
              <span className="caja-cc-metric-l">Neto</span>
              <span className="caja-cc-metric-v">$ {fmtArs(t.neto)}</span>
            </div>
          </>
        )}
        {planilla.lineas_cuadre_invalido > 0 && (
          <div className="caja-cc-metric warn">
            <span className="caja-cc-metric-l">Sin cuadrar</span>
            <span className="caja-cc-metric-v">{planilla.lineas_cuadre_invalido}</span>
          </div>
        )}
      </div>

      <p className="caja-cc-planilla-fisico">
        Efectivo físico neto: <strong>$ {fmtArs(resumen.neto.fisico_neto)}</strong>
        <span className="caja-cc-field-hint">
          {' '}
          · Tarjetas/MP: $ {fmtArs(resumen.neto.electronico_neto)} · Cta. cte.: $ {fmtArs(resumen.neto.cta_cte)}
        </span>
      </p>

      <PlanillaMediosResumen ingresos={resumen.ingresos} egresos={resumen.egresos} neto={resumen.neto} />

      <div className="caja-cc-planilla-lineas-all">
        <PlanillaLineasTable title="Ingresos varios (IV)" lineas={planilla.ingresos_varios} />
        <PlanillaLineasTable title="Ventas (FA / FB)" lineas={planilla.ventas} />
        <PlanillaLineasTable title="Pagos de clientes (IPC)" lineas={planilla.ingresos_pagos_clientes} />
        <PlanillaLineasTable title="Egresos varios" lineas={planilla.egresos} />
        <PlanillaLineasTable title="Compras" lineas={planilla.egresos_compras} />
        <PlanillaLineasTable title="Pagos a proveedores" lineas={planilla.egresos_pagos_proveedores} />
        <PlanillaLineasTable title="Movimientos entre cajas (MEC)" lineas={planilla.movimientos_mec} />
      </div>

      {footer}
    </div>
  )
}
