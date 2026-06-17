import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePhoneBoardLayout } from '../hooks/usePhoneBoardLayout'
import './StaffFloatingDock.css'

const SolicitudesPermisosFloatingButton = lazy(
  () => import('./SolicitudesPermisosFloatingButton')
)

function shouldHideFloatingDock(pathname: string): boolean {
  if (pathname === '/' || pathname === '' || pathname === '/tablero') return true
  if (pathname === '/admin') return true
  if (pathname === '/app-campo') return true
  if (pathname === '/statistics') return true
  if (pathname.startsWith('/mensajeria')) return true
  if (pathname.startsWith('/mostrador')) return true
  if (pathname.startsWith('/rrhh')) return true
  if (pathname.startsWith('/caja')) return true
  if (pathname === '/plot-design' || pathname === '/bolsa-plot') return true
  if (pathname.startsWith('/operario-externo')) return true
  if (pathname.startsWith('/impresoras')) return true
  return false
}

function shouldHideImpresorasButton(pathname: string, isPhoneLayout: boolean): boolean {
  if (isPhoneLayout) return true
  if (pathname.startsWith('/impresoras')) return true
  if (
    pathname === '/menu-diario' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 720px)').matches
  ) {
    return true
  }
  return false
}

export default function StaffFloatingDock() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isPhoneLayout = usePhoneBoardLayout()
  const { usuario, canAccessTotemImpresionPanel, canManageImpresoras } = useAuth()

  if (!usuario || shouldHideFloatingDock(pathname)) {
    return null
  }

  const showImpresoras =
    !shouldHideImpresorasButton(pathname, isPhoneLayout) &&
    (canAccessTotemImpresionPanel || canManageImpresoras)

  const dock = (
    <div className="staff-floating-dock" aria-label="Acciones rápidas">
      {showImpresoras && (
        <button
          type="button"
          className="staff-floating-dock__impresoras"
          onClick={() => navigate('/impresoras')}
          title="Ver ocupación de impresoras"
        >
          🖨️
        </button>
      )}
      <Suspense fallback={null}>
        <SolicitudesPermisosFloatingButton />
      </Suspense>
    </div>
  )

  if (typeof document === 'undefined') return dock
  return createPortal(dock, document.body)
}
