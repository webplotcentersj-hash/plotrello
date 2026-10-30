import { useState } from 'react'
import { fmtArs } from '../format'
import {
  etiquetaMedioMovimiento,
  esSalidaDeCaja,
  horaMovimiento,
  montoMovimientoLista,
  progresoDiaCaja,
  type ConteoMovimientosCaja
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

function etiquetaConteo(n: number): string {
  return n === 1 ? '1 movimiento' : `${n} movimientos`
}

function FilasConteo({ conteo }: { conteo: ConteoMovimientosCaja }) {
  return (
    <ul className="caja-cc-menu-caja-stats">
      <li>
        <span>Ingresos</span>
        <strong>
          {conteo.ingresos} · $ {fmtArs(conteo.ingresosMonto)}
        </strong>
      </li>
      <li>
        <span>Egresos</span>
        <strong>
          {conteo.egresos} · $ {fmtArs(conteo.egresosMonto)}
        </strong>
      </li>
      <li>
        <span>Traspasos</span>
        <strong>{conteo.traspasos}</strong>
      </li>
      <li>
        <span>Ajustes</span>
        <strong>{conteo.ajustes}</strong>
      </li>
      {conteo.otros > 0 ? (
        <li>
          <span>Otros</span>
          <strong>{conteo.otros}</strong>
        </li>
      ) : null}
      <li className="caja-cc-menu-caja-stats-total">
        <span>Total</span>
        <strong>{conteo.total}</strong>
      </li>
    </ul>
  )
}

function BotonCaja({
  hoy,
  historico,
  onVerMovimientos
}: {
  hoy: ConteoMovimientosCaja
  historico: ConteoMovimientosCaja
  onVerMovimientos: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [conHistorico, setConHistorico] = useState(false)

  return (
    <div className={`caja-cc-menu-caja${abierto ? ' is-open' : ''}`}>
      <button
        type="button"
        className="caja-cc-menu-caja-btn"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="caja-cc-menu-caja-btn-title">Caja</span>
        <span className="caja-cc-menu-caja-btn-count">{etiquetaConteo(hoy.total)} hoy</span>
        <span className="caja-cc-menu-caja-btn-chevron" aria-hidden>
          {abierto ? '▼' : '▶'}
        </span>
      </button>
      {abierto ? (
        <div className="caja-cc-menu-caja-panel">
          <p className="caja-cc-menu-caja-panel-title">Hoy</p>
          <FilasConteo conteo={hoy} />
          <label className="caja-cc-menu-caja-historico">
            <input
              type="checkbox"
              checked={conHistorico}
              onChange={(e) => setConHistorico(e.target.checked)}
            />
            Incluir histórico
          </label>
          {conHistorico ? (
            <>
              <p className="caja-cc-menu-caja-panel-title">
                Histórico · {etiquetaConteo(historico.total)}
              </p>
              <FilasConteo conteo={historico} />
            </>
          ) : null}
          <button type="button" className="btn-link" onClick={onVerMovimientos}>
            Ver movimientos →
          </button>
        </div>
      ) : null}
    </div>
  )
}

function chipsDesdeEstado(estado: CajaEstadoOperativaHoy): EstadoChip[] {
  const movsHoy = estado.conteoMovimientosHoy.total
  const chips: EstadoChip[] = [
    {
      section: 'historial',
      label: 'Movimientos',
      valor: movsHoy > 0 ? `${movsHoy} hoy` : 'Ver del día',
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
          <span className="caja-cc-menu-vivo" title="Ventas Plot Lab al instante">
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

      {estado.cajaSlug ? (
        <BotonCaja
          hoy={estado.conteoMovimientosHoy}
          historico={estado.conteoMovimientosHistorico}
          onVerMovimientos={() => onNavigate('historial')}
        />
      ) : null}

      {estado.cajaNombre ? (
        <CajaPlotlabVentasPanel
          resumen={estado.resumenPlotlab ?? { count: 0, efectivo: 0, tarjetas: 0, transferencia: 0, ctaCte: 0, otros: 0, total: 0 }}
          cajaNombre={estado.cajaNombre}
        />
      ) : null}

      {estado.efectivoTeorico != null ? (
        <div className="caja-cc-menu-teorico">
          <div>
            <small>
              {estado.resumenPlotlab && estado.resumenPlotlab.efectivo > 0
                ? 'Efectivo a contar (ventas en efectivo Plot Lab − egresos)'
                : 'Efectivo teórico en caja (movimientos físicos − egresos)'}
            </small>
            <strong>$ {fmtArs(estado.efectivoTeorico)}</strong>
          </div>
          <button type="button" className="btn-link" onClick={() => onNavigate('arqueo')}>
            Contar billetes →
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
                  {esSalidaDeCaja(m, estado.cajaSlug || '') ? '−' : '+'} $ {fmtArs(montoMovimientoLista(m))}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
