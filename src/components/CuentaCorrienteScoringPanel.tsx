import { useEffect, useState } from 'react'
import type { ClienteCuentaCorrienteRecord } from '../types/api'
import apiService from '../services/api'
import {
  CC_SCORE_NIVEL_LABELS,
  formatLimiteCredito,
  type CcScoreNivel
} from '../constants/cuentaCorrienteScoring'
import './CuentaCorrienteScoringPanel.css'

type Factor = { id?: string; label?: string; puntos?: number; max?: number }

type CuentaCorrienteScoringPanelProps = {
  record: ClienteCuentaCorrienteRecord
  isAdmin: boolean
  idUsuario: number
  onClose: () => void
  onUpdated: () => void
}

function parseFactores(detalle: unknown): Factor[] {
  if (!detalle || typeof detalle !== 'object') return []
  const f = (detalle as { factores?: unknown }).factores
  return Array.isArray(f) ? (f as Factor[]) : []
}

export default function CuentaCorrienteScoringPanel({
  record,
  isAdmin,
  idUsuario,
  onClose,
  onUpdated
}: CuentaCorrienteScoringPanelProps) {
  const [local, setLocal] = useState(record)
  const [ajuste, setAjuste] = useState(String(record.score_ajuste_manual ?? 0))
  const [limite, setLimite] = useState(
    record.limite_credito != null ? String(record.limite_credito) : ''
  )
  const [notas, setNotas] = useState(record.score_notas_internas ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocal(record)
    setAjuste(String(record.score_ajuste_manual ?? 0))
    setLimite(record.limite_credito != null ? String(record.limite_credito) : '')
    setNotas(record.score_notas_internas ?? '')
  }, [record])

  const nivel = (local.score_nivel ?? 'regular') as CcScoreNivel
  const factores = parseFactores(local.score_detalle)

  const recalcular = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.calcularScoringCuentaCorriente(record.id_cliente, idUsuario)
      if (!res.success || !res.data) throw new Error(res.error || 'Error al calcular')
      setLocal((prev) => ({
        ...prev,
        score: res.data!.score,
        score_nivel: res.data!.score_nivel as CcScoreNivel,
        score_detalle: res.data!.score_detalle,
        limite_credito_sugerido: res.data!.limite_credito_sugerido,
        score_actualizado_at: new Date().toISOString()
      }))
      onUpdated()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const guardarAdmin = async () => {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const lim = limite.trim() ? parseFloat(limite.replace(',', '.')) : null
      const res = await apiService.actualizarScoringCuentaCorriente({
        id_cliente: record.id_cliente,
        id_usuario: idUsuario,
        ajuste_manual: parseInt(ajuste, 10) || 0,
        limite_credito: lim,
        notas: notas.trim() || null
      })
      if (!res.success || !res.data) throw new Error(res.error || 'Error al guardar')
      setLocal((prev) => ({
        ...prev,
        score: res.data!.score,
        score_nivel: res.data!.score_nivel as CcScoreNivel,
        score_detalle: res.data!.score_detalle,
        limite_credito: res.data!.limite_credito,
        limite_credito_sugerido: res.data!.limite_credito_sugerido,
        score_ajuste_manual: parseInt(ajuste, 10) || 0,
        score_notas_internas: notas.trim() || null
      }))
      onUpdated()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cc-scoring-overlay" role="dialog" aria-modal="true" aria-labelledby="cc-scoring-title">
      <div className="cc-scoring-panel">
        <header className="cc-scoring-panel__head">
          <div>
            <h2 id="cc-scoring-title">Scoring interno</h2>
            <p className="cc-scoring-panel__sub">{local.razon_social ?? 'Cliente'}</p>
          </div>
          <button type="button" className="cc-scoring-panel__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {error && (
          <div className="cc-scoring-panel__error" role="alert">
            {error}
          </div>
        )}

        <div className="cc-scoring-panel__hero">
          <div className={`cc-scoring-ring cc-scoring-ring--${nivel}`} aria-hidden>
            <span className="cc-scoring-ring__value">{local.score ?? '—'}</span>
          </div>
          <div>
            <span className={`cc-scoring-nivel cc-scoring-nivel--${nivel}`}>
              {CC_SCORE_NIVEL_LABELS[nivel]}
            </span>
            <p className="cc-scoring-panel__limite">
              Límite sugerido:{' '}
              <strong>{formatLimiteCredito(local.limite_credito_sugerido)}</strong>
            </p>
            {local.limite_credito != null && (
              <p className="cc-scoring-panel__limite">
                Límite asignado: <strong>{formatLimiteCredito(local.limite_credito)}</strong>
              </p>
            )}
            {local.score_actualizado_at && (
              <p className="cc-scoring-panel__fecha">
                Actualizado:{' '}
                {new Date(local.score_actualizado_at).toLocaleString('es-AR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              </p>
            )}
          </div>
        </div>

        {factores.length > 0 && (
          <section className="cc-scoring-factores">
            <h3>Desglose</h3>
            <ul>
              {factores.map((f, i) => (
                <li key={f.id ?? i}>
                  <span>{f.label ?? f.id}</span>
                  <span className={((f.puntos ?? 0) < 0 ? ' cc-scoring-neg' : '')}>
                    {(f.puntos ?? 0) > 0 ? '+' : ''}
                    {f.puntos ?? 0}
                    {f.max != null ? ` / ${f.max}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isAdmin && (
          <section className="cc-scoring-admin">
            <h3>Ajuste administración</h3>
            <div className="cc-scoring-admin__grid">
              <label>
                <span>Ajuste manual (−30 a +30)</span>
                <input
                  type="number"
                  min={-30}
                  max={30}
                  value={ajuste}
                  onChange={(e) => setAjuste(e.target.value)}
                />
              </label>
              <label>
                <span>Límite de crédito ($)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  placeholder="Vacío = solo sugerido"
                />
              </label>
              <label className="cc-scoring-admin__wide">
                <span>Notas internas</span>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones visibles solo para administración"
                />
              </label>
            </div>
            <div className="cc-scoring-admin__actions">
              <button
                type="button"
                className="cc-btn cc-btn--secondary"
                disabled={loading}
                onClick={() => void recalcular()}
              >
                {loading ? '…' : 'Recalcular'}
              </button>
              <button
                type="button"
                className="cc-btn cc-btn--primary"
                disabled={loading}
                onClick={() => void guardarAdmin()}
              >
                Guardar y recalcular
              </button>
            </div>
          </section>
        )}

        {!isAdmin && (
          <p className="cc-scoring-panel__readonly">
            El scoring es de uso interno. Contactá a administración para ajustes.
          </p>
        )}

        {!local.score && !loading && (
          <button type="button" className="cc-btn cc-btn--primary" onClick={() => void recalcular()}>
            Calcular scoring
          </button>
        )}
      </div>
    </div>
  )
}
