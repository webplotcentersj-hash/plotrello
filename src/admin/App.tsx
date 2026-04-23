import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import AdminDashboard from './pages/AdminDashboard'
import AdminReports from './pages/AdminReports'
import AdminDeletedOpsPage from './pages/AdminDeletedOpsPage'
import { useAuth } from '../hooks/useAuth'
import type { Task, TeamMember, ActivityEvent } from '../types/board'
import type {
  FacturaVentaRecord,
  HistorialMovimiento,
  PedidoClienteRecord,
  UsuarioRecord
} from '../types/api'
import type { StockMovimiento } from '../types/pedidos'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import { historialToActivity, ordenToTask } from '../utils/dataMappers'
import { ConversationProvider } from '@elevenlabs/react'
import '../app.css'
import './App.css'

const mapUsuariosToTeamMembers = (usuarios: UsuarioRecord[]): TeamMember[] =>
  usuarios.map((usuario) => ({
    id: usuario.id.toString(),
    name: usuario.nombre,
    role: usuario.rol,
    avatar: usuario.nombre
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    productivity: 0
  }))

function AdminApp() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [actividadReclamos, setActividadReclamos] = useState<HistorialMovimiento[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoClienteRecord[]>([])
  const [impresorasOcupacion, setImpresorasOcupacion] = useState<any[]>([])
  const [movimientosStock, setMovimientosStock] = useState<StockMovimiento[]>([])
  const [facturasVenta, setFacturasVenta] = useState<FacturaVentaRecord[]>([])
  const { usuario, loading: authLoading } = useAuth()
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const loadRemoteData = useCallback(async () => {
    setDataLoading(true)
    setDataError(null)
    try {
      if (!supabase) {
        setDataLoading(false)
        const errorMsg = 'Supabase no está configurado.'
        setDataError(errorMsg)
        console.error('❌', errorMsg)
        setTasks([])
        setActivity([])
        setTeamMembers([])
        return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Variables de entorno de Supabase no configuradas')
      }

      const fechaDesde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const [
        ordenesResponse,
        historialResponse,
        usuariosResponse,
        reclamosHistResponse,
        pedidosPendResponse,
        impresorasOccResponse,
        stockMovsResponse,
        facturasResponse
      ] =
        await Promise.all([
          apiService.getOrdenes(),
          apiService.getHistorialMovimientos({ limit: 5000 }),
          apiService.getUsuarios(),
          apiService.getHistorialReclamosIncidencias(8000),
          apiService.getPedidosPendientes(),
          apiService.getImpresorasOcupacion()
          ,
          apiService.getMovimientosStock({ fecha_desde: fechaDesde30d, limit: 800 }),
          apiService.getFacturas({ fechaDesde: fechaDesde30d })
        ])

      if (ordenesResponse.success && ordenesResponse.data) {
        const mappedTasks = ordenesResponse.data.map(ordenToTask)
        setTasks(mappedTasks)
        console.log(`✅ Cargadas ${mappedTasks.length} órdenes de trabajo`)
      } else {
        console.warn('⚠️ No se pudieron cargar órdenes de trabajo:', ordenesResponse.error)
        setTasks([])
      }

      if (historialResponse.success && historialResponse.data) {
        const mappedActivity = historialResponse.data.map(historialToActivity)
        setActivity(mappedActivity)
        console.log(`✅ Cargados ${mappedActivity.length} movimientos de historial`)
      } else {
        console.warn('⚠️ No se pudo cargar historial:', historialResponse.error)
        setActivity([])
      }

      if (usuariosResponse.success && usuariosResponse.data) {
        const mappedMembers = mapUsuariosToTeamMembers(usuariosResponse.data)
        setTeamMembers(mappedMembers)
        console.log(`✅ Cargados ${mappedMembers.length} usuarios`)
      } else {
        console.warn('⚠️ No se pudieron cargar usuarios:', usuariosResponse.error)
        setTeamMembers([])
      }

      if (reclamosHistResponse.success && reclamosHistResponse.data) {
        setActividadReclamos(reclamosHistResponse.data)
      } else {
        setActividadReclamos([])
      }

      if (pedidosPendResponse.success && pedidosPendResponse.data) {
        setPedidosPendientes(pedidosPendResponse.data)
      } else {
        setPedidosPendientes([])
      }

      if (impresorasOccResponse.success && impresorasOccResponse.data) {
        setImpresorasOcupacion(impresorasOccResponse.data)
      } else {
        setImpresorasOcupacion([])
      }

      if (stockMovsResponse.success && stockMovsResponse.data) {
        setMovimientosStock(stockMovsResponse.data)
      } else {
        setMovimientosStock([])
      }

      if (facturasResponse.success && facturasResponse.data) {
        setFacturasVenta(facturasResponse.data)
      } else {
        setFacturasVenta([])
      }

      setLastUpdatedAt(new Date().toISOString())
    } catch (error) {
      console.error('❌ Error cargando datos remotos:', error)
      setDataError(error instanceof Error ? error.message : 'Error desconocido')
      setTasks([])
      setActivity([])
      setTeamMembers([])
      setActividadReclamos([])
      setPedidosPendientes([])
      setImpresorasOcupacion([])
      setMovimientosStock([])
      setFacturasVenta([])
      setLastUpdatedAt(null)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && usuario) {
      loadRemoteData()
    }
  }, [authLoading, usuario, loadRemoteData])

  // Nota: no auto-refresh. El gerente controla el refresh manualmente.

  if (authLoading || dataLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#f9fbff'
      }}>
        <div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#eb671b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Cargando Panel Admin...</p>
        </div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#f9fbff',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '16px' }}>⚠️ Error</h1>
        <p style={{ marginBottom: '24px', color: '#b7bed3' }}>{dataError}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            background: '#eb671b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Recargar
        </button>
      </div>
    )
  }

  return (
    <ConversationProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AdminProtectedRoute>
                <AdminDashboard
                  tasks={tasks}
                  activity={activity}
                  teamMembers={teamMembers}
                  actividadReclamos={actividadReclamos}
                  pedidosPendientes={pedidosPendientes}
                  impresorasOcupacion={impresorasOcupacion}
                  movimientosStock={movimientosStock}
                  facturasVenta={facturasVenta}
                  lastUpdatedAt={lastUpdatedAt}
                  loading={dataLoading}
                  onRefresh={loadRemoteData}
                />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <AdminProtectedRoute>
                <AdminReports tasks={tasks} activity={activity} teamMembers={teamMembers} />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/op-eliminadas"
            element={
              <AdminProtectedRoute>
                <AdminDeletedOpsPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConversationProvider>
  )
}

export default AdminApp

