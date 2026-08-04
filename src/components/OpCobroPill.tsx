import type { ReactNode } from 'react'
import { formatMontoPagoParcial } from '../utils/opCobroEstado'

type Props = {
  marcadaPagada?: boolean
  sinPago?: boolean
  montoPagoParcial?: number | null
  className?: string
  wrapClassName?: string
}

/** Pastilla de cobro para fichas (pagada / parcial / sin pago). */
export default function OpCobroPill({
  marcadaPagada,
  sinPago,
  montoPagoParcial,
  className = 'task-pagada-pill',
  wrapClassName
}: Props) {
  let pill: ReactNode = null
  if (marcadaPagada) {
    pill = (
      <span className={className} title="OP pagada">
        PAGADA
      </span>
    )
  } else if (montoPagoParcial != null && Number(montoPagoParcial) > 0) {
    pill = (
      <span className={`${className} task-pagada-pill--parcial`} title="Pago parcial">
        PARCIAL - {formatMontoPagoParcial(Number(montoPagoParcial))}
      </span>
    )
  } else if (sinPago) {
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
