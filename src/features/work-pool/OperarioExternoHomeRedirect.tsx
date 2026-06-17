import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { operarioExternoHomeRoute } from './workPoolOperarioExterno'
import {
  isOperarioExternoSession,
  readOperarioExternoUsuario
} from '../../utils/plotlabSession'

/** Solo operarios externos: el tablero `/` no es su home. Admin/gerencia entran por login a `/admin` pero pueden ir al tablero. */
export default function StaffHomeRedirect() {
  const { operarioExternoHome } = useAuth()
  if (!isOperarioExternoSession()) return null
  const externoUser = readOperarioExternoUsuario()
  const externo =
    operarioExternoHome ?? (externoUser ? operarioExternoHomeRoute(externoUser.rol) : null)
  if (externo) return <Navigate to={externo} replace />
  return null
}
