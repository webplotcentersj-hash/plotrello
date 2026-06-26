import { fmtArs } from '../format'
import {
  etiquetaMedioMovimiento,
  horaMovimiento,
  montoMovimientoLista,
  progresoDiaCaja
} from '../cajaMenuOperativaData'
import type { CajaEstadoOperativaHoy } from '../cajaOperativaHoy'
import type { CajaSectionId } from '../types'
import CajaPlotlabVentasPanel from './CajaPlotlabVentasPanel'

type Props = {
  estado: CajaEstadoOperativaHoy | null
  cargando: boolean
  enVivo?: boolean
  onNavigate: (section: CajaSectionId) => void
}

type EstadoChip = {
  section: CajaSectionId
  label: string
  valor: string
  tipo: 'ok' | 'pendiente' | 'alerta' | 'neutral'
}

function chipsDesdeEstado(estado: CajaEstadoOperativaHoy): EstadoChip[] {
  const movsHoy = estado.ultimosMovimientos.length
  const chips: EstadoChip[] = [
    {
      section: 'historial',
      label: 'Movimientos',
      valor: movsHoy > 0 ? `${movsHoy}+ hoy` : 'Ver del día',
      tipo: movsHoy > 0 ? 'ok' : 'neutral'
    },
    {
      section: 'arqueo',
      label: 'Arqueo',
      valor: estado.arqueoHecho ? 'Listo' : 'Pendiente',
      tipo: estado.arqueoHecho ? 'ok' : 'pendiente'
    },
    {
      section: 'cierre_turno',
      label: 'Cierre turno',
      valor: estado.cierreTurnoHecho ? 'Listo' : 'Pendiente',
      tipo: estado.cierreTurnoHecho ? 'ok' : 'pendiente'
    }
  ]

  if (estado.egresosPendientes > 0) {
    chips.push({
      section: 'egresos',
      label: 'Egresos',
      valor: `${estado.egresosPendientes} pendiente(s)`,
      tipo: 'alerta'
    })
  }

  if (estado.traspasosPendientes > 0) {
    chips.push({
      section: 'traspasos',
      label: 'Traspasos',
      valor: `${estado.traspasosPendientes} por confirmar`,
      tipo: 'alerta'
    })
  }

  return chips
}

export default function CajaMenuResumenDia({ estado, cargando, enVivo, onNavigate }: Props) {
  if (cargando) {
    return (
      <section className="caja-cc-menu-resumen" aria-label="Resumen del día" aria-busy="true">
        <p className="caja-cc-menu-resumen-loading">Cargando ventas y movimientos del día…</p>
      </section>
    )
  }

  if (!estado) return null

  const chips = chipsDesdeEstado(estado)
  const totales = estado.totalesDia
  const pasos = progresoDiaCaja({
    resumenPlotlabCount: estado.resumenPlotlab?.count ?? 0,
    ingresosDia: totales?.ingresos ?? 0,
    arqueoHecho: estado.arqueoHecho,
    cierreTurnoHecho: estado.cierreTurnoHecho
  })
  const pasosHechos = pasos.filter((p) => p.hecho).length

  return (
    <section className="caja-cc-menu-resumen" aria-label="Resumen del día en Plot Lab">
      <div className="caja-cc-menu-resumen-head">
        <span className="caja-cc-menu-turno-chip" title="Turno activo sugerido">
          Turno: <strong>{estado.turnoActivo}</strong>
        </span>
        {enVivo ? (
          <span className="caja-cc-menu-vivo" title="Ventas Plot Lab se sincronizan solas">
            <span className="caja-cc-menu-vivo-dot" aria-hidden />
            En vivo
          </span>
        ) : null}
      </div>

      <div className="caja-cc-menu-progreso" aria-label="Progreso del día">
        <div className="caja-cc-menu-progreso-head">
          <strong>Progreso del día</strong>
          <span>
            {pasosHechos}/{pasos.length}
          </span>
        </div>
        <div
          className="caja-cc-menu-progreso-bar"
          role="progressbar"
          aria-valuenow={pasosHechos}
          aria-valuemin={0}
          aria-valuemax={pasos.length}
        >
          <span style={{ width: `${(pasosHechos / pasos.length) * 100}%` }} />
        </div>
        <ul className="caja-cc-menu-progreso-pasos">
          {pasos.map((p) => (
            <li key={p.id} className={p.hecho ? 'hecho' : ''}>
              <span aria-hidden>{p.hecho ? '✓' : '○'}</span> {p.label}
            </li>
          ))}
        </ul>
      </div>

      {estado.cajaNombre && estado.resumenPlotlab ? (
        <CajaPlotlabVentasPanel resumen={estado.resumenPlotlab} cajaNombre={estado.cajaNombre} />
      ) : null}

      {estado.efectivoTeorico != null ? (
        <div className="caja-cc-menu-teorico">
          <div>
            <small>Efectivo teórico en caja (fondo + movimientos físicos)</small>
            <strong>$ {fmtArs(estado.efectivoTeorico)}</strong>
          </div>
          <button type="button" className="btn-link" onClick={() => onNavigate('arqueo')}>
            Ir a contar billetes →
          </button>
        </div>
      ) : null}

      {totales ? (
        <div className="caja-cc-menu-coherencia" aria-label="Movimientos coherentes del día">
          <div className="caja-cc-menu-coherencia-kpi">
            <small>Ingresos</small>
            <strong>$ {fmtArs(totales.ingresos)}</strong>
          </div>
          <div className="caja-cc-menu-coherencia-kpi">
            <small>Egresos</small>
            <strong>$ {fmtArs(totales.egresos)}</strong>
          </div>
          <div className="caja-cc-menu-coherencia-kpi caja-cc-menu-coherencia-kpi--neto">
            <small>Neto día</small>
            <strong>$ {fmtArs(totales.neto)}</strong>
          </div>
          <div className="caja-cc-menu-coherencia-kpi">
            <small>Comprobantes</small>
            <strong>{totales.comprobantes_unicos}</strong>
          </div>
        </div>
      ) : null}

      <div className="caja-cc-menu-estado-grid" role="list" aria-label="Estado de cierre del día">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            role="listitem"
            className={`caja-cc-menu-estado-chip caja-cc-menu-estado-chip--${chip.tipo}`}
            onClick={() => onNavigate(chip.section)}
          >
            <span className="caja-cc-menu-estado-chip-label">{chip.label}</span>
            <strong>{chip.valor}</strong>
          </button>
        ))}
      </div>

      <div className="caja-cc-menu-movs">
        <div className="caja-cc-menu-movs-head">
          <h3>Últimos movimientos del día</h3>
          <button type="button" className="btn-link" onClick={() => onNavigate('historial')}>
            Ver todos →
          </button>
        </div>
        {estado.ultimosMovimientos.length === 0 ? (
          <p className="caja-cc-menu-movs-empty">
            Todavía no hay movimientos hoy. Las ventas de Plot Lab aparecen acá al cobrar.
          </p>
        ) : (
          <ul className="caja-cc-menu-movs-list">
            {estado.ultimosMovimientos.map((m) => (
              <li key={m.id}>
                <span className="caja-cc-menu-movs-hora">{horaMovimiento(m)}</span>
                <span className="caja-cc-menu-movs-concepto">
                  {m.concepto || m.observacion || 'Movimiento'}
                  <small>{etiquetaMedioMovimiento(m)}</small>
                </span>
                <strong className="caja-cc-menu-movs-monto">
                  {m.tipo_movimiento === 'egreso' ? '−' : '+'} $ {fmtArs(montoMovimientoLista(m))}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
