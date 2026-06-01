import { fmtArs, fmtDateAr } from '../format'
import type { CajaMovimiento, CajaRegistro } from '../types'

type Props = {
  movimientos: CajaMovimiento[]
  cajas: CajaRegistro[]
  onDelete?: (id: string) => void
  showUsuario?: boolean
}

function cajaNombre(slug: string, cajas: CajaRegistro[]) {
  return cajas.find((c) => c.slug === slug)?.nombre ?? slug
}

export default function CajaMovimientosList({ movimientos, cajas, onDelete, showUsuario }: Props) {
  if (!movimientos.length) {
    return <p className="caja-cc-empty">Sin movimientos cargados.</p>
  }
  return (
    <div className="caja-cc-timeline">
      {movimientos.map((m) => {
        const tot = m.efectivo + m.otros
        const cls =
          m.concepto === 'Fondo de caja'
            ? 'fondo'
            : m.concepto === 'Cierre de caja'
              ? 'cierre'
              : 'pase'
        return (
          <div key={m.id} className="caja-cc-timeline-item">
            <div className={`caja-cc-timeline-icon ${cls}`} aria-hidden>
              {m.concepto === 'Fondo de caja' ? '💰' : m.concepto === 'Cierre de caja' ? '🔒' : '↔️'}
            </div>
            <div className="caja-cc-timeline-body">
              <strong>{m.concepto}</strong>
              <div className="caja-cc-meta">
                {cajaNombre(m.origen_slug, cajas)} → {cajaNombre(m.destino_slug, cajas)} ·{' '}
                {fmtDateAr(m.fecha)}
                {m.hora ? ` ${m.hora}` : ''}
                {showUsuario && m.usuario_nombre ? ` · ${m.usuario_nombre}` : ''}
                {m.origen_importacion === 'planilla_pdf'
                  ? ' · Planilla PDF'
                  : m.origen_importacion === 'excel'
                    ? ' · Excel'
                    : ''}
              </div>
              {m.observacion && <div className="caja-cc-meta italic">{m.observacion}</div>}
            </div>
            <div className="caja-cc-timeline-end">
              <div className="caja-cc-amount">$ {fmtArs(tot)}</div>
              {onDelete && (
                <button type="button" className="btn-small danger" onClick={() => onDelete(m.id)}>
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
