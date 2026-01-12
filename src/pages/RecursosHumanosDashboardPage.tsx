import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosDashboardPage.css'

const RecursosHumanosDashboardPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    usuariosActivos: 0,
    usuariosPorRol: {} as Record<string, number>,
    usuariosPorSector: {} as Record<string, number>,
    actividadHoy: 0,
    actividadSemana: 0,
    actividadMes: 0
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/')
      return
    }
    loadDashboardData()
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Cargar usuarios
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
        
        // Calcular estadísticas
        const totalUsuarios = usuariosResponse.data.length
        const usuariosActivos = usuariosResponse.data.filter(() => {
          // Considerar activo si ha estado activo en las últimas 24 horas
          // Esto se puede mejorar con last_seen si está disponible
          return true // Por ahora todos son activos
        }).length

        // Contar por rol
        const usuariosPorRol: Record<string, number> = {}
        usuariosResponse.data.forEach(u => {
          usuariosPorRol[u.rol] = (usuariosPorRol[u.rol] || 0) + 1
        })

        setStats({
          totalUsuarios,
          usuariosActivos,
          usuariosPorRol,
          usuariosPorSector: {},
          actividadHoy: 0,
          actividadSemana: 0,
          actividadMes: 0
        })
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-dashboard-loading">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-dashboard">
      <header className="rrhh-dashboard-header">
        <div className="rrhh-header-content">
          <h1>👥 Recursos Humanos</h1>
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Volver al Tablero
          </button>
        </div>
      </header>

      <div className="rrhh-dashboard-content">
        {/* Estadísticas principales */}
        <div className="rrhh-stats-grid">
          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">👥</div>
            <div className="rrhh-stat-info">
              <h3>Total de Usuarios</h3>
              <p className="rrhh-stat-value">{stats.totalUsuarios}</p>
            </div>
          </div>

          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">✅</div>
            <div className="rrhh-stat-info">
              <h3>Usuarios Activos</h3>
              <p className="rrhh-stat-value">{stats.usuariosActivos}</p>
            </div>
          </div>

          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">📊</div>
            <div className="rrhh-stat-info">
              <h3>Actividad Hoy</h3>
              <p className="rrhh-stat-value">{stats.actividadHoy}</p>
            </div>
          </div>

          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">📈</div>
            <div className="rrhh-stat-info">
              <h3>Actividad Semanal</h3>
              <p className="rrhh-stat-value">{stats.actividadSemana}</p>
            </div>
          </div>
        </div>

        {/* Sección de acciones rápidas */}
        <div className="rrhh-actions-section">
          <h2>Acciones Rápidas</h2>
          <div className="rrhh-actions-grid">
            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/usuarios')}
            >
              <div className="rrhh-action-icon">👤</div>
              <h3>Gestión de Usuarios</h3>
              <p>Crear, editar y gestionar usuarios del sistema</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/reportes')}
            >
              <div className="rrhh-action-icon">📊</div>
              <h3>Reportes de Personal</h3>
              <p>Ver reportes detallados por usuario, sector y período</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/horarios')}
            >
              <div className="rrhh-action-icon">🕐</div>
              <h3>Horarios y Turnos</h3>
              <p>Gestionar horarios de trabajo y asignación de turnos</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/evaluaciones')}
            >
              <div className="rrhh-action-icon">⭐</div>
              <h3>Evaluaciones</h3>
              <p>Gestionar evaluaciones de desempeño</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/capacitaciones')}
            >
              <div className="rrhh-action-icon">📚</div>
              <h3>Capacitaciones</h3>
              <p>Gestionar capacitaciones y cursos</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/menu-diario')}
            >
              <div className="rrhh-action-icon">🍽️</div>
              <h3>Menú Diario</h3>
              <p>Gestionar menú del día y selecciones de empleados</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/estadisticas')}
            >
              <div className="rrhh-action-icon">📈</div>
              <h3>Estadísticas Avanzadas</h3>
              <p>Análisis detallado de productividad y rendimiento</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/permisos')}
            >
              <div className="rrhh-action-icon">🔐</div>
              <h3>Permisos y Roles</h3>
              <p>Gestionar permisos y asignación de roles</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/notificaciones')}
            >
              <div className="rrhh-action-icon">📢</div>
              <h3>Notificador Masivo</h3>
              <p>Enviar notificaciones a todos los usuarios o grupos específicos</p>
            </button>
          </div>
        </div>

        {/* Distribución por roles */}
        <div className="rrhh-section">
          <h2>Distribución por Roles</h2>
          <div className="rrhh-roles-grid">
            {Object.entries(stats.usuariosPorRol).map(([rol, count]) => (
              <div key={rol} className="rrhh-role-card">
                <h3>{rol}</h3>
                <p className="rrhh-role-count">{count}</p>
                <div className="rrhh-role-bar">
                  <div
                    className="rrhh-role-bar-fill"
                    style={{
                      width: `${(count / stats.totalUsuarios) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de usuarios recientes */}
        <div className="rrhh-section">
          <h2>Usuarios del Sistema</h2>
          <div className="rrhh-users-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Última Actividad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.nombre}</td>
                    <td>
                      <span className="rrhh-role-badge">{user.rol}</span>
                    </td>
                    <td>Hoy</td>
                    <td>
                      <button
                        className="btn-edit"
                        onClick={() => navigate(`/rrhh/usuarios/${user.id}`)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosDashboardPage

