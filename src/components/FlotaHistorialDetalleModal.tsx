import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { RegistroSalidaVehiculo } from '../types/api'
import { exportFlotaRegistroSalidaPdf } from '../utils/flotaRegistroSalidaPdf'
import './FlotaHistorialDetalleModal.css'

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR')
  } catch {
    return String(iso)
  }
}

function yn(v: boolean | null | undefined): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

type RowProps = { label: string; children: ReactNode }

function Row({ label, children }: RowProps) {
  return (
    <div className="flota-detalle-row">
      <dt className="flota-detalle-dt">{label}</dt>
      <dd className="flota-detalle-dd">{children}</dd>
    </div>
  )
}

type Props = {
  registro: RegistroSalidaVehiculo
  onClose: () => void
}

export default function FlotaHistorialDetalleModal({ registro: r, onClose }: Props) {
  const v = r.vehiculo
  const acomp = r.acompanantes
  const mapsUrl =
    r.latitud != null && r.longitud != null
      ? `https://www.google.com/maps?q=${r.latitud},${r.longitud}`
      : null

  const modal = (
    <div
      className="flota-detalle-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flota-detalle-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flota-detalle-modal" onClick={(e) => e.stopPropagation()}>
        <header className="flota-detalle-header">
          <h2 id="flota-detalle-title">Viaje #{r.id} — {v?.nombre ?? 'Vehículo'}</h2>
          <button type="button" className="flota-detalle-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="flota-detalle-body">
          <p className="flota-detalle-estado">
            Estado: <strong>{r.estado}</strong>
          </p>
          <dl className="flota-detalle-dl">
            <Row label="ID registro">{r.id}</Row>
            <Row label="Vehículo (nombre)">{v?.nombre ?? '—'}</Row>
            <Row label="ID vehículo">{r.id_vehiculo}</Row>
            <Row label="Patente">{v?.patente != null && String(v.patente).trim() !== '' ? v.patente : '—'}</Row>
            <Row label="Catálogo vehículo activo">{v ? (v.activo ? 'Sí' : 'No') : '—'}</Row>
            <Row label="Estado en parque">{v?.estado_parque != null ? String(v.estado_parque) : '—'}</Row>
            <Row label="Detalle parque">{v?.estado_parque_detalle?.trim() || '—'}</Row>
            <Row label="Conductor">{r.nombre_usuario}</Row>
            <Row label="ID usuario conductor">{r.id_usuario != null ? r.id_usuario : '—'}</Row>
            <Row label="Sector">{r.sector}</Row>
            <Row label="Km odómetro (salida)">{r.km_aproximado != null ? r.km_aproximado : '—'}</Row>
            <Row label="Nº OP / trabajo">{r.numero_op?.trim() || '—'}</Row>
            <Row label="Motivo de la salida">
              <span className="flota-detalle-multiline">{r.motivo_salida}</span>
            </Row>
            <Row label="Hora de salida">{fmt(r.hora_salida)}</Row>
            <Row label="Llegada estimada">{fmt(r.hora_estimada_llegada)}</Row>
            <Row label="Llegada real">{fmt(r.hora_llegada_real)}</Row>
            <Row label="Combustible restante al llegar (L)">
              {r.litros_combustible_llegada != null ? `${Number(r.litros_combustible_llegada)} L` : '—'}
            </Row>
            <Row label="Objetivo de la salida cumplido">{yn(r.objetivo_cumplido)}</Row>
            <Row label="Observaciones del conductor (llegada)">
              <span className="flota-detalle-multiline">{r.observaciones_llegada?.trim() || '—'}</span>
            </Row>
            <Row label="Destino (texto)">{r.ubicacion_destino?.trim() || '—'}</Row>
            <Row label="Coordenadas destino">
              {r.latitud != null && r.longitud != null ? `${r.latitud}, ${r.longitud}` : '—'}
            </Row>
            <Row label="Mapa">
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flota-detalle-link">
                  Abrir en Google Maps
                </a>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Acompañantes">
              {Array.isArray(acomp) && acomp.length > 0 ? (
                <ul className="flota-detalle-list-acomp">
                  {acomp.map((a) => (
                    <li key={a.id_usuario}>
                      {a.nombre} <span className="flota-detalle-id">(id {a.id_usuario})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Llave entregada al autorizar">{r.llave_entregada ? 'Sí' : 'No'}</Row>
            <Row label="Caja — quien entregó llave">{r.nombre_usuario_caja_entrego_llave?.trim() || '—'}</Row>
            <Row label="Caja — id usuario">{r.id_usuario_caja_entrego_llave != null ? r.id_usuario_caja_entrego_llave : '—'}</Row>
            <Row label="Observaciones (cierre / administración)">
              <span className="flota-detalle-multiline">{r.observaciones?.trim() || '—'}</span>
            </Row>
            <Row label="Alta en sistema">{fmt(r.created_at)}</Row>
            <Row label="Última actualización">{fmt(r.updated_at)}</Row>
          </dl>
        </div>
        <footer className="flota-detalle-footer">
          <button type="button" className="flota-detalle-btn secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="flota-detalle-btn primary"
            onClick={() => exportFlotaRegistroSalidaPdf(r)}
          >
            Descargar PDF
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
