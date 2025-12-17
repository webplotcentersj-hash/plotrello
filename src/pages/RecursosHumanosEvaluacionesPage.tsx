import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosEvaluacionesPage.css'

const RecursosHumanosEvaluacionesPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar datos si es necesario
      await apiService.getUsuarios()
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-evaluaciones-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-evaluaciones-page">
      <header className="rrhh-evaluaciones-header">
        <div className="rrhh-header-content">
          <h1>⭐ Evaluaciones de Desempeño</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
            <button className="btn-primary" onClick={() => {}}>
              + Nueva Evaluación
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-evaluaciones-content">
        <div className="rrhh-info-box">
          <p>📋 Esta funcionalidad permitirá gestionar evaluaciones de desempeño para cada usuario.</p>
          <p>Próximamente: Formularios de evaluación, métricas de desempeño, y seguimiento de objetivos.</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosEvaluacionesPage

