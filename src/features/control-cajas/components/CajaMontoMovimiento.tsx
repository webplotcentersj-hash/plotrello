import { fmtArs, montoCobradoCaja, montoCuentaCorriente, montoVisibleMovimiento } from '../format'
import type { CajaMovimiento } from '../types'

type Props = {
  movimiento: CajaMovimiento
  className?: string
}

/** Muestra el monto cobrado en caja y, aparte, cuenta corriente en otro color. */
export default function CajaMontoMovimiento({ movimiento: m, className = '' }: Props) {
  const cc = montoCuentaCorriente(m)
  const cobrado = montoCobradoCaja(m)
  const total = montoVisibleMovimiento(m)

  if (cc <= 0) {
    return (
      <div className={`caja-cc-amounts ${className}`.trim()}>
        <div className="caja-cc-amount">$ {fmtArs(total)}</div>
      </div>
    )
  }

  return (
    <div className={`caja-cc-amounts ${className}`.trim()}>
      <div className="caja-cc-amount">$ {fmtArs(cobrado > 0 ? cobrado : total - cc)}</div>
      <div className="caja-cc-amount-cc" title="Cuenta corriente (no entra al arqueo)">
        CC $ {fmtArs(cc)}
      </div>
    </div>
  )
}
