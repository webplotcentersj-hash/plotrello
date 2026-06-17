import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { operarioExternoHomeRoute, OPERARIO_EXTERNO_LOGIN } from '../features/work-pool/workPoolOperarioExterno'
import { isOperarioExternoSession, readOperarioExternoUsuario } from '../utils/plotlabSession'

/** Redirige /operario-externo al panel según rol (diseno o bolsa). */
export default function OperarioExternoHomePage() {
  const { loading, operarioExternoHome } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: '#0b0b0b',
          background: '#fff',
          minHeight: '100vh',
          fontFamily: "'Onest', system-ui, sans-serif",
          fontWeight: 600
        }}
      >
        Cargando…
      </div>
    )
  }

  const externoUser = readOperarioExternoUsuario()
  const home =
    operarioExternoHome ??
    (externoUser ? operarioExternoHomeRoute(externoUser.rol) : null)
  if (home && isOperarioExternoSession()) return <Navigate to={home} replace />

  return <Navigate to={OPERARIO_EXTERNO_LOGIN} replace />
}
