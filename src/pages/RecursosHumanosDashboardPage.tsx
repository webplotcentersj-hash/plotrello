import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosDashboardPage.css'

const RecursosHumanosDashboardPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccessRrhhDashboard =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    rolesDistintos: 0,
    usuariosPorRol: {} as Record<string, number>,
    totalPruebas: 0,
    pruebasAsignaciones: 0,
    pruebasFinalizadas: 0
  })

  useEffect(() => {
    if (authLoading) return
    if (!canAccessRrhhDashboard) {
      navigate('/')
      return
    }
    loadDashboardData()
  }, [canAccessRrhhDashboard, navigate, authLoading])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [usuariosResponse, pruebasResponse] = await Promise.all([
        apiService.getUsuarios(),
        apiService.rrhhPruebasListar()
      ])

      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
        const totalUsuarios = usuariosResponse.data.length
        const usuariosPorRol: Record<string, number> = {}
        usuariosResponse.data.forEach((u) => {
          usuariosPorRol[u.rol] = (usuariosPorRol[u.rol] || 0) + 1
        })
        const rolesDistintos = Object.keys(usuariosPorRol).length

        let totalPruebas = 0
        let pruebasAsignaciones = 0
        let pruebasFinalizadas = 0
        if (pruebasResponse.success && Array.isArray(pruebasResponse.data)) {
          totalPruebas = pruebasResponse.data.length
          pruebasResponse.data.forEach((p: { asignados?: number; finalizados?: number }) => {
            pruebasAsignaciones += Number(p.asignados) || 0
            pruebasFinalizadas += Number(p.finalizados) || 0
          })
        }

        setStats({
          totalUsuarios,
          rolesDistintos,
          usuariosPorRol,
          totalPruebas,
          pruebasAsignaciones,
          pruebasFinalizadas
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
        <div className="rrhh-dashboard-personal">
          <div className="rrhh-dashboard-personal-text">
            <strong>Mis evaluaciones</strong>
            <span>Pruebas asignadas a tu usuario (todos los sectores)</span>
          </div>
          <button type="button" className="rrhh-dashboard-personal-btn" onClick={() => navigate('/mis-pruebas')}>
            Abrir
          </button>
        </div>

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
            <div className="rrhh-stat-icon">🏷️</div>
            <div className="rrhh-stat-info">
              <h3>Roles distintos</h3>
              <p className="rrhh-stat-value">{stats.rolesDistintos}</p>
            </div>
          </div>

          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">📝</div>
            <div className="rrhh-stat-info">
              <h3>Pruebas de conocimiento</h3>
              <p className="rrhh-stat-value">{stats.totalPruebas}</p>
            </div>
          </div>

          <div className="rrhh-stat-card">
            <div className="rrhh-stat-icon">📋</div>
            <div className="rrhh-stat-info">
              <h3>Asignaciones / Finalizadas</h3>
              <p className="rrhh-stat-value">
                {stats.pruebasAsignaciones} / {stats.pruebasFinalizadas}
              </p>
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
              onClick={() => navigate('/rrhh/desvinculaciones')}
            >
              <div className="rrhh-action-icon">📉</div>
              <h3>Historial de desvinculaciones</h3>
              <p>Tendencias de bajas, antigüedad, sectores y evolución mensual</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/incidencias')}
            >
              <div className="rrhh-action-icon">⚠️</div>
              <h3>Incidencias</h3>
              <p>OP en reclamo: motivo, seguimiento RRHH y análisis con PlotAI</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/novedades')}
            >
              <div className="rrhh-action-icon">📋</div>
              <h3>Novedades</h3>
              <p>
                Faltas, tardanzas, licencias y horas extra — calendario, comprobantes y reportes
              </p>
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
              onClick={() => navigate('/rrhh/pruebas')}
            >
              <div className="rrhh-action-icon">📝</div>
              <h3>Pruebas de conocimiento</h3>
              <p>Crear pruebas, asignarlas y ver respuestas</p>
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
                        onClick={() =>
                          navigate('/rrhh/usuarios', { state: { openEditUserId: user.id } })
                        }
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

