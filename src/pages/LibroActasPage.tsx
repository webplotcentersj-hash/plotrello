import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { SectorRecord } from '../types/api'
import { getSectoresPermitidos } from '../utils/sectorPermissions'
import './LibroActasPage.css'

export default function LibroActasPage() {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [sectores, setSectores] = useState<SectorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/login')
      return
    }
    loadSectores()
  }, [usuario, navigate, authLoading])

  const loadSectores = async () => {
    if (!usuario) return
    
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getSectores()
      if (response.success && response.data) {
        // Filtrar sectores activos
        let sectoresActivos = response.data.filter(s => s.activo !== false)
        
        // Si no es admin, filtrar solo los sectores permitidos para su rol
        if (usuario.rol !== 'administracion' && usuario.rol !== 'gerencia') {
          const sectoresPermitidos = getSectoresPermitidos(usuario.rol)
          sectoresActivos = sectoresActivos.filter(s => 
            sectoresPermitidos.includes(s.nombre)
          )
        }
        
        setSectores(sectoresActivos)
      } else {
        setError(response.error || 'Error al cargar los sectores')
      }
    } catch (err) {
      setError('Error al cargar los sectores')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="libro-actas-selector-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando sectores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="libro-actas-selector-page">
      <header className="libro-actas-selector-header">
        <div className="libro-actas-selector-header-content">
          <div>
            <h1>📋 Libro de Actas por Sector</h1>
            <p className="subtitle">Selecciona un sector para ver o crear actas</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="libro-actas-selector-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {sectores.length === 0 ? (
          <div className="empty-state">
            <p>No hay sectores disponibles.</p>
          </div>
        ) : (
          <div className="sectores-grid">
            {sectores.map((sector) => (
              <button
                key={sector.id}
                className="sector-card"
                onClick={() => navigate(`/libro-actas/sector/${sector.id}`)}
                style={{
                  borderLeftColor: sector.color || '#6b7280'
                }}
              >
                <div className="sector-card-header">
                  <div
                    className="sector-color-indicator"
                    style={{ backgroundColor: sector.color || '#6b7280' }}
                  />
                  <h3>{sector.nombre}</h3>
                </div>
                <p className="sector-card-description">
                  Ver y crear actas del sector {sector.nombre}
                </p>
                <div className="sector-card-arrow">→</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

