import type { CobroOpEstado } from '../utils/opCobroEstado'

type Props = {
  estado: CobroOpEstado
  montoParcial: string
  disabled?: boolean
  onEstadoChange: (next: CobroOpEstado) => void
  onMontoChange: (next: string) => void
}

export default function OpCobroFooterChecks({
  estado,
  montoParcial,
  disabled = false,
  onEstadoChange,
  onMontoChange
}: Props) {
  const toggle = (next: CobroOpEstado) => {
    if (disabled) return
    onEstadoChange(estado === next ? 'ninguno' : next)
  }

  return (
    <div className="create-cobro-checks" role="group" aria-label="Estado de cobro de la OP">
      <label className={`create-pagado-check${estado === 'pagado' ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={estado === 'pagado'}
          disabled={disabled}
          onChange={() => toggle('pagado')}
        />
        <span>Pagado</span>
      </label>

      <label className={`create-pagado-check create-pagado-check--parcial${estado === 'parcial' ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={estado === 'parcial'}
          disabled={disabled}
          onChange={() => toggle('parcial')}
        />
        <span>Pago parcial</span>
        {estado === 'parcial' && (
          <span className="create-parcial-monto">
            <span className="create-parcial-monto__prefix" aria-hidden>
              -
            </span>
            <input
              type="text"
              inputMode="numeric"
              className="create-parcial-monto__input"
              value={montoParcial}
              disabled={disabled}
              placeholder="8000"
              aria-label="Monto del pago parcial"
              onChange={(e) => onMontoChange(e.target.value.replace(/[^\d]/g, ''))}
              onClick={(e) => e.stopPropagation()}
            />
          </span>
        )}
      </label>

      <label
        className={`create-pagado-check create-pagado-check--cc${estado === 'cuenta_corriente' ? ' is-on' : ''}`}
        title="Cuenta corriente"
      >
        <input
          type="checkbox"
          checked={estado === 'cuenta_corriente'}
          disabled={disabled}
          onChange={() => toggle('cuenta_corriente')}
        />
        <span>CC</span>
      </label>

      <label className={`create-pagado-check create-pagado-check--sin${estado === 'sin_pago' ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={estado === 'sin_pago'}
          disabled={disabled}
          onChange={() => toggle('sin_pago')}
        />
        <span>Sin pago</span>
      </label>
    </div>
  )
}
