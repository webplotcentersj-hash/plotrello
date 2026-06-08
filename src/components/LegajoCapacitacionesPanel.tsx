import { useMemo } from 'react'
import type { Capacitacion } from '../types/api'
import {
  competenciasDeCapacitacion,
  ETIQUETA_ESTADO_INSCRIPCION,
  etiquetaCompetencia,
  esCapacitacionCompletada
} from '../utils/rrhhCapacitacionCompetencias'
import { calcularIndicadoresCapacitacion, fmtPct } from '../utils/rrhhCapacitacionStats'
import './LegajoCapacitacionesPanel.css'

type LegajoCapacitacionesPanelProps = {
  capacitaciones: Capacitacion[]
  sectorLegajo?: string | null
  rolUsuario?: string | null
  formatDate: (d: string | null | undefined) => string
}

const LegajoCapacitacionesPanel = ({
  capacitaciones,
  sectorLegajo,
  rolUsuario,
  formatDate
}: LegajoCapacitacionesPanelProps) => {
  const stats = useMemo(
    () => calcularIndicadoresCapacitacion(capacitaciones, sectorLegajo, rolUsuario),
    [capacitaciones, sectorLegajo, rolUsuario]
  )

  if (capacitaciones.length === 0) {
    return (
      <div className="ver-legajo-empty-small">No hay capacitaciones asignadas a este colaborador.</div>
    )
  }

  return (
    <div className="legajo-cap-panel">
      <section className="legajo-cap-kpis" aria-label="Indicadores de capacitación">
        <article className="legajo-cap-kpi">
          <span className="legajo-cap-kpi-value">{stats.asignadas}</span>
          <span className="legajo-cap-kpi-label">Asignadas</span>
        </article>
        <article className="legajo-cap-kpi legajo-cap-kpi--ok">
          <span className="legajo-cap-kpi-value">{stats.completadas}</span>
          <span className="legajo-cap-kpi-label">Completadas</span>
        </article>
        <article className="legajo-cap-kpi">
          <span className="legajo-cap-kpi-value">{stats.horasAcumuladas} h</span>
          <span className="legajo-cap-kpi-label">Horas acumuladas</span>
        </article>
        <article className="legajo-cap-kpi legajo-cap-kpi--pct">
          <span className="legajo-cap-kpi-value">{fmtPct(stats.cumplimientoPct)}</span>
          <span className="legajo-cap-kpi-label">Cumplimiento general</span>
        </article>
        <article className="legajo-cap-kpi legajo-cap-kpi--plan">
          <span className="legajo-cap-kpi-value">{fmtPct(stats.cumplimientoPlanPct)}</span>
          <span className="legajo-cap-kpi-label">Plan de formación</span>
          <span className="legajo-cap-kpi-hint">
            {stats.obligatoriasAsignadas > 0
              ? `${stats.obligatoriasCompletadas}/${stats.obligatoriasAsignadas} obligatorias`
              : 'Sin obligatorias definidas'}
          </span>
        </article>
        <article className="legajo-cap-kpi">
          <span className="legajo-cap-kpi-value">
            {stats.promedioCalificacion != null ? stats.promedioCalificacion : '—'}
          </span>
          <span className="legajo-cap-kpi-label">Promedio calificaciones</span>
        </article>
      </section>

      {stats.perfil ? (
        <section className="legajo-cap-perfil">
          <h4>Perfil de puesto: {stats.perfil.label}</h4>
          <div className="legajo-cap-perfil-grid">
            <div>
              <p className="legajo-cap-perfil-sub">Competencias desarrolladas</p>
              {stats.competenciasDesarrolladas.length === 0 ? (
                <p className="legajo-cap-muted">Aún sin competencias certificadas por formación completada.</p>
              ) : (
                <ul className="legajo-cap-tags">
                  {stats.competenciasDesarrolladas.map((id) => (
                    <li key={id} className="legajo-cap-tag legajo-cap-tag--ok">
                      {etiquetaCompetencia(id)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="legajo-cap-perfil-sub">
                Cobertura del perfil{' '}
                {stats.coberturaPerfilPct != null ? (
                  <strong>{fmtPct(stats.coberturaPerfilPct)}</strong>
                ) : null}
              </p>
              {stats.brechaCompetencias.length === 0 ? (
                <p className="legajo-cap-muted legajo-cap-muted--ok">
                  Perfil cubierto según capacitaciones completadas.
                </p>
              ) : (
                <ul className="legajo-cap-tags">
                  {stats.brechaCompetencias.map((id) => (
                    <li key={id} className="legajo-cap-tag legajo-cap-tag--gap">
                      Pendiente: {etiquetaCompetencia(id)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="legajo-cap-hint">
          Definí el sector en el legajo o el rol del usuario para vincular competencias con el perfil de
          puesto organizacional.
        </p>
      )}

      <div className="ver-legajo-table-wrap">
        <table className="ver-legajo-table">
          <thead>
            <tr>
              <th>Capacitación</th>
              <th>Categoría</th>
              <th>Competencias</th>
              <th>Horas</th>
              <th>Inscripción</th>
              <th>Asistió</th>
              <th>Calificación</th>
            </tr>
          </thead>
          <tbody>
            {capacitaciones.map((c) => {
              const comps = competenciasDeCapacitacion(c)
              const est = c.estado_inscripcion
                ? ETIQUETA_ESTADO_INSCRIPCION[c.estado_inscripcion] ?? c.estado_inscripcion
                : '—'
              return (
                <tr
                  key={c.id}
                  className={esCapacitacionCompletada(c) ? 'legajo-cap-row--done' : undefined}
                >
                  <td>
                    <span className="legajo-cap-titulo">{c.titulo}</span>
                    {c.es_obligatoria ? (
                      <span className="legajo-cap-oblig" title="Obligatoria">
                        Oblig.
                      </span>
                    ) : null}
                    {c.fecha_fin ? (
                      <span className="legajo-cap-fecha">{formatDate(c.fecha_fin)}</span>
                    ) : null}
                  </td>
                  <td>{c.categoria || '—'}</td>
                  <td>
                    <div className="legajo-cap-tags legajo-cap-tags--inline">
                      {comps.map((id) => (
                        <span key={id} className="legajo-cap-tag legajo-cap-tag--sm">
                          {etiquetaCompetencia(id)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{c.duracion_horas != null ? `${c.duracion_horas} h` : '—'}</td>
                  <td>{est}</td>
                  <td>{c.asistio === true ? 'Sí' : c.asistio === false ? 'No' : '—'}</td>
                  <td>{c.calificacion != null ? String(c.calificacion) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LegajoCapacitacionesPanel
