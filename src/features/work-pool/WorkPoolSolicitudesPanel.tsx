import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolSolicitud } from '../../types/workPool'
import { nivelLabel, rubroLabel } from './workPoolPostulacion'
import {
  aprobarSolicitudOperario,
  listarSolicitudesOperario,
  rechazarSolicitudOperario
} from './workPoolRepository'
import { solicitudTipoLabel } from './workPoolOperarioExterno'

function adjuntoLink(url: string | null | undefined, nombre?: string | null) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="work-pool-solicitud-link">
      {nombre || 'Ver archivo'}
    </a>
  )
}

function SolicitudDetalle({ s }: { s: WorkPoolSolicitud }) {
  const rubro = s.rubro ?? (s.tipo === 'diseno' ? 'diseno' : 'instalaciones')
  return (
    <div className="work-pool-solicitud-detalle">
      <div className="work-pool-module__job-meta">
        <span>{rubroLabel(rubro)}</span>
        {s.nivel && <span>{nivelLabel(s.nivel)}</span>}
        {!s.rubro && <span>{solicitudTipoLabel(s.tipo)}</span>}
        {s.zona_cobertura && <span>{s.zona_cobertura}</span>}
        <span>{new Date(s.created_at).toLocaleDateString('es-AR')}</span>
      </div>
      {s.titulo_texto && <p><strong>Título:</strong> {s.titulo_texto}</p>}
      {s.experiencia && (
        <p className="work-pool-solicitud-block">
          <strong>Experiencia</strong>
          <br />
          {s.experiencia}
        </p>
      )}
      {s.referencias && (
        <p className="work-pool-solicitud-block">
          <strong>Referencias</strong>
          <br />
          {s.referencias}
        </p>
      )}
      {s.mensaje && <p>{s.mensaje}</p>}
      {s.skills.length > 0 && <p><strong>Skills:</strong> {s.skills.join(', ')}</p>}
      <div className="work-pool-solicitud-adjuntos">
        <span>{adjuntoLink(s.cv_url, s.cv_nombre ?? 'CV')}</span>
        <span>{adjuntoLink(s.titulo_url, s.titulo_nombre ?? 'Título / certificado')}</span>
        <span>{adjuntoLink(s.titulo_universitario_url, s.titulo_universitario_nombre ?? 'Título universitario')}</span>
        <span>{adjuntoLink(s.libreta_url, s.libreta_nombre ?? 'Libreta')}</span>
        <span>{adjuntoLink(s.portfolio_archivo_url, s.portfolio_archivo_nombre ?? 'Portafolio')}</span>
        {s.portfolio_url && (
          <a href={s.portfolio_url} target="_blank" rel="noreferrer" className="work-pool-solicitud-link">
            Portafolio (URL)
          </a>
        )}
      </div>
    </div>
  )
}

export default function WorkPoolSolicitudesPanel() {
  const { usuario } = useAuth()
  const [solicitudes, setSolicitudes] = useState<WorkPoolSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aprobarId, setAprobarId] = useState<number | null>(null)
  const [loginUser, setLoginUser] = useState('')
  const [password, setPassword] = useState('')
  const [notas, setNotas] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listarSolicitudesOperario('pendiente')
    if (res.success) setSolicitudes(res.data ?? [])
    else setError(res.error || 'Error al cargar solicitudes')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleAprobar = async () => {
    if (!usuario || aprobarId == null) return
    setError('')
    const res = await aprobarSolicitudOperario({
      id_solicitud: aprobarId,
      id_admin: usuario.id,
      usuario_login: loginUser.trim(),
      password,
      notas_admin: notas.trim() || undefined
    })
    if (!res.success) {
      setError(res.error || 'No se pudo aprobar')
      return
    }
    setAprobarId(null)
    setLoginUser('')
    setPassword('')
    setNotas('')
    void load()
  }

  const handleRechazar = async (id: number) => {
    if (!usuario) return
    const motivo = window.prompt('Motivo del rechazo (opcional)') ?? ''
    const res = await rechazarSolicitudOperario(id, usuario.id, motivo || undefined)
    if (!res.success) setError(res.error || 'No se pudo rechazar')
    else void load()
  }

  return (
    <section className="work-pool-admin__section">
      <div className="work-pool-admin__section-head">
        <h2>Solicitudes de operarios externos</h2>
        <span className="work-pool-admin__pill">{solicitudes.length}</span>
      </div>
      <p className="work-pool-publicar__muted" style={{ marginBottom: 14 }}>
        Formulario público en{' '}
        <a href="/operario-bolsa/solicitud" target="_blank" rel="noreferrer">
          /operario-bolsa/solicitud
        </a>{' '}
        o{' '}
        <a href="/postulacion-operarios" target="_blank" rel="noreferrer">
          /postulacion-operarios
        </a>
        . Al aprobar se crea usuario según rubro y nivel.
      </p>
      {error && <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div>}
      {loading ? (
        <p className="work-pool-module__empty">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <p className="work-pool-module__empty">No hay solicitudes pendientes.</p>
      ) : (
        <div className="work-pool-admin__review-list">
          {solicitudes.map((s) => (
            <article key={s.id} className="work-pool-admin__review-card">
              <div>
                <h4>
                  {s.nombre_completo} — {s.email}
                </h4>
                <SolicitudDetalle s={s} />
              </div>
              <div className="work-pool-module__job-actions">
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--success"
                  onClick={() => {
                    setAprobarId(s.id)
                    setLoginUser(s.nombre_completo.split(/\s+/)[0].toLowerCase())
                  }}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--warn"
                  onClick={() => void handleRechazar(s.id)}
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {aprobarId != null && (
        <div className="work-pool-admin__pay-box">
          <h3>Aprobar solicitud #{aprobarId}</h3>
          <div className="work-pool-module__form-row">
            <label>
              Usuario de login
              <input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            </label>
            <label>
              Contraseña inicial
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Notas admin
              <input value={notas} onChange={(e) => setNotas(e.target.value)} />
            </label>
          </div>
          <div className="work-pool-admin__pay-actions">
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--primary"
              onClick={() => void handleAprobar()}
            >
              Crear usuario y aprobar
            </button>
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--ghost"
              onClick={() => setAprobarId(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
