import { useMemo, useState } from 'react'
import {
  ALL_PANOL_SLOTS,
  PANOL_LETTERS,
  PANOL_ROWS,
  normalizePanolSlot,
  panolSlotLabel,
  type PanolSlot
} from '../utils/panolTallerImprenta'
import './PanolSlotPicker.css'

type Props = {
  value: string | null | undefined
  onChange: (slot: PanolSlot | null) => void | Promise<void>
  disabled?: boolean
  occupiedSlots?: Set<string>
  compact?: boolean
  label?: string
}

export default function PanolSlotPicker({
  value,
  onChange,
  disabled = false,
  occupiedSlots,
  compact = false,
  label = 'Depósito pañol'
}: Props) {
  const [saving, setSaving] = useState(false)
  const current = normalizePanolSlot(value)

  const letterOptions = useMemo(() => PANOL_LETTERS, [])
  const letter = current?.[0] ?? ''
  const row = current ? Number(current.slice(1)) : 0

  const apply = async (next: PanolSlot | null) => {
    if (disabled || saving) return
    if ((next ?? null) === (current ?? null)) return
    setSaving(true)
    try {
      await onChange(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`panol-slot-picker${compact ? ' panol-slot-picker--compact' : ''}`}>
      <div className="panol-slot-picker__head">
        <span className="panol-slot-picker__label">{label}</span>
        {current ? (
          <span className="panol-slot-picker__current" title={panolSlotLabel(current)}>
            {current}
          </span>
        ) : (
          <span className="panol-slot-picker__current is-empty">Sin ubicar</span>
        )}
      </div>
      <div className="panol-slot-picker__controls">
        <label className="panol-slot-picker__field">
          <span>Letra</span>
          <select
            value={letter}
            disabled={disabled || saving}
            onChange={(e) => {
              const L = e.target.value
              if (!L) {
                void apply(null)
                return
              }
              const r = (row || 1) as 1 | 2 | 3
              void apply(`${L}${r}` as PanolSlot)
            }}
          >
            <option value="">—</option>
            {letterOptions.map((L) => (
              <option key={L} value={L}>
                {L}
              </option>
            ))}
          </select>
        </label>
        <label className="panol-slot-picker__field">
          <span>Fila</span>
          <select
            value={row || ''}
            disabled={disabled || saving || !letter}
            onChange={(e) => {
              const r = Number(e.target.value) as 1 | 2 | 3
              if (!letter || !r) {
                void apply(null)
                return
              }
              void apply(`${letter}${r}` as PanolSlot)
            }}
          >
            <option value="">—</option>
            {PANOL_ROWS.map((r) => (
              <option key={r} value={r}>
                {r === 1 ? '1 · arriba' : r === 2 ? '2 · medio' : '3 · abajo'}
              </option>
            ))}
          </select>
        </label>
        {current && (
          <button
            type="button"
            className="panol-slot-picker__clear"
            disabled={disabled || saving}
            onClick={() => void apply(null)}
          >
            Quitar
          </button>
        )}
      </div>
      {!compact && letter && (
        <div className="panol-slot-picker__quick" role="group" aria-label="Filas rápidas">
          {PANOL_ROWS.map((r) => {
            const slot = `${letter}${r}` as PanolSlot
            const taken = occupiedSlots?.has(slot) && slot !== current
            return (
              <button
                key={slot}
                type="button"
                className={`panol-slot-picker__chip${slot === current ? ' is-active' : ''}${taken ? ' is-taken' : ''}`}
                disabled={disabled || saving}
                title={taken ? `${slot} ocupado` : panolSlotLabel(slot)}
                onClick={() => void apply(slot)}
              >
                {slot}
              </button>
            )
          })}
        </div>
      )}
      {!compact && (
        <p className="panol-slot-picker__hint">
          Pañol A–Z · {ALL_PANOL_SLOTS.length} casilleros · 3 filas
        </p>
      )}
    </div>
  )
}
