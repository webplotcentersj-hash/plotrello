import { useCallback, useEffect, useState } from 'react'
import {
  ETIQUETA_MOVIMIENTO_SALDO,
  aplicarSaldoFavor,
  devolverSaldoFavor,
  getSaldoFavorDeNota,
  getSaldosFavorDisponibles,
  montoSugeridoAplicacion,
  pasarSaldoFavorACuentaCorriente,
  type MetodoDevolucion,
  type MovimientoSaldoFavor,
  type SaldoFavor
} from '../../services/saldosFavorApi'
import { getArgentinaDateString } from '../../utils/dateUtils'
import { formatFechaAr } from '../../utils/afipFacturaUi'

const pesos = (n: number) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

type Accion = 'devolver' | 'cuenta_corriente' | null

/**
 * Nota de crédito que superó lo adeudado: muestra el saldo a favor del cliente y permite
 * devolverlo, pasarlo a cuenta corriente o dejarlo a cuenta (se usa al cobrar otra factura).
 */
export function SaldoFavorNotaPanel({ idNotaCredito }: { idNotaCredito: number }) {
  const [saldo, setSaldo] = useState<SaldoFavor | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoSaldoFavor[]>([])
  const [accion, setAccion] = useState<Accion>(null)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoDevolucion>('Efectivo')
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const r = await getSaldoFavorDeNota(idNotaCredito)
    if (r.success) {
      setSaldo(r.data?.saldo ?? null)
      setMovimientos(r.data?.movimientos ?? [])
    }
  }, [idNotaCredito])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!saldo) return null

  const abrir = (a: Exclude<Accion, null>) => {
    setAccion(a)
    setMonto(String(saldo.disponible))
  }

  const confirmar = async () => {
    const valor = Number(monto)
    if (!Number.isFinite(valor) || valor <= 0) return alert('Ingresá un monto válido.')
    if (valor > saldo.disponible + 0.005) return alert(`El máximo disponible es ${pesos(saldo.disponible)}.`)
    const texto =
      accion === 'devolver'
        ? `¿Registrar la devolución de ${pesos(valor)} en ${metodo.toLowerCase()}? Genera el asiento de egreso.`
        : `¿Pasar ${pesos(valor)} a la cuenta corriente de ${saldo.cliente_nombre || 'el cliente'}?`
    if (!confirm(texto)) return
    setGuardando(true)
    const r =
      accion === 'devolver'
        ? await devolverSaldoFavor(saldo.id, valor, metodo, fecha, observaciones)
        : await pasarSaldoFavorACuentaCorriente(saldo.id, valor)
    setGuardando(false)
    if (!r.success) return alert(r.error || 'No se pudo registrar.')
    setAccion(null)
    setObservaciones('')
    await cargar()
  }

  return (
    <div className="factura-section">
      <h2>Saldo a favor del cliente</h2>
      <div className="info-grid">
        <div className="info-item">
          <label>Generado por esta nota</label>
          <div>{pesos(saldo.monto)}</div>
        </div>
        <div className="info-item">
          <label>Disponible</label>
          <div>
            <strong>{pesos(saldo.disponible)}</strong>
          </div>
        </div>
      </div>

      {movimientos.length > 0 && (
        <ul className="saldo-favor-movs">
          {movimientos.map((m) => (
            <li key={m.id}>
              {formatFechaAr(m.fecha)} · {ETIQUETA_MOVIMIENTO_SALDO[m.tipo]}
              {m.metodo_pago ? ` (${m.metodo_pago})` : ''}: {pesos(m.monto)}
              {m.observaciones ? ` — ${m.observaciones}` : ''}
            </li>
          ))}
        </ul>
      )}

      {saldo.disponible > 0 ? (
        <>
          <p className="erp-muted" style={{ marginTop: 8 }}>
            El cliente ya había pagado y la nota de crédito superó lo que debía. Podés devolverle la plata, pasarla
            a su cuenta corriente o dejarla a cuenta: en ese caso aparece para usarla al cobrar su próxima factura.
          </p>
          <div className="cobranza-actions">
            <button type="button" className="fd-btn fd-btn--primary" onClick={() => abrir('devolver')} disabled={guardando}>
              Devolver
            </button>
            <button type="button" className="fd-btn fd-btn--soft" onClick={() => abrir('cuenta_corriente')} disabled={guardando}>
              Pasar a cuenta corriente
            </button>
            {accion && (
              <button type="button" className="fd-btn fd-btn--ghost" onClick={() => setAccion(null)} disabled={guardando}>
                Cancelar
              </button>
            )}
          </div>

          {accion && (
            <div className="cobranza-form">
              <div className="cobranza-grid">
                <div className="cobranza-field">
                  <label>Monto *</label>
                  <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
                  <span className="cobranza-field-hint">Podés hacerlo por una parte; el resto queda disponible.</span>
                </div>
                {accion === 'devolver' && (
                  <>
                    <div className="cobranza-field">
                      <label>Medio *</label>
                      <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoDevolucion)}>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div className="cobranza-field">
                      <label>Fecha *</label>
                      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                    </div>
                    <div className="cobranza-field cobranza-field--full">
                      <label>Observaciones</label>
                      <input
                        type="text"
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="N° de transferencia, quién retiró, etc."
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="cobranza-actions">
                <button type="button" className="fd-btn fd-btn--primary" onClick={() => void confirmar()} disabled={guardando}>
                  {guardando ? 'Guardando…' : accion === 'devolver' ? 'Registrar devolución' : 'Pasar a cuenta corriente'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="erp-muted" style={{ marginTop: 8 }}>
          El saldo a favor ya se usó por completo.
        </p>
      )}
    </div>
  )
}

/** Al cobrar una factura: ofrece usar los saldos a favor que tenga el cliente. */
export function UsarSaldoFavorPanel({
  idCliente,
  idCuentaPorCobrar,
  pendiente,
  onAplicado
}: {
  idCliente: number
  idCuentaPorCobrar: number
  pendiente: number
  onAplicado: () => void | Promise<void>
}) {
  const [saldos, setSaldos] = useState<SaldoFavor[]>([])
  const [aplicando, setAplicando] = useState(false)

  const cargar = useCallback(async () => {
    const r = await getSaldosFavorDisponibles(idCliente)
    if (r.success) setSaldos(r.data ?? [])
  }, [idCliente])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const disponible = saldos.reduce((s, x) => s + x.disponible, 0)
  if (disponible <= 0 || pendiente <= 0) return null

  const aplicar = async () => {
    const total = montoSugeridoAplicacion(pendiente, disponible)
    if (!confirm(`¿Usar ${pesos(total)} del saldo a favor del cliente para esta factura? No mueve dinero.`)) return
    setAplicando(true)
    let restante = total
    // Se consumen primero los saldos más viejos
    for (const s of saldos) {
      if (restante <= 0.005) break
      const parte = montoSugeridoAplicacion(restante, s.disponible)
      if (parte <= 0) continue
      const r = await aplicarSaldoFavor(s.id, idCuentaPorCobrar, parte)
      if (!r.success) {
        alert(r.error || 'No se pudo aplicar el saldo a favor.')
        break
      }
      restante = Math.round((restante - parte) * 100) / 100
    }
    setAplicando(false)
    await cargar()
    await onAplicado()
  }

  return (
    <div className="saldo-favor-aviso">
      <span>
        El cliente tiene <strong>{pesos(disponible)}</strong> de saldo a favor.
      </span>
      <button type="button" className="fd-btn fd-btn--soft" onClick={() => void aplicar()} disabled={aplicando}>
        {aplicando ? 'Aplicando…' : `Usar ${pesos(montoSugeridoAplicacion(pendiente, disponible))}`}
      </button>
    </div>
  )
}
