import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProveedorDeudasTrazado from './ProveedorDeudasTrazado'
import ProveedorDeudaCcTrazado from './ProveedorDeudaCcTrazado'
import ProveedorFinanzasTrazado from './ProveedorFinanzasTrazado'
import ProveedorPagosTrazado from './ProveedorPagosTrazado'
import '../../pages/DeudasProveedoresPage.css'

export type FinanzasTab = 'deudas' | 'movimientos' | 'pagos' | 'deuda-cc'

export type ProveedorFinanzasHubProps = {
  mode?: 'page' | 'embedded'
  initialTab?: FinanzasTab
  idProveedor?: number
  proveedorNombre?: string
  saldoListado?: number | null
  codigoDeuda?: string | null
  movimientosCount?: number
  pagosCount?: number
  deudaCcCount?: number
  onClose?: () => void
  onEditar?: () => void
  onProductos?: () => void
}

const TAB_LABELS: Array<{ key: FinanzasTab; label: string; icon: string }> = [
  { key: 'deudas', label: 'Deudas', icon: '💳' },
  { key: 'movimientos', label: 'Movimientos', icon: '📒' },
  { key: 'pagos', label: 'Pagos', icon: '💸' },
  { key: 'deuda-cc', label: 'Deuda CC', icon: '📑' }
]

function pickDefaultTab(
  initialTab: FinanzasTab | undefined,
  movimientosCount: number,
  pagosCount: number,
  deudaCcCount: number
): FinanzasTab {
  if (initialTab) return initialTab
  if (movimientosCount > 0) return 'movimientos'
  if (pagosCount > 0) return 'pagos'
  if (deudaCcCount > 0) return 'deuda-cc'
  return 'deudas'
}

export default function ProveedorFinanzasHub({
  mode = 'page',
  initialTab,
  movimientosCount = 0,
  pagosCount = 0,
  deudaCcCount = 0,
  proveedorNombre,
  onClose,
  onEditar,
  onProductos,
  ...shared
}: ProveedorFinanzasHubProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<FinanzasTab>(() =>
    pickDefaultTab(initialTab, movimientosCount, pagosCount, deudaCcCount)
  )

  const panelProps = {
    ...shared,
    proveedorNombre,
    mode: 'panel' as const,
    showHeader: false
  }

  const badge = (key: FinanzasTab) => {
    if (key === 'movimientos' && movimientosCount > 0) return movimientosCount
    if (key === 'pagos' && pagosCount > 0) return pagosCount
    if (key === 'deuda-cc' && deudaCcCount > 0) return deudaCcCount
    return null
  }

  const rootClass = mode === 'embedded' ? 'prov-trazado-completo' : 'deudas-prov-page'

  return (
    <div className={rootClass}>
      {mode === 'page' && (
        <header className="deudas-prov-header">
          <div>
            <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras · Finanzas</p>
            <h1 style={{ margin: '4px 0 0', color: '#fff' }}>Trazado financiero de proveedores</h1>
            {proveedorNombre && (
              <p style={{ margin: '6px 0 0', color: 'var(--dp-muted)', fontSize: '0.85rem' }}>
                {proveedorNombre}
              </p>
            )}
          </div>
          <div className="deudas-prov-header__actions">
            <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
              ← Pedidos
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={() => navigate('/compras/proveedores')}
            >
              Maestro proveedores
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={() => navigate('/erp/tesoreria')}
            >
              Tesorería
            </button>
          </div>
        </header>
      )}

      {mode === 'embedded' && proveedorNombre && (
        <header className="deudas-prov-header prov-trazado-embedded-head">
          <div>
            <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras · Finanzas</p>
            <h1 style={{ margin: '4px 0 0', color: '#fff' }}>{proveedorNombre}</h1>
          </div>
          <div className="deudas-prov-header__actions">
            {onProductos && (
              <button type="button" className="cp-btn cp-btn--secondary" onClick={onProductos}>
                📦 Productos
              </button>
            )}
            {onEditar && (
              <button type="button" className="cp-btn cp-btn--secondary" onClick={onEditar}>
                ✏️ Ficha
              </button>
            )}
            {onClose && (
              <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>
                ✕ Cerrar
              </button>
            )}
          </div>
        </header>
      )}

      <nav className="prov-trazado-tabs" aria-label="Secciones del trazado financiero">
        {TAB_LABELS.map((t) => {
          const count = badge(t.key)
          return (
            <button
              key={t.key}
              type="button"
              className={`prov-trazado-tabs__btn ${tab === t.key ? 'prov-trazado-tabs__btn--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
              {count != null && <em>{count}</em>}
            </button>
          )
        })}
      </nav>

      {tab === 'deudas' && <ProveedorDeudasTrazado {...panelProps} />}
      {tab === 'movimientos' && <ProveedorFinanzasTrazado {...panelProps} saldoListado={shared.saldoListado} />}
      {tab === 'pagos' && <ProveedorPagosTrazado {...panelProps} />}
      {tab === 'deuda-cc' && <ProveedorDeudaCcTrazado {...panelProps} />}
    </div>
  )
}
