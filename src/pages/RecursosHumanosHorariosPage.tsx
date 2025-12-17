import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosHorariosPage.css'

const RecursosHumanosHorariosPage = () => {
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [horarios, setHorarios] = useState<any[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-horarios-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-horarios-page">
      <header className="rrhh-horarios-header">
        <div className="rrhh-header-content">
          <h1>🕐 Gestión de Horarios y Turnos</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              + Crear Horario
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-horarios-content">
        <div className="rrhh-info-box">
          <p>📋 Esta funcionalidad permitirá gestionar horarios de trabajo y asignación de turnos para cada usuario.</p>
          <p>Próximamente: Calendario de turnos, horarios flexibles, y gestión de ausencias.</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosHorariosPage

