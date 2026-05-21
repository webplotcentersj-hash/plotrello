import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import {
  ESTADO_CC_LABELS,
  normalizeEstadoCc,
} from '../constants/cuentaCorriente'
import CuentaCorrienteScoreBadge from './CuentaCorrienteScoreBadge'
import type { CcScoreNivel } from '../constants/cuentaCorrienteScoring'
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
  onScoring?: (row: CuentaCorrienteDashboardRow) => void
  resolviendoId?: number | null
}

export default function CuentaCorrienteDashboard({
  registros,
  isAdmin,
  onAprobar,
  onScoring,
  resolviendoId
}: Props) {
  const navigate = useNavigate()

  const stats = useMemo(() => calcCarteraStatsCuentaCorriente(registros), [registros])

  const todosOrdenados = useMemo(() => {
    return [...registros].sort((a, b) => {
      const ea = normalizeEstadoCc(a)
      const eb = normalizeEstadoCc(b)
      const prio = { pendiente: 0, aprobada: 1, rechazada: 2 }
      if (prio[ea] !== prio[eb]) return prio[ea] - prio[eb]
      const sa = Number(a.saldo_actual) || 0
      const sb = Number(b.saldo_actual) || 0
      return sb - sa
    })
  }, [registros])

  const aprobados = todosOrdenados.filter((r) => normalizeEstadoCc(r) === 'aprobada')
  const pendientes = todosOrdenados.filter((r) => normalizeEstadoCc(r) === 'pendiente')

  return (
    <section className="cc-dash">
      <header className="cc-dash__head">
        <h2>Panel de cuenta corriente</h2>
        <p>Todos los clientes con cuenta corriente en el sistema</p>
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
            ? `${stats.clientesConDeuda} cliente${stats.clientesConDeuda !== 1 ? 's' : ''} aprobado${stats.clientesConDeuda !== 1 ? 's' : ''} con saldo adeudado`
            : 'Ningún cliente aprobado con saldo pendiente de cobro'}
        </p>
      </div>

      <div className="cc-dash__kpis">
        <article className="cc-dash-kpi">
          <span className="cc-dash-kpi__label">Total clientes CC</span>
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
          <span className="cc-dash-kpi__label">Saldo neto cartera</span>
          <strong>{formatMontoArs(stats.saldoCartera)}</strong>
        </article>
        <article className="cc-dash-kpi">
          <span className="cc-dash-kpi__label">Rechazados</span>
          <strong>{stats.rechazada}</strong>
        </article>
      </div>

      {isAdmin && pendientes.length > 0 && (
        <div className="cc-dash__block cc-dash__block--alert">
          <h3>Pendientes de aprobación ({pendientes.length})</h3>
          <div className="cc-dash-table-wrap">
            <table className="cc-dash-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>CUIT/DNI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((r) => (
                  <DashRow
                    key={r.id}
                    row={r}
                    navigate={navigate}
                    isAdmin={isAdmin}
                    onAprobar={onAprobar}
                    onScoring={onScoring}
                    resolviendoId={resolviendoId}
                    compact
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="cc-dash__block">
        <h3>Cartera completa ({todosOrdenados.length} clientes)</h3>
        {todosOrdenados.length === 0 ? (
          <p className="cc-dash__empty">No hay clientes en cuenta corriente.</p>
        ) : (
          <div className="cc-dash-table-wrap">
            <table className="cc-dash-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Scoring</th>
                  <th className="num">Saldo</th>
                  <th>CUIT/DNI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todosOrdenados.map((r) => (
                  <DashRow
                    key={r.id}
                    row={r}
                    navigate={navigate}
                    isAdmin={isAdmin}
                    onAprobar={onAprobar}
                    onScoring={onScoring}
                    resolviendoId={resolviendoId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {aprobados.length > 0 && (
        <p className="cc-dash__foot">
          {aprobados.length} cliente{aprobados.length !== 1 ? 's' : ''} aprobado
          {aprobados.length !== 1 ? 's' : ''} pueden operar en venta con cuenta corriente.
        </p>
      )}
    </section>
  )
}

function DashRow({
  row,
  navigate,
  isAdmin,
  onAprobar,
  onScoring,
  resolviendoId,
  compact
}: {
  row: CuentaCorrienteDashboardRow
  navigate: ReturnType<typeof useNavigate>
  isAdmin: boolean
  onAprobar?: (id: number) => void
  onScoring?: (row: CuentaCorrienteDashboardRow) => void
  resolviendoId?: number | null
  compact?: boolean
}) {
  const nombre = row.razon_social || row.cliente?.nombre || 'Sin nombre'
  const estado = normalizeEstadoCc(row)
  const operativo = estado === 'aprobada'

  return (
    <tr className={`cc-dash-row cc-dash-row--${estado}`}>
      <td>
        <strong>{nombre}</strong>
      </td>
      <td>
        <span className={`cc-dash-estado cc-dash-estado--${estado}`}>
          {ESTADO_CC_LABELS[estado]}
        </span>
      </td>
      {!compact && (
        <>
          <td>
            {operativo ? (
              <CuentaCorrienteScoreBadge
                score={row.score}
                nivel={row.score_nivel as CcScoreNivel | undefined}
                compact
                onClick={onScoring ? () => onScoring(row) : undefined}
              />
            ) : (
              '—'
            )}
          </td>
          <td className="num">
            {operativo ? (
              <span className={Number(row.saldo_actual) > 0 ? 'cc-dash-saldo--deuda' : ''}>
                {formatMontoArs(Number(row.saldo_actual) || 0)}
              </span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
      <td>{row.cuit || '—'}</td>
      <td className="cc-dash-row__actions">
        {isAdmin && estado === 'pendiente' && onAprobar && (
          <button
            type="button"
            className="cc-btn cc-btn--primary cc-btn--sm"
            disabled={resolviendoId === row.id_cliente}
            onClick={() => onAprobar(row.id_cliente)}
          >
            {resolviendoId === row.id_cliente ? '…' : 'Aprobar'}
          </button>
        )}
        {operativo && (
          <button
            type="button"
            className="cc-btn cc-btn--primary cc-btn--sm"
            onClick={() => navigate(`/mostrador/cuenta-corriente/cliente/${row.id_cliente}`)}
          >
            Ver cuenta
          </button>
        )}
      </td>
    </tr>
  )
}
