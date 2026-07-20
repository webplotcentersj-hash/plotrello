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
  /** @deprecated El shell redirige a /login?next=…; se mantiene por compatibilidad. */
  login?: ReactNode
  staff: ReactNode
}

/** Operario externo nunca entra al tablero Plot Lab: redirige a /operario-externo/*. */
export default function OperarioExternoStaffShell({ isAuthenticated, staff }: Props) {
  const { operarioExternoHome } = useAuth()
  const { pathname, search } = useLocation()
  const externoUser = readOperarioExternoUsuario()
  const home = operarioExternoHome ?? (externoUser ? operarioExternoHomeRoute(externoUser.rol) : null)

  if (isOperarioExternoSession() && home && !isOperarioExternoPath(pathname)) {
    return <Navigate to={home} replace />
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${pathname}${search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{staff}</>
}
