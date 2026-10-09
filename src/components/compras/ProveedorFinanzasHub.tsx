import { useNavigate } from 'react-router-dom'
import ProveedorCuentaPanel from './ProveedorCuentaPanel'
import '../../pages/DeudasProveedoresPage.css'

/** Compat para rutas viejas /compras/deudas-proveedores, etc. */
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
  onChanged?: () => void
}

export default function ProveedorFinanzasHub({
  mode = 'page',
  idProveedor,
  proveedorNombre,
  saldoListado,
  onClose,
  onEditar,
  onProductos,
  onChanged
}: ProveedorFinanzasHubProps) {
  const navigate = useNavigate()
  const rootClass = mode === 'embedded' ? 'prov-trazado-completo' : 'deudas-prov-page'

  return (
    <div className={rootClass}>
      {mode === 'page' && (
        <header className="deudas-prov-header">
          <div>
            <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras</p>
            <h1 style={{ margin: '4px 0 0', color: '#fff' }}>
              {proveedorNombre || 'Cuenta del proveedor'}
            </h1>
          </div>
          <div className="deudas-prov-header__actions">
            <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/proveedores')}>
              ← Proveedores
            </button>
          </div>
        </header>
      )}

      {mode === 'embedded' && proveedorNombre && (
        <header className="deudas-prov-header prov-trazado-embedded-head">
          <div>
            <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Cuenta del proveedor</p>
            <h1 style={{ margin: '4px 0 0', color: '#fff' }}>{proveedorNombre}</h1>
          </div>
          <div className="deudas-prov-header__actions">
            {onProductos && (
              <button type="button" className="cp-btn cp-btn--secondary" onClick={onProductos}>
                Productos
              </button>
            )}
            {onEditar && (
              <button type="button" className="cp-btn cp-btn--secondary" onClick={onEditar}>
                Ficha
              </button>
            )}
            {onClose && (
              <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>
                Cerrar
              </button>
            )}
          </div>
        </header>
      )}

      <ProveedorCuentaPanel
        idProveedor={idProveedor}
        proveedorNombre={proveedorNombre}
        saldoListado={saldoListado}
        onChanged={onChanged}
      />
    </div>
  )
}
