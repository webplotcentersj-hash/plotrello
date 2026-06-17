import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct } from '../../types/workPool'
import { operarioExternoRolForProduct } from './workPoolConfig'
import { operarioExternoHomeRoute, OPERARIO_EXTERNO_LOGIN } from './workPoolOperarioExterno'
import { isOperarioExternoSession, readOperarioExternoUsuario } from '../../utils/plotlabSession'
import WorkPoolOperarioView from './WorkPoolOperarioView'
import '../phi/phi-landing.css'
import './WorkPoolOperarioDashboard.css'

type Props = { product: WorkPoolProduct }

/** Panel exclusivo del operario externo aprobado (Entrantes, Mensajes, Mi cuenta). */
export default function OperarioExternoDashboardPage({ product }: Props) {
  const { usuario, loading } = useAuth()
  const expectedRol = operarioExternoRolForProduct(product)
  const sessionUser = usuario ?? readOperarioExternoUsuario()

  if (loading && !sessionUser) {
    return (
      <div className="phi-root wp-operario-dash wp-operario-dash--loading">
        <p className="wp-operario-dash__empty">Cargando…</p>
      </div>
    )
  }

  if (!sessionUser || !isOperarioExternoSession()) {
    return <Navigate to={OPERARIO_EXTERNO_LOGIN} replace />
  }

  if (sessionUser.rol !== expectedRol) {
    const home = operarioExternoHomeRoute(sessionUser.rol)
    if (home) return <Navigate to={home} replace />
    return <Navigate to={OPERARIO_EXTERNO_LOGIN} replace />
  }

  return <WorkPoolOperarioView product={product} />
}
