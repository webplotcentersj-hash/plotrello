import { Navigate } from 'react-router-dom'
import { readStoredUsuario, useAuth } from '../../hooks/useAuth'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

function operarioHomeFromStorage(): string | null {
  const u = readStoredUsuario()
  return isOperarioExternoRol(u?.rol) ? operarioExternoHomeRoute(u.rol) : null
}

/** Solo operarios externos: el tablero `/` no es su home. Admin/gerencia entran por login a `/admin` pero pueden ir al tablero. */
export default function StaffHomeRedirect() {
  const { operarioExternoHome } = useAuth()
  const externo = operarioExternoHome ?? operarioHomeFromStorage()
  if (externo) return <Navigate to={externo} replace />
  return null
}
