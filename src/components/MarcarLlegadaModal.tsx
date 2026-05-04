import { useState } from 'react'
import type { RegistroSalidaVehiculo } from '../types/api'
import './MarcarLlegadaModal.css'

export type MarcarLlegadaPayload = {
  combustibleRestanteLitros: number
  objetivoCumplido: boolean
  observacionesLlegada: string
}

type Props = {
  registro: RegistroSalidaVehiculo
  onClose: () => void
  onConfirm: (payload: MarcarLlegadaPayload) => void | Promise<void>
}

export default function MarcarLlegadaModal({ registro, onClose, onConfirm }: Props) {
  const [combustibleRestante, setCombustibleRestante] = useState('')
  const [objetivo, setObjetivo] = useState<'si' | 'no' | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')

  const vehiculoNombre = registro.vehiculo?.nombre ?? 'Vehículo'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const normalizado = combustibleRestante.trim().replace(',', '.')
    const n = parseFloat(normalizado)
    if (normalizado === '' || !Number.isFinite(n) || n < 0) {
      setErr('Indicá el combustible que queda en el tanque (litros, ≥ 0).')
      return
    }
    if (objetivo !== 'si' && objetivo !== 'no') {
      setErr('Marcá si se cumplió o no el objetivo de la salida.')
      return
    }
    setEnviando(true)
    try {
      await onConfirm({
        combustibleRestanteLitros: n,
        objetivoCumplido: objetivo === 'si',
        observacionesLlegada: observaciones.trim()
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="marcar-llegada-overlay" role="dialog" aria-modal="true" aria-labelledby="marcar-llegada-title">
      <div className="marcar-llegada-modal">
        <h2 id="marcar-llegada-title">Llegada — {vehiculoNombre}</h2>
        <p className="marcar-llegada-sub">
          Registrá el estado al volver. Los datos se guardan en el historial del viaje cuando se finalice.
        </p>
        {registro.motivo_salida && (
          <div className="marcar-llegada-motivo" role="note">
            <span className="marcar-llegada-motivo-label">Objetivo / motivo de la salida</span>
            <p className="marcar-llegada-motivo-text">{registro.motivo_salida}</p>
          </div>
        )}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label className="marcar-llegada-label" htmlFor="combustible-restante">
            Combustible que queda (litros en tanque) *
          </label>
          <input
            id="combustible-restante"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="Ej. 45 o 0 si indicás vacío"
            value={combustibleRestante}
            onChange={(e) => setCombustibleRestante(e.target.value)}
            className="marcar-llegada-input"
            autoFocus
          />

          <fieldset className="marcar-llegada-fieldset">
            <legend className="marcar-llegada-label">¿Se cumplió el objetivo de la salida? *</legend>
            <div className="marcar-llegada-check-row">
              <label className="marcar-llegada-radio">
                <input
                  type="radio"
                  name="objetivo-cumplido"
                  checked={objetivo === 'si'}
                  onChange={() => setObjetivo('si')}
                />
                Sí
              </label>
              <label className="marcar-llegada-radio">
                <input
                  type="radio"
                  name="objetivo-cumplido"
                  checked={objetivo === 'no'}
                  onChange={() => setObjetivo('no')}
                />
                No
              </label>
            </div>
          </fieldset>

          <label className="marcar-llegada-label" htmlFor="observaciones-llegada">
            Observaciones
          </label>
          <textarea
            id="observaciones-llegada"
            className="marcar-llegada-textarea"
            rows={3}
            placeholder="Incidencias, demoras, repuestos, devolución de materiales…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />

          {err && <p className="marcar-llegada-error">{err}</p>}
          <div className="marcar-llegada-actions">
            <button type="button" className="marcar-llegada-btn secondary" onClick={onClose} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="marcar-llegada-btn primary" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Confirmar llegada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
