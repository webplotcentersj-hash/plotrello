import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

function homeFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('usuario')
    if (!raw) return null
    const u = JSON.parse(raw) as { rol?: string }
    return isOperarioExternoRol(u.rol) ? operarioExternoHomeRoute(u.rol) : null
  } catch {
    return null
  }
}

/** Redirige operarios externos aprobados a su panel (/operario-externo/...). */
export default function OperarioExternoHomeRedirect() {
  const { isOperarioExterno, operarioExternoHome, loading } = useAuth()

  if (!loading && isOperarioExterno && operarioExternoHome) {
    return <Navigate to={operarioExternoHome} replace />
  }

  if (loading) {
    const cached = homeFromStorage()
    if (cached) return <Navigate to={cached} replace />
  }

  return null
}
