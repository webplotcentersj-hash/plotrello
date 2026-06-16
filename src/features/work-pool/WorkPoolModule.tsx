import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct } from '../../types/workPool'
import {
  canOperarioAccessProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import WorkPoolAdminPanel from './WorkPoolAdminPanel'
import WorkPoolOperarioView from './WorkPoolOperarioView'
import { isOperarioExternoRol, operarioExternoHomeRoute } from './workPoolOperarioExterno'
import './WorkPoolModule.css'

type Props = { product: WorkPoolProduct }

export default function WorkPoolModule({ product }: Props) {
  const navigate = useNavigate()
  const { usuario, canManageWorkPool, canAccessPlotDesign, canAccessBolsaPlot, loading } = useAuth()
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]

  const canAccess =
    product === 'plot-design' ? canAccessPlotDesign : canAccessBolsaPlot

  if (loading) {
    return (
      <div className="work-pool-module">
        <p className="work-pool-module__empty">Cargando…</p>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="work-pool-module">
        <p className="work-pool-module__empty">Tenés que iniciar sesión para acceder a {cfg.label}.</p>
      </div>
    )
  }

  if (isOperarioExternoRol(usuario.rol)) {
    const home = operarioExternoHomeRoute(usuario.rol)
    if (home) return <Navigate to={home} replace />
  }

  if (!canAccess) {
    return (
      <div className={`work-pool-module ${cfg.themeClass}`}>
        <header className="work-pool-module__head">
          <div>
            <h1>{cfg.label}</h1>
            <p>Acceso restringido</p>
          </div>
          <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
            ← PlotLab
          </button>
        </header>
        <div className="work-pool-module__alert work-pool-module__alert--error">
          {product === 'plot-design'
            ? 'Plot Design es solo para diseñadores y administración / presupuestos.'
            : 'Bolsa Plot es solo para instalaciones, metalúrgica y administración / presupuestos.'}
        </div>
      </div>
    )
  }

  if (canManageWorkPool) {
    return <WorkPoolAdminPanel product={product} />
  }

  if (!canOperarioAccessProduct(product, usuario.rol)) {
    return (
      <div className={`work-pool-module ${cfg.themeClass}`}>
        <div className="work-pool-module__alert work-pool-module__alert--error">
          Tu rol no tiene acceso a {cfg.label}.
        </div>
      </div>
    )
  }

  return <WorkPoolOperarioView product={product} />
}
