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
  const [usuariosLoading, setUsuariosLoading] = useState(true)
  const [usuariosAbiertos, setUsuariosAbiertos] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!canAccessRrhhDashboard) {
      navigate('/')
      return
    }
    void loadDashboardData()
  }, [canAccessRrhhDashboard, navigate, authLoading])

  const loadDashboardData = async () => {
    setUsuariosLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error)
    } finally {
      setUsuariosLoading(false)
    }
  }

  if (authLoading) {
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
                Faltas, tardanzas, licencias, horas extra, pérdida del beneficio de comida, parte diario y
                anticipación de sueldo — calendario, firma y reportes
              </p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/postulaciones')}
            >
              <div className="rrhh-action-icon">📄</div>
              <h3>Postulaciones / CVs</h3>
              <p>Bandeja, pipeline (entrevista → oferta → ingreso) y funnel de conversión</p>
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
              onClick={() => navigate('/rrhh/horas-extra')}
            >
              <div className="rrhh-action-icon">⏱️</div>
              <h3>Horas extra declaradas</h3>
              <p>Aprobar o rechazar 1 a 1 las HE que carga cada empleado (foto + texto)</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/libro-sueldos')}
            >
              <div className="rrhh-action-icon">📗</div>
              <h3>Libro de sueldos</h3>
              <p>Recibos LCT, PDF a empleados y TXT para ARCA / F.931</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/vacaciones')}
            >
              <div className="rrhh-action-icon">🏖️</div>
              <h3>Vacaciones / saldos</h3>
              <p>Cupo LCT, días tomados, ajustes manuales y saldo por empleado</p>
            </button>

            <button className="rrhh-action-card" onClick={() => navigate('/rrhh/organigrama')}>
              <div className="rrhh-action-icon">🏢</div>
              <h3>Organigrama</h3>
              <p>Puestos, jerarquía y asignación de jefes</p>
            </button>

            <button className="rrhh-action-card" onClick={() => navigate('/rrhh/medicina')}>
              <div className="rrhh-action-icon">🩺</div>
              <h3>Medicina / ART</h3>
              <p>Exámenes, aptos y vencimientos</p>
            </button>

            <button className="rrhh-action-card" onClick={() => navigate('/rrhh/clima')}>
              <div className="rrhh-action-icon">📊</div>
              <h3>Clima laboral</h3>
              <p>Encuestas anónimas eNPS y resultados</p>
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
              onClick={() => navigate('/rrhh/formacion')}
            >
              <div className="rrhh-action-icon">📚</div>
              <h3>Formación</h3>
              <p>Capacitaciones, cursos y pruebas de conocimiento</p>
            </button>

            <button
              className="rrhh-action-card"
              onClick={() => navigate('/rrhh/menu-diario')}
            >
              <div className="rrhh-action-icon">🍽️</div>
              <h3>Menú Diario</h3>
              <p>
                Menú del día, pedidos y planilla acumulativa de descuentos ($7.000 por pedido con pérdida de
                beneficio de comida)
              </p>
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

        {/* Lista de usuarios — desplegable */}
        <div className={`rrhh-section rrhh-section-collapsible${usuariosAbiertos ? ' is-open' : ''}`}>
          <button
            type="button"
            className="rrhh-section-toggle"
            aria-expanded={usuariosAbiertos}
            onClick={() => setUsuariosAbiertos((v) => !v)}
          >
            <h2>
              Usuarios del Sistema
              {!usuariosLoading && usuarios.length > 0 ? (
                <span className="rrhh-section-count">({usuarios.length})</span>
              ) : null}
            </h2>
            <span className="rrhh-section-chevron" aria-hidden>
              {usuariosAbiertos ? '▾' : '▸'}
            </span>
          </button>
          {usuariosAbiertos ? (
            <>
              {usuariosLoading ? (
                <p className="rrhh-dashboard-inline-loading">Cargando usuarios…</p>
              ) : null}
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosDashboardPage

