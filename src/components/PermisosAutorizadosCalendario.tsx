import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { SolicitudPermiso, UsuarioRecord } from '../types/api'
import { permisoEnDia } from '../utils/rrhhNovedadDates'

type Props = {
  usuarios: UsuarioRecord[]
  permisos: SolicitudPermiso[]
}

const TIPO_LABEL: Record<string, string> = {
  permiso: 'Permiso',
  vacaciones: 'Vacaciones',
  ausencia: 'Ausencia',
  turno: 'Turno',
  ropa: 'Ropa',
  otro: 'Otro'
}

function nombreCorto(nombre: string | undefined, max = 10): string {
  if (!nombre) return '—'
  const base = nombre.split('@')[0]?.split(/\s+/)[0] ?? nombre
  return base.length <= max ? base : `${base.slice(0, max - 1)}…`
}

const PermisosAutorizadosCalendario = ({
  usuarios,
  permisos
}: Props) => {
  const [mes, setMes] = useState(() => new Date())
  const [detalle, setDetalle] = useState<SolicitudPermiso | null>(null)

  const nombres = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, u.nombre))
    return m
  }, [usuarios])

  const aprobados = useMemo(
    () => permisos.filter((p) => p.estado === 'aprobado'),
    [permisos]
  )

  const monthStart = startOfMonth(mes)
  const monthEnd = endOfMonth(mes)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const padStart = (monthStart.getDay() + 6) % 7

  const permisosDelMes = useMemo(
    () =>
      aprobados.filter((p) => {
        if (!p.fecha_inicio) return false
        const desde = String(p.fecha_inicio).slice(0, 10)
        const hasta = String(p.fecha_fin || p.fecha_inicio).slice(0, 10)
        return (
          desde <= format(monthEnd, 'yyyy-MM-dd') &&
          hasta >= format(monthStart, 'yyyy-MM-dd')
        )
      }),
    [aprobados, monthStart, monthEnd]
  )

  return (
    <div className="rrhh-permisos-cal">
      <div className="reloj-historial-head">
        <button type="button" className="reloj-historial-nav" onClick={() => setMes(subMonths(mes, 1))}>
          ←
        </button>
        <h3>{format(mes, 'MMMM yyyy', { locale: es })}</h3>
        <button type="button" className="reloj-historial-nav" onClick={() => setMes(addMonths(mes, 1))}>
          →
        </button>
      </div>

      <p className="rrhh-permisos-cal-help">
        Permisos y licencias <strong>aprobados</strong>. Cada día muestra quién tiene autorización vigente.
      </p>

      <div className="reloj-historial-weekdays">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="rrhh-permisos-cal-grid">
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="rrhh-permisos-cal-day rrhh-permisos-cal-day--empty" />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const list = permisosDelMes.filter((p) => permisoEnDia(p, key))
          const visible = list.slice(0, 3)
          const hidden = list.length - visible.length
          return (
            <div key={key} className="rrhh-permisos-cal-day">
              <div className="rrhh-permisos-cal-daynum">{format(day, 'd')}</div>
              <div className="rrhh-permisos-cal-chips">
                {visible.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`rrhh-permisos-cal-chip rrhh-permisos-cal-chip--${p.tipo_solicitud}`}
                    title={`${nombres.get(p.id_usuario) || p.nombre_usuario || ''} · ${p.titulo}`}
                    onClick={() => setDetalle(p)}
                  >
                    {nombreCorto(nombres.get(p.id_usuario) || p.nombre_usuario)}
                  </button>
                ))}
                {hidden > 0 ? <span className="rrhh-permisos-cal-more">+{hidden}</span> : null}
              </div>
            </div>
          )
        })}
      </div>

      {permisosDelMes.length === 0 ? (
        <p className="reloj-historial-empty">No hay permisos autorizados en este mes.</p>
      ) : (
        <ul className="rrhh-permisos-cal-lista">
          {permisosDelMes.map((p) => {
            const desde = p.fecha_inicio ? parseISO(p.fecha_inicio.slice(0, 10)) : null
            const hasta = p.fecha_fin ? parseISO(p.fecha_fin.slice(0, 10)) : desde
            const fechas =
              desde && hasta
                ? isSameMonth(desde, hasta)
                  ? `${format(desde, 'd')}–${format(hasta, 'd/M/yyyy')}`
                  : `${format(desde, 'd/M/yyyy')} – ${format(hasta!, 'd/M/yyyy')}`
                : '—'
            return (
              <li key={p.id}>
                <button type="button" className="reloj-historial-item" onClick={() => setDetalle(p)}>
                  <span className="reloj-historial-item-fechas">
                    ✅ {TIPO_LABEL[p.tipo_solicitud] || p.tipo_solicitud} · {fechas}
                  </span>
                  <span className="reloj-historial-item-stats">
                    {nombres.get(p.id_usuario) || p.nombre_usuario} — {p.titulo}
                  </span>
                  {p.descripcion ? (
                    <span className="reloj-historial-item-meta">{p.descripcion}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {detalle ? (
        <div className="rrhh-modal-overlay" onClick={() => setDetalle(null)}>
          <div className="rrhh-modal rrhh-permisos-detalle" onClick={(e) => e.stopPropagation()}>
            <h2>{TIPO_LABEL[detalle.tipo_solicitud] || detalle.tipo_solicitud} autorizado</h2>
            <p>
              <strong>Empleado:</strong>{' '}
              {nombres.get(detalle.id_usuario) || detalle.nombre_usuario || `#${detalle.id_usuario}`}
            </p>
            <p>
              <strong>Título:</strong> {detalle.titulo}
            </p>
            {detalle.descripcion ? (
              <p>
                <strong>Descripción:</strong> {detalle.descripcion}
              </p>
            ) : null}
            <p>
              <strong>Período:</strong>{' '}
              {detalle.fecha_inicio
                ? `${format(parseISO(detalle.fecha_inicio.slice(0, 10)), 'd/M/yyyy')}${
                    detalle.fecha_fin
                      ? ` → ${format(parseISO(detalle.fecha_fin.slice(0, 10)), 'd/M/yyyy')}`
                      : ''
                  }`
                : '—'}
            </p>
            {detalle.dias_solicitados != null ? (
              <p>
                <strong>Días:</strong> {detalle.dias_solicitados}
              </p>
            ) : null}
            {detalle.aprobado_por_nombre ? (
              <p>
                <strong>Aprobado por:</strong> {detalle.aprobado_por_nombre}
              </p>
            ) : null}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PermisosAutorizadosCalendario
