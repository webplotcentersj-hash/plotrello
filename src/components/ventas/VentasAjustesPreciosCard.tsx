import { useEffect, useState } from 'react'
import {
  labelAjustesPreciosActivos,
  totalPorcentajeAjustes,
  type ConfigAjustesPreciosVentas,
  type RecargoPrecioVentas
} from '../../constants/ventasListasPrecio'
import './VentasAjustesPreciosCard.css'

function newRecargoId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

type Props = {
  ajustes: ConfigAjustesPreciosVentas
  loading?: boolean
  saving?: boolean
  onGuardar: (next: ConfigAjustesPreciosVentas) => Promise<boolean>
}

export default function VentasAjustesPreciosCard({ ajustes, loading, saving, onGuardar }: Props) {
  const [draft, setDraft] = useState<ConfigAjustesPreciosVentas>(ajustes)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    setDraft(ajustes)
  }, [ajustes])

  const actualizarRecargo = (id: string, patch: Partial<RecargoPrecioVentas>) => {
    setDraft((prev) => ({
      ...prev,
      recargos: prev.recargos.map((r) => (r.id === id ? { ...r, ...patch } : r))
    }))
  }

  const agregarRecargo = () => {
    setDraft((prev) => ({
      ...prev,
      recargos: [
        ...prev.recargos,
        { id: newRecargoId(), nombre: 'Recargo', porcentaje: 0, activo: true }
      ]
    }))
  }

  const quitarRecargo = (id: string) => {
    setDraft((prev) => ({ ...prev, recargos: prev.recargos.filter((r) => r.id !== id) }))
  }

  const handleGuardar = async () => {
    const ok = await onGuardar(draft)
    if (ok) setAbierto(false)
    else alert('No se pudo guardar la configuración de precios.')
  }

  const totalPct = totalPorcentajeAjustes(draft)

  return (
    <section className="vap-card">
      <div className="vap-card__head">
        <div>
          <h3>Ajustes sobre listas</h3>
          <p className="vap-card__hint">
            Se suman al <strong>precio neto Flexxus</strong> en todas las listas (1 a 5). Precio final = neto ×
            (1 + {totalPct}%).
          </p>
          <p className="vap-card__activos">{labelAjustesPreciosActivos(ajustes)}</p>
        </div>
        <button
          type="button"
          className="vlp-btn vlp-btn--ghost vlp-btn--xs"
          onClick={() => setAbierto((v) => !v)}
          disabled={loading}
        >
          {abierto ? 'Cerrar' : 'Configurar %'}
        </button>
      </div>

      {abierto && (
        <div className="vap-card__body">
          <label className="vap-iva-row">
            <input
              type="checkbox"
              checked={draft.iva_activo}
              onChange={(e) => setDraft((p) => ({ ...p, iva_activo: e.target.checked }))}
            />
            <span>IVA</span>
            <input
              type="number"
              className="vlp-input vlp-input--sm vap-pct-input"
              min={0}
              step={0.01}
              value={draft.iva_porcentaje}
              disabled={!draft.iva_activo}
              onChange={(e) =>
                setDraft((p) => ({ ...p, iva_porcentaje: Number(e.target.value) || 0 }))
              }
            />
            <span>%</span>
          </label>

          <div className="vap-recargos">
            <div className="vap-recargos__head">
              <strong>Otros porcentajes</strong>
              <button type="button" className="vlp-btn vlp-btn--outline vlp-btn--xs" onClick={agregarRecargo}>
                + Agregar
              </button>
            </div>
            {draft.recargos.length === 0 ? (
              <p className="vlp-muted">Sin recargos adicionales. Ej.: comisión, flete, margen.</p>
            ) : (
              <ul className="vap-recargos__list">
                {draft.recargos.map((r) => (
                  <li key={r.id}>
                    <input
                      type="checkbox"
                      checked={r.activo}
                      onChange={(e) => actualizarRecargo(r.id, { activo: e.target.checked })}
                      aria-label="Activo"
                    />
                    <input
                      type="text"
                      className="vlp-input vlp-input--sm"
                      placeholder="Nombre"
                      value={r.nombre}
                      onChange={(e) => actualizarRecargo(r.id, { nombre: e.target.value })}
                    />
                    <input
                      type="number"
                      className="vlp-input vlp-input--sm vap-pct-input"
                      min={0}
                      step={0.01}
                      value={r.porcentaje}
                      onChange={(e) =>
                        actualizarRecargo(r.id, { porcentaje: Number(e.target.value) || 0 })
                      }
                    />
                    <span>%</span>
                    <button
                      type="button"
                      className="vlp-btn vlp-btn--ghost vlp-btn--xs"
                      onClick={() => quitarRecargo(r.id)}
                      aria-label="Quitar"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="vap-card__footer">
            <span className="vap-total-pct">Total aplicado: +{totalPorcentajeAjustes(draft)}%</span>
            <button
              type="button"
              className="vlp-btn vlp-btn--primary vlp-btn--xs"
              disabled={saving}
              onClick={() => void handleGuardar()}
            >
              {saving ? 'Guardando…' : 'Guardar ajustes'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
