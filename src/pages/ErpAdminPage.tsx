import { useNavigate } from 'react-router-dom'
import './ErpSectionPage.css'

export default function ErpAdminPage() {
  const navigate = useNavigate()

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>⚙️ Administración ERP</h1>
          <p className="erp-section-sub">Circuitos, roles y checklist de implementación</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
        </div>
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Mapa de circuitos</h2>
          <details open>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Venta → Cobro → Asiento → Impuestos</summary>
            <ul className="erp-muted" style={{ marginTop: 10 }}>
              <li>Emitir factura / nota (Facturación)</li>
              <li>Generar CxC (no aplica para Nota de Crédito)</li>
              <li>Registrar cobro (Tesorería) → movimiento en `pagos_cobros`</li>
              <li>Asiento contable automático (Contabilidad)</li>
              <li>Libro IVA ventas (Impuestos)</li>
            </ul>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Compra → Pago → Asiento → Impuestos</summary>
            <ul className="erp-muted" style={{ marginTop: 10 }}>
              <li>Pedido/OC/recepción (Compras)</li>
              <li>Generar CxP</li>
              <li>Registrar pago (Tesorería) → movimiento en `pagos_cobros`</li>
              <li>Asiento contable (pendiente de automatizar en pago/compra)</li>
              <li>Libro IVA compras (pendiente)</li>
            </ul>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Stock → Movimientos → Valuación</summary>
            <ul className="erp-muted" style={{ marginTop: 10 }}>
              <li>Entradas/salidas/transferencias (Stock)</li>
              <li>Stock actual por depósito (pendiente)</li>
              <li>Valuación (promedio) + inmovilizado (pendiente)</li>
            </ul>
          </details>
        </div>

        <div className="erp-panel">
          <h2>Roles / permisos (borrador)</h2>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Accesos típicos</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Admin</td>
                  <td>Todo (config AFIP, plan cuentas, RLS/políticas, reportes)</td>
                </tr>
                <tr>
                  <td>Mostrador / Ventas</td>
                  <td>Ventas/CRM, facturación, cobros (caja), clientes</td>
                </tr>
                <tr>
                  <td>Tesorería</td>
                  <td>Cobros/pagos, cuentas bancarias, flujo caja</td>
                </tr>
                <tr>
                  <td>Contabilidad</td>
                  <td>Asientos, balance, reportes contables, cierres</td>
                </tr>
                <tr>
                  <td>Compras</td>
                  <td>Proveedores, pedidos, recepción, CxP</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: enforcement real por rutas + permisos en Supabase (RLS por rol/usuario).
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Checklist</h2>
        <ul className="erp-muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Notas crédito/débito referenciadas + asiento invertido (hecho)</li>
          <li>Reportes contables (balance + resumen) (hecho)</li>
          <li>Compras/stock integrados al ERP (puente) (hecho)</li>
          <li>Automatizar asiento en cobro/pago (pendiente)</li>
          <li>Libro IVA compras (pendiente)</li>
          <li>Presupuesto vs real (pendiente)</li>
        </ul>
      </div>
    </div>
  )
}

