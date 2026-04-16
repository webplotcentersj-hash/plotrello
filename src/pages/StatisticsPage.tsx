import { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { BOARD_COLUMNS } from '../data/mockData'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import './StatisticsPage.css'
import jsPDF from 'jspdf'
import { apiService } from '../services/api'

type StatisticsPageProps = {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  onBack: () => void
}

const COLORS = {
  'Almacén de Entrega': '#f59e0b',
  'Entregado o Instalado': '#14b8a6',
  'Imprenta (Área de Impresión)': '#ef4444',
  'Mostrador': '#3b82f6',
  'Pendiente': '#9ca3af',
  'Taller Gráfico': '#a855f7',
  'En Espera': '#22d3ee',
  'Finalizado en Taller': '#22c55e',
  'Instalaciones': '#f97316',
  'Taller de Imprenta': '#fb7185'
}

const sanitizeName = (name?: string) => {
  if (!name) return ''
  const atIndex = name.indexOf('@')
  if (atIndex > 0) return name.slice(0, atIndex)
  return name
}

const StatisticsPage = ({ tasks, activity, teamMembers, onBack }: StatisticsPageProps) => {
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [backendPeriodStats, setBackendPeriodStats] = useState<any>(null)
  const [backendUserStats, setBackendUserStats] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [presupuestosVentas, setPresupuestosVentas] = useState<any[]>([])
  const [clientesWeb, setClientesWeb] = useState<any[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([])
  const [pedidosCompra, setPedidosCompra] = useState<any[]>([])
  const [articulosStock, setArticulosStock] = useState<any[]>([])
  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [movimientosStock, setMovimientosStock] = useState<any[]>([])
  const [vehiculosFlota, setVehiculosFlota] = useState<any[]>([])
  const [registrosFlota, setRegistrosFlota] = useState<any[]>([])
  const [menusDiarios, setMenusDiarios] = useState<any[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [backendLoading, setBackendLoading] = useState<boolean>(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const toArgentinaRangeTs = (from: string, to: string) => {
    // Filtra timestamptz (ej. hora_salida) por día completo en zona AR.
    return {
      desde: `${from}T00:00:00-03:00`,
      hasta: `${to}T23:59:59-03:00`
    }
  }

  // Proteger la ruta: solo administradores pueden acceder
  useEffect(() => {
    if (!loading && !isAdmin) {
      // Redirigir al tablero si no es administrador
      navigate('/')
    }
  }, [isAdmin, loading, navigate])

  // Rango por defecto: últimos 30 días
  useEffect(() => {
    if (dateFrom && dateTo) return
    const today = new Date()
    const from = new Date()
    from.setDate(today.getDate() - 30)
    const toStr = today.toISOString().slice(0, 10)
    const fromStr = from.toISOString().slice(0, 10)
    setDateFrom((prev) => prev || fromStr)
    setDateTo((prev) => prev || toStr)
  }, [dateFrom, dateTo])

  // Validar que los datos sean arrays válidos
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const safeActivity = Array.isArray(activity) ? activity : []
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : []

  // Cargar estadísticas reales desde Supabase
  useEffect(() => {
    const shouldFetch = dateFrom && dateTo
    if (!shouldFetch) return

    let cancelled = false
    const fetchStats = async () => {
      setBackendLoading(true)
      setBackendError(null)
      try {
        const periodResp = await apiService.getEstadisticasPeriodo(dateFrom, dateTo)
        if (!cancelled) {
          if (periodResp.success) {
            setBackendPeriodStats(periodResp.data)
          } else {
            setBackendError(periodResp.error || 'Error al obtener estadísticas del período')
          }
        }

        // Estadísticas por usuario (solo ids numéricos válidos)
        const numericIds = Array.from(
          new Set(
            safeTeamMembers
              .map((m) => Number(m.id))
              .filter((n) => !Number.isNaN(n))
          )
        )
        const userResults: any[] = []
        for (const userId of numericIds) {
          const userResp = await apiService.getEstadisticasUsuario(userId, dateFrom, dateTo)
          if (userResp.success && userResp.data) {
            userResults.push({ userId, ...userResp.data })
          }
        }
        if (!cancelled) {
          setBackendUserStats(userResults)
        }

        // Ventas, presupuestos y clientes (ámbitos medibles)
        const [facturasResp, presupResp, clientesResp] = await Promise.all([
          apiService.getFacturas({ fechaDesde: dateFrom, fechaHasta: dateTo }),
          apiService.getPresupuestosVentasAdmin({ fecha_desde: dateFrom, fecha_hasta: dateTo }),
          apiService.getClientesWeb()
        ])
        if (!cancelled) {
          if (facturasResp.success && facturasResp.data) setFacturas(Array.isArray(facturasResp.data) ? facturasResp.data : [])
          else setFacturas([])
          if (presupResp.success && presupResp.data) setPresupuestosVentas(Array.isArray(presupResp.data) ? presupResp.data : [])
          else setPresupuestosVentas([])
          if (clientesResp.success && clientesResp.data) setClientesWeb(Array.isArray(clientesResp.data) ? clientesResp.data : [])
          else setClientesWeb([])
        }

        // Pedidos web, compras, stock, flota y comida (ámbitos medibles)
        const { desde, hasta } = toArgentinaRangeTs(dateFrom, dateTo)
        const [pedWebResp, comprasResp, stockResp, stockBajoResp, movResp, vehResp, flotaRegResp, menusResp] =
          await Promise.all([
          apiService.getPedidosPendientes(),
          apiService.getPedidosCompra(),
          apiService.getArticulosStock().catch(() => ({ success: true, data: [] })),
          apiService.getArticulosStock(undefined, true).catch(() => ({ success: true, data: [] })),
          apiService
            .getMovimientosStock({ fecha_desde: dateFrom, fecha_hasta: dateTo })
            .catch(() => ({ success: true, data: [] })),
          apiService.getVehiculos().catch(() => ({ success: true, data: [] })),
          apiService
            .getRegistrosSalidasVehiculos({ fecha_desde: desde, fecha_hasta: hasta })
            .catch(() => ({ success: true, data: [] })),
          apiService.obtenerMenusDiarios(dateFrom, dateTo).catch(() => ({ success: true, data: [] }))
        ])
        if (!cancelled) {
          if (pedWebResp.success && pedWebResp.data) setPedidosPendientes(Array.isArray(pedWebResp.data) ? pedWebResp.data : [])
          else setPedidosPendientes([])
          if (comprasResp.success && comprasResp.data) {
            const list = Array.isArray(comprasResp.data) ? comprasResp.data : []
            const fromTs = new Date(dateFrom).getTime()
            const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000
            const inPeriod = list.filter((p: any) => {
              const t = p.fecha_solicitud ? new Date(p.fecha_solicitud).getTime() : 0
              return t >= fromTs && t <= toTs
            })
            setPedidosCompra(inPeriod)
          } else setPedidosCompra([])
          if (stockResp.success && stockResp.data) setArticulosStock(Array.isArray(stockResp.data) ? stockResp.data : [])
          else setArticulosStock([])
          if (stockBajoResp.success && stockBajoResp.data) setStockBajo(Array.isArray(stockBajoResp.data) ? stockBajoResp.data : [])
          else setStockBajo([])
          if (movResp.success && movResp.data) setMovimientosStock(Array.isArray(movResp.data) ? movResp.data : [])
          else setMovimientosStock([])
          if (vehResp.success && vehResp.data) setVehiculosFlota(Array.isArray(vehResp.data) ? vehResp.data : [])
          else setVehiculosFlota([])
          if (flotaRegResp.success && flotaRegResp.data) setRegistrosFlota(Array.isArray(flotaRegResp.data) ? flotaRegResp.data : [])
          else setRegistrosFlota([])
          if (menusResp.success && menusResp.data) setMenusDiarios(Array.isArray(menusResp.data) ? menusResp.data : [])
          else setMenusDiarios([])
          setLastUpdated(new Date())
        }
      } catch (error: any) {
        if (!cancelled) {
          setBackendError(error?.message || 'Error obteniendo estadísticas')
        }
      } finally {
        if (!cancelled) setBackendLoading(false)
      }
    }

    fetchStats()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, safeTeamMembers, refreshTrigger])

  // Auto-refresh cada 60s para sensación de tiempo real
  useEffect(() => {
    if (!dateFrom || !dateTo) return
    const interval = setInterval(() => setRefreshTrigger((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [dateFrom, dateTo])

  const filteredTasks = useMemo(() => {
    return safeTasks.filter((task) => {
      const created = new Date(task.createdAt).getTime()
      const updated = new Date(task.updatedAt).getTime()
      const fromOk = dateFrom ? created >= new Date(dateFrom).getTime() : true
      const toOk = dateTo ? updated <= new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : true
      const sectorOk = sectorFilter === 'all' ? true : (task.assignedSector || task.status) === sectorFilter
      const operatorOk = operatorFilter === 'all' ? true : task.ownerId === operatorFilter
      return fromOk && toOk && sectorOk && operatorOk
    })
  }, [safeTasks, dateFrom, dateTo, sectorFilter, operatorFilter])

  const filteredActivity = useMemo(() => {
    return safeActivity.filter((event) => {
      const ts = new Date(event.timestamp).getTime()
      const fromOk = dateFrom ? ts >= new Date(dateFrom).getTime() : true
      const toOk = dateTo ? ts <= new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : true
      return fromOk && toOk
    })
  }, [safeActivity, dateFrom, dateTo])

  // IMPORTANTE: Todos los hooks (useMemo) deben estar ANTES de los returns condicionales
  // para cumplir con las reglas de los hooks de React
  
  // 1. Órdenes por Estado (Donut Chart)
  const ordersByStatus = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const statusCounts: Record<string, number> = {}
    filteredTasks.forEach((task) => {
      if (!task || !task.status) return
      const column = BOARD_COLUMNS.find((col) => col.id === task.status)
      const label = column?.label || task.status
      statusCounts[label] = (statusCounts[label] || 0) + 1
    })
    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: COLORS[name as keyof typeof COLORS] || '#6b7280'
    }))
  }, [safeTasks])

  // 2. Top 5 Clientes
  const topClients = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const clientCounts: Record<string, number> = {}
    filteredTasks.forEach((task) => {
      if (!task || !task.title) return
      const client = task.title
      clientCounts[client] = (clientCounts[client] || 0) + 1
    })
    return Object.entries(clientCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value], index) => ({
        name,
        value,
        color: `hsl(${30 + index * 15}, 70%, ${60 - index * 5}%)`
      }))
  }, [safeTasks])

  // 3. Distribución por Sector
  const distributionBySector = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const sectorCounts: Record<string, number> = {}
    filteredTasks.forEach((task) => {
      if (!task) return
      const sector = task.assignedSector || 'Sin sector'
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
    })
    return Object.entries(sectorCounts).map(([name, value], index) => ({
      name,
      value,
      color: index === 0 ? '#3b82f6' : '#22c55e'
    }))
  }, [safeTasks])

  // 4. Carga de Trabajo por Operario
  const workloadByOperator = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const operatorCounts: Record<string, number> = {}
    filteredTasks.forEach((task) => {
      if (!task) return
      const member = safeTeamMembers.find((m) => m.id === task.ownerId)
      const operatorName = sanitizeName(member?.name) || 'Otro'
      operatorCounts[operatorName] = (operatorCounts[operatorName] || 0) + 1
    })
    return Object.entries(operatorCounts).map(([name, value]) => ({
      name,
      Órdenes: value
    }))
  }, [safeTasks, safeTeamMembers])

  // 5. Movimientos por Usuario
  const movementsByUser = useMemo(() => {
    if (!filteredActivity || filteredActivity.length === 0) return []
    const userMovements: Record<string, number> = {}
    filteredActivity.forEach((event) => {
      if (!event || !event.actorId) return
      const member = safeTeamMembers.find((m) => m.id === event.actorId)
      const userName = sanitizeName(member?.name) || event.actorId
      userMovements[userName] = (userMovements[userName] || 0) + 1
    })
    return Object.entries(userMovements)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({
        name,
        Movimientos: value
      }))
  }, [safeActivity, safeTeamMembers])

  // 6. Tiempo Promedio de Reacción por Usuario
  const reactionTimeByUser = useMemo(() => {
    if (!filteredActivity || filteredActivity.length === 0) return []
    const userReactionTimes: Record<string, { total: number; count: number }> = {}
    
    filteredActivity.forEach((event) => {
      if (!event || !event.actorId || !event.timestamp) return
      const member = safeTeamMembers.find((m) => m.id === event.actorId)
      const userName = sanitizeName(member?.name) || event.actorId
      
      if (!userReactionTimes[userName]) {
        userReactionTimes[userName] = { total: 0, count: 0 }
      }
      
      // Calcular tiempo de reacción (simulado basado en timestamp)
      try {
        const eventTime = new Date(event.timestamp).getTime()
        if (isNaN(eventTime)) return
        const now = Date.now()
        const hoursDiff = (now - eventTime) / (1000 * 60 * 60)
        
        userReactionTimes[userName].total += hoursDiff
        userReactionTimes[userName].count += 1
      } catch (error) {
        console.warn('Error procesando timestamp:', event.timestamp, error)
      }
    })
    
    return Object.entries(userReactionTimes)
      .map(([name, data]) => ({
        name,
        'Tiempo Promedio (horas)': data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b['Tiempo Promedio (horas)'] - a['Tiempo Promedio (horas)'])
  }, [safeActivity, safeTeamMembers])

  // 7. Tiempo Promedio por Estado (Bottleneck Detection)
  const avgTimeByStatus = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const statusTimes: Record<string, { total: number; count: number }> = {}
    
    filteredTasks.forEach((task) => {
      if (!task || !task.status || !task.updatedAt) return
      const column = BOARD_COLUMNS.find((col) => col.id === task.status)
      const statusName = column?.label || task.status
      
      if (!statusTimes[statusName]) {
        statusTimes[statusName] = { total: 0, count: 0 }
      }
      
      try {
        const updatedTime = new Date(task.updatedAt).getTime()
        if (isNaN(updatedTime)) return
        const now = Date.now()
        const daysDiff = (now - updatedTime) / (1000 * 60 * 60 * 24)
        
        statusTimes[statusName].total += daysDiff
        statusTimes[statusName].count += 1
      } catch (error) {
        console.warn('Error procesando updatedAt:', task.updatedAt, error)
      }
    })
    
    return Object.entries(statusTimes)
      .map(([name, data]) => ({
        name,
        'Tiempo Promedio (días)': data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b['Tiempo Promedio (días)'] - a['Tiempo Promedio (días)'])
  }, [safeTasks])

  // 8. Registro de Actividad Cronológico
  const chronologicalActivity = useMemo(() => {
    if (!filteredActivity || filteredActivity.length === 0) return []
    return [...filteredActivity]
      .filter((event) => event && event.timestamp)
      .sort((a, b) => {
        try {
          const timeA = new Date(a.timestamp).getTime()
          const timeB = new Date(b.timestamp).getTime()
          if (isNaN(timeA) || isNaN(timeB)) return 0
          return timeB - timeA
        } catch {
          return 0
        }
      })
      .slice(0, 50)
      .map((event) => {
        const member = safeTeamMembers.find((m) => m.id === event.actorId)
        const fromColumn = BOARD_COLUMNS.find((col) => col.id === event.from)
        const toColumn = BOARD_COLUMNS.find((col) => col.id === event.to)
        
        let fechaHora = 'N/A'
        try {
          fechaHora = new Date(event.timestamp).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        } catch (error) {
          console.warn('Error formateando fecha:', event.timestamp, error)
        }
        
        return {
          fechaHora,
          usuario: sanitizeName(member?.name) || '',
          opNumber: `#${safeTasks.find((t) => t && t.id === event.taskId)?.opNumber || 'N/A'}`,
          movimiento: `${fromColumn?.label || event.from || 'N/A'} → ${toColumn?.label || event.to || 'N/A'}`
        }
      })
  }, [safeActivity, safeTeamMembers, safeTasks])

  // 9. Tiempo promedio por tipo de orden (usaremos estado/columna)
  const avgCycleByStatus = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const map: Record<string, { total: number; count: number }> = {}
  filteredTasks.forEach((task) => {
      if (!task?.status || !task.createdAt || !task.updatedAt) return
      const col = BOARD_COLUMNS.find((c) => c.id === task.status)
      const label = col?.label || task.status
      const start = new Date(task.createdAt).getTime()
      const end = new Date(task.updatedAt).getTime()
      if (isNaN(start) || isNaN(end)) return
      const days = Math.max((end - start) / (1000 * 60 * 60 * 24), 0)
      if (!map[label]) map[label] = { total: 0, count: 0 }
      map[label].total += days
      map[label].count += 1
    })
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        'Promedio (días)': data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b['Promedio (días)'] - a['Promedio (días)'])
  }, [safeTasks])

  // 10. Tiempo promedio por operario
  const avgCycleByOperator = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const map: Record<string, { total: number; count: number }> = {}
    filteredTasks.forEach((task) => {
      if (!task?.createdAt || !task.updatedAt) return
      const owner = safeTeamMembers.find((m) => m.id === task.ownerId)
      const name = sanitizeName(owner?.name) || 'Sin asignar'
      const start = new Date(task.createdAt).getTime()
      const end = new Date(task.updatedAt).getTime()
      if (isNaN(start) || isNaN(end)) return
      const days = Math.max((end - start) / (1000 * 60 * 60 * 24), 0)
      if (!map[name]) map[name] = { total: 0, count: 0 }
      map[name].total += days
      map[name].count += 1
    })
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        'Promedio (días)': data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b['Promedio (días)'] - a['Promedio (días)'])
  }, [filteredTasks, safeTeamMembers])

  // Helper para calcular percentiles
  const calculatePercentile = (values: number[], percentile: number): number => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }

  const formatNumber = (n: any, digits: number = 0) => {
    const num = Number(n)
    if (Number.isNaN(num)) return '0'
    return num.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
  }

  // 9. Fichas Estancadas (> 3 días en el mismo estado)
  const stalledTasks = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const now = Date.now()
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000
    
    return filteredTasks
      .filter((task) => {
        if (!task || !task.updatedAt) return false
        try {
          const updatedTime = new Date(task.updatedAt).getTime()
          if (isNaN(updatedTime)) return false
          return now - updatedTime > threeDaysInMs
        } catch {
          return false
        }
      })
      .map((task) => {
        const column = BOARD_COLUMNS.find((col) => col.id === task.status)
        let daysStalled = 0
        try {
          const updatedTime = new Date(task.updatedAt).getTime()
          if (!isNaN(updatedTime)) {
            daysStalled = Math.floor((now - updatedTime) / (1000 * 60 * 60 * 24))
          }
        } catch (error) {
          console.warn('Error calculando días estancados:', task.updatedAt, error)
        }
        
        return {
          opNumber: task.opNumber || 'N/A',
          client: task.title || 'Sin cliente',
          sector: task.assignedSector || 'Sin sector',
          status: column?.label || task.status || 'Sin estado',
          daysStalled
        }
      })
      .sort((a, b) => b.daysStalled - a.daysStalled)
  }, [filteredTasks])

  // 10. Lead Time y Cycle Time (p50/p90) por Estado
  const leadCycleTimeByStatus = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const statusMap: Record<string, number[]> = {}
    
    filteredTasks.forEach((task) => {
      if (!task?.status || !task.createdAt || !task.updatedAt) return
      const col = BOARD_COLUMNS.find((c) => c.id === task.status)
      const label = col?.label || task.status
      
      try {
        const start = new Date(task.createdAt).getTime()
        const end = new Date(task.updatedAt).getTime()
        if (isNaN(start) || isNaN(end)) return
        const days = Math.max((end - start) / (1000 * 60 * 60 * 24), 0)
        
        if (!statusMap[label]) statusMap[label] = []
        statusMap[label].push(days)
      } catch {
        return
      }
    })
    
    return Object.entries(statusMap).map(([name, values]) => ({
      name,
      p50: calculatePercentile(values, 50),
      p90: calculatePercentile(values, 90),
      promedio: values.reduce((a, b) => a + b, 0) / values.length
    }))
  }, [filteredTasks])

  // 11. Lead Time y Cycle Time (p50/p90) por Operario
  const leadCycleTimeByOperator = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const operatorMap: Record<string, number[]> = {}
    
    filteredTasks.forEach((task) => {
      if (!task?.createdAt || !task.updatedAt) return
      const owner = safeTeamMembers.find((m) => m.id === task.ownerId)
      const name = sanitizeName(owner?.name) || 'Sin asignar'
      
      try {
        const start = new Date(task.createdAt).getTime()
        const end = new Date(task.updatedAt).getTime()
        if (isNaN(start) || isNaN(end)) return
        const days = Math.max((end - start) / (1000 * 60 * 60 * 24), 0)
        
        if (!operatorMap[name]) operatorMap[name] = []
        operatorMap[name].push(days)
      } catch {
        return
      }
    })
    
    return Object.entries(operatorMap).map(([name, values]) => ({
      name,
      p50: calculatePercentile(values, 50),
      p90: calculatePercentile(values, 90),
      promedio: values.reduce((a, b) => a + b, 0) / values.length
    }))
  }, [filteredTasks, safeTeamMembers])

  // 12. Aging WIP (Work In Progress) - Buckets de tiempo
  const agingWIP = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    const now = Date.now()
    const buckets = {
      '0-2 días': 0,
      '3-5 días': 0,
      '6-10 días': 0,
      '11+ días': 0
    }
    
    filteredTasks.forEach((task) => {
      if (!task?.updatedAt || task.status === 'almacen-entrega' || task.entregado) return
      
      try {
        const updatedTime = new Date(task.updatedAt).getTime()
        if (isNaN(updatedTime)) return
        const days = Math.floor((now - updatedTime) / (1000 * 60 * 60 * 24))
        
        if (days <= 2) buckets['0-2 días']++
        else if (days <= 5) buckets['3-5 días']++
        else if (days <= 10) buckets['6-10 días']++
        else buckets['11+ días']++
      } catch {
        return
      }
    })
    
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [filteredTasks])

  // 13. Throughput Comparativo (período actual vs anterior)
  const throughputComparison = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return null
    
    const now = Date.now()
    const currentPeriodStart = dateFrom ? new Date(dateFrom).getTime() : now - 30 * 24 * 60 * 60 * 1000
    const currentPeriodEnd = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : now
    const periodLength = currentPeriodEnd - currentPeriodStart
    const previousPeriodStart = currentPeriodStart - periodLength
    const previousPeriodEnd = currentPeriodStart
    
    let currentCompleted = 0
    let previousCompleted = 0
    
    filteredTasks.forEach((task) => {
      if (!task?.updatedAt) return
      try {
        const updatedTime = new Date(task.updatedAt).getTime()
        if (isNaN(updatedTime)) return
        
        // Solo contar tareas completadas (en almacén o entregadas)
        const isCompleted = task.status === 'almacen-entrega' || task.entregado
        if (!isCompleted) return
        
        if (updatedTime >= currentPeriodStart && updatedTime < currentPeriodEnd) {
          currentCompleted++
        } else if (updatedTime >= previousPeriodStart && updatedTime < previousPeriodEnd) {
          previousCompleted++
        }
      } catch {
        return
      }
    })
    
    const change = previousCompleted > 0 
      ? ((currentCompleted - previousCompleted) / previousCompleted) * 100 
      : currentCompleted > 0 ? 100 : 0
    
    return {
      current: currentCompleted,
      previous: previousCompleted,
      change,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    }
  }, [filteredTasks, dateFrom, dateTo])

  // 14. SLA Compliance (vs fecha de compromiso)
  const slaCompliance = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return null
    
    let total = 0
    let onTime = 0
    let late = 0
    let noDueDate = 0
    const deviations: number[] = []
    
    filteredTasks.forEach((task) => {
      if (!task?.dueDate) {
        noDueDate++
        return
      }
      
      try {
        const dueDate = new Date(task.dueDate).getTime()
        if (isNaN(dueDate)) {
          noDueDate++
          return
        }
        
        // Usar updatedAt como fecha de finalización (o createdAt si aún no está completada)
        const completionDate = task.status === 'almacen-entrega' || task.entregado
          ? new Date(task.updatedAt).getTime()
          : Date.now()
        
        if (isNaN(completionDate)) return
        
        total++
        const deviationDays = (completionDate - dueDate) / (1000 * 60 * 60 * 24)
        deviations.push(deviationDays)
        
        if (deviationDays <= 0) {
          onTime++
        } else {
          late++
        }
      } catch {
        return
      }
    })
    
    const complianceRate = total > 0 ? (onTime / total) * 100 : 0
    const avgDeviation = deviations.length > 0 
      ? deviations.reduce((a, b) => a + b, 0) / deviations.length 
      : 0
    
    return {
      total,
      onTime,
      late,
      noDueDate,
      complianceRate,
      avgDeviation,
      p50Deviation: calculatePercentile(deviations, 50),
      p90Deviation: calculatePercentile(deviations, 90)
    }
  }, [filteredTasks])

  // 15. WIP por Estado con Alertas
  const wipByStatus = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) return []
    
    // Límites de WIP por estado (configurables)
    const wipLimits: Record<string, number> = {
      'Diseño Gráfico': 10,
      'Diseño/Proceso': 8,
      'En Espera': 15,
      'Imprenta (Área de Impresión)': 12,
      'Taller de Imprenta': 10,
      'Taller Gráfico': 15,
      'Instalaciones': 8,
      'Finalizado en Taller': 20,
      'Almacén de Entrega': 25
    }
    
    const statusCounts: Record<string, number> = {}
    
    filteredTasks.forEach((task) => {
      if (!task?.status) return
      // No contar tareas completadas/entregadas como WIP
      if (task.status === 'almacen-entrega' || task.entregado) return
      
      const column = BOARD_COLUMNS.find((col) => col.id === task.status)
      const label = column?.label || task.status
      statusCounts[label] = (statusCounts[label] || 0) + 1
    })
    
    return Object.entries(statusCounts).map(([name, count]) => {
      const limit = wipLimits[name] || 20
      const isOverLimit = count > limit
      const utilization = (count / limit) * 100
      
      return {
        name,
        count,
        limit,
        isOverLimit,
        utilization
      }
    }).sort((a, b) => b.count - a.count)
  }, [filteredTasks])

  // ========== VENTAS / FACTURACIÓN ==========
  const statsVentas = useMemo(() => {
    const list = Array.isArray(facturas) ? facturas : []
    const emitidas = list.filter((f: any) => f.estado === 'Emitida')
    const totalMonto = emitidas.reduce((sum: number, f: any) => sum + (Number(f.total) || 0), 0)
    const porTipo: Record<string, number> = {}
    emitidas.forEach((f: any) => {
      const t = f.tipo_comprobante || 'Otro'
      porTipo[t] = (porTipo[t] || 0) + 1
    })
    const chartPorTipo = Object.entries(porTipo).map(([name, value]) => ({ name, value }))
    return {
      total: list.length,
      emitidas: emitidas.length,
      borrador: list.filter((f: any) => f.estado === 'Borrador').length,
      anuladas: list.filter((f: any) => f.estado === 'Anulada' || f.estado === 'Cancelada').length,
      totalMonto,
      chartPorTipo
    }
  }, [facturas])

  // ========== CLIENTES ==========
  const statsClientes = useMemo(() => {
    const list = Array.isArray(clientesWeb) ? clientesWeb : []
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity
    const nuevosEnPeriodo = list.filter((c: any) => {
      const created = c.created_at ? new Date(c.created_at).getTime() : 0
      return created >= fromTs && created <= toTs
    })
    return {
      total: list.length,
      nuevosEnPeriodo: nuevosEnPeriodo.length
    }
  }, [clientesWeb, dateFrom, dateTo])

  // ========== PRESUPUESTOS DE VENTAS ==========
  const statsPresupuestos = useMemo(() => {
    const list = Array.isArray(presupuestosVentas) ? presupuestosVentas : []
    const porEstado: Record<string, number> = {}
    let montoAceptados = 0
    let montoConvertidos = 0
    list.forEach((p: any) => {
      const e = (p.estado || 'otro').toString().toLowerCase()
      porEstado[e] = (porEstado[e] || 0) + 1
      const precio = Number(p.precio_total) || 0
      if (e === 'aceptado') montoAceptados += precio
      if (e === 'convertido') montoConvertidos += precio
    })
    const chartPorEstado = Object.entries(porEstado).map(([name, value]) => ({ name, value }))
    return {
      total: list.length,
      aceptados: porEstado.aceptado || 0,
      rechazados: porEstado.rechazado || 0,
      convertidos: porEstado.convertido || 0,
      enviados: porEstado.enviado || 0,
      borrador: porEstado.borrador || 0,
      montoAceptados,
      montoConvertidos,
      chartPorEstado
    }
  }, [presupuestosVentas])

  // ========== PEDIDOS WEB (pendientes) ==========
  const statsPedidosWeb = useMemo(() => {
    const list = Array.isArray(pedidosPendientes) ? pedidosPendientes : []
    const porEstado: Record<string, number> = {}
    list.forEach((p: any) => {
      const e = (p.estado || 'otro').toString()
      porEstado[e] = (porEstado[e] || 0) + 1
    })
    const chartPorEstado = Object.entries(porEstado).map(([name, value]) => ({ name, value }))
    return { total: list.length, chartPorEstado }
  }, [pedidosPendientes])

  // ========== COMPRAS (pedidos de compra en período) ==========
  const statsCompras = useMemo(() => {
    const list = Array.isArray(pedidosCompra) ? pedidosCompra : []
    const porEstado: Record<string, number> = {}
    list.forEach((p: any) => {
      const e = (p.estado || 'otro').toString()
      porEstado[e] = (porEstado[e] || 0) + 1
    })
    const chartPorEstado = Object.entries(porEstado).map(([name, value]) => ({ name, value }))
    return { total: list.length, chartPorEstado }
  }, [pedidosCompra])

  // ========== STOCK ==========
  const statsStock = useMemo(() => {
    const list = Array.isArray(articulosStock) ? articulosStock : []
    const bajos = Array.isArray(stockBajo) ? stockBajo : []
    const movs = Array.isArray(movimientosStock) ? movimientosStock : []
    const porTipo: Record<string, number> = {}
    movs.forEach((m: any) => {
      const t = (m.tipo_movimiento || 'otro').toString()
      porTipo[t] = (porTipo[t] || 0) + 1
    })
    const chartMovs = Object.entries(porTipo).map(([name, value]) => ({ name, value }))
    return {
      totalArticulos: list.length,
      stockBajo: bajos.length,
      movimientosEnPeriodo: movs.length,
      chartMovs
    }
  }, [articulosStock, stockBajo, movimientosStock])

  // ========== FLOTA ==========
  const statsFlota = useMemo(() => {
    const vehs = Array.isArray(vehiculosFlota) ? vehiculosFlota : []
    const regs = Array.isArray(registrosFlota) ? registrosFlota : []
    const activos = vehs.filter((v: any) => v?.activo !== false)
    const enUso = regs.filter((r: any) => r?.estado === 'en_uso').length
    const retrasados = regs.filter((r: any) => r?.estado === 'retrasado').length
    const pendientes = regs.filter((r: any) => r?.estado === 'pendiente_autorizacion').length
    const kmTotal = regs.reduce((acc: number, r: any) => acc + (Number(r?.km_aproximado) || 0), 0)
    return {
      vehiculosTotales: vehs.length,
      vehiculosActivos: activos.length,
      salidas: regs.length,
      kmTotal,
      enUso,
      retrasados,
      pendientes
    }
  }, [vehiculosFlota, registrosFlota])

  // ========== COMIDA / MENÚ DIARIO ==========
  const statsComida = useMemo(() => {
    const menus = Array.isArray(menusDiarios) ? menusDiarios : []
    const totalMenus = menus.length
    const totalSelecciones = menus.reduce((acc: number, m: any) => acc + (Number(m?.total_selecciones) || 0), 0)
    const totalPlatos = menus.reduce((acc: number, m: any) => acc + (Array.isArray(m?.platos) ? m.platos.length : 0), 0)
    const avgSelecciones = totalMenus > 0 ? totalSelecciones / totalMenus : 0
    return {
      totalMenus,
      totalSelecciones,
      totalPlatos,
      avgSelecciones
    }
  }, [menusDiarios])

  // ========== RANKINGS DE USUARIOS (datos reales) ==========
  const rankingsUsuarios = useMemo(() => {
    const rows = Array.isArray(backendUserStats) ? backendUserStats : []
    const getName = (userId: any) => {
      const member = safeTeamMembers.find((m) => Number(m.id) === Number(userId))
      return sanitizeName(member?.name) || `Usuario ${userId}`
    }
    const daysRange = dateFrom && dateTo
      ? Math.max(
          1,
          Math.floor((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1
        )
      : 1

    const base = rows.map((r: any) => {
      const userId = r.userId ?? r.id_usuario
      const total = Number(r.total_ordenes || 0)
      const completadas = Number(r.ordenes_completadas || 0)
      const enProceso = Number(r.ordenes_en_proceso || 0)
      const movimientos =
        Number(r.movimientos_totales ?? r.movimientos_realizados ?? r.movimientos ?? 0) || 0
      const ordenesPorDia =
        Number(r.ordenes_por_dia ?? 0) || (daysRange > 0 ? total / daysRange : total)
      const promDias =
        r.promedio_dias_completar == null ? null : Number(r.promedio_dias_completar)

      return {
        userId,
        name: getName(userId),
        total,
        completadas,
        enProceso,
        movimientos,
        ordenesPorDia,
        promDias
      }
    })

    const topN = 10
    const byCompletadas = [...base].sort((a, b) => b.completadas - a.completadas).slice(0, topN)
    const byMovimientos = [...base].sort((a, b) => b.movimientos - a.movimientos).slice(0, topN)
    const byOrdenesDia = [...base].sort((a, b) => b.ordenesPorDia - a.ordenesPorDia).slice(0, topN)
    const byPromDias = [...base]
      .filter((r) => r.promDias != null && r.completadas >= 2)
      .sort((a, b) => (a.promDias as number) - (b.promDias as number))
      .slice(0, topN)

    return { byCompletadas, byMovimientos, byOrdenesDia, byPromDias }
  }, [backendUserStats, safeTeamMembers, dateFrom, dateTo])

  const exportCsv = (filename: string, rows: any[], columns: string[]) => {
    if (!rows || rows.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    const header = columns.join(',')
    const data = rows
      .map((row) =>
        columns
          .map((col) => {
            const val = row[col] ?? ''
            const safe = typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            return safe
          })
          .join(',')
      )
      .join('\n')
    const csv = `${header}\n${data}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    const marginLeft = 14
    let line = 20

    const addLine = (text: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.text(text, marginLeft, line)
      line += 8
    }

    addLine('Reporte de Estadísticas', true)
    addLine(`Rango: ${dateFrom || 'inicio'} - ${dateTo || 'hoy'}`)
    addLine(`Sector: ${sectorFilter === 'all' ? 'Todos' : sectorFilter}`)
    addLine(`Operario: ${operatorFilter === 'all' ? 'Todos' : operatorFilter}`)
    line += 4

    addLine('Ventas / Facturación:', true)
    addLine(`- Facturas totales: ${statsVentas.total} | Emitidas: ${statsVentas.emitidas} | Monto emitido: $${formatNumber(statsVentas.totalMonto, 0)}`)
    addLine('Clientes (portal):', true)
    addLine(`- Total: ${statsClientes.total} | Nuevos en período: ${statsClientes.nuevosEnPeriodo}`)
    addLine('Presupuestos de ventas:', true)
    addLine(`- Total: ${statsPresupuestos.total} | Aceptados: ${statsPresupuestos.aceptados} | Convertidos: ${statsPresupuestos.convertidos} | Monto: $${formatNumber(statsPresupuestos.montoAceptados + statsPresupuestos.montoConvertidos, 0)}`)
    addLine('Pedidos web (pendientes):', true)
    addLine(`- Total: ${statsPedidosWeb.total}`)
    addLine('Compras (período):', true)
    addLine(`- Pedidos de compra: ${statsCompras.total}`)
    addLine('Stock:', true)
    addLine(`- Artículos: ${statsStock.totalArticulos} | Stock bajo: ${statsStock.stockBajo} | Movimientos: ${statsStock.movimientosEnPeriodo}`)
    addLine('Flota (período):', true)
    addLine(
      `- Vehículos activos: ${statsFlota.vehiculosActivos}/${statsFlota.vehiculosTotales} | Salidas: ${statsFlota.salidas} | Km aprox: ${formatNumber(statsFlota.kmTotal, 0)}`
    )
    addLine('Comida (menú diario):', true)
    addLine(
      `- Menús: ${statsComida.totalMenus} | Selecciones: ${statsComida.totalSelecciones} (prom: ${formatNumber(statsComida.avgSelecciones, 1)})`
    )
    line += 4

    addLine('Órdenes por estado:', true)
    ordersByStatus.slice(0, 8).forEach((s) => addLine(`- ${s.name}: ${s.value}`))
    line += 4

    addLine('Movimientos por usuario (top 5):', true)
    movementsByUser.slice(0, 5).forEach((m) => addLine(`- ${m.name}: ${m.Movimientos}`))
    line += 4

    addLine('Tiempo promedio por estado (top 5):', true)
    avgTimeByStatus.slice(0, 5).forEach((t) =>
      addLine(`- ${t.name}: ${t['Tiempo Promedio (días)'].toFixed(2)} días`)
    )
    line += 4

    addLine('Tiempo promedio por operario (top 5):', true)
    avgCycleByOperator.slice(0, 5).forEach((t) =>
      addLine(`- ${t.name}: ${t['Promedio (días)'].toFixed(2)} días`)
    )
    line += 4

    addLine('Fichas estancadas (top 5):', true)
    stalledTasks.slice(0, 5).forEach((t) =>
      addLine(`- OP #${t.opNumber} · ${t.status} · ${t.daysStalled} días`)
    )
    line += 4

    addLine('Lead/Cycle Time por Estado (p50/p90) - Top 5:', true)
    leadCycleTimeByStatus.slice(0, 5).forEach((t) =>
      addLine(`- ${t.name}: p50=${t.p50.toFixed(1)}d, p90=${t.p90.toFixed(1)}d, prom=${t.promedio.toFixed(1)}d`)
    )
    line += 4

    addLine('Lead/Cycle Time por Operario (p50/p90) - Top 5:', true)
    leadCycleTimeByOperator.slice(0, 5).forEach((t) =>
      addLine(`- ${t.name}: p50=${t.p50.toFixed(1)}d, p90=${t.p90.toFixed(1)}d, prom=${t.promedio.toFixed(1)}d`)
    )
    line += 4

    addLine('Aging WIP:', true)
    agingWIP.forEach((a) => addLine(`- ${a.name}: ${a.value} tareas`))
    line += 4

    if (throughputComparison) {
      addLine('Throughput Comparativo:', true)
      addLine(`- Período actual: ${throughputComparison.current} tareas`)
      addLine(`- Período anterior: ${throughputComparison.previous} tareas`)
      addLine(`- Cambio: ${throughputComparison.change > 0 ? '+' : ''}${throughputComparison.change.toFixed(1)}%`)
      line += 4
    }

    if (slaCompliance) {
      addLine('SLA Compliance:', true)
      addLine(`- Tasa de cumplimiento: ${slaCompliance.complianceRate.toFixed(1)}%`)
      addLine(`- A tiempo: ${slaCompliance.onTime} | Retrasadas: ${slaCompliance.late}`)
      addLine(`- Desviación promedio: ${slaCompliance.avgDeviation.toFixed(1)} días`)
      addLine(`- p50 desviación: ${slaCompliance.p50Deviation.toFixed(1)} días`)
      addLine(`- p90 desviación: ${slaCompliance.p90Deviation.toFixed(1)} días`)
      line += 4
    }

    addLine('WIP por Estado (sobre límite):', true)
    wipByStatus.filter((w) => w.isOverLimit).slice(0, 5).forEach((w) =>
      addLine(`- ${w.name}: ${w.count}/${w.limit} (${w.utilization.toFixed(0)}%)`)
    )

    doc.save('estadisticas.pdf')
  }

  // Ahora sí, después de todos los hooks, podemos hacer returns condicionales
  if (loading) {
    return (
      <div className="statistics-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="statistics-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
          <p>Solo los administradores pueden ver las estadísticas.</p>
          <button onClick={onBack} className="back-button" style={{ marginTop: '20px' }}>
            Volver al Tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="statistics-page">
      <header className="stats-header">
        <div className="stats-header-content">
          <div className="stats-header-brand">
            <img 
              src="https://trello.plotcenter.com.ar/Group%20187.png" 
              alt="Plot Center Logo" 
              className="stats-logo"
            />
            <button className="back-button" onClick={onBack}>
              ← Volver al Tablero
            </button>
          </div>
          <h1>Estadísticas y Reportes</h1>
          {lastUpdated && (
            <div className="stats-live-indicator" key={lastUpdated.getTime()}>
              <span className="stats-live-dot" />
              <span>Última actualización: {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
        </div>
        <div className="stats-filters">
          <div className="filter-group">
            <label>📅 Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>📆 Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>🏭 Sector</label>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
              <option value="all">Todos</option>
              {BOARD_COLUMNS.map((col) => (
                <option key={col.id} value={col.label}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>👤 Operario</label>
            <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
              <option value="all">Todos</option>
              {safeTeamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {sanitizeName(m.name) || m.id}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group export-group">
            <button onClick={() => exportCsv('orders-por-estado', ordersByStatus, ['name', 'value'])}>
              ⬇️ Exportar estados
            </button>
            <button onClick={() => exportCsv('tiempo-por-operario', avgCycleByOperator, ['name', 'Promedio (días)'])}>
              ⬇️ Exportar tiempos
            </button>
            <button onClick={() => exportCsv('actividad', chronologicalActivity, ['fechaHora', 'usuario', 'opNumber', 'movimiento'])}>
              ⬇️ Exportar actividad
            </button>
            <button onClick={exportPdf}>⬇️ PDF</button>
          </div>
        </div>
      </header>

      <div className="stats-container">
        {backendError && (
          <div className="stat-card error-card">
            <h3>⚠️ Error cargando datos reales</h3>
            <p className="stat-subtitle">{backendError}</p>
          </div>
        )}

        {backendLoading && (
          <div className="stat-card">
            <h3>Sincronizando datos reales...</h3>
            <p className="stat-subtitle">Consultando Supabase con el rango seleccionado.</p>
          </div>
        )}

        {backendPeriodStats && (
          <div className="stats-row">
            <div className="stat-card">
              <h3>Totales reales (período)</h3>
              <p className="stat-subtitle">Supabase • {dateFrom} → {dateTo}</p>
              <div className="stat-grid-2">
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.total_ordenes)}</div>
                  <div className="stat-label">Órdenes totales</div>
                </div>
                <div>
                  <div className="stat-value success">{formatNumber(backendPeriodStats.ordenes_completadas)}</div>
                  <div className="stat-label">Completadas</div>
                </div>
                <div>
                  <div className="stat-value warning">{formatNumber(backendPeriodStats.ordenes_en_proceso)}</div>
                  <div className="stat-label">En proceso</div>
                </div>
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.usuarios_activos)}</div>
                  <div className="stat-label">Usuarios activos</div>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <h3>Ritmo y tiempos</h3>
              <p className="stat-subtitle">KPI reales del período</p>
              <div className="stat-grid-2">
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.ordenes_por_dia, 1)}</div>
                  <div className="stat-label">Órdenes por día</div>
                </div>
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.promedio_dias_completar, 1)}</div>
                  <div className="stat-label">Promedio días por orden</div>
                </div>
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.movimientos_totales)}</div>
                  <div className="stat-label">Movimientos registrados</div>
                </div>
                <div>
                  <div className="stat-value">{formatNumber(backendPeriodStats.ordenes_atrasadas)}</div>
                  <div className="stat-label">Atrasadas</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ventas · Clientes · Presupuestos */}
        <div className="stats-row">
          <div className="stat-card">
            <h3>💰 Ventas / Facturación</h3>
            <p className="stat-subtitle">Período {dateFrom} → {dateTo}</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsVentas.total)}</div>
                <div className="stat-label">Facturas totales</div>
              </div>
              <div>
                <div className="stat-value success">{formatNumber(statsVentas.emitidas)}</div>
                <div className="stat-label">Emitidas</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsVentas.borrador)}</div>
                <div className="stat-label">Borrador</div>
              </div>
              <div>
                <div className="stat-value">${formatNumber(statsVentas.totalMonto, 0)}</div>
                <div className="stat-label">Monto emitido</div>
              </div>
            </div>
            {statsVentas.chartPorTipo.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statsVentas.chartPorTipo} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="stat-card">
            <h3>👥 Clientes</h3>
            <p className="stat-subtitle">Clientes web (portal)</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsClientes.total)}</div>
                <div className="stat-label">Total clientes</div>
              </div>
              <div>
                <div className="stat-value success">{formatNumber(statsClientes.nuevosEnPeriodo)}</div>
                <div className="stat-label">Nuevos en período</div>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <h3>📋 Presupuestos de ventas</h3>
            <p className="stat-subtitle">Período {dateFrom} → {dateTo}</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsPresupuestos.total)}</div>
                <div className="stat-label">Total</div>
              </div>
              <div>
                <div className="stat-value success">{formatNumber(statsPresupuestos.aceptados)}</div>
                <div className="stat-label">Aceptados</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsPresupuestos.convertidos)}</div>
                <div className="stat-label">Convertidos a OP</div>
              </div>
              <div>
                <div className="stat-value">${formatNumber(statsPresupuestos.montoAceptados + statsPresupuestos.montoConvertidos, 0)}</div>
                <div className="stat-label">Monto (acept.+conv.)</div>
              </div>
            </div>
            {statsPresupuestos.chartPorEstado.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statsPresupuestos.chartPorEstado} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pedidos web · Compras · Stock */}
        <div className="stats-row">
          <div className="stat-card stats-card-live">
            <h3>🛒 Pedidos web (pendientes)</h3>
            <p className="stat-subtitle">Estado actual</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsPedidosWeb.total)}</div>
                <div className="stat-label">Pendientes</div>
              </div>
            </div>
            {statsPedidosWeb.chartPorEstado.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statsPedidosWeb.chartPorEstado} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="stat-card stats-card-live">
            <h3>📦 Compras (período)</h3>
            <p className="stat-subtitle">{dateFrom} → {dateTo}</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsCompras.total)}</div>
                <div className="stat-label">Pedidos de compra</div>
              </div>
            </div>
            {statsCompras.chartPorEstado.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statsCompras.chartPorEstado} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="stat-card stats-card-live">
            <h3>📊 Stock</h3>
            <p className="stat-subtitle">Artículos y movimientos</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsStock.totalArticulos)}</div>
                <div className="stat-label">Artículos</div>
              </div>
              <div>
                <div className="stat-value warning">{formatNumber(statsStock.stockBajo)}</div>
                <div className="stat-label">Stock bajo</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsStock.movimientosEnPeriodo)}</div>
                <div className="stat-label">Movimientos (período)</div>
              </div>
            </div>
            {statsStock.chartMovs.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statsStock.chartMovs} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#c7d0dd', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Flota · Comida */}
        <div className="stats-row">
          <div className="stat-card stats-card-live">
            <h3>🚚 Flota (período)</h3>
            <p className="stat-subtitle">{dateFrom} → {dateTo}</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsFlota.vehiculosActivos)}</div>
                <div className="stat-label">Vehículos activos</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsFlota.salidas)}</div>
                <div className="stat-label">Salidas (período)</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsFlota.kmTotal, 0)}</div>
                <div className="stat-label">Km aprox (sum)</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsFlota.enUso)}</div>
                <div className="stat-label">En uso ahora</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsFlota.pendientes)}</div>
                <div className="stat-label">Pend. autorización</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsFlota.retrasados)}</div>
                <div className="stat-label">Retrasados</div>
              </div>
            </div>
          </div>

          <div className="stat-card stats-card-live">
            <h3>🍽️ Comida (menú diario)</h3>
            <p className="stat-subtitle">{dateFrom} → {dateTo}</p>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{formatNumber(statsComida.totalMenus)}</div>
                <div className="stat-label">Menús publicados</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsComida.totalSelecciones)}</div>
                <div className="stat-label">Selecciones totales</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsComida.avgSelecciones, 1)}</div>
                <div className="stat-label">Prom. selecciones/menú</div>
              </div>
              <div>
                <div className="stat-value">{formatNumber(statsComida.totalPlatos)}</div>
                <div className="stat-label">Platos publicados</div>
              </div>
            </div>
          </div>
        </div>

        {backendUserStats && backendUserStats.length > 0 && (
          <div className="stat-card full-width">
            <h3>Productividad por usuario (datos reales)</h3>
            <p className="stat-subtitle">Supabase • {dateFrom} → {dateTo}</p>
            <div className="table-container">
              <table className="activity-table compact">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Órdenes totales</th>
                    <th>Completadas</th>
                    <th>En proceso</th>
                    <th>Movimientos</th>
                    <th>Órdenes/día</th>
                    <th>Prom. días/orden</th>
                  </tr>
                </thead>
                <tbody>
                  {backendUserStats.map((row, idx) => {
                    const member = safeTeamMembers.find((m) => Number(m.id) === Number(row.userId))
                    const name = sanitizeName(member?.name) || `Usuario ${row.userId}`
                    const daysRange = Math.max(
                      1,
                      Math.floor(
                        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
                      ) + 1
                    )
                    const ordenesPorDia = Number(row.ordenes_por_dia ?? 0) || (Number(row.total_ordenes || 0) / daysRange)
                    const movimientos =
                      row.movimientos_totales ??
                      row.movimientos_realizados ??
                      row.movimientos ??
                      0
                    return (
                      <tr key={`${row.userId}-${idx}`}>
                        <td>{name}</td>
                        <td>{formatNumber(row.total_ordenes)}</td>
                        <td className="success">{formatNumber(row.ordenes_completadas)}</td>
                        <td className="warning">{formatNumber(row.ordenes_en_proceso)}</td>
                        <td>{formatNumber(movimientos)}</td>
                        <td>{formatNumber(ordenesPorDia, 1)}</td>
                        <td>{formatNumber(row.promedio_dias_completar, 1)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {backendUserStats && backendUserStats.length > 0 && (
          <div className="stat-card full-width">
            <h3>🏆 Rankings de usuarios (datos reales)</h3>
            <p className="stat-subtitle">Top 10 • Supabase • {dateFrom} → {dateTo}</p>
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <div className="stat-card" style={{ boxShadow: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3>✅ Más completadas</h3>
                <p className="stat-subtitle">Órdenes finalizadas en período</p>
                <ol className="stats-ranking">
                  {rankingsUsuarios.byCompletadas.map((r, i) => (
                    <li key={`comp-${r.userId}-${i}`} className="stats-ranking-item">
                      <span className="stats-ranking-pos">{i + 1}</span>
                      <span className="stats-ranking-name">{r.name}</span>
                      <span className="stats-ranking-val">{formatNumber(r.completadas)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="stat-card" style={{ boxShadow: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3>🧾 Más movimientos</h3>
                <p className="stat-subtitle">Actividad registrada en historial</p>
                <ol className="stats-ranking">
                  {rankingsUsuarios.byMovimientos.map((r, i) => (
                    <li key={`mov-${r.userId}-${i}`} className="stats-ranking-item">
                      <span className="stats-ranking-pos">{i + 1}</span>
                      <span className="stats-ranking-name">{r.name}</span>
                      <span className="stats-ranking-val">{formatNumber(r.movimientos)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="stat-card" style={{ boxShadow: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3>📈 Mejor ritmo</h3>
                <p className="stat-subtitle">Órdenes/día (por total en el rango)</p>
                <ol className="stats-ranking">
                  {rankingsUsuarios.byOrdenesDia.map((r, i) => (
                    <li key={`spd-${r.userId}-${i}`} className="stats-ranking-item">
                      <span className="stats-ranking-pos">{i + 1}</span>
                      <span className="stats-ranking-name">{r.name}</span>
                      <span className="stats-ranking-val">{formatNumber(r.ordenesPorDia, 1)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="stat-card" style={{ boxShadow: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3>⏱️ Mejor tiempo</h3>
                <p className="stat-subtitle">Menor prom. días/orden (mín. 2 completadas)</p>
                {rankingsUsuarios.byPromDias.length > 0 ? (
                  <ol className="stats-ranking">
                    {rankingsUsuarios.byPromDias.map((r, i) => (
                      <li key={`lt-${r.userId}-${i}`} className="stats-ranking-item">
                        <span className="stats-ranking-pos">{i + 1}</span>
                        <span className="stats-ranking-name">{r.name}</span>
                        <span className="stats-ranking-val">{formatNumber(r.promDias, 1)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="stat-subtitle">Sin datos suficientes en el rango.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Primera fila: Gráficos circulares */}
        <div className="stats-row">
          <div className="stat-card">
            <h3>Órdenes por Estado</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ordersByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {ordersByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-card">
            <h3>Top 5 Clientes (por N° de trabajos)</h3>
            {topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topClients}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {topClients.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>

          <div className="stat-card">
            <h3>Distribución por Sector</h3>
            {distributionBySector.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionBySector}
                    cx="50%"
                    cy="50%"
                    isAnimationActive
                    animationDuration={800}
                    animationEasing="ease-out"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {distributionBySector.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Segunda fila: Gráficos de barras */}
        <div className="stats-row">
          <div className="stat-card">
            <h3>Carga de Trabajo por Operario</h3>
            {workloadByOperator.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workloadByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Órdenes" fill="#a855f7" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>

          <div className="stat-card">
            <h3>Movimientos por Usuario</h3>
            {movementsByUser.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={movementsByUser}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Movimientos" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>

          <div className="stat-card">
            <h3>Tiempo Promedio de Reacción por Usuario</h3>
            {reactionTimeByUser.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reactionTimeByUser}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Tiempo Promedio (horas)" fill="#38bdf8" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Tercera fila: Tiempo promedio por estado y por operario */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Tiempo Promedio por Estado (Detección de Cuellos de Botella)</h3>
            {avgTimeByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={avgTimeByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Tiempo Promedio (días)" fill="#f97316" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Tiempo Promedio por Tipo de Orden</h3>
            <p className="stat-subtitle">Días desde creación a última actualización</p>
            {avgCycleByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={avgCycleByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Promedio (días)" fill="#60a5fa" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Tiempo Promedio por Operario</h3>
            <p className="stat-subtitle">Días desde creación a última actualización</p>
            {avgCycleByOperator.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={avgCycleByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                <Bar dataKey="Promedio (días)" fill="#34d399" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Cuarta fila: Tablas */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Registro de Actividad Cronológico</h3>
            <div className="table-container">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>FECHA Y HORA</th>
                    <th>USUARIO</th>
                    <th>N° OP</th>
                    <th>MOVIMIENTO</th>
                  </tr>
                </thead>
                <tbody>
                  {chronologicalActivity.map((item, index) => (
                    <tr key={index}>
                      <td>{item.fechaHora}</td>
                      <td>{item.usuario || '-'}</td>
                      <td>{item.opNumber}</td>
                      <td>{item.movimiento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quinta fila: Fichas estancadas */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3 className="stalled-title">Informe de Fichas Estancadas (&gt; 3 días en el mismo estado)</h3>
            <div className="stalled-list">
              {stalledTasks.length === 0 ? (
                <p className="no-stalled">✅ No hay fichas estancadas</p>
              ) : (
                <ul>
                  {stalledTasks.map((task, index) => (
                    <li key={index}>
                      <strong>OP #{task.opNumber}</strong> ({task.client}
                      {task.sector && ` - ${task.sector}`}) - Atascada en{' '}
                      <strong>{task.status}</strong> por <strong>{task.daysStalled} días</strong>.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Sexta fila: Métricas Avanzadas - Lead/Cycle Time por Estado */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Lead/Cycle Time por Estado (p50/p90)</h3>
            <p className="stat-subtitle">Tiempo en días: mediana (p50) y percentil 90 (p90)</p>
            {leadCycleTimeByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={leadCycleTimeByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="p50" fill="#60a5fa" name="Mediana (p50)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                  <Bar dataKey="p90" fill="#f97316" name="Percentil 90 (p90)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                  <Bar dataKey="promedio" fill="#34d399" name="Promedio" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Séptima fila: Lead/Cycle Time por Operario */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>Lead/Cycle Time por Operario (p50/p90)</h3>
            <p className="stat-subtitle">Tiempo en días: mediana (p50) y percentil 90 (p90)</p>
            {leadCycleTimeByOperator.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={leadCycleTimeByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="p50" fill="#60a5fa" name="Mediana (p50)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                  <Bar dataKey="p90" fill="#f97316" name="Percentil 90 (p90)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                  <Bar dataKey="promedio" fill="#34d399" name="Promedio" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Octava fila: Aging WIP y Throughput */}
        <div className="stats-row">
          <div className="stat-card">
            <h3>Aging WIP (Work In Progress)</h3>
            <p className="stat-subtitle">Distribución de tareas por tiempo en estado actual</p>
            {agingWIP.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agingWIP}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#a855f7" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>

          <div className="stat-card">
            <h3>Throughput Comparativo</h3>
            <p className="stat-subtitle">Tareas completadas: período actual vs anterior</p>
            {throughputComparison ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#e5ecf5', marginBottom: '10px' }}>
                  {throughputComparison.current}
                </div>
                <div style={{ fontSize: '1rem', color: '#c7d0dd', marginBottom: '20px' }}>
                  Período actual
                </div>
                <div style={{ fontSize: '1.2rem', color: '#c7d0dd', marginBottom: '10px' }}>
                  Período anterior: <strong>{throughputComparison.previous}</strong>
                </div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 'bold',
                  color: throughputComparison.trend === 'up' ? '#22c55e' : 
                         throughputComparison.trend === 'down' ? '#ef4444' : '#9ca3af',
                  marginTop: '20px'
                }}>
                  {throughputComparison.change > 0 ? '↑' : throughputComparison.change < 0 ? '↓' : '→'} 
                  {' '}
                  {Math.abs(throughputComparison.change).toFixed(1)}%
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Novena fila: SLA Compliance */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>SLA Compliance (vs Fecha de Compromiso)</h3>
            <p className="stat-subtitle">Cumplimiento de fechas de entrega</p>
            {slaCompliance ? (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                  <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.2rem', color: '#c7d0dd', marginBottom: '5px' }}>Tasa de Cumplimiento</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: slaCompliance.complianceRate >= 80 ? '#22c55e' : slaCompliance.complianceRate >= 60 ? '#f59e0b' : '#ef4444' }}>
                      {slaCompliance.complianceRate.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.2rem', color: '#c7d0dd', marginBottom: '5px' }}>A Tiempo</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>
                      {slaCompliance.onTime}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.2rem', color: '#c7d0dd', marginBottom: '5px' }}>Retrasadas</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                      {slaCompliance.late}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.2rem', color: '#c7d0dd', marginBottom: '5px' }}>Desviación Promedio</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: slaCompliance.avgDeviation <= 0 ? '#22c55e' : '#ef4444' }}>
                      {slaCompliance.avgDeviation.toFixed(1)} días
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '5px' }}>p50 Desviación</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#e5ecf5' }}>
                      {slaCompliance.p50Deviation.toFixed(1)} días
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '5px' }}>p90 Desviación</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#e5ecf5' }}>
                      {slaCompliance.p90Deviation.toFixed(1)} días
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '5px' }}>Sin Fecha</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#9ca3af' }}>
                      {slaCompliance.noDueDate}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Décima fila: WIP por Estado con Alertas */}
        <div className="stats-row">
          <div className="stat-card full-width">
            <h3>WIP por Estado (Work In Progress)</h3>
            <p className="stat-subtitle">Cantidad de tareas en progreso vs límites establecidos</p>
            {wipByStatus.length > 0 ? (
              <div className="table-container">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>ESTADO</th>
                      <th>WIP ACTUAL</th>
                      <th>LÍMITE</th>
                      <th>UTILIZACIÓN</th>
                      <th>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wipByStatus.map((item, index) => (
                      <tr key={index} style={item.isOverLimit ? { background: 'rgba(239, 68, 68, 0.1)' } : {}}>
                        <td>{item.name}</td>
                        <td style={{ fontWeight: 'bold', color: item.isOverLimit ? '#ef4444' : '#e5ecf5' }}>
                          {item.count}
                        </td>
                        <td>{item.limit}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ 
                              flex: 1, 
                              height: '20px', 
                              background: 'rgba(255, 255, 255, 0.1)', 
                              borderRadius: '10px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(item.utilization, 100)}%`,
                                height: '100%',
                                background: item.utilization > 100 
                                  ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                                  : item.utilization > 80
                                  ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                                  : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                transition: 'width 0.3s'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.9rem', color: '#c7d0dd' }}>
                              {item.utilization.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          {item.isOverLimit ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ SOBRE LÍMITE</span>
                          ) : item.utilization > 80 ? (
                            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚡ ALTA</span>
                          ) : (
                            <span style={{ color: '#22c55e' }}>✓ OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsPage

