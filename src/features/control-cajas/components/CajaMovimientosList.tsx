import { fmtArs, fmtDateAr } from '../format'
import { paseTieneTrazabilidad } from '../paseCaja'
import type { CajaMovimiento, CajaRegistro } from '../types'
import CajaMontoMovimiento from './CajaMontoMovimiento'

type Props = {
  movimientos: CajaMovimiento[]
  cajas: CajaRegistro[]
  onDelete?: (id: string) => void
  onSelect?: (m: CajaMovimiento) => void
  showUsuario?: boolean
  showPaseTrazabilidad?: boolean
}

function cajaNombre(slug: string, cajas: CajaRegistro[]) {
  return cajas.find((c) => c.slug === slug)?.nombre ?? slug
}

function filaMontos(label: string, antes: number | null | undefined, despues: number | null | undefined) {
  if (antes == null && despues == null) return null
  return (
    <span className="caja-cc-pase-trace-line">
      {label}: $ {fmtArs(antes ?? 0)} → $ {fmtArs(despues ?? 0)}
    </span>
  )
}

export default function CajaMovimientosList({
  movimientos,
  cajas,
  onDelete,
  onSelect,
  showUsuario,
  showPaseTrazabilidad = false
}: Props) {
  if (!movimientos.length) {
    return <p className="caja-cc-empty">Sin movimientos cargados.</p>
  }
  return (
    <div className="caja-cc-timeline">
      {movimientos.map((m) => {
        const cls =
          m.concepto === 'Fondo de caja'
            ? 'fondo'
            : m.concepto === 'Cierre de caja'
              ? 'cierre'
              : 'pase'
        return (
          <div
            key={m.id}
            className={`caja-cc-timeline-item${onSelect ? ' caja-cc-timeline-item-clickable' : ''}`}
            onClick={onSelect ? () => onSelect(m) : undefined}
            onKeyDown={
              onSelect
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(m)
                    }
                  }
                : undefined
            }
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            title={onSelect ? 'Ver detalle del movimiento' : undefined}
          >
            <div className={`caja-cc-timeline-icon ${cls}`} aria-hidden>
              {m.concepto === 'Fondo de caja' ? '💰' : m.concepto === 'Cierre de caja' ? '🔒' : '↔️'}
            </div>
            <div className="caja-cc-timeline-body">
              <strong>{m.concepto}</strong>
              <div className="caja-cc-meta">
                {cajaNombre(m.origen_slug, cajas)} → {cajaNombre(m.destino_slug, cajas)}
                {m.subtipo_pase === 'fondo'
                  ? ' · Fondo'
                  : m.subtipo_pase === 'resto_admin'
                    ? ' · Resto admin'
                    : ''}{' '}
                · {fmtDateAr(m.fecha)}
                {m.hora ? ` ${m.hora}` : ''}
                {showUsuario && m.usuario_nombre ? ` · ${m.usuario_nombre}` : ''}
                {m.origen_importacion === 'planilla_pdf'
                  ? ' · Planilla PDF'
                  : m.origen_importacion === 'plotlab_venta'
                    ? ' · Venta PlotLab'
                    : m.origen_importacion === 'comprobante'
                      ? ' · Comprobante MP/POS'
                      : m.origen_importacion === 'excel'
                        ? ' · Excel'
                        : ''}
                {m.anulado ? ' · Anulado' : ''}
                {m.cierre_id ? ' · En cierre cerrado' : ''}
              </div>
              {m.observacion && <div className="caja-cc-meta italic">{m.observacion}</div>}
              {showPaseTrazabilidad && paseTieneTrazabilidad(m) && (
                <div className="caja-cc-pase-trace">
                  {filaMontos('Origen efectivo', m.origen_efectivo_antes, m.origen_efectivo_despues)}
                  {filaMontos('Destino efectivo', m.destino_efectivo_antes, m.destino_efectivo_despues)}
                  {(m.origen_otros_antes != null || m.destino_otros_antes != null) && (
                    <>
                      {filaMontos('Origen otros', m.origen_otros_antes, m.origen_otros_despues)}
                      {filaMontos('Destino otros', m.destino_otros_antes, m.destino_otros_despues)}
                    </>
                  )}
                  {m.nro_comprobante && (
                    <span className="caja-cc-pase-trace-line">Comprobante: {m.nro_comprobante}</span>
                  )}
                  {m.created_at && (
                    <span className="caja-cc-pase-trace-line caja-cc-pase-id">
                      ID {m.id.slice(0, 8)}… · {new Date(m.created_at).toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="caja-cc-timeline-end">
              <CajaMontoMovimiento movimiento={m} />
              {onDelete && !m.cierre_id && !m.anulado && (
                <button
                  type="button"
                  className="btn-small danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(m.id)
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
