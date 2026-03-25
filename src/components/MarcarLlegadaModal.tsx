import { useState } from 'react'
import type { RegistroSalidaVehiculo } from '../types/api'
import './MarcarLlegadaModal.css'

type Props = {
  registro: RegistroSalidaVehiculo
  onClose: () => void
  onConfirm: (litrosCombustible: number) => void | Promise<void>
}

export default function MarcarLlegadaModal({ registro, onClose, onConfirm }: Props) {
  const [litros, setLitros] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')

  const vehiculoNombre = registro.vehiculo?.nombre ?? 'Vehículo'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const normalizado = litros.trim().replace(',', '.')
    const n = parseFloat(normalizado)
    if (normalizado === '' || !Number.isFinite(n) || n < 0) {
      setErr('Ingresá los litros de combustible (número mayor o igual a 0).')
      return
    }
    setEnviando(true)
    try {
      await onConfirm(n)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="marcar-llegada-overlay" role="dialog" aria-modal="true" aria-labelledby="marcar-llegada-title">
      <div className="marcar-llegada-modal">
        <h2 id="marcar-llegada-title">Llegada — {vehiculoNombre}</h2>
        <p className="marcar-llegada-sub">
          Registrá los litros de combustible al volver. Queda guardado en el historial del vehículo.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label className="marcar-llegada-label" htmlFor="litros-combustible">
            Litros de combustible
          </label>
          <input
            id="litros-combustible"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="Ej. 12,5 o 0 si no cargaste"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            className="marcar-llegada-input"
            autoFocus
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
