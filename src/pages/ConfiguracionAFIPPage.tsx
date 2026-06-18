import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { probarConexionAFIP } from '../services/afipApi'
import type { ConfiguracionAFIPRecord } from '../types/api'
import './ConfiguracionAFIPPage.css'

export default function ConfiguracionAFIPPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingAfip, setTestingAfip] = useState(false)
  const [config, setConfig] = useState<Partial<ConfiguracionAFIPRecord>>({
    cuit: '',
    punto_venta: 1,
    razon_social: '',
    domicilio_comercial: '',
    condicion_iva: 'Responsable Inscripto',
    ingresos_brutos: '',
    fecha_inicio_actividades: '',
    actividad_principal: '',
    webservice: 'wsmtxca',
    ambiente: 'Testing',
    homologacion_aprobada: false,
    ultimo_numero_factura_a: 0,
    ultimo_numero_factura_b: 0,
    ultimo_numero_factura_c: 0,
    activo: true
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const response = await apiService.getConfiguracionAFIP()
      if (response.success && response.data) {
        setConfig(response.data)
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProbarAfip = async () => {
    setTestingAfip(true)
    try {
      const response = await probarConexionAFIP()
      if (response.success && response.data) {
        const d = response.data
        alert(
          `Conexión AFIP OK (homologación)\n\n` +
            `Ambiente: ${d.ambiente}\n` +
            `CUIT SDK: ${d.cuit ?? '—'}\n` +
            `PtoVta: ${d.puntoVenta} · Tipo 6 (Factura B)\n` +
            `Último comprobante AFIP: ${d.ultimoNumero}`
        )
      } else {
        alert('Error probando AFIP: ' + (response.error || 'desconocido'))
      }
    } catch (error) {
      console.error('Error probando AFIP:', error)
      alert('Error al probar conexión AFIP')
    } finally {
      setTestingAfip(false)
    }
  }

  const handleSave = async () => {
    if (!config.cuit || !config.razon_social || !config.condicion_iva) {
      alert('Por favor completa los campos obligatorios: CUIT, Razón Social y Condición IVA')
      return
    }

    setSaving(true)
    try {
      const response = await apiService.actualizarConfiguracionAFIP(config)
      if (response.success) {
        alert('Configuración guardada correctamente')
        loadConfig()
      } else {
        alert('Error al guardar: ' + response.error)
      }
    } catch (error) {
      console.error('Error guardando configuración:', error)
      alert('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="config-afip-page">
        <div className="loading">Cargando configuración...</div>
      </div>
    )
  }

  return (
    <div className="config-afip-page">
      <div className="page-header">
        <h1>⚙️ Configuración AFIP</h1>
        <div className="erp-section-actions" style={{ gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/impuestos')}>
            ← Impuestos
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            Contable
          </button>
        </div>
      </div>

      <div className="config-sections">
        {/* Datos de la Empresa */}
        <div className="config-section">
          <h2>📋 Datos de la Empresa</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>CUIT *</label>
              <input
                type="text"
                value={config.cuit || ''}
                onChange={(e) => setConfig({ ...config, cuit: e.target.value })}
                className="form-input"
                placeholder="20-12345678-9"
                maxLength={13}
              />
              <small>Formato: XX-XXXXXXXX-X (sin guiones, solo números)</small>
            </div>

            <div className="form-group">
              <label>Razón Social *</label>
              <input
                type="text"
                value={config.razon_social || ''}
                onChange={(e) => setConfig({ ...config, razon_social: e.target.value })}
                className="form-input"
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="form-group">
              <label>Condición IVA *</label>
              <select
                value={config.condicion_iva || ''}
                onChange={(e) => setConfig({ ...config, condicion_iva: e.target.value })}
                className="form-input"
              >
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Exento">Exento</option>
                <option value="No Responsable">No Responsable</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>Domicilio Comercial</label>
              <input
                type="text"
                value={config.domicilio_comercial || ''}
                onChange={(e) => setConfig({ ...config, domicilio_comercial: e.target.value })}
                className="form-input"
                placeholder="Dirección completa"
              />
            </div>

            <div className="form-group">
              <label>Ingresos Brutos</label>
              <input
                type="text"
                value={config.ingresos_brutos || ''}
                onChange={(e) => setConfig({ ...config, ingresos_brutos: e.target.value })}
                className="form-input"
                placeholder="Número de inscripción"
              />
            </div>

            <div className="form-group">
              <label>Fecha Inicio Actividades</label>
              <input
                type="date"
                value={config.fecha_inicio_actividades || ''}
                onChange={(e) => setConfig({ ...config, fecha_inicio_actividades: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group full-width">
              <label>Actividad Principal</label>
              <textarea
                value={config.actividad_principal || ''}
                onChange={(e) => setConfig({ ...config, actividad_principal: e.target.value })}
                className="form-textarea"
                rows={3}
                placeholder="Descripción de la actividad principal"
              />
            </div>
          </div>
        </div>

        {/* Configuración de Facturación */}
        <div className="config-section">
          <h2>🧾 Configuración de Facturación</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Punto de Venta *</label>
              <input
                type="number"
                value={config.punto_venta || 1}
                onChange={(e) => setConfig({ ...config, punto_venta: parseInt(e.target.value) || 1 })}
                className="form-input"
                min="1"
                max="9999"
              />
              <small>Número de punto de venta asignado por AFIP</small>
            </div>

            <div className="form-group">
              <label>Web Service</label>
              <select
                value={config.webservice || 'wsmtxca'}
                onChange={(e) => setConfig({ ...config, webservice: e.target.value as any })}
                className="form-input"
              >
                <option value="wsmtxca">wsmtxca (Recomendado - Con items)</option>
                <option value="wsfev1">wsfev1 (Sin items)</option>
                <option value="wsfexv1">wsfexv1 (Exportación)</option>
              </select>
              <small>wsmtxca permite facturas con detalle de items</small>
            </div>

            <div className="form-group">
              <label>Ambiente</label>
              <select
                value={config.ambiente || 'Testing'}
                onChange={(e) => setConfig({ ...config, ambiente: e.target.value as any })}
                className="form-input"
              >
                <option value="Testing">Testing</option>
                <option value="Homologación">Homologación</option>
                <option value="Producción">Producción</option>
              </select>
              <small>Producción solo después de homologación aprobada</small>
            </div>

            <div className="form-group">
              <label>Último N° Factura A</label>
              <input
                type="number"
                value={config.ultimo_numero_factura_a || 0}
                onChange={(e) => setConfig({ ...config, ultimo_numero_factura_a: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Último N° Factura B</label>
              <input
                type="number"
                value={config.ultimo_numero_factura_b || 0}
                onChange={(e) => setConfig({ ...config, ultimo_numero_factura_b: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Último N° Factura C</label>
              <input
                type="number"
                value={config.ultimo_numero_factura_c || 0}
                onChange={(e) => setConfig({ ...config, ultimo_numero_factura_c: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Homologación */}
        <div className="config-section">
          <h2>✅ Homologación</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.homologacion_aprobada || false}
                  onChange={(e) => setConfig({ ...config, homologacion_aprobada: e.target.checked })}
                />
                {' '}Homologación Aprobada
              </label>
              <small>Marcar solo cuando AFIP haya aprobado la homologación</small>
            </div>

            <div className="form-group">
              <label>Fecha Aprobación Homologación</label>
              <input
                type="date"
                value={config.fecha_aprobacion_homologacion || ''}
                onChange={(e) => setConfig({ ...config, fecha_aprobacion_homologacion: e.target.value })}
                className="form-input"
                disabled={!config.homologacion_aprobada}
              />
            </div>

            <div className="form-group">
              <label>N° Expediente Homologación</label>
              <input
                type="text"
                value={config.numero_expediente_homologacion || ''}
                onChange={(e) => setConfig({ ...config, numero_expediente_homologacion: e.target.value })}
                className="form-input"
                placeholder="Número de expediente asignado por AFIP"
                disabled={!config.homologacion_aprobada}
              />
            </div>
          </div>
        </div>

        {/* Información Importante */}
        <div className="info-box">
          <h3>📌 Información Importante</h3>
          <ul>
            <li><strong>Certificado Digital:</strong> El certificado (.p12/.pfx) debe ser subido y configurado por un administrador del sistema.</li>
            <li><strong>Homologación:</strong> Es obligatorio realizar homologación externa antes de facturar en producción (R.G. N° 5.616/2024).</li>
            <li><strong>Ambiente Testing:</strong> Usa certificados de prueba. No genera facturas válidas.</li>
            <li><strong>Ambiente Producción:</strong> Solo usar después de homologación aprobada. Genera facturas reales.</li>
            <li><strong>Web Service wsmtxca:</strong> Recomendado para facturas con detalle de items (R.G. N° 2.904).</li>
            <li><strong>Pruebas con @afipsdk/afip.js:</strong> Configurá <code>AFIP_ACCESS_TOKEN</code> en Vercel/.env.local. En desarrollo podés usar el CUIT de prueba 20-40937847-2 sin certificado propio.</li>
          </ul>
          <div className="info-links">
            <a href="/docs/INTEGRACION_AFIP.md" target="_blank" rel="noopener noreferrer">
              📖 Ver Documentación de Integración
            </a>
            <a href="/docs/HOMOLOGACION_AFIP.md" target="_blank" rel="noopener noreferrer">
              📋 Ver Guía de Homologación
            </a>
          </div>
        </div>

        {/* Estado */}
        <div className="config-section">
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.activo || false}
                onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
              />
              {' '}Configuración Activa
            </label>
            <small>Desactivar para deshabilitar temporalmente la facturación electrónica</small>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp')}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleProbarAfip}
            disabled={testingAfip}
          >
            {testingAfip ? 'Probando AFIP…' : '🔌 Probar conexión AFIP'}
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  )
}

