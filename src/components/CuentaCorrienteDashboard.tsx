import { useMemo } from 'react'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import { normalizeEstadoCc } from '../constants/cuentaCorriente'
import { formatMontoArs, formatMontoArsKpi } from '../utils/cuentaCorrienteLedger'
import { calcCarteraStatsCuentaCorriente } from '../utils/cuentaCorrienteStats'
import './CuentaCorrienteDashboard.css'

export type CuentaCorrienteDashboardRow = ClienteCuentaCorrienteRecord & {
  cliente?: ClienteRecord
}

type Props = {
  registros: CuentaCorrienteDashboardRow[]
}

export default function CuentaCorrienteDashboard({ registros }: Props) {
  const stats = useMemo(() => calcCarteraStatsCuentaCorriente(registros), [registros])
  const pendientes = useMemo(
    () => registros.filter((r) => normalizeEstadoCc(r) === 'pendiente').length,
    [registros]
  )

  return (
    <section className="cc-dash">
      <header className="cc-dash__head">
        <h2>Resumen de cartera</h2>
        <p>Indicadores consolidados de cuenta corriente</p>
      </header>

      <div className="cc-dash__kpis">
        <article className="cc-dash-kpi cc-dash-kpi--count">
          <span className="cc-dash-kpi__label">Total clientes</span>
          <span className="cc-dash-kpi__value">{stats.total}</span>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--ok cc-dash-kpi--count">
          <span className="cc-dash-kpi__label">Aprobados</span>
          <span className="cc-dash-kpi__value">{stats.aprobada}</span>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--warn cc-dash-kpi--count">
          <span className="cc-dash-kpi__label">Pendientes</span>
          <span className="cc-dash-kpi__value">{pendientes}</span>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--deuda cc-dash-kpi--money">
          <span className="cc-dash-kpi__label">Deuda total</span>
          <span className="cc-dash-kpi__value" title={formatMontoArs(stats.deudaTotal)}>
            {formatMontoArsKpi(stats.deudaTotal)}
          </span>
        </article>
        <article
          className={`cc-dash-kpi cc-dash-kpi--money${stats.saldoCartera < 0 ? ' cc-dash-kpi--negativo' : ''}`}
        >
          <span className="cc-dash-kpi__label">Saldo neto cartera</span>
          <span className="cc-dash-kpi__value" title={formatMontoArs(stats.saldoCartera)}>
            {formatMontoArsKpi(stats.saldoCartera)}
          </span>
        </article>
        <article className="cc-dash-kpi cc-dash-kpi--count">
          <span className="cc-dash-kpi__label">Rechazados</span>
          <span className="cc-dash-kpi__value">{stats.rechazada}</span>
        </article>
      </div>
    </section>
  )
}
