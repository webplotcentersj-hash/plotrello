import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import BoardPage from './pages/BoardPage'
import StatisticsPage from './pages/StatisticsPage'
import ChatPage from './pages/ChatPage'
import ClienteConsultaPage from './pages/ClienteConsultaPage'
import UsuariosPage from './pages/UsuariosPage'
import DashboardPantallasPage from './pages/DashboardPantallasPage'
import ImpresorasPage from './pages/ImpresorasPage'
import CalendarPage from './pages/CalendarPage'
import GanttPage from './pages/GanttPage'
import OpViewPage from './pages/OpViewPage'
import OpPublicPage from './pages/OpPublicPage'
import HerramientaPage from './pages/HerramientaPage'
import MostradorDashboardPage from './pages/MostradorDashboardPage'
import DisenoDashboardPage from './pages/DisenoDashboardPage'
import GaleriaTrabajosPage from './pages/GaleriaTrabajosPage'
import OrdenesListasPage from './pages/OrdenesListasPage'
import BuscarClientePage from './pages/BuscarClientePage'
import EntregaPage from './pages/EntregaPage'
import CalendarioEntregasPage from './pages/CalendarioEntregasPage'
import ReportesMostradorPage from './pages/ReportesMostradorPage'
import ClientesFrecuentesPage from './pages/ClientesFrecuentesPage'
import ComprasDashboardPage from './pages/ComprasDashboardPage'
import PedidoCompraDetallePage from './pages/PedidoCompraDetallePage'
import ReportesStockPage from './pages/ReportesStockPage'
import GestionStockPage from './pages/GestionStockPage'
import Login from './components/Login'
import EnvDebug from './components/EnvDebug'
import type { ActivityEvent, Task, TeamMember } from './types/board'
import type {
  HistorialMovimiento,
  MaterialRecord,
  OrdenTrabajo,
  SectorRecord,
  UsuarioRecord
} from './types/api'
import { useAuth } from './hooks/useAuth'
import './app.css'
import apiService from './services/api'
import { historialToActivity, ordenToTask } from './utils/dataMappers'
import { supabase } from './services/supabaseClient'

const DEFAULT_SECTORES: SectorRecord[] = [
  { id: 1, nombre: 'Diseño Gráfico', color: '#FF7F50' },
  { id: 2, nombre: 'Taller de Imprenta', color: '#8F7EF3' },
  { id: 3, nombre: 'Taller Gráfico', color: '#4FD1C5' },
  { id: 4, nombre: 'Instalaciones', color: '#F6AD55' },
  { id: 5, nombre: 'Metalúrgica', color: '#63B3ED' },
  { id: 6, nombre: 'Mostrador', color: '#E53E3E' },
  { id: 7, nombre: 'Caja', color: '#48BB78' }
]

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

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [sectores, setSectores] = useState<SectorRecord[]>(DEFAULT_SECTORES)
  const [materiales, setMateriales] = useState<MaterialRecord[]>([])
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('compactMode') === '1'
  })
  const { usuario, loading, setUsuario } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      setIsAuthenticated(!!usuario)
    }
  }, [usuario, loading])

  // Debug: Mostrar variables de entorno
  useEffect(() => {
    console.log('🔍 Variables de Entorno:')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_SCHEMA:', import.meta.env.VITE_SUPABASE_SCHEMA || 'NO CONFIGURADA')
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'NO CONFIGURADA')
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase no está configurado. La app usará datos mock o fallback.')
    }
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('compact-mode', isCompact)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('compactMode', isCompact ? '1' : '0')
    }
  }, [isCompact])

  const handleLogin = (usuarioData: any) => {
    setUsuario(usuarioData)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('usuario')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('usuario_id')
    setUsuario(null)
    setIsAuthenticated(false)
    setTasks([])
    setActivity([])
    setTeamMembers([])
    setSectores(DEFAULT_SECTORES)
    setMateriales([])
  }

  const loadRemoteData = useCallback(async () => {
    setDataLoading(true)
    setDataError(null)
    try {
      if (!supabase) {
        setDataLoading(false)
        setDataError('Supabase no está configurado. Define las variables VITE_SUPABASE_* y vuelve a intentar.')
        setTasks([])
        setActivity([])
        setTeamMembers([])
        setSectores([])
        setMateriales([])
        return
      }

      const [ordenesResp, historialResp] = await Promise.all([
        apiService.getOrdenes(),
        apiService.getHistorialMovimientos({ limit: 100 })
      ])

      if (ordenesResp.success && ordenesResp.data) {
        // Solo fichas principales: las sub-tareas no se muestran en el tablero
        const tasksWithCorrectStatus = ordenesResp.data.map((orden) => ordenToTask(orden))
        setTasks(tasksWithCorrectStatus)
      } else {
        setDataError(ordenesResp.error || 'No se pudieron cargar las órdenes')
      }

      if (historialResp.success && historialResp.data) {
        setActivity(historialResp.data.map((registro) => historialToActivity(registro)))
      } else {
        setDataError((prev) => prev ?? historialResp.error ?? 'No se pudo cargar el historial')
      }

      const [usuariosResp, sectoresResp, materialesResp] = await Promise.all([
        apiService.getUsuarios(),
        apiService.getSectores(),
        apiService.getMateriales()
      ])

      if (usuariosResp.success && usuariosResp.data) {
        setTeamMembers(mapUsuariosToTeamMembers(usuariosResp.data))
      } else {
        setTeamMembers([])
        setDataError((prev) => prev ?? usuariosResp.error ?? 'No se pudieron cargar los usuarios')
      }

      if (sectoresResp.success && sectoresResp.data && sectoresResp.data.length > 0) {
        setSectores(sectoresResp.data)
      } else {
        setSectores(DEFAULT_SECTORES)
        setDataError((prev) => prev ?? sectoresResp.error ?? 'No se pudieron cargar los sectores')
      }

      if (materialesResp.success && materialesResp.data) {
        setMateriales(materialesResp.data)
      } else {
        setMateriales([])
        setDataError((prev) => prev ?? materialesResp.error ?? 'No se pudieron cargar los materiales')
      }
    } catch (error) {
      console.error('Error cargando datos desde Supabase:', error)
      setDataError('No se pudieron sincronizar los datos con Supabase.')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      void loadRemoteData()
    }
  }, [isAuthenticated, loadRemoteData])

  useEffect(() => {
    if (!supabase || !isAuthenticated) return

    // Track movimientos recientes del usuario para evitar efecto espejo del realtime
    const recentUserMoves = new Map<string, { estado: string; timestamp: number }>()

    // Escuchar eventos de movimiento del usuario desde BoardPage
    const handleUserMove = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId: string; estado: string; timestamp: number }>
      const { taskId, estado, timestamp } = customEvent.detail
      recentUserMoves.set(taskId, { estado, timestamp })
      console.log(`📝 Registrado movimiento del usuario: ${taskId} → ${estado}`)
    }

    window.addEventListener('user-moved-task', handleUserMove)

    const upsertTaskFromOrden = (orden: OrdenTrabajo) => {
      if (!orden?.id) return
      const taskId = orden.id!.toString()
      const mapped = ordenToTask(orden)
      
      // Verificar si hay un movimiento reciente del usuario para esta ficha
      const recentMove = recentUserMoves.get(taskId)
      if (recentMove) {
        const timeSinceMove = Date.now() - recentMove.timestamp
        // Si el movimiento fue hace menos de 3 segundos y el estado del realtime
        // es diferente al estado que el usuario movió, ignorar (efecto espejo)
        if (timeSinceMove < 3000 && orden.estado !== recentMove.estado) {
          console.log(`⏭️ Ignorando actualización realtime (efecto espejo) para ${taskId}: realtime=${orden.estado}, usuario movió a=${recentMove.estado}`)
          return
        }
        // Si pasaron más de 3 segundos, limpiar el tracking
        if (timeSinceMove >= 3000) {
          recentUserMoves.delete(taskId)
        }
      }
      
      setTasks((prev) => {
        const next = [...prev]
        const idx = next.findIndex((task) => task.id === taskId)
        if (idx >= 0) {
          next[idx] = mapped
        } else {
          next.unshift(mapped)
        }
        
        return next
      })
    }

    const removeTask = (orden: OrdenTrabajo | null) => {
      if (!orden?.id) return
      setTasks((prev) => prev.filter((task) => task.id !== orden.id!.toString()))
    }

    const addActivityFromRegistro = (registro: HistorialMovimiento) => {
      if (!registro?.id) return
      const mapped = historialToActivity(registro)
      setActivity((prev) => {
        const withoutDuplicate = prev.filter((event) => event.id !== mapped.id)
        return [mapped, ...withoutDuplicate].slice(0, 300)
      })
    }

    const ordenesChannel = supabase
      .channel('realtime-ordenes')
      .on<OrdenTrabajo>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            removeTask(payload.old as OrdenTrabajo)
          } else {
            upsertTaskFromOrden(payload.new as OrdenTrabajo)
          }
        }
      )

    const historialChannel = supabase
      .channel('realtime-historial')
      .on<HistorialMovimiento>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_movimientos' },
        (payload) => {
          addActivityFromRegistro(payload.new as HistorialMovimiento)
        }
      )

    ordenesChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime conectado: ordenes_trabajo')
      }
    })

    historialChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime conectado: historial_movimientos')
      }
    })

    return () => {
      void ordenesChannel.unsubscribe()
      void historialChannel.unsubscribe()
      window.removeEventListener('user-moved-task', handleUserMove)
    }
  }, [isAuthenticated])

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #0b0d17 0%, #1a1d2e 100%)',
        color: '#fff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTopColor: '#eb671b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <p>Cargando...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <EnvDebug />
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/consulta-cliente" element={<ClienteConsultaPage />} />
          <Route path="/dashboard-pantallas" element={<DashboardPantallasPage />} />
          <Route path="/op-public/:opNumber" element={<OpPublicPage />} />
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
            }
          />

          {/* Rutas protegidas - requieren autenticación */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <AppRoutes
                  tasks={tasks}
                  setTasks={setTasks}
                  activity={activity}
                  setActivity={setActivity}
                  onLogout={handleLogout}
                  onReloadData={loadRemoteData}
                  isSyncing={dataLoading}
                  syncError={dataError}
                  teamMembers={teamMembers}
                  sectores={sectores}
                  materiales={materiales}
                  isCompact={isCompact}
                  onToggleCompact={() => setIsCompact((prev) => !prev)}
                />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  )
}

function AppRoutes({
  tasks,
  setTasks,
  activity,
  setActivity,
  onLogout,
  onReloadData,
  isSyncing,
  syncError,
  teamMembers,
  sectores,
  materiales,
  isCompact,
  onToggleCompact
}: {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  activity: ActivityEvent[]
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  onLogout: () => void
  onReloadData: () => Promise<void>
  isSyncing: boolean
  syncError: string | null
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materiales: MaterialRecord[]
  isCompact: boolean
  onToggleCompact: () => void
}) {
  const navigate = useNavigate()

  return (
    <>
      {/* Botón flotante para acceder a impresoras */}
      <button
        className="floating-button"
        onClick={() => navigate('/impresoras')}
        title="Ver ocupación de impresoras"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: 'none',
          color: '#fff',
          fontSize: '28px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          fontWeight: 'bold'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
        }}
      >
        🖨️
      </button>
      <Routes>
      <Route
        path="/"
        element={
          <BoardPage
            tasks={tasks}
            setTasks={setTasks}
            activity={activity}
            setActivity={setActivity}
            teamMembers={teamMembers}
            onNavigateToStats={() => navigate('/statistics')}
            onNavigateToCalendar={() => navigate('/calendario')}
            onNavigateToGantt={() => navigate('/gantt')}
            onNavigateToUsuarios={() => navigate('/usuarios')}
            onNavigateToChat={() => navigate('/chat')}
            onNavigateToHerramienta={() => navigate('/herramienta')}
            onNavigateToMostrador={() => navigate('/mostrador/dashboard')}
            onNavigateToCompras={() => navigate('/compras/dashboard')}
            onNavigateToDiseno={() => navigate('/diseno/dashboard')}
            onLogout={onLogout}
            onReloadData={onReloadData}
            isSyncing={isSyncing}
            syncError={syncError}
            sectores={sectores}
            materialesCatalog={materiales}
            isCompact={isCompact}
            onToggleCompact={onToggleCompact}
          />
        }
      />
      <Route
        path="/statistics"
        element={
          <StatisticsPage
            tasks={tasks}
            activity={activity}
            teamMembers={teamMembers}
            onBack={() => navigate('/')}
          />
        }
      />
      <Route
        path="/calendario"
        element={<CalendarPage tasks={tasks} onBack={() => navigate('/')} />}
      />
      <Route
        path="/gantt"
        element={<GanttPage tasks={tasks} onBack={() => navigate('/')} />}
      />
      <Route
        path="/op/:opNumber"
        element={<OpViewPage tasks={tasks} sectores={sectores} />}
      />
      <Route
        path="/chat"
        element={<ChatPage onBack={() => navigate('/')} teamMembers={teamMembers} />}
      />
      <Route
        path="/consulta-cliente"
        element={<ClienteConsultaPage />}
      />
      <Route
        path="/usuarios"
        element={<UsuariosPage onBack={() => navigate('/')} />}
      />
      <Route
        path="/impresoras"
        element={<ImpresorasPage />}
      />
      <Route
        path="/herramienta"
        element={<HerramientaPage onBack={() => navigate('/')} />}
      />
      <Route
        path="/mostrador/dashboard"
        element={<MostradorDashboardPage />}
      />
      <Route
        path="/mostrador"
        element={<MostradorDashboardPage />}
      />
      <Route
        path="/mostrador/ordenes-listas"
        element={<OrdenesListasPage />}
      />
      <Route
        path="/mostrador/buscar-cliente"
        element={<BuscarClientePage />}
      />
      <Route
        path="/mostrador/entrega/:id"
        element={<EntregaPage />}
      />
      <Route
        path="/mostrador/calendario"
        element={<CalendarioEntregasPage />}
      />
      <Route
        path="/mostrador/reportes"
        element={<ReportesMostradorPage />}
      />
      <Route
        path="/mostrador/clientes-frecuentes"
        element={<ClientesFrecuentesPage />}
      />
      <Route
        path="/compras/dashboard"
        element={<ComprasDashboardPage />}
      />
      <Route
        path="/compras"
        element={<ComprasDashboardPage />}
      />
      <Route
        path="/compras/pedidos"
        element={<ComprasDashboardPage />}
      />
      <Route
        path="/compras/pedidos/:id"
        element={<PedidoCompraDetallePage />}
      />
      <Route
        path="/compras/reportes"
        element={<ReportesStockPage />}
      />
      <Route
        path="/compras/gestion-stock"
        element={<GestionStockPage />}
      />
      <Route
        path="/diseno/dashboard"
        element={<DisenoDashboardPage />}
      />
      <Route
        path="/diseno"
        element={<DisenoDashboardPage />}
      />
      <Route
        path="/galeria"
        element={<GaleriaTrabajosPage />}
      />
      <Route
        path="/galeria-trabajos"
        element={<GaleriaTrabajosPage />}
      />
    </Routes>
    </>
  )
}

export default App
