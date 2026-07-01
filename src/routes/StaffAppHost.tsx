import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, startTransition } from 'react'
import { flushSync } from 'react-dom'
import { Routes, Route, useNavigate, Navigate, useParams, useLocation } from 'react-router-dom'
import OperarioExternoGate from '../features/work-pool/OperarioExternoGate'
import OperarioExternoHomeRedirect from '../features/work-pool/OperarioExternoHomeRedirect'
import type { TaskStatus } from '../types/board'
const BoardPage = lazy(() => import('../pages/BoardPage'))
// Lazy load de páginas menos críticas para mejorar tiempo de carga inicial
const StatisticsPage = lazy(() => import('../pages/StatisticsPage'))
const ChatPage = lazy(() => import('../pages/ChatPage'))
const MensajeriaPage = lazy(() => import('../pages/MensajeriaPage'))
const MensajeriaProofVerifyPage = lazy(() => import('../pages/MensajeriaProofVerifyPage'))
const ClienteConsultaPage = lazy(() => import('../pages/ClienteConsultaPage'))
const UsuariosPage = lazy(() => import('../pages/UsuariosPage'))
const ImpresorasPage = lazy(() => import('../pages/ImpresorasPage'))
const TotemImpresionBackofficePage = lazy(() => import('../pages/TotemImpresionBackofficePage'))
const CalendarPage = lazy(() => import('../pages/CalendarPage'))
const GanttPage = lazy(() => import('../pages/GanttPage'))
const OpViewPage = lazy(() => import('../pages/OpViewPage'))
const HerramientaPage = lazy(() => import('../pages/HerramientaPage'))
const MostradorDashboardPage = lazy(() => import('../pages/MostradorDashboardPage'))
const DisenoDashboardPage = lazy(() => import('../pages/DisenoDashboardPage'))
const GaleriaTrabajosPage = lazy(() => import('../pages/GaleriaTrabajosPage'))
const BriefsPendientesPage = lazy(() => import('../pages/BriefsPendientesPage'))
const OrdenesListasPage = lazy(() => import('../pages/OrdenesListasPage'))
const BuscarClientePage = lazy(() => import('../pages/BuscarClientePage'))
const ClientesDashboardPage = lazy(() => import('../pages/ClientesDashboardPage'))
const AgregarClientePage = lazy(() => import('../pages/AgregarClientePage'))
const EntregaPage = lazy(() => import('../pages/EntregaPage'))
const MostradorCalendarioPage = lazy(() => import('../pages/MostradorCalendarioPage'))
const ReportesMostradorPage = lazy(() => import('../pages/ReportesMostradorPage'))
const ClientesFrecuentesPage = lazy(() => import('../pages/ClientesFrecuentesPage'))
const CuentaCorrientePage = lazy(() => import('../pages/CuentaCorrientePage'))
const CuentaCorrientePerfilPage = lazy(() => import('../pages/CuentaCorrientePerfilPage'))
const ClientePerfilPage = lazy(() => import('../pages/ClientePerfilPage'))
const AtencionPublicoDashboardPage = lazy(() => import('../pages/AtencionPublicoDashboardPage'))
const ComprasDashboardPage = lazy(() => import('../pages/ComprasDashboardPage'))
const ComprasEstadisticasPage = lazy(() => import('../pages/ComprasEstadisticasPage'))
const DeudasProveedoresPage = lazy(() => import('../pages/DeudasProveedoresPage'))
const PagosProveedoresPage = lazy(() => import('../pages/PagosProveedoresPage'))
const MovimientosProveedoresPage = lazy(() => import('../pages/MovimientosProveedoresPage'))
const DeudaCcProveedoresPage = lazy(() => import('../pages/DeudaCcProveedoresPage'))
const PedidoCompraDetallePage = lazy(() => import('../pages/PedidoCompraDetallePage'))
const ReportesStockPage = lazy(() => import('../pages/ReportesStockPage'))
const GestionStockPage = lazy(() => import('../pages/GestionStockPage'))
const ProveedoresPage = lazy(() => import('../pages/ProveedoresPage'))
const PresupuestosPage = lazy(() => import('../pages/PresupuestosPage'))
const ReportesComprasPage = lazy(() => import('../pages/ReportesComprasPage'))
const CrearPedidoCompraPage = lazy(() => import('../pages/CrearPedidoCompraPage'))
const MisPedidosPage = lazy(() => import('../pages/MisPedidosPage'))
const ConciliacionBancariaPage = lazy(() => import('../pages/ConciliacionBancariaPage'))
const ConciliacionMercadoPagoPage = lazy(() => import('../pages/ConciliacionMercadoPagoPage'))
const RecursosHumanosDashboardPage = lazy(() => import('../pages/RecursosHumanosDashboardPage'))
const ClientesWebDashboardPage = lazy(() => import('../pages/ClientesWebDashboardPage'))
const ClientesWebGestionPage = lazy(() => import('../pages/ClientesWebGestionPage'))
const PedidosClientesPage = lazy(() => import('../pages/PedidosClientesPage'))
const ArticulosEmpresaPage = lazy(() => import('../pages/ArticulosEmpresaPage'))
const CategoriasArticulosPage = lazy(() => import('../pages/CategoriasArticulosPage'))
const RecursosHumanosUsuariosPage = lazy(() => import('../pages/RecursosHumanosUsuariosPage'))
const RecursosHumanosReportesPage = lazy(() => import('../pages/RecursosHumanosReportesPage'))
const RecursosHumanosHorariosPage = lazy(() => import('../pages/RecursosHumanosHorariosPage'))
const RecursosHumanosEvaluacionesPage = lazy(() => import('../pages/RecursosHumanosEvaluacionesPage'))
const RecursosHumanosEstadisticasPage = lazy(() => import('../pages/RecursosHumanosEstadisticasPage'))
const RecursosHumanosPermisosPage = lazy(() => import('../pages/RecursosHumanosPermisosPage'))
const CajaDashboardPage = lazy(() => import('../pages/CajaDashboardPage'))
const RecursosHumanosNotificacionesPage = lazy(() => import('../pages/RecursosHumanosNotificacionesPage'))
const RecursosHumanosCapacitacionesPage = lazy(() => import('../pages/RecursosHumanosCapacitacionesPage'))
const RecursosHumanosMenuDiarioPage = lazy(() => import('../pages/RecursosHumanosMenuDiarioPage'))
const RecursosHumanosPruebasPage = lazy(() => import('../pages/RecursosHumanosPruebasPage'))
const RecursosHumanosIncidenciasPage = lazy(() => import('../pages/RecursosHumanosIncidenciasPage'))
const RecursosHumanosNovedadesPage = lazy(() => import('../pages/RecursosHumanosNovedadesPage'))
const RecursosHumanosPostulacionesPage = lazy(() => import('../pages/RecursosHumanosPostulacionesPage'))
const RecursosHumanosDesvinculacionesPage = lazy(
  () => import('../pages/RecursosHumanosDesvinculacionesPage')
)
const MisPruebasPage = lazy(() => import('../pages/MisPruebasPage'))
const CapacitacionesPage = lazy(() => import('../pages/CapacitacionesPage'))
const MenuDiarioPage = lazy(() => import('../pages/MenuDiarioPage'))
const MenuOnlyPage = lazy(() => import('../pages/MenuOnlyPage'))
const AdminHomePage = lazy(() => import('../pages/AdminHomePage'))
const CRMVentasPage = lazy(() => import('../pages/CRMVentasPage'))
const ReportesVentasPage = lazy(() => import('../pages/ReportesVentasPage'))
const FlotaPage = lazy(() => import('../pages/FlotaPage'))
const FlotaAdminDashboard = lazy(() => import('../pages/FlotaAdminDashboard'))
const ERPDashboardPage = lazy(() => import('../pages/ERPDashboardPage'))
const FacturasPage = lazy(() => import('../pages/FacturasPage'))
const FacturaDetallePage = lazy(() => import('../pages/FacturaDetallePage'))
const CrearFacturaPage = lazy(() => import('../pages/CrearFacturaPage'))
const CrearNotaPage = lazy(() => import('../pages/CrearNotaPage.tsx'))
const AsientosContablesPage = lazy(() => import('../pages/AsientosContablesPage'))
const ConfiguracionAFIPPage = lazy(() => import('../pages/ConfiguracionAFIPPage'))
const ErpTesoreriaPage = lazy(() => import('../pages/ErpTesoreriaPage.tsx'))
const ErpCuentasBancariasPage = lazy(() => import('../pages/ErpCuentasBancariasPage'))
const ErpContabilidadPage = lazy(() => import('../pages/ErpContabilidadPage.tsx'))
const ErpContabilidadReportesPage = lazy(() => import('../pages/ErpContabilidadReportesPage.tsx'))
const ErpImpuestosPage = lazy(() => import('../pages/ErpImpuestosPage.tsx'))
const ErpCuentasPorCobrarPage = lazy(() => import('../pages/ErpCuentasPorCobrarPage.tsx'))
const ErpCuentasPorPagarPage = lazy(() => import('../pages/ErpCuentasPorPagarPage.tsx'))
const ErpPlanCuentasPage = lazy(() => import('../pages/ErpPlanCuentasPage.tsx'))
const ErpCostosPage = lazy(() => import('../pages/ErpCostosPage.tsx'))
const ErpReportesPage = lazy(() => import('../pages/ErpReportesPage.tsx'))
const ErpComprasPage = lazy(() => import('../pages/ErpComprasPage'))
const ErpStockPage = lazy(() => import('../pages/ErpStockPage'))
const ErpCrmPage = lazy(() => import('../pages/ErpCrmPage'))
const ErpAdminPage = lazy(() => import('../pages/ErpAdminPage'))
const ErpConfigCondicionesVentaPage = lazy(() => import('../pages/ErpConfigCondicionesVentaPage'))
const ErpGastosPage = lazy(() => import('../pages/ErpGastosPage'))
const TallerGraficoInventarioPage = lazy(() => import('../pages/TallerGraficoInventarioPage'))
const MetalurgicaInventarioPage = lazy(() => import('../pages/MetalurgicaInventarioPage'))
const TallerGraficoDashboardPage = lazy(() => import('../pages/TallerGraficoDashboardPage'))
const SectorEtapaKanbanPage = lazy(() => import('../pages/SectorEtapaKanbanPage'))
const InstalacionesMetalurgicaCampoPage = lazy(() => import('../pages/InstalacionesMetalurgicaCampoPage'))
const PlotDesignPage = lazy(() => import('../pages/PlotDesignPage'))
const BolsaPlotPage = lazy(() => import('../pages/BolsaPlotPage'))
const WorkPoolLegacyRedirect = lazy(() => import('../pages/WorkPoolLegacyRedirect'))
const PresupuestosClientesAdminPage = lazy(() => import('../pages/PresupuestosClientesAdminPage'))
const PresupuestoClienteDetalleAdminPage = lazy(() => import('../pages/PresupuestoClienteDetalleAdminPage'))
const PedidoClienteDetalleAdminPage = lazy(() => import('../pages/PedidoClienteDetalleAdminPage'))
const ConvertirPedidoAOpPage = lazy(() => import('../pages/ConvertirPedidoAOpPage'))
const LibroActasSectorPage = lazy(() => import('../pages/LibroActasSectorPage'))
const LibroActasPage = lazy(() => import('../pages/LibroActasPage'))
const ProtocolosBasesPage = lazy(() => import('../pages/ProtocolosBasesPage'))
const AsesorPresupuestosPage = lazy(() => import('../pages/AsesorPresupuestosPage'))
const AdminBackLink = lazy(() => import('../components/AdminBackLink'))
const TallerGraficoPedidoEntregaOverlay = lazy(() => import('../components/TallerGraficoPedidoEntregaOverlay'))
import { useAuth } from '../hooks/useAuth'
import { nombreVisibleDesdeRecord } from '../utils/usuarioDisplayName'
import { clearPlotlabAuthStorage } from '../utils/plotlabSession'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import type {
  HistorialMovimiento,
  MaterialRecord,
  OrdenTrabajo,
  SectorRecord,
  UsuarioRecord
} from '../types/api'
import { getApiService } from '../services/apiLoader'
import { formatSupabaseStatementTimeoutError } from '../utils/supabaseErrors'
import { historialToActivity } from '../utils/dataMappers'
import { subscribeOrdenesBroadcast } from '../utils/ordenesBroadcast'
import { routeNeedsBoardSync } from '../utils/boardRouteSync'
import { readOrdenesTableroCache, writeOrdenesTableroCache } from '../utils/ordenesTableroCache'
import { ordenesTableroFingerprint, syncTasksFromOrdenesFetch, applyOrdenRealtimeBatch } from '../utils/syncTasksFromOrdenes'
import { supabase } from '../services/supabaseClient'

const DEFAULT_SECTORES: SectorRecord[] = [
  { id: 1, nombre: 'Diseño Gráfico', color: '#FF7F50' },
  { id: 2, nombre: 'Taller de Imprenta', color: '#8F7EF3' },
  { id: 3, nombre: 'Taller Gráfico', color: '#4FD1C5' },
  { id: 4, nombre: 'Instalaciones', color: '#F6AD55' },
  { id: 5, nombre: 'Metalúrgica', color: '#63B3ED' },
  { id: 6, nombre: 'Mostrador', color: '#E53E3E' },
  { id: 7, nombre: 'Caja', color: '#48BB78' }
]

const normNumeroOp = (n: unknown) => String(n ?? '').trim().toLowerCase()

const mapUsuariosToTeamMembers = (usuarios: UsuarioRecord[]): TeamMember[] =>
  usuarios.map((usuario) => {
    const display = nombreVisibleDesdeRecord(usuario)
    return {
      id: usuario.id.toString(),
      name: display,
      role: usuario.rol,
      avatar: display
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      productivity: 0
    }
  })

export default function StaffAppHost() {
  const navigate = useNavigate()
  const location = useLocation()
  const boardSyncActive = routeNeedsBoardSync(location.pathname)
  const boardSyncActiveRef = useRef(boardSyncActive)
  boardSyncActiveRef.current = boardSyncActive
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [sectores, setSectores] = useState<SectorRecord[]>(DEFAULT_SECTORES)
  const [materiales, setMateriales] = useState<MaterialRecord[]>([])
  const { setUsuario } = useAuth()
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const isBoardDraggingRef = useRef(false)
  const needsSyncAfterDragRef = useRef(false)
  /** Durante creación OP multi-sector: ignorar realtime de esa OP para evitar parpadeo/rebote antes del refetch. */
  const multiSectorSettleRef = useRef<{ numeroOpNorm: string } | null>(null)
  /** Encola refrescos silenciosos del tablero para no disparar varios getOrdenes a la vez. */
  const silentReloadBusyRef = useRef(false)
  const silentReloadAgainRef = useRef(false)
  const ordenBroadcastRefreshTimerRef = useRef<number | null>(null)
  const lastOrdenesFingerprintRef = useRef<string | null>(null)

  // Manual PlotAI: no bloquear primer paint (idle o timeout corto).
  useEffect(() => {
    const run = () => {
      void import('../services/plotAIManualService')
        .then((m) => m.initializeManual())
        .catch((error) => {
          console.warn('Error precargando manual:', error)
        })
    }
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 4000 }) : null
    const tid = ric == null ? window.setTimeout(run, 1) : null
    return () => {
      if (ric != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(ric as number)
      if (tid != null) window.clearTimeout(tid)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.log('🔍 Variables de Entorno:')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA')
    console.log('VITE_SUPABASE_SCHEMA:', import.meta.env.VITE_SUPABASE_SCHEMA || 'NO CONFIGURADA')
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'NO CONFIGURADA')
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase no está configurado. La app usará datos mock o fallback.')
    }
  }, [])


  const handleLogout = () => {
    clearPlotlabAuthStorage()
    flushSync(() => setUsuario(null))
    setTasks([])
    setActivity([])
    setTeamMembers([])
    setSectores(DEFAULT_SECTORES)
    setMateriales([])
    navigate('/login', { replace: true })
    void import('../services/staffAuthApi')
      .then((m) => m.staffLogout())
      .catch(() => {
        clearPlotlabAuthStorage()
      })
  }

  const loadRemoteData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) {
      setDataLoading(true)
      setDataError(null)
    }
    try {
      if (!supabase) {
        if (!silent) {
          setDataLoading(false)
          const errorMsg = 'Supabase no está configurado. Define las variables VITE_SUPABASE_* y vuelve a intentar.'
          setDataError(errorMsg)
          console.error('❌', errorMsg)
          setTasks([])
          setActivity([])
          setTeamMembers([])
          setSectores([])
          setMateriales([])
        }
        return
      }

      // Verificar que Supabase esté realmente disponible
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseKey) {
        if (!silent) {
          const errorMsg = 'Variables de entorno de Supabase no configuradas. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
          setDataError(errorMsg)
          setDataLoading(false)
          console.error('❌', errorMsg)
        }
        return
      }

      // Refresco ligero: solo órdenes (Kanban compartido / realtime ausente o RLS en eventos)
      if (silent) {
        if (!boardSyncActiveRef.current) return
        if (silentReloadBusyRef.current) {
          silentReloadAgainRef.current = true
          return
        }
        silentReloadBusyRef.current = true
        try {
          const api = await getApiService()
          const ordenesResp = await api.getOrdenes({
            skipInFlightDedupe: true,
            attachLineasM2: false,
            soloActivasEnTablero: true
          })
          if (ordenesResp.success && ordenesResp.data && ordenesResp.data.length > 0) {
            const fp = ordenesTableroFingerprint(ordenesResp.data)
            if (fp !== lastOrdenesFingerprintRef.current) {
              lastOrdenesFingerprintRef.current = fp
              writeOrdenesTableroCache(ordenesResp.data)
              startTransition(() => {
                setTasks((prev) => syncTasksFromOrdenesFetch(prev, ordenesResp.data!))
                setDataError(null)
              })
            }
          } else if (!ordenesResp.success) {
            if (import.meta.env.DEV) {
              console.warn('🔄 Actualización silenciosa: órdenes no disponibles', ordenesResp.error)
            }
          }
        } finally {
          silentReloadBusyRef.current = false
          if (silentReloadAgainRef.current) {
            silentReloadAgainRef.current = false
            void loadRemoteData({ silent: true })
          }
        }
        return
      }

      if (import.meta.env.DEV) {
        console.log('🔄 Intentando cargar datos de Supabase...')
      }

      const hydrateFromCache = () => {
        const cached = readOrdenesTableroCache()
        if (!cached?.length) return
        startTransition(() => {
          setTasks((prev) => {
            if (prev.length > 0) return prev
            return syncTasksFromOrdenesFetch(
              prev,
              cached.filter((o) => o.id != null)
            )
          })
        })
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(hydrateFromCache, { timeout: 120 })
      } else {
        window.setTimeout(hydrateFromCache, 0)
      }

      const api = await getApiService()
      const [ordenesResp, usuariosResp, sectoresResp] = await Promise.all([
        api.getOrdenes({ attachLineasM2: false, soloActivasEnTablero: true }),
        api.getUsuarios(),
        api.getSectores()
      ])

      if (ordenesResp.success && ordenesResp.data && ordenesResp.data.length > 0) {
        const fp = ordenesTableroFingerprint(ordenesResp.data)
        if (fp !== lastOrdenesFingerprintRef.current) {
          lastOrdenesFingerprintRef.current = fp
          writeOrdenesTableroCache(ordenesResp.data)
          startTransition(() => {
            setTasks((prev) => syncTasksFromOrdenesFetch(prev, ordenesResp.data!))
            setDataError(null)
          })
        } else {
          setDataError(null)
        }
        if (import.meta.env.DEV) {
          console.log('✅ Órdenes cargadas:', ordenesResp.data.length)
        }
      } else if (!readOrdenesTableroCache()?.length) {
        const errorMsg = formatSupabaseStatementTimeoutError(
          ordenesResp.error || 'No se pudieron cargar las órdenes (Supabase no respondió)'
        )
        setDataError(errorMsg)
        if (import.meta.env.DEV) {
          console.error('❌ Error cargando órdenes:', errorMsg)
        }
      } else {
        setDataError(
          formatSupabaseStatementTimeoutError(
            ordenesResp.error ||
              'No se pudo actualizar desde Supabase; mostrando la última copia guardada en este navegador.'
          )
        )
      }

      if (!silent) {
        setDataLoading(false)
      }

      if (usuariosResp.success && usuariosResp.data) {
        startTransition(() => setTeamMembers(mapUsuariosToTeamMembers(usuariosResp.data!)))
      } else {
        startTransition(() => setTeamMembers([]))
        setDataError((prev) =>
          prev ?? formatSupabaseStatementTimeoutError(usuariosResp.error ?? 'No se pudieron cargar los usuarios')
        )
      }

      if (sectoresResp.success && sectoresResp.data && sectoresResp.data.length > 0) {
        startTransition(() => setSectores(sectoresResp.data!))
      } else {
        startTransition(() => setSectores(DEFAULT_SECTORES))
        setDataError((prev) =>
          prev ?? formatSupabaseStatementTimeoutError(sectoresResp.error ?? 'No se pudieron cargar los sectores')
        )
      }

      // Historial y materiales: no bloquean el primer paint del tablero.
      void (async () => {
        try {
          const [historialResp, materialesResp] = await Promise.all([
            api.getHistorialMovimientos({ limit: 50 }),
            api.getMateriales()
          ])
          if (historialResp.success && historialResp.data) {
            const act = historialResp.data.map((registro) => historialToActivity(registro))
            startTransition(() => setActivity(act))
          }
          if (materialesResp.success && materialesResp.data) {
            startTransition(() => setMateriales(materialesResp.data!))
          }
        } catch {
          /* secundario */
        }
      })()
    } catch (error: any) {
      console.error('❌ Error cargando datos desde Supabase:', error)
      const errorMessage = error?.message || 'Error desconocido'

      // Detectar errores específicos
      if (errorMessage.includes('Failed to fetch') || error?.name === 'TypeError') {
        setDataError(
          'Error de conexión: No se pudo conectar con Supabase. Verifica tu conexión a internet y que las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén correctamente configuradas.'
        )
      } else if (errorMessage.includes('CORS')) {
        setDataError('Error de CORS: Verifica la configuración de Supabase y que el dominio esté permitido.')
      } else {
        setDataError(
          formatSupabaseStatementTimeoutError(
            `No se pudieron sincronizar los datos con Supabase: ${errorMessage}`
          )
        )
      }
    } finally {
      if (!silent) {
        setDataLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!boardSyncActive) return
    void loadRemoteData()
  }, [boardSyncActive, loadRemoteData])

  // Tras procesar entrega (mostrador/tablet): refrescar tablero por si el realtime llega tarde
  useEffect(() => {
    const onOrdenEntregada = () => {
      if (!boardSyncActiveRef.current) return
      void loadRemoteData({ silent: true })
    }
    window.addEventListener('plotrello-orden-entregada', onOrdenEntregada)
    return () => window.removeEventListener('plotrello-orden-entregada', onOrdenEntregada)
  }, [loadRemoteData])

  /** Otra pestaña creó/borró OP: Supabase Realtime puede no llegar; BroadcastChannel + refetch silencioso. */
  useEffect(() => {
    const unsub = subscribeOrdenesBroadcast(() => {
      if (!boardSyncActiveRef.current) return
      if (ordenBroadcastRefreshTimerRef.current != null) {
        window.clearTimeout(ordenBroadcastRefreshTimerRef.current)
      }
      ordenBroadcastRefreshTimerRef.current = window.setTimeout(() => {
        ordenBroadcastRefreshTimerRef.current = null
        void loadRemoteData({ silent: true })
      }, 220)
    })
    return () => {
      unsub()
      if (ordenBroadcastRefreshTimerRef.current != null) {
        window.clearTimeout(ordenBroadcastRefreshTimerRef.current)
        ordenBroadcastRefreshTimerRef.current = null
      }
    }
  }, [loadRemoteData])

  useEffect(() => {
    const onSettle = (event: Event) => {
      const d = (event as CustomEvent<{ numeroOp: string }>).detail
      const n = normNumeroOp(d?.numeroOp)
      if (n) multiSectorSettleRef.current = { numeroOpNorm: n }
    }
    const onSettleEnd = () => {
      multiSectorSettleRef.current = null
    }
    window.addEventListener('plotrello-op-multi-sector-settle', onSettle)
    window.addEventListener('plotrello-op-multi-sector-settle-end', onSettleEnd)
    return () => {
      window.removeEventListener('plotrello-op-multi-sector-settle', onSettle)
      window.removeEventListener('plotrello-op-multi-sector-settle-end', onSettleEnd)
    }
  }, [])

  useEffect(() => {
    if (!boardSyncActive || !supabase) return

    // Track movimientos recientes del usuario para evitar efecto espejo del realtime
    const recentUserMoves = new Map<string, { estado: string; timestamp: number }>()
    // Track ediciones recientes del usuario para preservar el status
    const recentUserEdits = new Map<string, { status: TaskStatus; timestamp: number }>()

    // Escuchar eventos de movimiento del usuario desde BoardPage
    const handleUserMove = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId: string; estado: string; timestamp: number }>
      const { taskId, estado, timestamp } = customEvent.detail
      recentUserMoves.set(taskId, { estado, timestamp })
      if (import.meta.env.DEV) {
        console.log(`📝 Registrado movimiento del usuario: ${taskId} → ${estado}`)
      }
    }

    // Escuchar eventos de edición del usuario desde BoardPage
    const handleUserEdit = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId: string; status: TaskStatus; timestamp: number }>
      const { taskId, status, timestamp } = customEvent.detail
      recentUserEdits.set(taskId, { status, timestamp })
      if (import.meta.env.DEV) {
        console.log(`✏️ Registrada edición del usuario: ${taskId} → status: ${status}`)
      }
    }

    const handleBoardDraggingChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ dragging?: boolean }>
      const dragging = Boolean(customEvent.detail?.dragging)
      isBoardDraggingRef.current = dragging
      if (!dragging && needsSyncAfterDragRef.current) {
        needsSyncAfterDragRef.current = false
        // Defer sync hasta después del paint / animación de soltar (evita tildado al drop).
        // silent: no spinner; evita pisar estado optimista con refetch a medio fusionar.
        window.setTimeout(() => {
          void loadRemoteData({ silent: true })
        }, 450)
      }
    }

    window.addEventListener('user-moved-task', handleUserMove)
    window.addEventListener('user-edited-task', handleUserEdit)
    window.addEventListener('board-dragging-changed', handleBoardDraggingChanged)

    const pendingRealtimeOrdenesRef = { current: new Map<number, OrdenTrabajo>() }
    const realtimeFlushTimerRef = { current: null as number | null }

    const flushRealtimeOrdenes = () => {
      realtimeFlushTimerRef.current = null
      const batch = Array.from(pendingRealtimeOrdenesRef.current.values())
      pendingRealtimeOrdenesRef.current.clear()
      if (batch.length === 0) return

      const guard = {
        recentUserMoves,
        recentUserEdits,
        settlingNumeroOpNorm: multiSectorSettleRef.current?.numeroOpNorm ?? null,
        normNumeroOp: normNumeroOp
      }

      startTransition(() => {
        setTasks((prev) => applyOrdenRealtimeBatch(prev, batch, guard))
      })
    }

    const scheduleRealtimeFlush = () => {
      if (realtimeFlushTimerRef.current != null) return
      realtimeFlushTimerRef.current = window.setTimeout(flushRealtimeOrdenes, 280)
    }

    const upsertTaskFromOrden = (orden: OrdenTrabajo) => {
      if (!orden?.id) return
      if (isBoardDraggingRef.current) {
        needsSyncAfterDragRef.current = true
        return
      }
      pendingRealtimeOrdenesRef.current.set(orden.id, orden)
      scheduleRealtimeFlush()
    }

    const handleOrdenUpsertEvent = (event: Event) => {
      const orden = (event as CustomEvent<{ orden?: OrdenTrabajo }>).detail?.orden
      if (orden?.id) upsertTaskFromOrden(orden)
    }
    window.addEventListener('plotrello-orden-upsert', handleOrdenUpsertEvent)

    const removeTask = (orden: OrdenTrabajo | null) => {
      if (!orden?.id) return
      if (isBoardDraggingRef.current) {
        needsSyncAfterDragRef.current = true
        return
      }
      startTransition(() => {
        setTasks((prev) => prev.filter((task) => task.id !== orden.id!.toString()))
      })
    }

    const addActivityFromRegistro = (registro: HistorialMovimiento) => {
      if (!registro?.id) return
      if (isBoardDraggingRef.current) {
        needsSyncAfterDragRef.current = true
        return
      }
      const mapped = historialToActivity(registro)
      startTransition(() => {
        setActivity((prev) => {
          const withoutDuplicate = prev.filter((event) => event.id !== mapped.id)
          return [mapped, ...withoutDuplicate].slice(0, 300)
        })
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
      if (import.meta.env.DEV && status === 'SUBSCRIBED') {
        console.log('✅ Realtime conectado: ordenes_trabajo')
      }
    })

    historialChannel.subscribe((status) => {
      if (import.meta.env.DEV && status === 'SUBSCRIBED') {
        console.log('✅ Realtime conectado: historial_movimientos')
      }
    })

    return () => {
      if (realtimeFlushTimerRef.current != null) {
        window.clearTimeout(realtimeFlushTimerRef.current)
        realtimeFlushTimerRef.current = null
      }
      pendingRealtimeOrdenesRef.current.clear()
      void ordenesChannel.unsubscribe()
      void historialChannel.unsubscribe()
      window.removeEventListener('plotrello-orden-upsert', handleOrdenUpsertEvent)
      window.removeEventListener('user-moved-task', handleUserMove)
      window.removeEventListener('user-edited-task', handleUserEdit)
      window.removeEventListener('board-dragging-changed', handleBoardDraggingChanged)
    }
  }, [boardSyncActive, loadRemoteData])

  return (
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
    />
  )
}

const ASESOR_PRESUPUESTOS_STATUSES = [
  'asesor-tecnico',
  'presupuestos',
  'armados-enviados-asesor-presupuestos',
  'finalizado-asesor-presupuestos'
]

function RedirectMostradorCcCliente() {
  const { idCliente } = useParams()
  return <Navigate to={`/clientes/cuenta-corriente/cliente/${idCliente ?? ''}`} replace />
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
  materiales
}: {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  activity: ActivityEvent[]
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  onLogout: () => void
  onReloadData: (options?: { silent?: boolean }) => Promise<void>
  isSyncing: boolean
  syncError: string | null
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materiales: MaterialRecord[]
}) {
  const navigate = useNavigate()
  const { isAdmin, isPresupuestos } = useAuth()

  // Los movimientos de asesor técnico/presupuestos solo los ven admin y presupuestos
  const filteredActivity = useMemo(() => {
    if (isAdmin || isPresupuestos) return activity
    return activity.filter((ev) => {
      const fromAsesor = ASESOR_PRESUPUESTOS_STATUSES.includes(ev.from || '')
      const toAsesor = ASESOR_PRESUPUESTOS_STATUSES.includes(ev.to || '')
      return !fromAsesor && !toAsesor
    })
  }, [activity, isAdmin, isPresupuestos])

  return (
    <OperarioExternoGate>
      <>
      <Suspense fallback={null}>
        <TallerGraficoPedidoEntregaOverlay />
      </Suspense>
      <Suspense fallback={null}>
        <AdminBackLink />
      </Suspense>
      <Suspense
        fallback={
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 14,
              contain: 'strict'
            }}
          >
            Cargando tablero…
          </div>
        }
      >
      <Routes>
      <Route
        path="/tablero"
        element={
          <>
            <OperarioExternoHomeRedirect />
            <BoardPage
            tasks={tasks}
            setTasks={setTasks}
            activity={filteredActivity}
            setActivity={setActivity}
            teamMembers={teamMembers}
            onNavigateToStats={() => navigate('/statistics')}
            onNavigateToCalendar={() => navigate('/calendario')}
            onNavigateToUsuarios={() => navigate('/usuarios')}
            onNavigateToChat={() => navigate('/chat')}
            onNavigateToMensajeria={() => navigate('/mensajeria')}
            onNavigateToMostrador={() => navigate('/mostrador/dashboard')}
            onNavigateToCompras={() => navigate('/compras/dashboard')}
            onNavigateToCaja={() =>
              navigate(isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja')
            }
            onNavigateToDiseno={() => navigate('/diseno/dashboard')}
            onNavigateToRecursosHumanos={() => navigate('/rrhh/dashboard')}
            onNavigateToClientesWeb={() => navigate('/clientes-web/dashboard')}
            onNavigateToAsesorPresupuestos={() => navigate('/asesor-presupuestos')}
            onNavigateToAtencionPublico={() => navigate('/atencion-publico')}
            onNavigateToFlota={() => navigate('/flota')}
            onNavigateToERP={() => navigate('/erp')}
            onLogout={onLogout}
            onReloadData={onReloadData}
            isSyncing={isSyncing}
            syncError={syncError}
            sectores={sectores}
            materialesCatalog={materiales}
          />
          </>
        }
      />
      <Route
        path="/"
        element={
          <>
            <OperarioExternoHomeRedirect />
            <BoardPage
            tasks={tasks}
            setTasks={setTasks}
            activity={filteredActivity}
            setActivity={setActivity}
            teamMembers={teamMembers}
            onNavigateToStats={() => navigate('/statistics')}
            onNavigateToCalendar={() => navigate('/calendario')}
            onNavigateToUsuarios={() => navigate('/usuarios')}
            onNavigateToChat={() => navigate('/chat')}
            onNavigateToMensajeria={() => navigate('/mensajeria')}
            onNavigateToMostrador={() => navigate('/mostrador/dashboard')}
            onNavigateToCompras={() => navigate('/compras/dashboard')}
            onNavigateToCaja={() =>
              navigate(isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja')
            }
            onNavigateToDiseno={() => navigate('/diseno/dashboard')}
            onNavigateToRecursosHumanos={() => navigate('/rrhh/dashboard')}
            onNavigateToClientesWeb={() => navigate('/clientes-web/dashboard')}
            onNavigateToAsesorPresupuestos={() => navigate('/asesor-presupuestos')}
            onNavigateToAtencionPublico={() => navigate('/atencion-publico')}
            onNavigateToFlota={() => navigate('/flota')}
            onNavigateToERP={() => navigate('/erp')}
            onLogout={onLogout}
            onReloadData={onReloadData}
            isSyncing={isSyncing}
            syncError={syncError}
            sectores={sectores}
            materialesCatalog={materiales}
          />
          </>
        }
      />
      <Route path="/menu" element={<MenuOnlyPage onLogout={onLogout} />} />
      <Route
        path="/admin"
        element={
          <AdminHomePage
            tasks={tasks}
            activity={activity}
            teamMembers={teamMembers}
            onLogout={onLogout}
            onReloadData={() => void onReloadData()}
          />
        }
      />
      <Route
        path="/kanban-etapas/:slug"
        element={
          <SectorEtapaKanbanPage
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={teamMembers}
            activity={filteredActivity}
            sectores={sectores}
          />
        }
      />
      <Route
        path="/app-campo"
        element={
          <InstalacionesMetalurgicaCampoPage tasks={tasks} onReloadData={onReloadData} />
        }
      />
      <Route path="/plot-design" element={<PlotDesignPage />} />
      <Route path="/bolsa-plot" element={<BolsaPlotPage />} />
      <Route path="/bolsa" element={<WorkPoolLegacyRedirect />} />
      <Route
        path="/statistics"
        element={
          <StatisticsPage
            tasks={tasks}
            activity={filteredActivity}
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
        element={
          <ChatPage
            onBack={() => navigate('/')}
            teamMembers={teamMembers}
            tasks={tasks}
            activity={filteredActivity}
          />
        }
      />
      <Route
        path="/mensajeria"
        element={<MensajeriaPage onLogout={onLogout} />}
      />
      <Route path="/mensajeria/verificar/:token" element={<MensajeriaProofVerifyPage />} />
      <Route
        path="/consulta-cliente"
        element={<ClienteConsultaPage />}
      />
      <Route
        path="/usuarios"
        element={<UsuariosPage />}
      />
      <Route
        path="/impresoras"
        element={<ImpresorasPage />}
      />
      <Route
        path="/impresoras/totem"
        element={
          <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>}>
            <TotemImpresionBackofficePage />
          </Suspense>
        }
      />
      <Route
        path="/taller-grafico/inventario"
        element={<TallerGraficoInventarioPage />}
      />
      <Route
        path="/metalurgica/inventario"
        element={<MetalurgicaInventarioPage />}
      />
      <Route
        path="/taller-grafico/dashboard"
        element={
          <TallerGraficoDashboardPage
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={teamMembers}
            activity={filteredActivity}
            sectores={sectores}
          />
        }
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
        element={<Navigate to="/clientes/buscar" replace />}
      />
      <Route
        path="/mostrador/entrega/:id"
        element={<EntregaPage />}
      />
      <Route
        path="/mostrador/calendario"
        element={<MostradorCalendarioPage />}
      />
      <Route
        path="/mostrador/reportes"
        element={<ReportesMostradorPage />}
      />
      <Route
        path="/mostrador/ventas"
        element={<Navigate to="/ventas" replace />}
      />
      <Route
        path="/mostrador/ventas/reportes"
        element={<Navigate to="/ventas/reportes" replace />}
      />
      <Route
        path="/mostrador/clientes-frecuentes"
        element={<Navigate to="/clientes/frecuentes" replace />}
      />
      <Route
        path="/mostrador/cuenta-corriente"
        element={<Navigate to="/clientes/cuenta-corriente" replace />}
      />
      <Route
        path="/mostrador/cuenta-corriente/cliente/:idCliente"
        element={<RedirectMostradorCcCliente />}
      />
      <Route path="/clientes" element={<Navigate to="/clientes/dashboard" replace />} />
      <Route path="/clientes/dashboard" element={<ClientesDashboardPage />} />
      <Route path="/clientes/buscar" element={<BuscarClientePage />} />
      <Route path="/clientes/cliente/:idCliente" element={<ClientePerfilPage />} />
      <Route path="/clientes/frecuentes" element={<ClientesFrecuentesPage />} />
      <Route path="/clientes/cuenta-corriente" element={<CuentaCorrientePage />} />
      <Route
        path="/clientes/cuenta-corriente/cliente/:idCliente"
        element={<CuentaCorrientePerfilPage />}
      />
      <Route path="/clientes/agregar" element={<AgregarClientePage />} />
      <Route
        path="/atencion-publico"
        element={<AtencionPublicoDashboardPage />}
      />
      <Route path="/ventas" element={<CRMVentasPage />} />
      <Route path="/ventas/reportes" element={<ReportesVentasPage />} />
      <Route path="/crm-ventas" element={<Navigate to="/ventas" replace />} />
      <Route path="/crm-ventas/reportes" element={<Navigate to="/ventas/reportes" replace />} />
      <Route
        path="/caja/dashboard"
        element={<CajaDashboardPage />}
      />
      <Route
        path="/caja/dashboard/admin"
        element={<CajaDashboardPage />}
      />
      <Route
        path="/caja/dashboard/caja"
        element={<CajaDashboardPage />}
      />
      <Route
        path="/compras/dashboard"
        element={<ComprasDashboardPage />}
      />
      <Route
        path="/compras/estadisticas"
        element={<ComprasEstadisticasPage />}
      />
      <Route
        path="/compras/deudas-proveedores"
        element={<DeudasProveedoresPage />}
      />
      <Route
        path="/compras/pagos-proveedores"
        element={<PagosProveedoresPage />}
      />
      <Route
        path="/compras/movimientos-proveedores"
        element={<MovimientosProveedoresPage />}
      />
      <Route
        path="/compras/deuda-cc-proveedores"
        element={<DeudaCcProveedoresPage />}
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
        path="/compras/proveedores"
        element={<ProveedoresPage />}
      />
      <Route
        path="/compras/presupuestos/:id"
        element={<PresupuestosPage />}
      />
      <Route
        path="/compras/reportes"
        element={<ReportesComprasPage />}
      />
      <Route
        path="/compras/crear-pedido"
        element={<CrearPedidoCompraPage />}
      />
      <Route
        path="/mis-pedidos"
        element={<MisPedidosPage />}
      />
      <Route
        path="/compras/conciliacion-bancaria"
        element={<ConciliacionBancariaPage />}
      />
      <Route
        path="/compras/conciliacion-mercadopago"
        element={<ConciliacionMercadoPagoPage />}
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
        path="/as"
        element={<Navigate to="/asesor-presupuestos" replace />}
      />
      <Route
        path="/asesor-presupuestos"
        element={
          <AsesorPresupuestosPage
            tasks={tasks}
            setTasks={setTasks}
            activity={filteredActivity}
            teamMembers={teamMembers}
            sectores={sectores}
            materialesCatalog={materiales}
            onNavigateToStats={() => navigate('/statistics')}
            onNavigateToUsuarios={() => navigate('/usuarios')}
            onNavigateToChat={() => navigate('/chat')}
            onLogout={onLogout}
            onReloadData={onReloadData}
          />
        }
      />
      <Route
        path="/galeria"
        element={<GaleriaTrabajosPage />}
      />
      <Route
        path="/galeria-trabajos"
        element={<GaleriaTrabajosPage />}
      />
      <Route
        path="/briefs-pendientes"
        element={<BriefsPendientesPage />}
      />
      <Route
        path="/rrhh/dashboard"
        element={<RecursosHumanosDashboardPage />}
      />
      <Route
        path="/rrhh"
        element={<RecursosHumanosDashboardPage />}
      />
      <Route
        path="/rrhh/usuarios"
        element={<RecursosHumanosUsuariosPage />}
      />
      <Route
        path="/rrhh/reportes"
        element={<RecursosHumanosReportesPage />}
      />
      <Route
        path="/rrhh/horarios"
        element={<RecursosHumanosHorariosPage />}
      />
      <Route
        path="/rrhh/evaluaciones"
        element={<RecursosHumanosEvaluacionesPage />}
      />
      <Route
        path="/rrhh/capacitaciones"
        element={<RecursosHumanosCapacitacionesPage />}
      />
      <Route
        path="/rrhh/estadisticas"
        element={<RecursosHumanosEstadisticasPage />}
      />
      <Route
        path="/rrhh/menu-diario"
        element={<RecursosHumanosMenuDiarioPage />}
      />
      <Route
        path="/rrhh/permisos"
        element={<RecursosHumanosPermisosPage />}
      />
      <Route
        path="/rrhh/notificaciones"
        element={<RecursosHumanosNotificacionesPage />}
      />
      <Route
        path="/rrhh/pruebas"
        element={<RecursosHumanosPruebasPage />}
      />
      <Route
        path="/rrhh/incidencias"
        element={<RecursosHumanosIncidenciasPage />}
      />
      <Route
        path="/rrhh/novedades"
        element={<RecursosHumanosNovedadesPage />}
      />
      <Route
        path="/rrhh/postulaciones"
        element={<RecursosHumanosPostulacionesPage />}
      />
      <Route
        path="/rrhh/desvinculaciones"
        element={<RecursosHumanosDesvinculacionesPage />}
      />
      <Route
        path="/mis-pruebas"
        element={<MisPruebasPage />}
      />
      <Route
        path="/capacitaciones"
        element={<CapacitacionesPage />}
      />
      <Route
        path="/menu-diario"
        element={<MenuDiarioPage />}
      />
      {/* Rutas de Gestión de Clientes Web */}
      <Route
        path="/clientes-web/dashboard"
        element={<ClientesWebDashboardPage />}
      />
      <Route
        path="/clientes-web"
        element={<Navigate to="/clientes-web/dashboard" replace />}
      />
      <Route
        path="/clientes-web/gestion"
        element={<ClientesWebGestionPage />}
      />
      <Route
        path="/clientes-web/pedidos"
        element={<PedidosClientesPage />}
      />
      <Route
        path="/clientes-web/pedidos/:id/detalle"
        element={<PedidoClienteDetalleAdminPage />}
      />
      <Route
        path="/clientes-web/pedidos/:id/convertir"
        element={<ConvertirPedidoAOpPage />}
      />
      <Route
        path="/clientes-web/articulos"
        element={<ArticulosEmpresaPage />}
      />
      <Route
        path="/clientes-web/categorias"
        element={<CategoriasArticulosPage />}
      />
      <Route
        path="/clientes-web/presupuestos"
        element={<PresupuestosClientesAdminPage />}
      />
      <Route
        path="/clientes-web/presupuestos/:id"
        element={<PresupuestoClienteDetalleAdminPage />}
      />
      <Route
        path="/libro-actas"
        element={<LibroActasPage />}
      />
      <Route
        path="/libro-actas/sector/:sectorId"
        element={<LibroActasSectorPage />}
      />
      <Route
        path="/protocolos-bases"
        element={<ProtocolosBasesPage />}
      />
      {/* Rutas de Gestión de Flota */}
      <Route
        path="/flota"
        element={<FlotaPage />}
      />
      <Route
        path="/flota/admin"
        element={<FlotaAdminDashboard />}
      />
      {/* Rutas ERP */}
      <Route
        path="/erp"
        element={<ERPDashboardPage />}
      />
      <Route
        path="/erp/facturas"
        element={<FacturasPage />}
      />
      <Route
        path="/erp/facturas/nueva"
        element={<CrearFacturaPage />}
      />
      <Route
        path="/erp/facturas/:id"
        element={<FacturaDetallePage />}
      />
      <Route
        path="/erp/facturas/:id/nota"
        element={<CrearNotaPage />}
      />
      <Route
        path="/erp/asientos"
        element={<AsientosContablesPage />}
      />
      <Route
        path="/erp/tesoreria"
        element={<ErpTesoreriaPage />}
      />
      <Route
        path="/erp/tesoreria/cuentas"
        element={<ErpCuentasBancariasPage />}
      />
      <Route
        path="/erp/contabilidad"
        element={<ErpContabilidadPage />}
      />
      <Route
        path="/erp/contabilidad/reportes"
        element={<ErpContabilidadReportesPage />}
      />
      <Route
        path="/erp/impuestos"
        element={<ErpImpuestosPage />}
      />
      <Route
        path="/erp/cuentas-por-cobrar"
        element={<ErpCuentasPorCobrarPage />}
      />
      <Route
        path="/erp/cuentas-por-pagar"
        element={<ErpCuentasPorPagarPage />}
      />
      <Route
        path="/erp/compras"
        element={<ErpComprasPage />}
      />
      <Route
        path="/erp/stock"
        element={<ErpStockPage />}
      />
      <Route
        path="/erp/crm"
        element={<ErpCrmPage />}
      />
      <Route
        path="/erp/gastos"
        element={<ErpGastosPage />}
      />
      <Route
        path="/erp/admin"
        element={<ErpAdminPage />}
      />
      <Route
        path="/erp/admin/condiciones-venta"
        element={<ErpConfigCondicionesVentaPage />}
      />
      <Route
        path="/erp/plan-cuentas"
        element={<ErpPlanCuentasPage />}
      />
      <Route
        path="/erp/costos"
        element={<ErpCostosPage />}
      />
      <Route
        path="/erp/reportes"
        element={<ErpReportesPage />}
      />
      <Route
        path="/erp/configuracion-afip"
        element={<ConfiguracionAFIPPage />}
      />
      <Route
        path="/erp/*"
        element={<Navigate to="/erp" replace />}
      />
    </Routes>
    </Suspense>
    </>
    </OperarioExternoGate>
  )
}
