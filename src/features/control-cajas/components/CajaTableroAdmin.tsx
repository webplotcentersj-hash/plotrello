import { useEffect, useMemo, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { buildCalendarioCajasIndex, yearMonthFromDate } from '../calendarioCajasData'
import { resumenAdminHoy } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import {
  listArqueos,
  listCajas,
  listEgresoSolicitudes,
  listPlanillas,
  listTransferenciaLotes
} from '../cajaRepository'
import type { CajaRegistro, CajaTransferenciaLote } from '../types'
import CajaCalendarioAdmin from './CajaCalendarioAdmin'
import CajaCierreTurnoDetalleModal from './CajaCierreTurnoDetalleModal'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Props = {
  onCierreTurno: () => void
  onEgresos: () => void
}

export default function CajaTableroAdmin({ onCierreTurno, onEgresos }: Props) {
  const hoy = getArgentinaDateString()
  const [selectedFecha, setSelectedFecha] = useState(hoy)
  const [yearMonth, setYearMonth] = useState(() => yearMonthFromDate(hoy))
  const [search, setSearch] = useState('')
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lotes, setLotes] = useState<CajaTransferenciaLote[]>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [arqueos, setArqueos] = useState<Awaited<ReturnType<typeof listArqueos>>>([])
  const [egresos, setEgresos] = useState<Awaited<ReturnType<typeof listEgresoSolicitudes>>>([])
  const [loading, setLoading] = useState(true)
  const [detalleLote, setDetalleLote] = useState<CajaTransferenciaLote | null>(null)

  useEffect(() => {
    setLoading(true)
    void Promise.all([
      listTransferenciaLotes(400),
      listPlanillas(300),
      listEgresoSolicitudes(),
      listArqueos(),
      listCajas()
    ]).then(([l, p, e, a, c]) => {
      setLotes(l)
      setPlanillas(p)
      setEgresos(e)
      setArqueos(a)
      setCajas(c)
      setLoading(false)
    })
  }, [])

  const calendarioIndex = useMemo(
    () => buildCalendarioCajasIndex(lotes, planillas, arqueos, egresos, cajas),
    [lotes, planillas, arqueos, egresos, cajas]
  )

  const resumen = useMemo(
    () => resumenAdminHoy(selectedFecha, lotes, planillas, egresos, cajas),
    [selectedFecha, lotes, planillas, egresos, cajas]
  )

  const cajaNombre = (slug: string) => cajas.find((x) => x.slug === slug)?.nombre ?? slug

  const fondosTxt =
    resumen.fondosOperativas.length > 0
      ? resumen.fondosOperativas.map((f) => `${f.nombre} $ ${fmtArs(f.monto)}`).join(' · ')
      : `recomendado $ ${fmtArs(resumen.fondoRecomendado)}`

  const ingresoLabel =
    resumen.ingresoFuente === 'cierre_turno'
      ? 'Resto enviado a administración (cierres de turno)'
      : resumen.ingresoFuente === 'planilla'
        ? 'Ingresos en planillas PDF (aún sin cierre de turno)'
        : 'Sin cierres de turno ni planillas este día'

  const esHoy = selectedFecha === hoy
  const tituloDia = esHoy ? `Hoy — ${fmtDateAr(selectedFecha)}` : fmtDateAr(selectedFecha)

  return (
    <>
      <CajaCalendarioAdmin
        yearMonth={yearMonth}
        onYearMonthChange={setYearMonth}
        selectedFecha={selectedFecha}
        onSelectFecha={setSelectedFecha}
        index={calendarioIndex}
        cajas={cajas}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="caja-cc-page-head">
        <div>
          <h2>{tituloDia}</h2>
          <p className="caja-cc-sub">
            Fondo entre cajas ({fondosTxt}, editable por cajeras): una caja (Rosa o Noelia) lo traspasa a la otra;
            el resto ingresa a administración.
          </p>
        </div>
        <CajaVolverPlotLab small />
      </div>

      {loading ? (
        <p className="caja-cc-muted">Cargando movimientos del calendario…</p>
      ) : (
        <>
          <div className="caja-cc-hoy-hero">
            <div className="caja-cc-hoy-hero-card ingreso">
              <span className="caja-cc-hoy-hero-label">{esHoy ? 'Ingreso hoy' : 'Ingreso del día'}</span>
              <span className="caja-cc-hoy-hero-value">$ {fmtArs(resumen.ingresoHoy)}</span>
              <span className="caja-cc-hoy-hero-hint">{ingresoLabel}</span>
            </div>
            <div className="caja-cc-hoy-hero-card egreso">
              <span className="caja-cc-hoy-hero-label">{esHoy ? 'Egresos hoy' : 'Egresos del día'}</span>
              <span className="caja-cc-hoy-hero-value">$ {fmtArs(resumen.egresosHoy)}</span>
              <span className="caja-cc-hoy-hero-hint">
                {resumen.egresosPendientes > 0
                  ? `${resumen.egresosPendientes} egreso(s) pendiente(s) de aprobar`
                  : 'Egresos aprobados del día (todas las cajas)'}
              </span>
              {resumen.egresosPendientes > 0 && (
                <button type="button" className="btn-secondary btn-small" onClick={onEgresos}>
                  Ver egresos
                </button>
              )}
            </div>
          </div>

          {esHoy && (
            <div className="caja-cc-card caja-cc-fondo-regla">
              <h3>Regla del cierre de turno</h3>
              <ol className="caja-cc-steps-simple">
                <li>
                  <strong>Fondo</strong> (recomendado $ {fmtArs(resumen.fondoRecomendado)}, editable por la cajera) —
                  se traspasa a la otra caja operativa (ej. Rosa → Noelia).
                </li>
                <li>
                  <strong>Resto del arqueo</strong> (menos egresos del día) — va a <strong>Caja Administración</strong>.
                </li>
                <li>
                  En el cierre se sube el <strong>PDF planilla</strong> y los <strong>comprobantes</strong> MP / tarjetas.
                </li>
              </ol>
              <button type="button" className="btn-primary" onClick={onCierreTurno}>
                Ir a cierre de turno
              </button>
            </div>
          )}

          {resumen.cierresTurnoHoy.length > 0 && (
            <div className="caja-cc-card">
              <h3>Cierres de turno — {fmtDateAr(selectedFecha)}</h3>
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

          {resumen.cierresTurnoHoy.length === 0 &&
            resumen.ingresoHoy <= 0 &&
            resumen.egresosHoy <= 0 && (
              <p className="caja-cc-muted caja-cc-empty-day">
                Sin cierres de turno ni movimientos registrados para este día.
              </p>
            )}
        </>
      )}

      {detalleLote && (
        <CajaCierreTurnoDetalleModal lote={detalleLote} cajas={cajas} onClose={() => setDetalleLote(null)} />
      )}
    </>
  )
}
