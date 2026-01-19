import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import type { OrdenTrabajo } from '../../types/api'
import './TabletFirmaSelectPage.css'

export default function TabletFirmaSelectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrdenesListas()
  }, [])

  const loadOrdenesListas = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        // Filtrar solo órdenes en "Almacén de Entrega" o "Entregado o Instalado" pero sin entregar
        const ordenesListas = response.data.filter(
          (orden) =>
            orden.estado === 'Almacén de Entrega' ||
            (orden.estado === 'Entregado o Instalado' && !orden.entregado)
        )
        setOrdenes(ordenesListas)
      } else {
        setError('Error al cargar órdenes')
      }
    } catch (err) {
      console.error('Error cargando órdenes:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const ordenesFiltradas = ordenes.filter((orden) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      orden.numero_op?.toLowerCase().includes(term) ||
      orden.cliente?.toLowerCase().includes(term) ||
      orden.dni_cuit?.toLowerCase().includes(term)
    )
  })

  if (loading) {
    return (
      <div className="tablet-firma-select">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando órdenes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tablet-firma-select">
      <header className="select-header">
        <h1>📋 Seleccionar Orden para Firma</h1>
        <div className="search-container">
          <input
            type="text"
            placeholder="Buscar por OP, cliente o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            autoFocus
          />
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={loadOrdenesListas}>Reintentar</button>
        </div>
      )}

      <div className="ordenes-grid">
        {ordenesFiltradas.length === 0 ? (
          <div className="empty-state">
            <p>{searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes listas para entregar'}</p>
          </div>
        ) : (
          ordenesFiltradas.map((orden) => (
            <div
              key={orden.id}
              className="orden-card"
              onClick={() => navigate(`/${orden.id}`)}
            >
              <div className="orden-card-header">
                <h2>OP #{orden.numero_op}</h2>
                <span className="orden-status">Lista</span>
              </div>
              <div className="orden-card-body">
                <p className="orden-cliente">{orden.cliente}</p>
                {orden.dni_cuit && (
                  <p className="orden-dni">DNI/CUIT: {orden.dni_cuit}</p>
                )}
                {orden.fecha_entrega && (
                  <p className="orden-fecha">
                    Entrega: {new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              <div className="orden-card-footer">
                <button className="btn-firma">Firmar</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

