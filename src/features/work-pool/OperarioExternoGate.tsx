import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const ALLOWED = ['/plot-design', '/bolsa-plot']

export default function OperarioExternoGate({ children }: { children: ReactNode }) {
  const { isOperarioExterno, operarioExternoHome, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading || !isOperarioExterno || !operarioExternoHome) {
    return <>{children}</>
  }

  const allowed = ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!allowed) {
    return <Navigate to={operarioExternoHome} replace />
  }

  return <>{children}</>
}
