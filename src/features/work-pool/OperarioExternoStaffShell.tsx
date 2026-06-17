import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { operarioExternoHomeRoute } from './workPoolOperarioExterno'
import {
  isOperarioExternoSession,
  readOperarioExternoUsuario
} from '../../utils/plotlabSession'

function isOperarioExternoPath(pathname: string): boolean {
  return pathname === '/operario-externo' || pathname.startsWith('/operario-externo/')
}

type Props = {
  isAuthenticated: boolean
  login: ReactNode
  staff: ReactNode
}

/** Operario externo nunca entra al tablero Plot Lab: redirige a /operario-externo/*. */
export default function OperarioExternoStaffShell({ isAuthenticated, login, staff }: Props) {
  const { operarioExternoHome } = useAuth()
  const { pathname } = useLocation()
  const externoUser = readOperarioExternoUsuario()
  const home = operarioExternoHome ?? (externoUser ? operarioExternoHomeRoute(externoUser.rol) : null)

  if (isOperarioExternoSession() && home && !isOperarioExternoPath(pathname)) {
    return <Navigate to={home} replace />
  }

  if (!isAuthenticated) return <>{login}</>
  return <>{staff}</>
}
