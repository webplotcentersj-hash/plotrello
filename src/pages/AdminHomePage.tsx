import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AdminModulePanel from '../components/admin-module/AdminModulePanel'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { exportTableroFichasActivasPdf } from '../utils/exportTableroFichasActivasPdf'
import { ordenToTask } from '../utils/dataMappers'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import './AdminHomePage.css'

const PlotAIChat = lazy(() => import('../components/PlotAIChat'))

type AdminHomePageProps = {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  onLogout: () => void
  onReloadData: () => void
}

export default function AdminHomePage({
  tasks,
  activity,
  teamMembers,
  onLogout,
  onReloadData
}: AdminHomePageProps) {
  const navigate = useNavigate()
  const { isAdmin, isGerencia } = useAuth()
  const [pedidosPendientes, setPedidosPendientes] = useState(0)
  const [isPlotAIOpen, setIsPlotAIOpen] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const allowed = isAdmin || isGerencia

  useEffect(() => {
    if (!allowed) return
    void apiService.getPedidosPendientes().then((res) => {
      if (res.success && res.data) setPedidosPendientes(res.data.length)
    })
  }, [allowed])

  const fichasActivasTablero = useMemo(
    () => tasks.filter((t) => !t.esSubTarea && !t.ordenEliminada && t.visibleEnTablero !== false && !t.entregado),
    [tasks]
  )

  const opsUrgentes = useMemo(
    () => fichasActivasTablero.filter((t) => t.priority === 'alta').length,
    [fichasActivasTablero]
  )

  const opsAtrasadas = useMemo(() => {
    const now = new Date()
    return fichasActivasTablero.filter((t) => {
      const dueDate = new Date(t.dueDate)
      return dueDate < now && t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
    }).length
  }, [fichasActivasTablero])

  const handleDescargarBackup = useCallback(async () => {
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
          aplicacion: 'Plot Lab',
          versionExport: 1
        },
        ordenes_trabajo: ordRes.success ? ordRes.data ?? [] : [],
        historial_movimientos: histRes.success ? histRes.data ?? [] : [],
        usuarios: usrRes.success ? usrRes.data ?? [] : []
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
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo generar el backup.')
    } finally {
      setBackupLoading(false)
    }
  }, [])

  const handleDescargarFichasPdf = useCallback(async () => {
    setPdfLoading(true)
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
      setPdfLoading(false)
    }
  }, [])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="admin-home-page">
      <AdminModulePanel
        navigateInApp
        onNavigateTablero={() => navigate('/tablero')}
        onNavigateToMensajeria={() => navigate('/mensajeria')}
        onNavigateToChat={() => navigate('/chat')}
        onLogout={onLogout}
        onRefreshData={onReloadData}
        kpis={{
          fichasActivas: fichasActivasTablero.length,
          urgentes: opsUrgentes,
          atrasadas: opsAtrasadas,
          pedidosPendientes
        }}
        onPlotAI={() => setIsPlotAIOpen(true)}
        onBackup={handleDescargarBackup}
        onPdf={handleDescargarFichasPdf}
        onRefresh={onReloadData}
        backupLoading={backupLoading}
        pdfLoading={pdfLoading}
      />

      {isPlotAIOpen && (
        <Suspense fallback={null}>
          <div className="admin-home-plotai">
            <PlotAIChat
              tasks={tasks}
              activity={activity}
              teamMembers={teamMembers}
              onClose={() => setIsPlotAIOpen(false)}
            />
          </div>
        </Suspense>
      )}
    </div>
  )
}
