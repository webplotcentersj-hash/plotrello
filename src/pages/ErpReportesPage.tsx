import { useNavigate } from 'react-router-dom'
import './ErpSectionPage.css'

export default function ErpReportesPage() {
  const navigate = useNavigate()

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📊 Reportes ERP</h1>
          <p className="erp-section-sub">Reportes financieros y contables</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/statistics')}>
            Ir a Statistics
          </button>
        </div>
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Contables</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad')}>
              Contabilidad
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/asientos')}>
              Asientos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/plan-cuentas')}>
              Plan de cuentas
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: mayor general, balance, estado de resultados.
          </p>
        </div>

        <div className="erp-panel">
          <h2>Tesorería</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/tesoreria')}>
              Tesorería
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
              CxC
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-pagar')}>
              CxP
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: flujo de caja y conciliación bancaria.
          </p>
        </div>

        <div className="erp-panel">
          <h2>Impuestos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/impuestos')}>
              Impuestos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/configuracion-afip')}>
              AFIP
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: IVA ventas/compras y reportes por alícuotas.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Roadmap rápido</h2>
        <ul className="erp-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Balance y estado de resultados (por período)</li>
          <li>Mayor general por cuenta</li>
          <li>Flujo de caja (ingresos/egresos) + proyección</li>
          <li>Libro IVA Ventas / Compras</li>
        </ul>
      </div>
    </div>
  )
}

