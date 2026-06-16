import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'

const ALLOWED = ['/plot-design', '/bolsa-plot']

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

export default function OperarioExternoGate({ children }: { children: ReactNode }) {
  const { isOperarioExterno, operarioExternoHome, loading } = useAuth()
  const { pathname } = useLocation()

  const home = operarioExternoHome ?? homeFromStorage()
  const isExterno = isOperarioExterno || Boolean(home)

  if (!isExterno || !home) {
    return <>{children}</>
  }

  const allowed = ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!allowed) {
    return <Navigate to={home} replace />
  }

  if (loading) {
    return <>{children}</>
  }

  return <>{children}</>
}
