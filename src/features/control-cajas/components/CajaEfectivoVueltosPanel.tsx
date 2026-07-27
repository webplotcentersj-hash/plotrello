import { fmtArs } from '../format'
import type { CajaMovimiento } from '../types'

export type CobroEfectivoTraza = {
  id: string
  hora: string
  cliente: string
  /** Neto que queda en caja (venta). */
  monto: number
  montoRecibido: number | null
  vuelto: number | null
  observacion: string
}

function parsePagóVuelto(obs: string | null | undefined): {
  montoRecibido: number | null
  vuelto: number | null
} {
  if (!obs) return { montoRecibido: null, vuelto: null }
  const recibidoM = obs.match(/Pag[oó]\s*\$?\s*([\d]+(?:[.,]\d+)?)/i)
  const vueltoM = obs.match(/Vuelto\s*\$?\s*([\d]+(?:[.,]\d+)?)/i)
  const parseFlexible = (raw: string | undefined) => {
    if (!raw) return null
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return {
    montoRecibido: parseFlexible(recibidoM?.[1]),
    vuelto: parseFlexible(vueltoM?.[1])
  }
}

/** Cobros en efectivo del día (Plot Lab) para trazabilidad en arqueo. */
export function cobrosEfectivoConVuelto(
  movimientos: CajaMovimiento[],
  fecha: string,
  cajaSlug: string
): CobroEfectivoTraza[] {
  return movimientos
    .filter(
      (m) =>
        !m.anulado &&
        m.fecha === fecha &&
        (m.destino_slug === cajaSlug || m.origen_slug === cajaSlug) &&
        (Number(m.efectivo) || 0) > 0 &&
        (m.origen_importacion === 'plotlab_venta' || /efectivo/i.test(m.observacion || ''))
    )
    .map((m) => {
      const { montoRecibido, vuelto } = parsePagóVuelto(m.observacion)
      const montoMov = Number(m.efectivo) || Number(m.monto_total) || 0
      // Si hay pagó/vuelto, el neto en caja es pagó − vuelto (debe coincidir con la venta).
      const neto =
        montoRecibido != null
          ? Math.max(0, Math.round((montoRecibido - (vuelto ?? 0)) * 100) / 100)
          : montoMov
      return {
        id: m.id,
        hora: m.hora || '',
        cliente: m.tercero_nombre || m.concepto || 'Cliente',
        monto: neto > 0 ? neto : montoMov,
        montoRecibido,
        vuelto,
        observacion: m.observacion || ''
      }
    })
    .sort((a, b) => (b.hora || '').localeCompare(a.hora || ''))
}

/** Suma del efectivo que debe quedar en caja por cobros (neto, ya sin vuelto). */
export function netoEfectivoCobrosDia(items: CobroEfectivoTraza[]): {
  netoEnCaja: number
  totalPagado: number
  totalVuelto: number
  conTraza: number
} {
  let netoEnCaja = 0
  let totalPagado = 0
  let totalVuelto = 0
  let conTraza = 0
  for (const i of items) {
    netoEnCaja += i.monto
    if (i.montoRecibido != null) {
      conTraza++
      totalPagado += i.montoRecibido
      totalVuelto += i.vuelto ?? 0
    }
  }
  return { netoEnCaja, totalPagado, totalVuelto, conTraza }
}

type Props = {
  items: CobroEfectivoTraza[]
  /** Egresos en efectivo del día. */
  egresosEfectivo?: number
}

export default function CajaEfectivoVueltosPanel({ items, egresosEfectivo = 0 }: Props) {
  if (items.length === 0) return null

  const { netoEnCaja, totalPagado, totalVuelto, conTraza } = netoEfectivoCobrosDia(items)
  // Objetivo = ventas neto − egresos. El fondo no se suma: sale del contado.
  const debeHaber = Math.max(0, netoEnCaja - egresosEfectivo)

  return (
    <div className="caja-cc-efectivo-vueltos" aria-label="Cobros en efectivo con vuelto">
      <strong>Efectivo — lo que queda en caja</strong>
      <p className="caja-cc-sub">
        Contá <strong>lo que hay</strong>. El vuelto ya salió (queda el neto de cada venta). El fondo
        dejado sale de ese contado: no se suma ni resta al objetivo.
      </p>

      <div className="caja-cc-efectivo-vueltos__resumen">
        <div>
          <span>Ventas neto (queda)</span>
          <strong>$ {fmtArs(netoEnCaja)}</strong>
        </div>
        {conTraza > 0 ? (
          <>
            <div>
              <span>Clientes pagaron</span>
              <strong>$ {fmtArs(totalPagado)}</strong>
            </div>
            <div>
              <span>− Vuelto entregado</span>
              <strong>$ {fmtArs(totalVuelto)}</strong>
            </div>
          </>
        ) : null}
        {egresosEfectivo > 0 ? (
          <div>
            <span>− Egresos efectivo</span>
            <strong>$ {fmtArs(egresosEfectivo)}</strong>
          </div>
        ) : null}
        <div className="caja-cc-efectivo-vueltos__debe">
          <span>Debés tener ahora</span>
          <strong>$ {fmtArs(debeHaber)}</strong>
        </div>
      </div>

      {conTraza === 0 ? (
        <p className="caja-cc-sub">
          Hay {items.length} cobro{items.length === 1 ? '' : 's'} en efectivo sin dato de &quot;pagó
          con&quot; (anteriores al registro de vuelto). Se usa el monto de la venta.
        </p>
      ) : (
        <ul className="caja-cc-efectivo-vueltos__lista">
          {items.map((i) => (
            <li key={i.id}>
              <span className="caja-cc-efectivo-vueltos__hora">{i.hora || '—'}</span>
              <span className="caja-cc-efectivo-vueltos__cli">{i.cliente}</span>
              <span className="caja-cc-efectivo-vueltos__montos">
                Queda <strong>$ {fmtArs(i.monto)}</strong>
                {i.montoRecibido != null ? (
                  <>
                    {' '}
                    (pagó $ {fmtArs(i.montoRecibido)} − vuelto $ {fmtArs(i.vuelto ?? 0)})
                  </>
                ) : (
                  <span className="caja-cc-efectivo-vueltos__sin"> · sin vuelto registrado</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
