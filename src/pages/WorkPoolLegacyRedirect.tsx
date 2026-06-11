import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Redirige /bolsa legacy al producto correcto según rol. */
export default function WorkPoolLegacyRedirect() {
  const { usuario, canManageWorkPool, loading } = useAuth()

  if (loading) return null

  if (!usuario) return <Navigate to="/" replace />

  if (usuario.rol === 'diseno') return <Navigate to="/plot-design" replace />
  if (usuario.rol === 'instalaciones' || usuario.rol === 'metalurgica') {
    return <Navigate to="/bolsa-plot" replace />
  }
  if (canManageWorkPool) return <Navigate to="/plot-design" replace />

  return <Navigate to="/" replace />
}
