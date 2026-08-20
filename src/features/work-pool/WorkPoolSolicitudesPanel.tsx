import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct, WorkPoolSolicitud } from '../../types/workPool'
import { nivelLabel, rubroLabel } from './workPoolPostulacion'
import {
  aprobarSolicitudOperario,
  listarSolicitudesOperario,
  rechazarSolicitudOperario
} from './workPoolRepository'
import { operarioExternoHomeRoute, OPERARIO_EXTERNO_LOGIN } from './workPoolOperarioExterno'
import WorkPoolSolicitudDetailModal from './WorkPoolSolicitudDetailModal'

type Props = {
  product?: WorkPoolProduct
  onPendingCount?: (n: number) => void
}

type OrigenFilter = 'todos' | 'phi' | 'rrhh'

const PAGE_SIZE = 10

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function isOrigenPhi(s: WorkPoolSolicitud) {
  return s.origen !== 'rrhh'
}

function matchesSolicitudQuery(s: WorkPoolSolicitud, q: string) {
  const rubro = s.rubro ?? (s.tipo === 'diseno' ? 'diseno' : 'instalaciones')
  const haystack = [
    s.nombre_completo,
    s.email,
    s.telefono,
    s.documento,
    s.titulo_texto,
    s.zona_cobertura,
    s.experiencia,
    s.referencias,
    s.mensaje,
    rubroLabel(rubro),
    s.nivel ? nivelLabel(s.nivel) : '',
    s.origen === 'rrhh' ? 'rrhh' : 'phi formulario',
    ...s.skills,
    String(s.id)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export default function WorkPoolSolicitudesPanel({ product, onPendingCount }: Props) {
  const { usuario } = useAuth()
  const [solicitudes, setSolicitudes] = useState<WorkPoolSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [aprobarId, setAprobarId] = useState<number | null>(null)
  const [loginUser, setLoginUser] = useState('')
  const [password, setPassword] = useState('')
  const [notas, setNotas] = useState('')
  const [query, setQuery] = useState('')
  const [origenFilter, setOrigenFilter] = useState<OrigenFilter>('todos')
  const [successMsg, setSuccessMsg] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const isPlotDesign = product === 'plot-design'
  const selected = solicitudes.find((s) => s.id === detailId) ?? null

  const filtered = useMemo(() => {
    let rows = solicitudes
    if (origenFilter === 'phi') rows = rows.filter(isOrigenPhi)
    if (origenFilter === 'rrhh') rows = rows.filter((s) => s.origen === 'rrhh')
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => matchesSolicitudQuery(s, q))
  }, [solicitudes, query, origenFilter])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [origenFilter, query, solicitudes])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length
  const remaining = Math.max(0, filtered.length - visibleCount)

  const origenCounts = useMemo(() => {
    let phi = 0
    let rrhh = 0
    for (const s of solicitudes) {
      if (s.origen === 'rrhh') rrhh += 1
      else phi += 1
    }
    return { phi, rrhh, todos: solicitudes.length }
  }, [solicitudes])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listarSolicitudesOperario('pendiente', product)
    if (res.success) {
      const rows = res.data ?? []
      setSolicitudes(rows)
      onPendingCount?.(rows.length)
    } else setError(res.error || 'Error al cargar solicitudes')
    setLoading(false)
  }, [product, onPendingCount])

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
    const home = operarioExternoHomeRoute(res.data?.rol) ?? '/operario-externo'
    setSuccessMsg(
      `Usuario «${loginUser.trim()}» creado. Ingreso en ${OPERARIO_EXTERNO_LOGIN} → panel en ${home}.`
    )
    setAprobarId(null)
    setDetailId(null)
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
    else {
      setDetailId(null)
      void load()
    }
  }

  const openAprobar = (s: WorkPoolSolicitud) => {
    setDetailId(null)
    setAprobarId(s.id)
    setLoginUser(s.nombre_completo.split(/\s+/)[0].toLowerCase())
  }

  return (
    <section className="work-pool-admin__section work-pool-admin__section--solicitudes">
      <div className="work-pool-admin__section-head">
        <h2>{isPlotDesign ? 'Postulantes diseñadores' : 'Solicitudes de operarios externos'}</h2>
        <span className="work-pool-admin__pill">
          {query.trim() || origenFilter !== 'todos'
            ? `${filtered.length} / ${solicitudes.length}`
            : solicitudes.length}
        </span>
      </div>

      {!loading && solicitudes.length > 0 && (
        <div className="work-pool-admin__section-toolbar">
          {isPlotDesign && (
            <div className="work-pool-admin__origen-filters" role="group" aria-label="Origen de postulación">
              {(
                [
                  ['todos', `Todas (${origenCounts.todos})`],
                  ['phi', `φ phi (${origenCounts.phi})`],
                  ['rrhh', `RRHH (${origenCounts.rrhh})`]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`work-pool-admin__origen-chip${origenFilter === id ? ' is-active' : ''}`}
                  onClick={() => setOrigenFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <label className="work-pool-admin__search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email, rubro, skills…"
              aria-label="Buscar solicitudes"
            />
            {query && (
              <button
                type="button"
                className="work-pool-admin__search-clear"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </label>
        </div>
      )}
      <p className="work-pool-admin__form-links">
        {isPlotDesign ? (
          <>
            Siguen llegando desde{' '}
            <a href="https://phi-omega-one.vercel.app/" target="_blank" rel="noreferrer" className="work-pool-admin__form-link">
              φ phi
            </a>{' '}
            →{' '}
            <a href="/postulacion-operarios" target="_blank" rel="noreferrer" className="work-pool-admin__form-link">
              /postulacion-operarios
            </a>
            , y también desde{' '}
            <a href="/rrhh/postulaciones" className="work-pool-admin__form-link">
              RRHH · Postulaciones
            </a>{' '}
            (puestos de diseño). Al aprobar se crea usuario operario-diseño.
          </>
        ) : (
          <>
            Formulario público en{' '}
            <a href="/operario-bolsa/solicitud" target="_blank" rel="noreferrer" className="work-pool-admin__form-link">
              /operario-bolsa/solicitud
            </a>{' '}
            o{' '}
            <a href="/postulacion-operarios" target="_blank" rel="noreferrer" className="work-pool-admin__form-link">
              /postulacion-operarios
            </a>
            . Al aprobar se crea usuario según rubro y nivel.
          </>
        )}
      </p>

      {error && <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div>}
      {successMsg && (
        <div className="work-pool-module__alert work-pool-module__alert--info">{successMsg}</div>
      )}

      {loading ? (
        <p className="work-pool-module__empty">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <p className="work-pool-module__empty">No hay postulaciones pendientes.</p>
      ) : filtered.length === 0 ? (
        <p className="work-pool-module__empty">
          {origenFilter !== 'todos' && !query.trim()
            ? `No hay postulaciones de ${origenFilter === 'phi' ? 'φ phi' : 'RRHH'}.`
            : `Ninguna solicitud coincide con «${query.trim()}».`}
        </p>
      ) : (
        <>
          <ul className="work-pool-solicitud-compact-list" role="list">
            {visible.map((s) => {
              const rubro = s.rubro ?? (s.tipo === 'diseno' ? 'diseno' : 'instalaciones')
              const fromPhi = isOrigenPhi(s)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="work-pool-solicitud-compact-row"
                    onClick={() => setDetailId(s.id)}
                  >
                    <span className="work-pool-solicitud-compact-row__avatar" aria-hidden>
                      {initials(s.nombre_completo)}
                    </span>
                    <span className="work-pool-solicitud-compact-row__main">
                      <strong>{s.nombre_completo}</strong>
                      <span className="work-pool-solicitud-compact-row__email">{s.email}</span>
                    </span>
                    <span className="work-pool-solicitud-compact-row__tags">
                      {fromPhi ? (
                        <span className="work-pool-solicitud-compact-row__origen work-pool-solicitud-compact-row__origen--phi">
                          φ
                        </span>
                      ) : (
                        <span className="work-pool-solicitud-compact-row__origen">RRHH</span>
                      )}
                      <span>{rubroLabel(rubro)}</span>
                      {s.nivel && <span>{nivelLabel(s.nivel)}</span>}
                    </span>
                    <span className="work-pool-solicitud-compact-row__date">
                      {new Date(s.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                    <ChevronRight size={16} className="work-pool-solicitud-compact-row__chev" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
          {filtered.length > PAGE_SIZE && (
            <div className="work-pool-admin__list-pager">
              <p className="work-pool-admin__list-pager-meta">
                Mostrando {visible.length} de {filtered.length}
              </p>
              {hasMore ? (
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__ver-mas"
                  onClick={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length))}
                >
                  Ver más ({Math.min(PAGE_SIZE, remaining)} de {remaining})
                </button>
              ) : (
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__ver-mas"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                >
                  Ver menos
                </button>
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <WorkPoolSolicitudDetailModal
          solicitud={selected}
          onClose={() => setDetailId(null)}
          onAprobar={() => openAprobar(selected)}
          onRechazar={() => void handleRechazar(selected.id)}
        />
      )}

      {aprobarId != null && (
        <div className="work-pool-admin__pay-box work-pool-admin__pay-box--approve">
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

