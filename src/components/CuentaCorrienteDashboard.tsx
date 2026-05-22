import { useMemo } from 'react'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import { ESTADO_CC_LABELS, normalizeEstadoCc } from '../constants/cuentaCorriente'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { calcCarteraStatsCuentaCorriente } from '../utils/cuentaCorrienteStats'
import './CuentaCorrienteDashboard.css'

export type CuentaCorrienteDashboardRow = ClienteCuentaCorrienteRecord & {
  cliente?: ClienteRecord
}

type Props = {
  registros: CuentaCorrienteDashboardRow[]
  isAdmin: boolean
  onAprobar?: (idCliente: number) => void
  resolviendoId?: number | null
}

export default function CuentaCorrienteDashboard({
  registros,
  isAdmin,
  onAprobar,
  resolviendoId
}: Props) {
  const stats = useMemo(() => calcCarteraStatsCuentaCorriente(registros), [registros])
  const pendientes = useMemo(
    () => registros.filter((r) => normalizeEstadoCc(r) === 'pendiente'),
    [registros]
  )

  return (
    <section className="cc-dash">
      <header className="cc-dash__head">
        <h2>Resumen de cartera</h2>
        <p>Indicadores consolidados de cuenta corriente</p>
      </header>

      <div className="cc-dash-deuda-total" role="status">
        <div className="cc-dash-deuda-total__main">
          <span className="cc-dash-deuda-total__label">Deuda total</span>
          <strong className="cc-dash-deuda-total__monto">
            {formatMontoArs(stats.deudaTotal)}
          </strong>
        </div>
        <p className="cc-dash-deuda-total__hint">
          {stats.clientesConDeuda > 0
            ? `${stats.clientesConDeuda} cliente${stats.clientesConDeuda !== 1 ? 's' : ''} con saldo adeudado`
            : 'Sin saldos pendientes de cobro'}
        </p>
      </div>

      <div className="cc-dash__kpis">
        <article className="cc-dash-kpi">
          <span className="cc-dash-kpi__label">Total clientes</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--ok">
          <span className="cc-dash-kpi__label">Aprobados</span>
          <strong>{stats.aprobada}</strong>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--warn">
          <span className="cc-dash-kpi__label">Pendientes</span>
          <strong>{stats.pendiente}</strong>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--deuda">
          <span className="cc-dash-kpi__label">Deuda total</span>
          <strong>{formatMontoArs(stats.deudaTotal)}</strong>
        </article>
        <article className="cc-dash-kpi">
          <span className="cc-dash-kpi__label">Saldo neto</span>
          <strong>{formatMontoArs(stats.saldoCartera)}</strong>
        </article>
        <article className="cc-dash-kpi">
          <span className="cc-dash-kpi__label">Rechazados</span>
          <strong>{stats.rechazada}</strong>
        </article>
      </div>

      {isAdmin && pendientes.length > 0 && (
        <div className="cc-dash__block cc-dash__block--alert">
          <h3>Solicitudes pendientes ({pendientes.length})</h3>
          <div className="cc-dash-table-wrap">
            <table className="cc-dash-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>CUIT / DNI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((r) => {
                  const nombre = r.razon_social || r.cliente?.nombre || 'Sin nombre'
                  return (
                    <tr key={r.id} className="cc-dash-row cc-dash-row--pendiente">
                      <td>
                        <strong>{nombre}</strong>
                      </td>
                      <td>
                        <span className="cc-dash-estado cc-dash-estado--pendiente">
                          {ESTADO_CC_LABELS.pendiente}
                        </span>
                      </td>
                      <td>{r.cuit || '—'}</td>
                      <td className="cc-dash-row__actions">
                        {onAprobar && (
                          <button
                            type="button"
                            className="cc-btn cc-btn--primary cc-btn--sm"
                            disabled={resolviendoId === r.id_cliente}
                            onClick={() => onAprobar(r.id_cliente)}
                          >
                            {resolviendoId === r.id_cliente ? '…' : 'Aprobar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="cc-dash__foot">
            El detalle completo está en la cartera inferior. Podés expandir cada fila.
          </p>
        </div>
      )}
    </section>
  )
}
