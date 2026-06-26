import { fmtArs } from '../format'
import type { ResumenCajeroAdminDia } from '../cajaMenuOperativaData'

type Props = {
  filas: ResumenCajeroAdminDia[]
  fechaLabel: string
}

export default function CajaAdminCajerosResumen({ filas, fechaLabel }: Props) {
  if (filas.length === 0) {
    return (
      <section className="caja-cc-admin-cajeros caja-cc-admin-cajeros--empty" aria-label="Resumen por cajero">
        <h3>Cajeros — {fechaLabel}</h3>
        <p>Sin ventas Plot Lab ni cierres registrados para operativas este día.</p>
      </section>
    )
  }

  return (
    <section className="caja-cc-admin-cajeros" aria-label="Resumen por cajero">
      <h3>Cajeros — {fechaLabel}</h3>
      <p className="caja-cc-sub">Ventas Plot Lab, arqueo y cierre de turno por caja operativa.</p>
      <ul className="caja-cc-admin-cajeros-list">
        {filas.map((f) => (
          <li key={f.slug} className="caja-cc-admin-cajeros-row">
            <strong className="caja-cc-admin-cajeros-nombre">{f.nombre}</strong>
            <span className="caja-cc-admin-cajeros-ventas">
              Plot Lab: $ {fmtArs(f.ventasPlotlab)}
              {f.cobrosPlotlab > 0 ? ` (${f.cobrosPlotlab} cobro${f.cobrosPlotlab === 1 ? '' : 's'})` : ''}
            </span>
            <span className="caja-cc-admin-cajeros-estado">
              Arqueo: {f.arqueoHecho ? '✓' : '—'} · Cierre: {f.cierreHecho ? '✓' : '—'}
              {f.diferenciaArqueo != null && Math.abs(f.diferenciaArqueo) > 0.01
                ? ` · Dif. $ ${fmtArs(f.diferenciaArqueo)}`
                : f.arqueoHecho
                  ? ' · Cuadra'
                  : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
