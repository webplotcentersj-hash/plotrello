import { useMemo } from 'react'
import {
  conciliacionAutomaticaDia,
  fondosReservaDesdeArqueosDia,
  labelEstadoConciliacion,
  mediosIngresosDia,
  type LineaConciliacionDia
} from '../conciliacionDiaCaja'
import { fmtArs } from '../format'
import type {
  CajaArqueo,
  CajaConcilBanco,
  CajaConcilMP,
  CajaMovimiento,
  CajaRegistro,
  PlanillaCajaGuardada
} from '../types'

type Props = {
  fecha: string
  movimientos: CajaMovimiento[]
  planillas: PlanillaCajaGuardada[]
  arqueos?: CajaArqueo[]
  cajas?: CajaRegistro[]
  concilMp?: CajaConcilMP | null
  concilBanco?: CajaConcilBanco | null
}

function claseEstado(estado: LineaConciliacionDia['estado']): string {
  if (estado === 'ok') return 'ok'
  if (estado === 'revisar') return 'bad'
  if (estado === 'pendiente') return 'warn'
  return 'muted'
}

export default function CajaDiaConciliacionPanel({
  fecha,
  movimientos,
  planillas,
  arqueos = [],
  cajas = [],
  concilMp,
  concilBanco
}: Props) {
  const medios = useMemo(() => mediosIngresosDia(movimientos, fecha), [movimientos, fecha])
  const lineas = useMemo(
    () =>
      conciliacionAutomaticaDia({
        fecha,
        movimientos,
        planillas,
        arqueos,
        concilMp,
        concilBanco
      }),
    [fecha, movimientos, planillas, arqueos, concilMp, concilBanco]
  )
  const fondosReserva = useMemo(
    () => fondosReservaDesdeArqueosDia(arqueos, fecha, cajas),
    [arqueos, fecha, cajas]
  )
  const totalFondos = useMemo(
    () => fondosReserva.reduce((s, f) => s + f.monto, 0),
    [fondosReserva]
  )

  const conActividad = lineas.some((l) => l.estado !== 'sin_mov')
  if (!conActividad && medios.countIngresos === 0 && fondosReserva.length === 0) return null

  const pendientes = lineas.filter((l) => l.estado === 'pendiente' || l.estado === 'revisar').length
  const lineaEfectivo = lineas.find((l) => l.canal === 'efectivo')

  return (
    <div className="caja-cc-card caja-cc-concil-dia">
      <div className="caja-cc-concil-dia-head">
        <div>
          <h3>Conciliación automática por medio</h3>
          <p className="caja-cc-help">
            Compara ingresos del día con planilla, comprobantes MP/POS y conciliaciones registradas.
            {pendientes > 0 ? ` ${pendientes} canal(es) a revisar.` : ' Todo cuadra.'}
          </p>
        </div>
        <div className="caja-cc-concil-dia-totales">
          <div>
            <span className="caja-cc-meta-label">Cobrado en caja</span>
            <strong>$ {fmtArs(medios.totalCobrado)}</strong>
          </div>
          {medios.cuenta_corriente > 0 && (
            <div className="caja-cc-concil-dia-cc">
              <span className="caja-cc-meta-label">Cuenta corriente</span>
              <strong className="caja-cc-amount-cc-inline">$ {fmtArs(medios.cuenta_corriente)}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="caja-cc-concil-grid">
        {lineas.map((l) => (
          <div
            key={l.canal}
            className={`caja-cc-concil-card ${claseEstado(l.estado)}${
              l.canal === 'cuenta_corriente' ? ' is-cc' : ''
            }${l.canal === 'mercado_pago' ? ' is-mp' : ''}`}
          >
            <div className="caja-cc-concil-card-top">
              <span className="caja-cc-concil-icon" aria-hidden>
                {l.icon}
              </span>
              <span className="caja-cc-concil-label">{l.label}</span>
              <span className={`caja-cc-concil-badge ${claseEstado(l.estado)}`}>
                {labelEstadoConciliacion(l.estado)}
              </span>
            </div>
            <div className="caja-cc-concil-montos">
              <div>
                <span className="caja-cc-meta-label">Movimientos</span>
                <strong className={l.canal === 'cuenta_corriente' ? 'caja-cc-amount-cc-inline' : undefined}>
                  $ {fmtArs(l.movimientos)}
                </strong>
              </div>
              {l.referencia != null && l.referencia > 0 && !l.esContable && (
                <div>
                  <span className="caja-cc-meta-label">Referencia</span>
                  <span>$ {fmtArs(l.referencia)}</span>
                  {l.referenciaFuente && (
                    <span className="caja-cc-concil-fuente">{l.referenciaFuente}</span>
                  )}
                </div>
              )}
              {l.esContable && l.movimientos > 0 && (
                <p className="caja-cc-concil-hint-cc">No suma al arqueo físico</p>
              )}
              {l.estado === 'revisar' && (
                <div className="caja-cc-concil-dif">
                  Dif. $ {fmtArs(Math.abs(l.diferencia))}
                  {l.canal === 'efectivo' && totalFondos > 0 ? (
                    <span className="caja-cc-concil-dif-hint">
                      {' '}
                      (puede ser fondo dejado en cajas)
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}

        {fondosReserva.length > 0 && (
          <div className="caja-cc-concil-card caja-cc-concil-card--fondos" aria-label="Fondos de reserva">
            <div className="caja-cc-concil-card-top">
              <span className="caja-cc-concil-icon" aria-hidden>
                🏦
              </span>
              <span className="caja-cc-concil-label">Fondos de reserva</span>
              <span className="caja-cc-concil-badge ok">En cajas</span>
            </div>
            <p className="caja-cc-concil-fondos-help">
              Efectivo que quedó en cada caja (no va a administración). Suma $ {fmtArs(totalFondos)}.
            </p>
            <ul className="caja-cc-concil-fondos-lista">
              {fondosReserva.map((f) => (
                <li key={f.cajaSlug}>
                  <span className="caja-cc-concil-fondos-nombre">{f.cajaNombre}</span>
                  <strong>$ {fmtArs(f.monto)}</strong>
                </li>
              ))}
            </ul>
            {lineaEfectivo?.estado === 'revisar' && totalFondos > 0 ? (
              <p className="caja-cc-concil-fondos-nota">
                La diferencia de efectivo vs arqueo suele explicarse con esta reserva.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
