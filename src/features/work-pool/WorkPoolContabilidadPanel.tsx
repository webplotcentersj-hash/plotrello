import { useMemo, useState } from 'react'
import { Banknote, CheckCircle2, Wallet } from 'lucide-react'
import type { WorkPoolFreelancerResumen, WorkPoolProduct } from '../../types/workPool'
import { WORK_POOL_SECTOR_LABELS } from '../../types/workPool'

type Props = {
  product: WorkPoolProduct
  freelancers: WorkPoolFreelancerResumen[]
  deudaTotal: number
  acreditadoTotal: number
  pagadoTotal: number
  payUserId: number | null
  payMonto: string
  payNotas: string
  paying: boolean
  onPayMonto: (v: string) => void
  onPayNotas: (v: string) => void
  onStartPay: (idUsuario: number) => void
  onCancelPay: () => void
  onConfirmPay: () => void
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

type Vista = 'a_pagar' | 'todos'

export default function WorkPoolContabilidadPanel({
  product,
  freelancers,
  deudaTotal,
  acreditadoTotal,
  pagadoTotal,
  payUserId,
  payMonto,
  payNotas,
  paying,
  onPayMonto,
  onPayNotas,
  onStartPay,
  onCancelPay,
  onConfirmPay
}: Props) {
  const isPlotDesign = product === 'plot-design'
  const [vista, setVista] = useState<Vista>('a_pagar')

  const rows = useMemo(() => {
    const list =
      vista === 'a_pagar'
        ? freelancers.filter((f) => f.saldo_pendiente > 0)
        : [...freelancers].filter((f) => f.acreditado > 0 || f.pagado > 0 || f.saldo_pendiente > 0)
    return list.sort((a, b) => b.saldo_pendiente - a.saldo_pendiente || a.nombre.localeCompare(b.nombre, 'es'))
  }, [freelancers, vista])

  const aPagarCount = freelancers.filter((f) => f.saldo_pendiente > 0).length
  const payTarget = payUserId != null ? freelancers.find((f) => f.id_usuario === payUserId) : null

  return (
    <section className="work-pool-admin__section work-pool-admin__section--contabilidad">
      <div className="work-pool-conta-hero">
        <div className="work-pool-conta-hero__top">
          <span className="work-pool-conta-hero__eyebrow">
            <Wallet size={14} aria-hidden />
            Contabilidad · {isPlotDesign ? 'Plot Design' : 'Bolsa Plot'}
          </span>
        </div>
        <h2>Pagos a {isPlotDesign ? 'diseñadores' : 'operarios'}</h2>
        <p>Quién tiene saldo pendiente, cuánto se acreditó y cuánto ya se pagó.</p>

        <div className="work-pool-conta-kpis" aria-label="Resumen contable">
          <article className="work-pool-conta-kpi work-pool-conta-kpi--deuda">
            <small>A pagar ahora</small>
            <strong>{formatArs(deudaTotal)}</strong>
            <span>
              {aPagarCount} {aPagarCount === 1 ? 'persona' : 'personas'}
            </span>
          </article>
          <article className="work-pool-conta-kpi">
            <small>Acreditado</small>
            <strong>{formatArs(acreditadoTotal)}</strong>
            <span>Trabajos aprobados</span>
          </article>
          <article className="work-pool-conta-kpi work-pool-conta-kpi--ok">
            <small>Ya pagado</small>
            <strong>{formatArs(pagadoTotal)}</strong>
            <span>Registrado en ledger</span>
          </article>
        </div>
      </div>

      <div className="work-pool-admin__section-head">
        <h3 className="work-pool-conta-list-title">
          {vista === 'a_pagar' ? 'Pendientes de pago' : 'Movimientos por persona'}
        </h3>
        <div className="work-pool-admin__origen-filters" role="group" aria-label="Filtro contabilidad">
          <button
            type="button"
            className={`work-pool-admin__origen-chip${vista === 'a_pagar' ? ' is-active' : ''}`}
            onClick={() => setVista('a_pagar')}
          >
            A pagar ({aPagarCount})
          </button>
          <button
            type="button"
            className={`work-pool-admin__origen-chip${vista === 'todos' ? ' is-active' : ''}`}
            onClick={() => setVista('todos')}
          >
            Todos con movimiento
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="work-pool-conta-empty">
          <CheckCircle2 size={28} aria-hidden />
          <p>
            {vista === 'a_pagar'
              ? 'No hay saldos pendientes. Cuando se apruebe un trabajo, aparece acá el monto a pagar.'
              : 'Todavía no hay acreditaciones ni pagos registrados.'}
          </p>
        </div>
      ) : (
        <div className="work-pool-conta-table-wrap">
          <table className="work-pool-conta-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Sector</th>
                <th>Acreditado</th>
                <th>Pagado</th>
                <th>A pagar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id_usuario} className={f.saldo_pendiente > 0 ? 'is-debt' : ''}>
                  <td>
                    <div className="work-pool-conta-person">
                      {f.foto_url ? (
                        <img
                          src={f.foto_url}
                          alt=""
                          className="work-pool-conta-person__avatar work-pool-conta-person__avatar--photo"
                        />
                      ) : (
                        <span className="work-pool-conta-person__avatar" aria-hidden>
                          {initials(f.nombre)}
                        </span>
                      )}
                      <span>
                        <strong>{f.nombre}</strong>
                        <small>
                          {f.trabajos_aprobados} aprobados
                          {f.trabajos_activos > 0 ? ` · ${f.trabajos_activos} activos` : ''}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="work-pool-conta-sectors">
                      {f.sectores.map((s) => WORK_POOL_SECTOR_LABELS[s]).join(', ') || '—'}
                    </span>
                  </td>
                  <td>{formatArs(f.acreditado)}</td>
                  <td>{formatArs(f.pagado)}</td>
                  <td>
                    <strong className={f.saldo_pendiente > 0 ? 'work-pool-conta-deuda' : ''}>
                      {formatArs(f.saldo_pendiente)}
                    </strong>
                  </td>
                  <td>
                    {f.saldo_pendiente > 0 ? (
                      <button
                        type="button"
                        className="work-pool-module__btn work-pool-module__btn--primary work-pool-conta-pay-btn"
                        onClick={() => onStartPay(f.id_usuario)}
                      >
                        <Banknote size={14} aria-hidden />
                        Registrar pago
                      </button>
                    ) : (
                      <span className="work-pool-conta-ok">Al día</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payTarget && (
        <div className="work-pool-admin__pay-box work-pool-conta-pay-box">
          <h3>Registrar pago</h3>
          <p>
            A <strong>{payTarget.nombre}</strong> · saldo {formatArs(payTarget.saldo_pendiente)}
          </p>
          <div className="work-pool-module__form-row">
            <label>
              Monto ARS
              <input
                type="number"
                min="0"
                value={payMonto}
                onChange={(e) => onPayMonto(e.target.value)}
                placeholder={String(Math.round(payTarget.saldo_pendiente) || '')}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Notas
              <input
                value={payNotas}
                onChange={(e) => onPayNotas(e.target.value)}
                placeholder="Transferencia, fecha, comprobante…"
              />
            </label>
          </div>
          <div className="work-pool-admin__pay-actions">
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--ghost"
              onClick={() =>
                onPayMonto(String(Math.round(payTarget.saldo_pendiente * 100) / 100))
              }
            >
              Pagar todo el saldo
            </button>
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--primary"
              disabled={paying}
              onClick={onConfirmPay}
            >
              {paying ? 'Registrando…' : 'Confirmar pago'}
            </button>
            <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onCancelPay}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
