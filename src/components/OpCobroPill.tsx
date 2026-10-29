import type { ReactNode } from 'react'
import { formatMontoPagoParcial } from '../utils/opCobroEstado'

type Props = {
  marcadaPagada?: boolean
  sinPago?: boolean
  pagoCuentaCorriente?: boolean
  montoPagoParcial?: number | null
  /** Saldo que falta cobrar (pago parcial). */
  montoSaldoPendiente?: number | null
  className?: string
  wrapClassName?: string
  /** Si true, muestra SIN PAGO cuando no hay pagado ni parcial ni CC */
  showWhenUnpaid?: boolean
}

/** Pastilla de cobro para fichas (pagada / parcial / CC / sin pago). */
export default function OpCobroPill({
  marcadaPagada,
  sinPago,
  pagoCuentaCorriente,
  montoPagoParcial,
  montoSaldoPendiente,
  className = 'task-pagada-pill',
  wrapClassName,
  showWhenUnpaid = false
}: Props) {
  let pill: ReactNode = null
  if (marcadaPagada) {
    pill = (
      <span className={className} title="OP pagada">
        PAGADA
      </span>
    )
  } else if (
    (montoPagoParcial != null && Number(montoPagoParcial) > 0) ||
    (montoSaldoPendiente != null && Number(montoSaldoPendiente) > 0)
  ) {
    const pagado = Number(montoPagoParcial) || 0
    const falta = Number(montoSaldoPendiente) || 0
    pill = (
      <span className={`${className} task-pagada-pill--parcial-wrap`} title="Pago parcial">
        <span className={`${className} task-pagada-pill--parcial`}>
          PARCIAL{pagado > 0 ? ` · ${formatMontoPagoParcial(pagado)}` : ''}
        </span>
        {falta > 0 ? (
          <span className={`${className} task-pagada-pill--falta`} title="Saldo pendiente">
            FALTA · {formatMontoPagoParcial(falta)}
          </span>
        ) : null}
      </span>
    )
  } else if (pagoCuentaCorriente) {
    pill = (
      <span className={`${className} task-pagada-pill--cc`} title="Cuenta corriente">
        CC
      </span>
    )
  } else if (sinPago || showWhenUnpaid) {
    pill = (
      <span className={`${className} task-pagada-pill--sin`} title="Sin pago">
        SIN PAGO
      </span>
    )
  }

  if (!pill) return null
  if (wrapClassName) return <span className={wrapClassName}>{pill}</span>
  return pill
}
