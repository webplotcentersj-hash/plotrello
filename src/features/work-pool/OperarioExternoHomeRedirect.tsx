import { Navigate } from 'react-router-dom'
import { readStoredUsuario, useAuth } from '../../hooks/useAuth'
import { adminStaffHomeRoute } from '../../utils/adminStaffHome'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

function operarioHomeFromStorage(): string | null {
  const u = readStoredUsuario()
  return isOperarioExternoRol(u?.rol) ? operarioExternoHomeRoute(u.rol) : null
}

/** Redirige al home correcto según rol (operario externo → panel; admin/gerencia → /admin). */
export default function StaffHomeRedirect() {
  const { operarioExternoHome, usuario } = useAuth()
  const stored = readStoredUsuario()

  const externo = operarioExternoHome ?? operarioHomeFromStorage()
  if (externo) return <Navigate to={externo} replace />

  const adminHome = adminStaffHomeRoute(usuario?.rol) ?? adminStaffHomeRoute(stored?.rol)
  if (adminHome) return <Navigate to={adminHome} replace />

  return null
}
