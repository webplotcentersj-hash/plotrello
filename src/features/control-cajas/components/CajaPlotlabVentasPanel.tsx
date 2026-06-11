import { fmtArs } from '../format'
import type { ResumenPlotlabVentasCaja } from '../plotlabVentasCajaData'

type Props = {
  resumen: ResumenPlotlabVentasCaja
  cajaNombre: string
}

export default function CajaPlotlabVentasPanel({ resumen, cajaNombre }: Props) {
  if (resumen.count <= 0) {
    return (
      <div className="caja-cc-plotlab-ventas caja-cc-plotlab-ventas--empty">
        <strong>Ventas PlotLab hoy</strong>
        <p>Sin cobros sincronizados en {cajaNombre} para esta fecha.</p>
      </div>
    )
  }

  return (
    <div className="caja-cc-plotlab-ventas">
      <strong>Ventas PlotLab hoy — {cajaNombre}</strong>
      <p className="caja-cc-sub">
        {resumen.count} cobro(s) en vivo (mostrador, CRM, portal al cobrar). Compará con la planilla antes del cierre.
      </p>
      <div className="caja-cc-plotlab-ventas-grid">
        <span>Efectivo</span>
        <strong>$ {fmtArs(resumen.efectivo)}</strong>
        <span>Tarjetas</span>
        <strong>$ {fmtArs(resumen.tarjetas)}</strong>
        <span>Transfer.</span>
        <strong>$ {fmtArs(resumen.transferencia)}</strong>
        <span>Cta. cte.</span>
        <strong>$ {fmtArs(resumen.ctaCte)}</strong>
        <span>Otros</span>
        <strong>$ {fmtArs(resumen.otros)}</strong>
        <span className="caja-cc-plotlab-ventas-total-label">Total</span>
        <strong className="caja-cc-plotlab-ventas-total">$ {fmtArs(resumen.total)}</strong>
      </div>
    </div>
  )
}
