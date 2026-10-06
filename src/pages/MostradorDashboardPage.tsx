import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CLIENTES_BUSCAR, CLIENTES_DASHBOARD } from '../utils/clientesRoutes'
import { VENTAS, ventasConVentaId, ventasNuevaVenta } from '../utils/ventasRoutes'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import RegistrarAtencionModal from '../components/RegistrarAtencionModal'
import type { OrdenTrabajo, Venta, PedidoClienteRecord } from '../types/api'
import { supabase } from '../services/supabaseClient'
import { getArgentinaDateString, isoToArgentinaDateKey } from '../utils/dateUtils'
import { idVendedorParaConsulta } from '../utils/ventasCajaScope'
import { HeaderNavGlyph, type HeaderGlyphId, type HeaderGlyphTone } from '../components/HeaderNavGlyph'
import './MostradorDashboardPage.css'

function NavTile({
  title,
  desc,
  badge,
  glyph,
  tone = 'slate',
  onClick
}: {
  title: string
  desc?: string
  badge?: number
  glyph: HeaderGlyphId
  tone?: HeaderGlyphTone
  onClick: () => void
}) {
  return (
    <button type="button" className="md-nav-tile" onClick={onClick}>
      <span className="md-nav-tile__glyph" data-tone={tone} aria-hidden>
        <HeaderNavGlyph id={glyph} size={18} />
      </span>
      <span className="md-nav-tile__body">
        <strong>{title}</strong>
        {desc ? <span className="md-nav-tile__desc">{desc}</span> : null}
      </span>
      {badge != null && badge > 0 ? <span className="md-nav-tile__badge">{badge}</span> : null}
    </button>
  )
}

type TipoAtencion = 'virtual' | 'consulta' | 'venta'
type Atencion = {
  id: number
  cliente_id?: number
  cliente_nombre: string
  tipo: TipoAtencion
  orden_id?: number
  usuario_id: number
  usuario_nombre: string
  timestamp: string
  notas?: string
}

/**
 * Suma días a una fecha civil YYYY-MM-DD sin depender del huso del navegador (coherente con getArgentinaDateString).
 */
function addCalendarDaysToYMD(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const da = parseInt(m[3], 10)
  const u = new Date(Date.UTC(y, mo, da))
  u.setUTCDate(u.getUTCDate() + deltaDays)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
}

/** Día calendario en Argentina para fecha_venta (misma lógica que getArgentinaDateString para "hoy"). */
function diaCalendarioArgentinaDeFechaVenta(fechaVenta: string | undefined | null): string {
  if (fechaVenta == null || String(fechaVenta).trim() === '') return ''
  return isoToArgentinaDateKey(String(fechaVenta).trim())
}

/** Solo dashboard mostrador: ajusta tipos raros del RPC sin tocar `obtenerVentas` global. */
function normalizarVentaDashboard(row: unknown): Venta | null {
  if (row == null || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const vt = r.valor_total
  const numTotal =
    vt == null || vt === ''
      ? 0
      : typeof vt === 'number'
        ? vt
        : Number(String(vt).replace(',', '.'))
  const fv = r.fecha_venta
  const fechaVenta =
    fv != null && String(fv).trim() !== ''
      ? String(fv).trim()
      : r.created_at != null
        ? String(r.created_at)
        : ''
  return {
    ...(r as unknown as Venta),
    id: Number(r.id),
    valor_total: Number.isFinite(numTotal) ? numTotal : 0,
    fecha_venta: fechaVenta
  }
}

const MostradorDashboardPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isPresupuestos, usuario, nombreVisible, canAccessTotemImpresionPanel } = useAuth()
  const idVendedorScope = idVendedorParaConsulta(isAdmin, isPresupuestos, usuario?.id)
  const [ordenesCreadasCount, setOrdenesCreadasCount] = useState(0)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [registrandoRapido, setRegistrandoRapido] = useState(false)
  const handleRegistrarAtencionSuccess = async () => {
    await loadAtencionesHoy()
    if (isAdmin) {
      // Recalcular órdenes creadas hoy antes de cargar métricas
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data) {
          const hoy = new Date()
          hoy.setHours(0, 0, 0, 0)
          const creadasHoy = ordenesResponse.data.filter((orden) => {
            if (!orden.fecha_creacion) return false
            const fechaCreacion = new Date(orden.fecha_creacion)
            fechaCreacion.setHours(0, 0, 0, 0)
            return fechaCreacion.getTime() === hoy.getTime()
          })
          await loadMetricas(creadasHoy.length)
        } else {
          await loadMetricas(ordenesCreadasCount)
        }
      } catch (error) {
        console.error('Error recalculando métricas:', error)
        await loadMetricas(ordenesCreadasCount)
      }
    }
  }
  const [loading, setLoading] = useState(true)
  const [ordenesListas, setOrdenesListas] = useState<OrdenTrabajo[]>([])
  const [ordenesPendientesHoy, setOrdenesPendientesHoy] = useState<OrdenTrabajo[]>([])
  const [atencionesHoy, setAtencionesHoy] = useState<Atencion[]>([])
  const [, setOrdenesCreadasHoy] = useState<OrdenTrabajo[]>([])
  const [showRegistrarAtencion, setShowRegistrarAtencion] = useState(false)
  const [datosGraficos, setDatosGraficos] = useState({
    atencionesPorDia: [] as Array<{ fecha: string; virtual: number; consulta: number; venta: number; total: number }>,
    distribucionTipos: [] as Array<{ name: string; value: number; color: string }>,
    ordenesPorDia: [] as Array<{ fecha: string; creadas: number; entregadas: number }>
  })
  
  // Métricas (solo admin)
  const [metricas, setMetricas] = useState({
    totalAtenciones: 0,
    atencionesVirtuales: 0,
    consultas: 0,
    ventasConcretadas: 0,
    ordenesCreadas: 0,
    ordenesEntregadas: 0
  })

  // Pedidos del portal de clientes (con mensajes)
  const [pedidosClientes, setPedidosClientes] = useState<(PedidoClienteRecord & { cliente?: { nombre?: string; empresa?: string } })[]>([])

  // CRM de Ventas → resumen; venta rápida unificada en /ventas
  const [ventasRecientes, setVentasRecientes] = useState<Venta[]>([])
  const [estadisticasVentas, setEstadisticasVentas] = useState({
    totalHoy: 0,
    ingresosHoy: 0,
    ventasPendientes: 0,
    ingresosPendientes: 0
  })

  const loadAtencionesHoy = useCallback(async () => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyInicio = hoy.toISOString()
      const hoyFin = new Date(hoy)
      hoyFin.setHours(23, 59, 59, 999)
      const hoyFinISO = hoyFin.toISOString()

      const response = await apiService.obtenerAtencionesMostrador(hoyInicio, hoyFinISO)
      
      if (response.success && response.data) {
        const atencionesHoy: Atencion[] = response.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
        setAtencionesHoy(atencionesHoy)
      } else {
        console.error('Error obteniendo atenciones:', response.error)
        setAtencionesHoy([])
      }
    } catch (error) {
      console.error('Error cargando atenciones:', error)
      setAtencionesHoy([])
    }
  }, [])

  const loadMetricas = useCallback(async (ordenesCreadasCountParam: number = 0) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const hoyInicio = hoy.toISOString()
      const hoyFin = new Date(hoy)
      hoyFin.setHours(23, 59, 59, 999)
      const hoyFinISO = hoyFin.toISOString()

      const atencionesResponse = await apiService.obtenerAtencionesMostrador(hoyInicio, hoyFinISO)
      let atencionesHoy: Atencion[] = []
      
      if (atencionesResponse.success && atencionesResponse.data) {
        atencionesHoy = atencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      const sieteDiasAtras = new Date()
      sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7)
      sieteDiasAtras.setHours(0, 0, 0, 0)
      const todasAtencionesResponse = await apiService.obtenerAtencionesMostrador(
        sieteDiasAtras.toISOString(),
        undefined
      )
      let todasAtenciones: Atencion[] = []
      
      if (todasAtencionesResponse.success && todasAtencionesResponse.data) {
        todasAtenciones = todasAtencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      const fechas = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        return d
      }).reverse()

      const atencionesPorDia = fechas.map((fecha) => {
        const fechaISO = fecha.toISOString().slice(0, 10)
        const items = todasAtenciones.filter((a) => a.timestamp.slice(0, 10) === fechaISO)
        const virtual = items.filter((a) => a.tipo === 'virtual').length
        const consulta = items.filter((a) => a.tipo === 'consulta').length
        const venta = items.filter((a) => a.tipo === 'venta').length
        return {
          fecha: fechaISO,
          virtual,
          consulta,
          venta,
          total: virtual + consulta + venta
        }
      })

      const distribucionTipos = [
        { name: 'Virtual', value: atencionesHoy.filter((a) => a.tipo === 'virtual').length, color: '#8b5cf6' },
        { name: 'Consulta', value: atencionesHoy.filter((a) => a.tipo === 'consulta').length, color: '#f59e0b' },
        { name: 'Venta', value: atencionesHoy.filter((a) => a.tipo === 'venta').length, color: '#10b981' }
      ].filter((item) => item.value > 0)

      const ordenesPorDia = fechas.map((fecha) => {
        const fechaISO = fecha.toISOString().slice(0, 10)
        return {
          fecha: fechaISO,
          creadas: 0,
          entregadas: 0
        }
      })

      setDatosGraficos({
        atencionesPorDia,
        distribucionTipos,
        ordenesPorDia
      })

      const metricasHoy = {
        totalAtenciones: atencionesHoy.length,
        atencionesVirtuales: atencionesHoy.filter((a) => a.tipo === 'virtual').length,
        consultas: atencionesHoy.filter((a) => a.tipo === 'consulta').length,
        ventasConcretadas: atencionesHoy.filter((a) => a.tipo === 'venta').length,
        ordenesCreadas: ordenesCreadasCountParam,
        ordenesEntregadas: ordenesListas.length
      }

      setMetricas(metricasHoy)
    } catch (error) {
      console.error('Error cargando métricas:', error)
    }
  }, [ordenesListas.length])

  const loadVentasData = useCallback(async () => {
    const hoyStr = getArgentinaDateString()
    const desdeStr = addCalendarDaysToYMD(hoyStr, -62)

    try {
      let ventasResponse = await apiService.obtenerVentas(idVendedorScope, desdeStr, hoyStr)
      if (!ventasResponse.success) {
        ventasResponse = await apiService.obtenerVentas(idVendedorScope)
      }
      if (
        ventasResponse.success &&
        (!ventasResponse.data || ventasResponse.data.length === 0)
      ) {
        const sinFecha = await apiService.obtenerVentas(idVendedorScope)
        if (sinFecha.success && sinFecha.data && sinFecha.data.length > 0) {
          ventasResponse = sinFecha
        }
      }

      if (ventasResponse.success && ventasResponse.data) {
        const ventasLista = ventasResponse.data
          .map(normalizarVentaDashboard)
          .filter((v): v is Venta => v != null)

        const ventasOrdenadasTodas = [...ventasLista].sort((a, b) => {
          const ta = Date.parse(String(a.fecha_venta))
          const tb = Date.parse(String(b.fecha_venta))
          const sa = Number.isFinite(ta) ? ta : 0
          const sb = Number.isFinite(tb) ? tb : 0
          if (sb !== sa) return sb - sa
          return (Number(b.id) || 0) - (Number(a.id) || 0)
        })

        const delDia = ventasLista.filter((v) => {
          const key = diaCalendarioArgentinaDeFechaVenta(v.fecha_venta)
          return key === hoyStr
        })
        const ventasOrdenadasHoy = [...delDia].sort((a, b) => {
          const ta = Date.parse(String(a.fecha_venta))
          const tb = Date.parse(String(b.fecha_venta))
          const sa = Number.isFinite(ta) ? ta : 0
          const sb = Number.isFinite(tb) ? tb : 0
          if (sb !== sa) return sb - sa
          return (Number(b.id) || 0) - (Number(a.id) || 0)
        })

        // Si hoy no hay ventas, mostrar las últimas 5 recientes igual (para que "Ventas" no quede vacío).
        setVentasRecientes((ventasOrdenadasHoy.length > 0 ? ventasOrdenadasHoy : ventasOrdenadasTodas).slice(0, 5))

        const totalHoy = delDia.length
        const ingresosHoy = delDia.reduce((sum, v) => sum + (Number(v.valor_total) || 0), 0)
        const ventasPendientes = delDia.filter((v) => v.estado_pago === 'Pendiente')
        const ingresosPendientes = ventasPendientes.reduce(
          (sum, v) => sum + (Number(v.valor_total) || 0),
          0
        )

        setEstadisticasVentas({
          totalHoy,
          ingresosHoy,
          ventasPendientes: ventasPendientes.length,
          ingresosPendientes
        })
      } else {
        setVentasRecientes([])
        setEstadisticasVentas({
          totalHoy: 0,
          ingresosHoy: 0,
          ventasPendientes: 0,
          ingresosPendientes: 0
        })
      }
    } catch (error) {
      console.error('Error cargando ventas:', error)
      setVentasRecientes([])
      setEstadisticasVentas({
        totalHoy: 0,
        ingresosHoy: 0,
        ventasPendientes: 0,
        ingresosPendientes: 0
      })
    }
  }, [idVendedorScope])

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    let ordenesCreadasHoyCount = 0
    try {
      const ordenesResponse = await apiService.getOrdenes()

      if (ordenesResponse.success && ordenesResponse.data) {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)

        const listas = ordenesResponse.data.filter(
          (orden) =>
            !orden.entregado &&
            orden.estado !== 'Entregado o Instalado' &&
            (orden.estado === 'Finalizado en Taller' || orden.estado === 'Almacén de Entrega')
        )
        setOrdenesListas(listas)

        const pendientesHoy = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_entrega) return false
          const fechaEntrega = new Date(orden.fecha_entrega)
          fechaEntrega.setHours(0, 0, 0, 0)
          return (
            fechaEntrega.getTime() === hoy.getTime() && orden.estado !== 'Entregado o Instalado'
          )
        })
        setOrdenesPendientesHoy(pendientesHoy)

        const creadasHoy = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_creacion) return false
          const fechaCreacion = new Date(orden.fecha_creacion)
          fechaCreacion.setHours(0, 0, 0, 0)
          return fechaCreacion.getTime() === hoy.getTime()
        })
        setOrdenesCreadasHoy(creadasHoy)
        setOrdenesCreadasCount(creadasHoy.length)
        ordenesCreadasHoyCount = creadasHoy.length

      } else {
        setOrdenesListas([])
        setOrdenesPendientesHoy([])
        setOrdenesCreadasHoy([])
        setOrdenesCreadasCount(0)
      }

      await loadAtencionesHoy()
      await loadVentasData()

      const pedidosResp = await apiService.getPedidosPendientes()
      if (pedidosResp.success && pedidosResp.data) {
        setPedidosClientes(pedidosResp.data)
      }

      if (isAdmin) {
        await loadMetricas(ordenesCreadasHoyCount)
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, loadAtencionesHoy, loadMetricas, loadVentasData])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const registrarAtencionRapida = useCallback(
    async (tipo: TipoAtencion) => {
      if (!usuario) {
        alert('Debes estar autenticado para registrar la atención')
        return
      }
      setRegistrandoRapido(true)
      try {
        const resp = await apiService.crearAtencionMostrador({
          cliente_nombre: 'Cliente mostrador',
          tipo,
          usuario_id: Number(usuario.id),
          usuario_nombre: nombreVisible || 'Mostrador',
          notas: 'Registro rápido'
        })
        if (!resp.success) {
          throw new Error(resp.error || 'No se pudo registrar')
        }
        await handleRegistrarAtencionSuccess()
        setShowFabMenu(false)
      } catch (error) {
        console.error('Error en registro rápido:', error)
        alert('No se pudo registrar la atención rápida')
      } finally {
        setRegistrandoRapido(false)
      }
    },
    [usuario, handleRegistrarAtencionSuccess]
  )

  // Atajos rápidos de atención (Venta rápida usa el atajo global V).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!usuario || loading) return
      if (showRegistrarAtencion) return

      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      if (e.altKey && e.key === '1') {
        e.preventDefault()
        registrarAtencionRapida('virtual')
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault()
        registrarAtencionRapida('consulta')
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault()
        registrarAtencionRapida('venta')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    usuario,
    loading,
    showRegistrarAtencion,
    registrarAtencionRapida,
    navigate
  ])

  // Suscripción en tiempo real a atenciones_mostrador
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`realtime:atenciones_mostrador`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'atenciones_mostrador' },
        async () => {
          await loadAtencionesHoy()
          if (isAdmin) {
            await loadMetricas(ordenesCreadasCount)
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) supabase?.removeChannel(channel)
    }
  }, [isAdmin, loadAtencionesHoy, loadMetricas, ordenesCreadasCount])

  /*
  const loadMetricasLegacy = async (ordenesCreadasCount: number = 0) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      // Obtener atenciones de hoy desde la base de datos
      const hoyInicio = hoy.toISOString()
      const hoyFin = new Date(hoy)
      hoyFin.setHours(23, 59, 59, 999)
      const hoyFinISO = hoyFin.toISOString()

      const atencionesResponse = await apiService.obtenerAtencionesMostrador(hoyInicio, hoyFinISO)
      let atencionesHoy: Atencion[] = []
      
      if (atencionesResponse.success && atencionesResponse.data) {
        atencionesHoy = atencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      // Obtener todas las atenciones de los últimos 7 días para gráficos
      const sieteDiasAtras = new Date()
      sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7)
      sieteDiasAtras.setHours(0, 0, 0, 0)
      const todasAtencionesResponse = await apiService.obtenerAtencionesMostrador(
        sieteDiasAtras.toISOString(),
        undefined
      )
      let todasAtenciones: Atencion[] = []
      
      if (todasAtencionesResponse.success && todasAtencionesResponse.data) {
        todasAtenciones = todasAtencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      // Calcular órdenes entregadas hoy
      let ordenesEntregadasHoy = 0
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data && Array.isArray(ordenesResponse.data)) {
          ordenesEntregadasHoy = ordenesResponse.data.filter((orden) => {
            if (!orden.fecha_entrega) return false
            try {
              const fechaEntrega = new Date(orden.fecha_entrega)
              fechaEntrega.setHours(0, 0, 0, 0)
              return fechaEntrega.getTime() === hoy.getTime() && orden.estado === 'Entregado o Instalado'
            } catch (e) {
              console.warn('Error procesando fecha de entrega:', e, orden)
              return false
            }
          }).length
        }
      } catch (error) {
        console.error('Error obteniendo órdenes entregadas:', error)
      }

      setMetricas({
        totalAtenciones: atencionesHoy.length,
        atencionesVirtuales: atencionesHoy.filter(a => a.tipo === 'virtual').length,
        consultas: atencionesHoy.filter(a => a.tipo === 'consulta').length,
        ventasConcretadas: atencionesHoy.filter(a => a.tipo === 'venta').length,
        ordenesCreadas: ordenesCreadasCount,
        ordenesEntregadas: ordenesEntregadasHoy
      })

      // Preparar datos para gráficos (últimos 7 días)
      const ultimos7Dias = []
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() - i)
        fecha.setHours(0, 0, 0, 0)
        
        const atencionesDia = todasAtenciones.filter((atencion) => {
          try {
            const fechaAtencion = new Date(atencion.timestamp)
            fechaAtencion.setHours(0, 0, 0, 0)
            return fechaAtencion.getTime() === fecha.getTime()
          } catch (e) {
            return false
          }
        })

        ultimos7Dias.push({
          fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          virtual: atencionesDia.filter(a => a.tipo === 'virtual').length,
          consulta: atencionesDia.filter(a => a.tipo === 'consulta').length,
          venta: atencionesDia.filter(a => a.tipo === 'venta').length,
          total: atencionesDia.length
        })
      }

      // Distribución de tipos de atención
      const distribucionTipos = [
        { name: 'Virtual', value: atencionesHoy.filter(a => a.tipo === 'virtual').length, color: '#8b5cf6' },
        { name: 'Consulta', value: atencionesHoy.filter(a => a.tipo === 'consulta').length, color: '#f59e0b' },
        { name: 'Venta', value: atencionesHoy.filter(a => a.tipo === 'venta').length, color: '#10b981' }
      ].filter(item => item.value > 0)

      // Órdenes por día (últimos 7 días)
      let ordenesPorDia = []
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data && Array.isArray(ordenesResponse.data)) {
          for (let i = 6; i >= 0; i--) {
            const fecha = new Date()
            fecha.setDate(fecha.getDate() - i)
            fecha.setHours(0, 0, 0, 0)
            
            const ordenesDia = ordenesResponse.data.filter((orden) => {
              if (!orden.fecha_creacion) return false
              try {
                const fechaCreacion = new Date(orden.fecha_creacion)
                fechaCreacion.setHours(0, 0, 0, 0)
                return fechaCreacion.getTime() === fecha.getTime()
              } catch (e) {
                return false
              }
            })

            const entregadasDia = ordenesResponse.data.filter((orden) => {
              if (!orden.fecha_entrega) return false
              try {
                const fechaEntrega = new Date(orden.fecha_entrega)
                fechaEntrega.setHours(0, 0, 0, 0)
                return fechaEntrega.getTime() === fecha.getTime() && orden.estado === 'Entregado o Instalado'
              } catch (e) {
                return false
              }
            })

            ordenesPorDia.push({
              fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
              creadas: ordenesDia.length,
              entregadas: entregadasDia.length
            })
          }
        } else {
          // Si no hay datos, crear array vacío con fechas
          for (let i = 6; i >= 0; i--) {
            const fecha = new Date()
            fecha.setDate(fecha.getDate() - i)
            ordenesPorDia.push({
              fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
              creadas: 0,
              entregadas: 0
            })
          }
        }
      } catch (error) {
        console.error('Error obteniendo órdenes para gráficos:', error)
        // Crear array vacío con fechas
        for (let i = 6; i >= 0; i--) {
          const fecha = new Date()
          fecha.setDate(fecha.getDate() - i)
          ordenesPorDia.push({
            fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
            creadas: 0,
            entregadas: 0
          })
        }
      }

      setDatosGraficos({
        atencionesPorDia: ultimos7Dias,
        distribucionTipos,
        ordenesPorDia
      })
    } catch (error) {
      console.error('Error cargando métricas:', error)
    }
  }
  */

  // Función para registrar atenciones (se usará cuando implementemos el registro)
  // Se exportará o usará cuando se implemente el formulario de registro
  // const registrarAtencion = async (tipo: TipoAtencion, clienteNombre: string, ordenId?: number, notas?: string) => {
  //   if (!usuario) return
  //
  //   const nuevaAtencion: Atencion = {
  //     id: Date.now(),
  //     cliente_nombre: clienteNombre,
  //     tipo,
  //     orden_id: ordenId,
  //     usuario_id: usuario.id,
  //     usuario_nombre: usuario.nombre,
  //     timestamp: new Date().toISOString(),
  //     notas
  //   }
  //
  //   // Guardar en localStorage (temporal hasta crear tabla en Supabase)
  //   const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
  //   const todasAtenciones: Atencion[] = atencionesGuardadas 
  //     ? JSON.parse(atencionesGuardadas) 
  //     : []
  //   
  //   todasAtenciones.push(nuevaAtencion)
  //   localStorage.setItem('atenciones_mostrador', JSON.stringify(todasAtenciones))
  //
  //   await loadAtencionesHoy()
  //   if (isAdmin) {
  //     await loadMetricas()
  //   }
  // }

  if (loading) {
    return (
      <div className="mostrador-dashboard-page">
        <div className="md-loading">
          <div className="md-spinner" />
          <p>Cargando dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mostrador-dashboard-page">
      <header className="md-hero">
        <div className="md-hero__copy">
          <p className="md-kicker">Mostrador</p>
          <h1>{nombreVisible ? `Hola, ${nombreVisible}` : 'Dashboard de mostrador'}</h1>
        </div>
        <section className="md-dock" aria-label="Acciones principales">
          <button type="button" className="md-dock-btn" data-tone="sky" onClick={() => navigate('/')}>
            <span className="md-dock-btn__glyph" aria-hidden>
              <HeaderNavGlyph id="kanban" size={18} />
            </span>
            <span className="md-dock-btn__copy">
              <strong>Nueva orden</strong>
              <small>Tablero</small>
            </span>
          </button>
          <button
            type="button"
            className="md-dock-btn"
            data-tone="emerald"
            onClick={() => navigate('/mostrador/ordenes-listas')}
          >
            <span className="md-dock-btn__glyph" aria-hidden>
              <HeaderNavGlyph id="box" size={18} />
            </span>
            <span className="md-dock-btn__copy">
              <strong>Órdenes listas</strong>
              <small>{ordenesListas.length} para retirar</small>
            </span>
            {ordenesListas.length > 0 && <span className="md-dock-btn__badge">{ordenesListas.length}</span>}
          </button>
          <button type="button" className="md-dock-btn" data-tone="cyan" onClick={() => navigate(CLIENTES_BUSCAR)}>
            <span className="md-dock-btn__glyph" aria-hidden>
              <HeaderNavGlyph id="users" size={18} />
            </span>
            <span className="md-dock-btn__copy">
              <strong>Buscar cliente</strong>
              <small>DNI, nombre o CC</small>
            </span>
          </button>
          <button type="button" className="md-dock-btn" data-tone="orange" onClick={() => navigate(ventasNuevaVenta())}>
            <span className="md-dock-btn__glyph" aria-hidden>
              <HeaderNavGlyph id="receipt" size={18} />
            </span>
            <span className="md-dock-btn__copy">
              <strong>Venta rápida</strong>
              <small>Atajo V</small>
            </span>
          </button>
        </section>
      </header>

      {isAdmin && (
        <section className="md-kpi-row" aria-label="Métricas del día">
          <div className="md-kpi">
            <strong>{metricas.totalAtenciones}</strong>
            <span>Atendidos</span>
          </div>
          <div className="md-kpi">
            <strong>{metricas.ventasConcretadas}</strong>
            <span>Ventas</span>
          </div>
          <div className="md-kpi">
            <strong>{metricas.ordenesCreadas}</strong>
            <span>OP creadas</span>
          </div>
          <div className="md-kpi">
            <strong>{metricas.ordenesEntregadas}</strong>
            <span>Entregadas</span>
          </div>
        </section>
      )}

      <div className="md-board" aria-label="Tablero del día">
        <section className="md-col">
          <header className="md-col__head">
            <h2>Listas</h2>
            <span className="md-col__count">{ordenesListas.length}</span>
            <button type="button" className="md-col__more" onClick={() => navigate('/mostrador/ordenes-listas')}>
              Ver
            </button>
          </header>
          {ordenesListas.length === 0 ? (
            <p className="md-col__empty">Nada para retirar</p>
          ) : (
            ordenesListas.slice(0, 5).map((orden) => (
              <article key={orden.id} className="md-card md-card--ready">
                <div className="md-card__top">
                  <strong>OP {orden.numero_op}</strong>
                  <span className="md-pill md-pill--ok">Listo</span>
                </div>
                <p>{orden.cliente}</p>
                <button type="button" className="md-card__action" onClick={() => navigate(`/mostrador/entrega/${orden.id}`)}>
                  Entregar
                </button>
              </article>
            ))
          )}
        </section>

        <section className="md-col">
          <header className="md-col__head">
            <h2>Hoy</h2>
            <span className="md-col__count">{ordenesPendientesHoy.length}</span>
          </header>
          {ordenesPendientesHoy.length === 0 ? (
            <p className="md-col__empty">Sin entregas programadas</p>
          ) : (
            ordenesPendientesHoy.slice(0, 5).map((orden) => (
              <article key={orden.id} className="md-card md-card--pending">
                <div className="md-card__top">
                  <strong>OP {orden.numero_op}</strong>
                  <span className="md-pill md-pill--warn">Hoy</span>
                </div>
                <p>{orden.cliente}</p>
                {orden.fecha_entrega && (
                  <small>
                    {new Date(orden.fecha_entrega).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </small>
                )}
              </article>
            ))
          )}
        </section>

        <section className="md-col">
          <header className="md-col__head">
            <h2>Ventas</h2>
            <span className="md-col__count">{estadisticasVentas.totalHoy}</span>
            <button type="button" className="md-col__more" onClick={() => navigate(VENTAS)}>
              Ver
            </button>
          </header>
          <div className="md-col__kpis">
            <span>${estadisticasVentas.ingresosHoy.toLocaleString('es-AR')} cobrado</span>
            <span>{estadisticasVentas.ventasPendientes} pendientes</span>
          </div>
          {ventasRecientes.length === 0 ? (
            <p className="md-col__empty">Sin ventas hoy</p>
          ) : (
            ventasRecientes.slice(0, 4).map((venta) => (
              <article
                key={venta.id}
                className="md-card md-card--venta"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (venta.numero_op) {
                    navigate(`/op/${encodeURIComponent(venta.numero_op)}`)
                    return
                  }
                  navigate(ventasConVentaId(venta.id))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (venta.numero_op) navigate(`/op/${encodeURIComponent(venta.numero_op)}`)
                    else navigate(ventasConVentaId(venta.id))
                  }
                }}
              >
                <div className="md-card__top">
                  <strong>{venta.cliente_nombre}</strong>
                  <span
                    className={`md-pill md-pill--${
                      venta.estado_pago === 'Pagado' ? 'ok' : venta.estado_pago === 'Pendiente' ? 'warn' : 'info'
                    }`}
                  >
                    {venta.estado_pago}
                  </span>
                </div>
                <p>
                  $
                  {Number(venta.valor_total ?? 0).toLocaleString('es-AR', {
                    maximumFractionDigits: 0
                  })}
                  {venta.metodo_pago ? ` · ${venta.metodo_pago}` : ''}
                </p>
                <small>{venta.numero_op ? `OP ${venta.numero_op}` : venta.numero_venta}</small>
              </article>
            ))
          )}
        </section>

        <section className="md-col">
          <header className="md-col__head">
            <h2>Portal</h2>
            <span className="md-col__count">{pedidosClientes.length}</span>
            <button type="button" className="md-col__more" onClick={() => navigate('/clientes-web/pedidos')}>
              Ver
            </button>
          </header>
          {pedidosClientes.length === 0 ? (
            <p className="md-col__empty">Sin pedidos web</p>
          ) : (
            pedidosClientes.slice(0, 5).map((pedido) => (
              <article
                key={pedido.id}
                className="md-card md-card--portal"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/clientes-web/pedidos/${pedido.id}/detalle`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/clientes-web/pedidos/${pedido.id}/detalle`)
                  }
                }}
              >
                <div className="md-card__top">
                  <strong>{pedido.numero_pedido}</strong>
                  <span
                    className={`md-pill md-pill--${pedido.estado === 'pendiente' ? 'warn' : pedido.estado === 'en_revision' ? 'info' : 'ok'}`}
                  >
                    {pedido.estado === 'pendiente' ? 'Pendiente' : pedido.estado === 'en_revision' ? 'Revisión' : 'Ok'}
                  </span>
                </div>
                <p>
                  {(pedido as { cliente?: { nombre?: string; empresa?: string } }).cliente?.nombre ||
                    (pedido as { cliente?: { empresa?: string } }).cliente?.empresa ||
                    'Cliente'}
                </p>
              </article>
            ))
          )}
        </section>
      </div>

      <section className="md-tools-section">
        <h2 className="md-tools-title">Más herramientas</h2>
        <div className="md-nav-grid">
          <NavTile
            title="Clientes"
            desc="Buscar, VIP y CC"
            glyph="users"
            tone="sky"
            onClick={() => navigate(CLIENTES_DASHBOARD)}
          />
          <NavTile
            title="Calendario"
            desc="Entregas del mes"
            glyph="calendar"
            tone="indigo"
            onClick={() => navigate('/mostrador/calendario')}
          />
          <NavTile
            title="Atención"
            desc="Cola y tótem"
            glyph="phone"
            tone="emerald"
            onClick={() => navigate('/atencion-publico')}
          />
          <NavTile
            title="Pedidos web"
            desc="Portal de clientes"
            glyph="globe"
            tone="violet"
            badge={pedidosClientes.length}
            onClick={() => navigate('/clientes-web/pedidos')}
          />
          <NavTile
            title="Ventas"
            desc="Pipeline y cobros"
            glyph="receipt"
            tone="orange"
            onClick={() => navigate(VENTAS)}
          />
          {canAccessTotemImpresionPanel && (
            <NavTile
              title="Tótem"
              desc="Impresión"
              glyph="printer"
              tone="slate"
              onClick={() => navigate('/impresoras/totem')}
            />
          )}
          {isAdmin && (
            <NavTile
              title="Reportes"
              desc="Estadísticas"
              glyph="chart"
              tone="cyan"
              onClick={() => navigate('/mostrador/reportes')}
            />
          )}
        </div>
      </section>

      {/* Modal de Registrar Atención */}
      {showRegistrarAtencion && (
        <RegistrarAtencionModal
          onClose={() => setShowRegistrarAtencion(false)}
          onSuccess={handleRegistrarAtencionSuccess}
        />
      )}

      {/* Acciones flotantes compactas */}
      <div className="fab-container">
        <div className="fab-stack">
          <button
            type="button"
            className={`fab-button fab-secondary${showFabMenu ? ' fab-button--open' : ''}`}
            onClick={() => setShowFabMenu((prev) => !prev)}
            title="Registrar atención (Alt+1 Virtual, Alt+2 Consulta, Alt+3 Venta)"
            aria-expanded={showFabMenu}
            aria-haspopup="menu"
            aria-label="Registrar atención"
          >
            <span className="fab-button__icon" aria-hidden>
              <HeaderNavGlyph id="note" size={16} />
            </span>
            <span className="fab-button__label">Atención</span>
          </button>
        </div>
        {showFabMenu && (
          <div className="fab-menu" role="menu" onMouseLeave={() => setShowFabMenu(false)}>
            <p className="fab-hint">Atajos: Alt+1 virtual · Alt+2 consulta · Alt+3 venta</p>
            <button
              className="fab-option virtual"
              onClick={() => registrarAtencionRapida('virtual')}
              disabled={registrandoRapido}
            >
              💻 Virtual
            </button>
            <button
              className="fab-option consulta"
              onClick={() => registrarAtencionRapida('consulta')}
              disabled={registrandoRapido}
            >
              ❓ Consulta
            </button>
            <button
              className="fab-option venta"
              onClick={() => registrarAtencionRapida('venta')}
              disabled={registrandoRapido}
            >
              💰 Venta Concretada
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MostradorDashboardPage

