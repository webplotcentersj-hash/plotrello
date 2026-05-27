import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { PresupuestoClienteRecord } from '../types/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClientePresupuestosPage.css'

export default function ClientePresupuestosPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [presupuestos, setPresupuestos] = useState<PresupuestoClienteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('todos')

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadPresupuestos()
  }, [cliente, authLoading, navigate])

  const loadPresupuestos = async () => {
    if (!cliente?.id) return
    
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getPresupuestosCliente(cliente.id)
      if (response.success && response.data) {
        setPresupuestos(response.data)
      } else {
        setError(response.error || 'Error al cargar presupuestos')
      }
    } catch (err) {
      setError('Error al cargar presupuestos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      borrador: '#6b7280',
      enviado: '#3b82f6',
      aceptado: '#10b981',
      rechazado: '#ef4444',
      cancelado: '#9ca3af',
      convertido: '#6366f1'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      borrador: 'Borrador',
      enviado: 'Enviado',
      aceptado: 'Aceptado',
      rechazado: 'Rechazado',
      cancelado: 'Cancelado',
      convertido: 'Convertido a Pedido'
    }
    return labels[estado] || estado
  }

  const filteredPresupuestos = presupuestos.filter(p => {
    if (filterEstado === 'todos') return true
    return p.estado === filterEstado
  })

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-presupuestos-page">
      <ClientePageHeader
        eyebrow="Cotizaciones"
        title="Presupuestos"
        subtitle="Tus solicitudes y cotizaciones con Plot Center"
        actions={
          <button type="button" className="cliente-btn-primary" onClick={() => navigate('/cliente/presupuesto/nuevo')}>
            + Nuevo presupuesto
          </button>
        }
      />

        {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

        {/* Filtros */}
        <div className="cliente-presupuestos-filters">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="cliente-presupuestos-filter-select"
          >
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borradores</option>
            <option value="enviado">Enviados</option>
            <option value="aceptado">Aceptados</option>
            <option value="rechazado">Rechazados</option>
            <option value="convertido">Convertidos</option>
          </select>
        </div>

        {/* Lista de presupuestos */}
        {filteredPresupuestos.length === 0 ? (
          <div className="cliente-page-empty">
            <p>No tienes presupuestos {filterEstado !== 'todos' ? `con estado "${filterEstado}"` : ''}</p>
            <button
              type="button"
              className="cliente-btn-primary"
              onClick={() => navigate('/cliente/presupuesto/nuevo')}
            >
              Crear Primer Presupuesto
            </button>
          </div>
        ) : (
          <div className="cliente-presupuestos-list">
            {filteredPresupuestos.map((presupuesto) => (
              <div key={presupuesto.id} className="cliente-page-card cliente-presupuesto-card">
                <div className="cliente-presupuesto-card-header">
                  <div className="cliente-presupuesto-card-title">
                    <h3>{presupuesto.numero_presupuesto}</h3>
                    <span 
                      className="cliente-presupuesto-status-badge"
                      style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
                    >
                      {getEstadoLabel(presupuesto.estado)}
                    </span>
                  </div>
                  <div className="cliente-presupuesto-card-date">
                    {new Date(presupuesto.fecha_creacion).toLocaleDateString('es-AR')}
                  </div>
                </div>
                
                <div className="cliente-presupuesto-card-body">
                  <div className="cliente-presupuesto-card-info">
                    <div className="cliente-presupuesto-info-item">
                      <span className="label">Total:</span>
                      <span className="value">${presupuesto.precio_total.toFixed(2)}</span>
                    </div>
                    {presupuesto.fecha_envio && (
                      <div className="cliente-presupuesto-info-item">
                        <span className="label">Enviado:</span>
                        <span className="value">
                          {new Date(presupuesto.fecha_envio).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    )}
                    {presupuesto.fecha_vencimiento && (
                      <div className="cliente-presupuesto-info-item">
                        <span className="label">Válido hasta:</span>
                        <span className="value">
                          {new Date(presupuesto.fecha_vencimiento).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    )}
                    {presupuesto.id_pedido_asociado && (
                      <div className="cliente-presupuesto-info-item">
                        <span className="label">Pedido asociado:</span>
                        <span className="value">#{presupuesto.id_pedido_asociado}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cliente-presupuesto-card-actions">
                  <button
                    className="btn-view"
                    onClick={() => navigate(`/cliente/presupuesto/${presupuesto.id}`)}
                  >
                    Ver Detalle
                  </button>
                  {presupuesto.estado === 'borrador' && (
                    <>
                      <button
                        className="btn-edit"
                        onClick={() => navigate(`/cliente/presupuesto/${presupuesto.id}/editar`)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-send"
                        onClick={async () => {
                          if (confirm('¿Estás seguro de enviar este presupuesto a la empresa?')) {
                            try {
                              const response = await apiService.enviarPresupuestoCliente(presupuesto.id)
                              if (response.success) {
                                alert('Presupuesto enviado exitosamente')
                                loadPresupuestos()
                              } else {
                                alert(response.error || 'Error al enviar presupuesto')
                              }
                            } catch (err) {
                              alert('Error al enviar presupuesto')
                            }
                          }
                        }}
                      >
                        Enviar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </ClientePageLayout>
  )
}

