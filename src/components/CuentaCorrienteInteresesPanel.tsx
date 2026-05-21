import { useState } from 'react'
import type { ClienteCuentaCorrienteRecord, CcInteresesDevengados } from '../types/api'
import apiService from '../services/api'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import './CuentaCorrienteInteresesPanel.css'

type Props = {
  idCliente: number
  idUsuario: number
  isAdmin: boolean
  ficha: ClienteCuentaCorrienteRecord
  intereses: CcInteresesDevengados | null
  onUpdated: () => void
}

export default function CuentaCorrienteInteresesPanel({
  idCliente,
  idUsuario,
  isAdmin,
  ficha,
  intereses,
  onUpdated
}: Props) {
  const [interesMensual, setInteresMensual] = useState(
    ficha.porcentaje_interes_mensual != null ? String(ficha.porcentaje_interes_mensual) : ''
  )
  const [interesMora, setInteresMora] = useState(
    ficha.porcentaje_interes_mora_mensual != null ? String(ficha.porcentaje_interes_mora_mensual) : ''
  )
  const [diasGracia, setDiasGracia] = useState(String(ficha.dias_gracia ?? 0))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const tasaVigente = intereses?.tasa_mora_mensual ?? 0
  const totalDevengado = intereses?.total_devengado ?? 0
  const items = intereses?.items ?? []
  const pendientesRegistrar = items.filter((i) => !i.ya_registrado && (i.interes_calculado ?? 0) > 0)

  const guardarTasas = async () => {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      const res = await apiService.actualizarCondicionesCreditoCc({
        id_cliente: idCliente,
        id_usuario: idUsuario,
        porcentaje_interes_mensual: interesMensual.trim()
          ? parseFloat(interesMensual.replace(',', '.'))
          : null,
        porcentaje_interes_mora_mensual: interesMora.trim()
          ? parseFloat(interesMora.replace(',', '.'))
          : null,
        dias_gracia: parseInt(diasGracia, 10) || 0
      })
      if (!res.success) throw new Error(res.error || 'Error al guardar')
      setOk('Tasas de interés guardadas.')
      onUpdated()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const registrarIntereses = async () => {
    if (!isAdmin) return
    if (!window.confirm('¿Registrar en el libro los intereses devengados del período actual?')) return
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      const res = await apiService.registrarInteresesDevengadosCc(idCliente, idUsuario)
      if (!res.success || !res.data) throw new Error(res.error || 'Error')
      setOk(
        `Se registraron ${res.data.registrados} cargo(s) por ${formatMontoArs(res.data.monto_total)} (período ${res.data.periodo}).`
      )
      onUpdated()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="cc-intereses">
      <h2>Intereses (configuración manual)</h2>
      <p className="cc-intereses__hint">
        Definí el % mensual pactado y, si querés, uno distinto por mora. El cálculo es proporcional por días
        vencidos (base 30 días) después de los días de gracia.
      </p>

      {error && (
        <div className="cc-intereses__alert cc-intereses__alert--error" role="alert">
          {error}
        </div>
      )}
      {ok && (
        <div className="cc-intereses__alert cc-intereses__alert--ok" role="status">
          {ok}
        </div>
      )}

      <div className="cc-intereses__resumen">
        <span>
          Tasa mora vigente: <strong>{tasaVigente > 0 ? `${tasaVigente}% mensual` : 'Sin tasa (0%)'}</strong>
        </span>
        <span>
          Devengado estimado ({intereses?.periodo ?? '—'}):{' '}
          <strong>{formatMontoArs(totalDevengado)}</strong>
        </span>
      </div>

      {isAdmin ? (
        <div className="cc-intereses__form">
          <label>
            <span>% interés mensual pactado</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={interesMensual}
              onChange={(e) => setInteresMensual(e.target.value)}
              placeholder="Ej. 5"
            />
          </label>
          <label>
            <span>% interés por mora (vacío = usa el pactado)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={interesMora}
              onChange={(e) => setInteresMora(e.target.value)}
              placeholder="Ej. 8"
            />
          </label>
          <label>
            <span>Días de gracia post vencimiento</span>
            <input
              type="number"
              min={0}
              max={90}
              value={diasGracia}
              onChange={(e) => setDiasGracia(e.target.value)}
            />
          </label>
          <div className="cc-intereses__actions">
            <button
              type="button"
              className="cc-btn cc-btn--primary"
              disabled={loading}
              onClick={() => void guardarTasas()}
            >
              Guardar tasas
            </button>
            {pendientesRegistrar.length > 0 && tasaVigente > 0 && (
              <button
                type="button"
                className="cc-btn cc-btn--secondary"
                disabled={loading}
                onClick={() => void registrarIntereses()}
              >
                Registrar intereses en cuenta ({pendientesRegistrar.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="cc-intereses__readonly">
          Interés pactado:{' '}
          {ficha.porcentaje_interes_mensual != null
            ? `${ficha.porcentaje_interes_mensual}%`
            : '—'}{' '}
          · Mora:{' '}
          {ficha.porcentaje_interes_mora_mensual != null
            ? `${ficha.porcentaje_interes_mora_mensual}%`
            : 'igual al pactado'}{' '}
          · Gracia: {ficha.dias_gracia ?? 0} días
        </p>
      )}

      {items.length > 0 && (
        <div className="cc-intereses__detalle">
          <h3>Detalle por venta vencida</h3>
          <ul>
            {items.map((it, idx) => (
              <li key={`${it.id_venta ?? idx}-${it.fecha_vencimiento}`}>
                <span>{it.numero_venta ?? it.concepto}</span>
                <span>
                  {it.dias_mora} días · {formatMontoArs(it.interes_calculado)}
                  {it.ya_registrado ? ' ✓ registrado' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
