import { useNavigate } from 'react-router-dom'
import './ErpSectionPage.css'

export default function ErpCostosPage() {
  const navigate = useNavigate()

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>💰 Control de Costos</h1>
          <p className="erp-section-sub">Costos por OP y margen</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
        </div>
      </div>

      <div className="erp-panel">
        <h2>En construcción</h2>
        <p className="erp-muted">
          Acá vamos a sumar:
          <br />- cálculo de costos por OP (materiales + mano de obra + logística)
          <br />- margen por cliente / producto
          <br />- alertas de OP con costo fuera de rango
        </p>
        <p className="erp-muted">
          Si querés, lo próximo es un buscador por N° OP para ejecutar el cálculo existente (si está activo en BD).
        </p>
      </div>
    </div>
  )
}

