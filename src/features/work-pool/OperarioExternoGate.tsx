import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { operarioExternoHomeRoute } from './workPoolOperarioExterno'
import {
  isOperarioExternoSession,
  readOperarioExternoUsuario
} from '../../utils/plotlabSession'

/** Operarios externos solo pueden navegar en /operario-externo/* (no el tablero Plot Lab). */
export default function OperarioExternoGate({ children }: { children: ReactNode }) {
  const { operarioExternoHome } = useAuth()
  const { pathname } = useLocation()

  if (!isOperarioExternoSession()) {
    return <>{children}</>
  }

  const externoUser = readOperarioExternoUsuario()
  const home = operarioExternoHome ?? (externoUser ? operarioExternoHomeRoute(externoUser.rol) : null)
  if (!home) {
    return <>{children}</>
  }

  const allowed = pathname === '/operario-externo' || pathname.startsWith('/operario-externo/')
  if (!allowed) {
    return <Navigate to={home} replace />
  }

  return <>{children}</>
}
