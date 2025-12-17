import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './RecursosHumanosPermisosPage.css'

const RecursosHumanosPermisosPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="rrhh-permisos-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-permisos-page">
      <header className="rrhh-permisos-header">
        <div className="rrhh-header-content">
          <h1>🔐 Gestión de Permisos y Roles</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-permisos-content">
        <div className="rrhh-info-box">
          <p>📋 Esta funcionalidad permitirá gestionar permisos específicos y asignación de roles.</p>
          <p>Próximamente: Matriz de permisos, roles personalizados, y gestión de accesos.</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosPermisosPage

