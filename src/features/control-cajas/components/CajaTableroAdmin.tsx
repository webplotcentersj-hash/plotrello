import { useEffect, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { resumenAdminHoy } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import { listCajas, listEgresoSolicitudes, listPlanillas, listTransferenciaLotes } from '../cajaRepository'
import type { CajaRegistro, CajaTransferenciaLote } from '../types'
import CajaCierreTurnoDetalleModal from './CajaCierreTurnoDetalleModal'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Props = {
  onCierreTurno: () => void
  onEgresos: () => void
}

export default function CajaTableroAdmin({ onCierreTurno, onEgresos }: Props) {
  const hoy = getArgentinaDateString()
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof resumenAdminHoy>> | null>(null)
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [detalleLote, setDetalleLote] = useState<CajaTransferenciaLote | null>(null)

  useEffect(() => {
    void Promise.all([
      listTransferenciaLotes(50),
      listPlanillas(100),
      listEgresoSolicitudes({ fecha: hoy }),
      listCajas()
    ]).then(([lotes, planillas, egresos, c]) => {
      setCajas(c)
      setResumen(resumenAdminHoy(hoy, lotes, planillas, egresos))
    })
  }, [hoy])

  const cajaNombre = (slug: string) => cajas.find((x) => x.slug === slug)?.nombre ?? slug

  const ingresoLabel =
    resumen?.ingresoFuente === 'cierre_turno'
      ? 'Resto enviado a administración (cierres de turno de hoy)'
      : resumen?.ingresoFuente === 'planilla'
        ? 'Ingresos en planillas PDF de hoy (aún sin cierre de turno)'
        : 'Sin cierres de turno ni planillas hoy'

  return (
    <>
      <div className="caja-cc-page-head">
        <div>
          <h2>Hoy — {fmtDateAr(hoy)}</h2>
          <p className="caja-cc-sub">
            Fondo fijo $ {fmtArs(resumen?.fondoFijo ?? 100_000)}: una caja (Rosa o Noelia) lo traspasa a la otra;
            el resto ingresa a administración.
          </p>
        </div>
        <CajaVolverPlotLab small />
      </div>

      <div className="caja-cc-hoy-hero">
        <div className="caja-cc-hoy-hero-card ingreso">
          <span className="caja-cc-hoy-hero-label">Ingreso hoy</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(resumen?.ingresoHoy ?? 0)}</span>
          <span className="caja-cc-hoy-hero-hint">{ingresoLabel}</span>
        </div>
        <div className="caja-cc-hoy-hero-card egreso">
          <span className="caja-cc-hoy-hero-label">Egresos hoy</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(resumen?.egresosHoy ?? 0)}</span>
          <span className="caja-cc-hoy-hero-hint">
            {resumen && resumen.egresosPendientes > 0
              ? `${resumen.egresosPendientes} egreso(s) pendiente(s) de aprobar`
              : 'Egresos aprobados del día (todas las cajas)'}
          </span>
          {resumen && resumen.egresosPendientes > 0 && (
            <button type="button" className="btn-secondary btn-small" onClick={onEgresos}>
              Ver egresos
            </button>
          )}
        </div>
      </div>

      <div className="caja-cc-card caja-cc-fondo-regla">
        <h3>Regla del cierre de turno</h3>
        <ol className="caja-cc-steps-simple">
          <li>
            <strong>Fondo $ {fmtArs(100_000)}</strong> — se traspasa a la otra caja operativa (ej. Rosa → Noelia).
          </li>
          <li>
            <strong>Resto del arqueo</strong> (menos egresos del día) — va a <strong>Caja Administración</strong> (es el
            ingreso hoy de arriba).
          </li>
          <li>
            En el cierre se sube el <strong>PDF planilla</strong> y los <strong>comprobantes</strong> MP / tarjetas.
          </li>
        </ol>
        <button type="button" className="btn-primary" onClick={onCierreTurno}>
          Ir a cierre de turno
        </button>
      </div>

      {resumen && resumen.cierresTurnoHoy.length > 0 && (
        <div className="caja-cc-card">
          <h3>Cierres de turno de hoy</h3>
          <p className="caja-cc-help">Tocá una fila para ver planilla, comprobantes, hora y quién cerró.</p>
          <table className="caja-cc-table caja-cc-table-clickable">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Caja origen</th>
                <th>Fondo →</th>
                <th className="num">A administración</th>
                <th>Cajera</th>
              </tr>
            </thead>
            <tbody>
              {resumen.cierresTurnoHoy.map((l) => (
                <tr
                  key={l.id}
                  className="caja-cc-row-clickable"
                  onClick={() => setDetalleLote(l)}
                  title="Ver detalle del cierre"
                >
                  <td>{l.hora ?? '—'}</td>
                  <td>{cajaNombre(l.origen_slug)}</td>
                  <td>{cajaNombre(l.caja_fondo_destino_slug)}</td>
                  <td className="num">$ {fmtArs((l.resto_efectivo || 0) + (l.resto_otros || 0))}</td>
                  <td>{l.usuario_nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalleLote && (
        <CajaCierreTurnoDetalleModal lote={detalleLote} cajas={cajas} onClose={() => setDetalleLote(null)} />
      )}
    </>
  )
}
