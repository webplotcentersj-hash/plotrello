import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import PlotAIChat from '../../components/PlotAIChat'
import { useAuth } from '../../hooks/useAuth'
import apiService from '../../services/api'
import { ordenToTask } from '../../utils/dataMappers'
import { exportTableroFichasActivasPdf } from '../../utils/exportTableroFichasActivasPdf'
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [pdfFichasLoading, setPdfFichasLoading] = useState(false)

  // Manejar instalación PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleDescargarBackup = async () => {
    setBackupLoading(true)
    try {
      const [ordRes, histRes, usrRes] = await Promise.all([
        apiService.getOrdenes(),
        apiService.getHistorialMovimientos({ limit: 50000 }),
        apiService.getUsuarios()
      ])

      const payload = {
        meta: {
          exportadoEn: new Date().toISOString(),
          aplicacion: 'Plot Lab Admin',
          versionExport: 1,
          aviso:
            'Snapshot JSON (órdenes, historial de movimientos, usuarios) obtenido por la API del cliente. No sustituye un backup completo de la base PostgreSQL ni archivos en Storage.'
        },
        ordenes_trabajo: ordRes.success ? ordRes.data ?? [] : [],
        historial_movimientos: histRes.success ? histRes.data ?? [] : [],
        usuarios: usrRes.success ? usrRes.data ?? [] : [],
        erroresCarga: {
          ordenes: ordRes.success ? null : ordRes.error ?? 'desconocido',
          historial: histRes.success ? null : histRes.error ?? 'desconocido',
          usuarios: usrRes.success ? null : usrRes.error ?? 'desconocido'
        }
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19)
      a.href = url
      a.download = `plotlab-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)

      const errs = payload.erroresCarga
      if (errs.ordenes || errs.historial || errs.usuarios) {
        window.alert(
          'Backup generado con advertencias: revisá el campo erroresCarga dentro del JSON si alguna sección quedó vacía.'
        )
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo generar el backup.')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleDescargarFichasPdf = async () => {
    setPdfFichasLoading(true)
    try {
      const ordRes = await apiService.getOrdenes()
      if (!ordRes.success || !ordRes.data) {
        window.alert(ordRes.error ?? 'No se pudieron cargar las órdenes.')
        return
      }
      exportTableroFichasActivasPdf(ordRes.data.map((o) => ordenToTask(o)))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
    } finally {
      setPdfFichasLoading(false)
    }
  }

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('[PWA Admin] Usuario aceptó la instalación')
    } else {
      console.log('[PWA Admin] Usuario rechazó la instalación')
    }
    
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

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
            {isInstallable && (
              <button
                className="admin-btn admin-btn-install"
                onClick={handleInstallPWA}
                title="Instalar aplicación"
              >
                <span className="admin-btn-icon">📱</span>
                <span className="admin-btn-text">Instalar</span>
              </button>
            )}
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setIsPlotAIOpen(true)}
            >
              <span className="admin-btn-icon">🤖</span>
              <span className="admin-btn-text">PlotAI</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-backup"
              onClick={() => void handleDescargarBackup()}
              disabled={backupLoading || pdfFichasLoading}
              title="Descargar JSON con órdenes, historial y usuarios"
            >
              <span className="admin-btn-icon">💾</span>
              <span className="admin-btn-text">{backupLoading ? 'Generando…' : 'Backup'}</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-fichas-pdf"
              onClick={() => void handleDescargarFichasPdf()}
              disabled={pdfFichasLoading || backupLoading}
              title="PDF de todas las fichas activas del tablero principal (Kanban)"
            >
              <span className="admin-btn-icon">📄</span>
              <span className="admin-btn-text">{pdfFichasLoading ? 'PDF…' : 'Fichas PDF'}</span>
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
            onClick={() => navigate('/admin/op-eliminadas')}
          >
            <div className="admin-quick-action-icon">🗑️</div>
            <div className="admin-quick-action-label">OP eliminadas</div>
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
          <button
            type="button"
            className="admin-quick-action-card"
            disabled={backupLoading || pdfFichasLoading}
            onClick={() => void handleDescargarBackup()}
          >
            <div className="admin-quick-action-icon">💾</div>
            <div className="admin-quick-action-label">
              {backupLoading ? 'Generando backup…' : 'Descargar backup'}
            </div>
          </button>
          <button
            type="button"
            className="admin-quick-action-card admin-quick-action-card-pdf"
            disabled={pdfFichasLoading || backupLoading}
            onClick={() => void handleDescargarFichasPdf()}
          >
            <div className="admin-quick-action-icon">📑</div>
            <div className="admin-quick-action-label">
              {pdfFichasLoading ? 'Generando PDF…' : 'Fichas activas (PDF)'}
            </div>
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

