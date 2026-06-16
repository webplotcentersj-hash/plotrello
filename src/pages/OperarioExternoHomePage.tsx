import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'

/** Redirige /operario-externo al panel según rol (diseno o bolsa). */
export default function OperarioExternoHomePage() {
  const { usuario, loading, operarioExternoHome } = useAuth()

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Cargando…</div>
    )
  }

  const home = operarioExternoHome ?? operarioExternoHomeRoute(usuario?.rol)
  if (home) return <Navigate to={home} replace />

  return <Navigate to="/login" replace />
}
