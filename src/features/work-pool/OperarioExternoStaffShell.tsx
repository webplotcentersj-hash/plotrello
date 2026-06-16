import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readStoredUsuario, useAuth } from '../../hooks/useAuth'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

function homeFromStorage(): string | null {
  const u = readStoredUsuario()
  return isOperarioExternoRol(u?.rol) ? operarioExternoHomeRoute(u.rol) : null
}

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
  const home = operarioExternoHome ?? homeFromStorage()

  if (home && !isOperarioExternoPath(pathname)) {
    return <Navigate to={home} replace />
  }

  if (!isAuthenticated) return <>{login}</>
  return <>{staff}</>
}
