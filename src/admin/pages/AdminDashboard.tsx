import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import PlotAIChat from '../../components/PlotAIChat'
import { useAuth } from '../../hooks/useAuth'
import './AdminDashboard.css'

interface AdminDashboardProps {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  onRefresh: () => void
}

export default function AdminDashboard({
  tasks,
  activity,
  teamMembers,
  onRefresh
}: AdminDashboardProps) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [isPlotAIOpen, setIsPlotAIOpen] = useState(false)

  // Calcular métricas rápidas
  const totalOps = tasks.length
  const opsEnProceso = tasks.filter(t => 
    t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
  ).length
  const opsUrgentes = tasks.filter(t => t.priority === 'alta').length
  const opsAtrasadas = tasks.filter(t => {
    const dueDate = new Date(t.dueDate)
    const now = new Date()
    return dueDate < now && t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
  }).length

  return (
    <div className="admin-dashboard">
      {/* Header Mobile-First */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <h1 className="admin-title">Plot Lab Admin</h1>
            <p className="admin-subtitle">Panel de Control</p>
          </div>
          <div className="admin-header-right">
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setIsPlotAIOpen(true)}
            >
              <span className="admin-btn-icon">🤖</span>
              <span className="admin-btn-text">PlotAI</span>
            </button>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => navigate('/reportes')}
            >
              <span className="admin-btn-icon">📊</span>
              <span className="admin-btn-text">Reportes</span>
            </button>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                localStorage.removeItem('usuario')
                localStorage.removeItem('auth_token')
                window.location.href = '/'
              }}
            >
              <span className="admin-btn-icon">🚪</span>
              <span className="admin-btn-text">Salir</span>
            </button>
          </div>
        </div>
        {usuario && (
          <div className="admin-user-info">
            <span>👤 {usuario.nombre}</span>
            <span className="admin-user-role">{usuario.rol}</span>
          </div>
        )}
      </header>

      {/* Métricas Rápidas */}
      <section className="admin-metrics">
        <div className="admin-metric-card">
          <div className="admin-metric-icon">📋</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{totalOps}</div>
            <div className="admin-metric-label">Total OPs</div>
          </div>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-icon">⚙️</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsEnProceso}</div>
            <div className="admin-metric-label">En Proceso</div>
          </div>
        </div>
        <div className="admin-metric-card admin-metric-card-urgent">
          <div className="admin-metric-icon">🔴</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsUrgentes}</div>
            <div className="admin-metric-label">Urgentes</div>
          </div>
        </div>
        <div className="admin-metric-card admin-metric-card-warning">
          <div className="admin-metric-icon">⚠️</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsAtrasadas}</div>
            <div className="admin-metric-label">Atrasadas</div>
          </div>
        </div>
      </section>

      {/* PlotAI Chat (Fullscreen en mobile, modal en desktop) */}
      {isPlotAIOpen && (
        <div className="admin-plotai-container">
          <PlotAIChat
            tasks={tasks}
            activity={activity}
            teamMembers={teamMembers}
            onClose={() => setIsPlotAIOpen(false)}
          />
        </div>
      )}

      {/* Accesos Rápidos */}
      <section className="admin-quick-actions">
        <h2 className="admin-section-title">Accesos Rápidos</h2>
        <div className="admin-quick-actions-grid">
          <button
            className="admin-quick-action-card"
            onClick={() => window.location.href = '/'}
          >
            <div className="admin-quick-action-icon">🏠</div>
            <div className="admin-quick-action-label">App Principal</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={() => navigate('/reportes')}
          >
            <div className="admin-quick-action-icon">📊</div>
            <div className="admin-quick-action-label">Reportes</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={() => setIsPlotAIOpen(true)}
          >
            <div className="admin-quick-action-icon">🤖</div>
            <div className="admin-quick-action-label">PlotAI</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={onRefresh}
          >
            <div className="admin-quick-action-icon">🔄</div>
            <div className="admin-quick-action-label">Actualizar</div>
          </button>
        </div>
      </section>

      {/* Información del Sistema */}
      <section className="admin-system-info">
        <h2 className="admin-section-title">Estado del Sistema</h2>
        <div className="admin-system-info-grid">
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Última actualización:</span>
            <span className="admin-system-info-value">
              {new Date().toLocaleTimeString('es-AR')}
            </span>
          </div>
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Usuarios activos:</span>
            <span className="admin-system-info-value">{teamMembers.length}</span>
          </div>
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Movimientos recientes:</span>
            <span className="admin-system-info-value">{activity.length}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

