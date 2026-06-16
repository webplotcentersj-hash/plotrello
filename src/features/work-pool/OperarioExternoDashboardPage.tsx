import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct } from '../../types/workPool'
import { operarioExternoRolForProduct } from './workPoolConfig'
import { operarioExternoHomeRoute } from './workPoolOperarioExterno'
import WorkPoolOperarioView from './WorkPoolOperarioView'
import './WorkPoolModule.css'

type Props = { product: WorkPoolProduct }

/** Panel exclusivo del operario externo aprobado (Entrantes, Mensajes, Mi cuenta). */
export default function OperarioExternoDashboardPage({ product }: Props) {
  const { usuario, loading } = useAuth()
  const expectedRol = operarioExternoRolForProduct(product)

  if (loading) {
    return (
      <div className="work-pool-module">
        <p className="work-pool-module__empty">Cargando…</p>
      </div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  if (usuario.rol !== expectedRol) {
    const home = operarioExternoHomeRoute(usuario.rol)
    if (home) return <Navigate to={home} replace />
    return <Navigate to="/" replace />
  }

  return <WorkPoolOperarioView product={product} />
}
