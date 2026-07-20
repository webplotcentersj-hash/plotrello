import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAdminStaffHomeRole } from '../utils/adminStaffHome'
import './AdminBackLink.css'

const HIDDEN_PATHS = new Set(['/admin', '/login', '/', '/avisar-ausencia', '/permisos'])

function shouldShow(pathname: string): boolean {
  if (HIDDEN_PATHS.has(pathname)) return false
  if (pathname.startsWith('/operario-externo')) return false
  if (pathname.startsWith('/cliente')) return false
  if (pathname.startsWith('/totem')) return false
  if (pathname.startsWith('/embed/')) return false
  return true
}

/** Enlace fijo para admin/gerencia: volver al panel /admin desde cualquier módulo. */
export default function AdminBackLink() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (!usuario || !isAdminStaffHomeRole(usuario.rol)) return null
  if (!shouldShow(pathname)) return null

  const link = (
    <div className="admin-back-link-wrap">
      <button
        type="button"
        className="admin-back-link"
        onClick={() => navigate('/admin')}
      >
        ← Volver a admin
      </button>
    </div>
  )

  if (typeof document === 'undefined') return link
  return createPortal(link, document.body)
}
