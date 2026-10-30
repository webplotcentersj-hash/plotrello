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
        <strong>Ventas realizadas hoy</strong>
        <p>
          Sin ventas cobradas hoy en {cajaNombre}. Solo cuentan las confirmadas (no el modal abierto a medias).
        </p>
      </div>
    )
  }

  return (
    <div className="caja-cc-plotlab-ventas">
      <strong>Ventas realizadas hoy — {cajaNombre}</strong>
      <p className="caja-cc-sub">
        {resumen.count} venta{resumen.count === 1 ? '' : 's'} cobrada
        {resumen.count === 1 ? '' : 's'} (confirmadas) en Plot Lab.
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
