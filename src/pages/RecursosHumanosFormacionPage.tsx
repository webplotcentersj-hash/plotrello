import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import RecursosHumanosCapacitacionesPage from './RecursosHumanosCapacitacionesPage'
import RecursosHumanosPruebasPage from './RecursosHumanosPruebasPage'
import './RecursosHumanosFormacionPage.css'

type TabFormacion = 'capacitaciones' | 'pruebas'

const RecursosHumanosFormacionPage = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()

  const tab: TabFormacion = useMemo(() => {
    const t = params.get('tab')
    return t === 'pruebas' ? 'pruebas' : 'capacitaciones'
  }, [params])

  const setTab = (next: TabFormacion) => {
    setParams(next === 'capacitaciones' ? {} : { tab: next }, { replace: true })
  }

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) navigate('/rrhh/dashboard')
  }, [authLoading, canManageRecursosHumanos, navigate])

  if (authLoading) {
    return (
      <div className="rrhh-formacion-loading">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  if (!canManageRecursosHumanos) return null

  return (
    <div className="rrhh-formacion-page">
      <header className="rrhh-formacion-header">
        <div className="rrhh-formacion-header-text">
          <p className="rrhh-formacion-kicker">RRHH · Desarrollo</p>
          <h1>Formación</h1>
          <p className="rrhh-formacion-lead">
            Capacitaciones, cursos y pruebas de conocimiento en un solo lugar.
          </p>
        </div>
        <button type="button" className="rrhh-formacion-back" onClick={() => navigate('/rrhh/dashboard')}>
          ← Volver
        </button>
      </header>

      <div className="rrhh-formacion-tabs" role="tablist" aria-label="Secciones de formación">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'capacitaciones'}
          className={`rrhh-formacion-tab${tab === 'capacitaciones' ? ' is-active' : ''}`}
          onClick={() => setTab('capacitaciones')}
        >
          📚 Capacitaciones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'pruebas'}
          className={`rrhh-formacion-tab${tab === 'pruebas' ? ' is-active' : ''}`}
          onClick={() => setTab('pruebas')}
        >
          📝 Pruebas de conocimiento
        </button>
      </div>

      <div className="rrhh-formacion-body">
        {tab === 'capacitaciones' ? (
          <RecursosHumanosCapacitacionesPage embedded />
        ) : (
          <RecursosHumanosPruebasPage embedded />
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosFormacionPage
