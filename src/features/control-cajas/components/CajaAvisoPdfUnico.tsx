type Props = {
  onIr: () => void
  destinoLabel?: string
}

/** Indica que el PDF solo se sube desde el menú (o Cierres admin). */
export default function CajaAvisoPdfUnico({ onIr, destinoLabel = 'Menú' }: Props) {
  return (
    <div className="caja-cc-aviso-pdf-unico" role="note">
      <p>
        El PDF del día se sube en <strong>un solo lugar</strong>: el{' '}
        <button type="button" className="btn-link" onClick={onIr}>
          {destinoLabel}
        </button>
        . Ahí se lee, clasifica e importa automáticamente.
      </p>
    </div>
  )
}
