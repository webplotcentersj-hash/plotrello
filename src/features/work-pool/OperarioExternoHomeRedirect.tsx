import { Navigate } from 'react-router-dom'
import { readStoredUsuario, useAuth } from '../../hooks/useAuth'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

function homeFromStorage(): string | null {
  const u = readStoredUsuario()
  return isOperarioExternoRol(u?.rol) ? operarioExternoHomeRoute(u.rol) : null
}

/** Redirige operarios externos aprobados a su panel (/operario-externo/...). */
export default function OperarioExternoHomeRedirect() {
  const { operarioExternoHome } = useAuth()
  const home = operarioExternoHome ?? homeFromStorage()
  if (home) return <Navigate to={home} replace />
  return null
}
