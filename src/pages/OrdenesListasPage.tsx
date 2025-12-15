import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './OrdenesListasPage.css'

const OrdenesListasPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenesListas, setOrdenesListas] = useState<OrdenTrabajo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState<'todos' | 'finalizado' | 'almacen'>('todos')

  useEffect(() => {
    loadOrdenesListas()
  }, [])

  const loadOrdenesListas = async () => {
    setLoading(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        const listas = response.data.filter(
          (orden) => orden.estado === 'Finalizado en Taller' || orden.estado === 'Almacén de Entrega'
        )
        setOrdenesListas(listas)
      }
    } catch (error) {
      console.error('Error cargando órdenes listas:', error)
    } finally {
      setLoading(false)
    }
  }

  const ordenesFiltradas = ordenesListas.filter((orden) => {
    // Filtro por búsqueda
    const matchesSearch = 
      orden.numero_op?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.dni_cuit?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por estado
    const matchesEstado = 
      filterEstado === 'todos' ||
      (filterEstado === 'finalizado' && orden.estado === 'Finalizado en Taller') ||
      (filterEstado === 'almacen' && orden.estado === 'Almacén de Entrega')

    return matchesSearch && matchesEstado
  })

  const handleMarcarEntregada = async (ordenId: number) => {
    // Esto se implementará cuando creemos la página de entrega
    navigate(`/mostrador/entrega/${ordenId}`)
  }

  if (loading) {
    return (
      <div className="ordenes-listas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando órdenes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ordenes-listas-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📦 Órdenes Listas para Retirar</h1>
            <p className="subtitle">
              {ordenesListas.length} {ordenesListas.length === 1 ? 'orden lista' : 'órdenes listas'}
            </p>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* Filtros y búsqueda */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por OP, cliente o DNI/CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterEstado === 'todos' ? 'active' : ''}`}
            onClick={() => setFilterEstado('todos')}
          >
            Todas ({ordenesListas.length})
          </button>
          <button
            className={`filter-btn ${filterEstado === 'finalizado' ? 'active' : ''}`}
            onClick={() => setFilterEstado('finalizado')}
          >
            Finalizado en Taller ({ordenesListas.filter(o => o.estado === 'Finalizado en Taller').length})
          </button>
          <button
            className={`filter-btn ${filterEstado === 'almacen' ? 'active' : ''}`}
            onClick={() => setFilterEstado('almacen')}
          >
            Almacén de Entrega ({ordenesListas.filter(o => o.estado === 'Almacén de Entrega').length})
          </button>
        </div>
      </div>

      {/* Lista de órdenes */}
      {ordenesFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No hay órdenes listas</h3>
          <p>
            {searchTerm || filterEstado !== 'todos'
              ? 'No se encontraron órdenes con los filtros aplicados'
              : 'No hay órdenes listas para retirar en este momento'}
          </p>
        </div>
      ) : (
        <div className="ordenes-grid">
          {ordenesFiltradas.map((orden) => (
            <div 
              key={orden.id} 
              className={`orden-card ${orden.estado === 'Almacén de Entrega' ? 'almacen' : 'finalizado'}`}
            >
              <div className="orden-header">
                <div>
                  <h3>OP #{orden.numero_op}</h3>
                  <div className="orden-cliente">{orden.cliente}</div>
                </div>
                <span className={`badge ${orden.estado === 'Almacén de Entrega' ? 'almacen-badge' : 'finalizado-badge'}`}>
                  {orden.estado === 'Almacén de Entrega' ? 'En Almacén' : 'Finalizado'}
                </span>
              </div>

              <div className="orden-details">
                {orden.dni_cuit && (
                  <div className="detail-row">
                    <span className="detail-label">DNI/CUIT:</span>
                    <span className="detail-value">{orden.dni_cuit}</span>
                  </div>
                )}
                {orden.fecha_creacion && (
                  <div className="detail-row">
                    <span className="detail-label">Creada:</span>
                    <span className="detail-value">
                      {new Date(orden.fecha_creacion).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                )}
                {orden.fecha_entrega && (
                  <div className="detail-row">
                    <span className="detail-label">Entrega estimada:</span>
                    <span className="detail-value">
                      {new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                )}
                {orden.sector && (
                  <div className="detail-row">
                    <span className="detail-label">Sector:</span>
                    <span className="detail-value">{orden.sector}</span>
                  </div>
                )}
              </div>

              {orden.descripcion && (
                <div className="orden-descripcion">
                  <strong>Descripción:</strong> {orden.descripcion}
                </div>
              )}

              <div className="orden-actions">
                <button 
                  className="btn-primary"
                  onClick={() => handleMarcarEntregada(orden.id!)}
                >
                  📋 Procesar Entrega
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => navigate(`/op/${orden.numero_op}`)}
                >
                  Ver Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdenesListasPage

