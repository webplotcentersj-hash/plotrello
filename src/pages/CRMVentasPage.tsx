import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { OportunidadVenta, Venta, OrdenTrabajo, VentaItem, ClienteRecord, PresupuestoClienteRecord } from '../types/api'
import type { ArticuloStock } from '../types/pedidos'
import { formatArgentinaDate } from '../utils/dateUtils'
import { exportarVentasPDF, exportarVentasExcel, exportarOportunidadesPDF, generarFacturaRemitoPDF } from '../utils/crmExportUtils'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import BuscadorClientesModal from '../components/BuscadorClientesModal'
import './CRMVentasPage.css'

const CRMVentasPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'oportunidades' | 'ventas' | 'presupuestos'>('oportunidades')
  
  // Oportunidades
  const [oportunidades, setOportunidades] = useState<OportunidadVenta[]>([])
  const [oportunidadesFiltradas, setOportunidadesFiltradas] = useState<OportunidadVenta[]>([])
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas')
  const [busquedaOportunidad, setBusquedaOportunidad] = useState('')
  const [mostrarModalOportunidad, setMostrarModalOportunidad] = useState(false)
  const [oportunidadEditando, setOportunidadEditando] = useState<OportunidadVenta | null>(null)
  
  // Ventas
  const [ventas, setVentas] = useState<Venta[]>([])
  const [ventasFiltradas, setVentasFiltradas] = useState<Venta[]>([])
  const [filtroEstadoPago, setFiltroEstadoPago] = useState<string>('todos')
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>('todos')
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos')
  const [busquedaVenta, setBusquedaVenta] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [estadisticas, setEstadisticas] = useState({
    totalVentas: 0,
    totalIngresos: 0,
    ventasPagadas: 0,
    ingresosPagados: 0,
    ventasPendientes: 0,
    ingresosPendientes: 0,
    ticketPromedio: 0,
    // KPIs avanzados
    tasaConversion: 0,
    tiempoPromedioCierre: 0,
    valorPromedioOportunidad: 0,
    oportunidadesActivas: 0,
    oportunidadesCerradas: 0,
    oportunidadesPerdidas: 0,
    valorTotalOportunidades: 0,
    // Presupuestos
    totalPresupuestos: 0,
    presupuestosEnviados: 0,
    presupuestosAceptados: 0,
    presupuestosRechazados: 0,
    valorTotalPresupuestos: 0,
    tasaAceptacionPresupuestos: 0
  })
  
  // Búsqueda de clientes
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteRecord | null>(null)
  
  // Formularios
  const [formOportunidad, setFormOportunidad] = useState({
    cliente_nombre: '',
    cliente_telefono: '',
    cliente_email: '',
    cliente_dni_cuit: '',
    cliente_empresa: '',
    cliente_direccion: '',
    descripcion: '',
    valor_estimado: '',
    probabilidad_cierre: 50,
    etapa: 'Prospecto' as 'Prospecto' | 'Calificación' | 'Propuesta' | 'Negociación' | 'Cerrado' | 'Perdido',
    fecha_cierre_estimada: '',
    observaciones: '',
    id_cliente: null as number | null
  })
  
  const [mostrarModalSeguimiento, setMostrarModalSeguimiento] = useState(false)
  const [oportunidadParaSeguimiento, setOportunidadParaSeguimiento] = useState<OportunidadVenta | null>(null)
  const [formSeguimiento, setFormSeguimiento] = useState({
    tipo_seguimiento: 'Llamada' as const,
    descripcion: '',
    proxima_accion: '',
    fecha_proxima_accion: ''
  })
  
  const [mostrarModalConvertir, setMostrarModalConvertir] = useState(false)
  const [oportunidadParaConvertir, setOportunidadParaConvertir] = useState<OportunidadVenta | null>(null)
  const [formVenta, setFormVenta] = useState({
    id_op: '',
    numero_op: '',
    valor_total: '',
    metodo_pago: 'Efectivo' as const,
    estado_pago: 'Pendiente' as const,
    fecha_venta: new Date().toISOString().split('T')[0],
    observaciones: ''
  })
  const [ordenesDisponibles, setOrdenesDisponibles] = useState<OrdenTrabajo[]>([])
  const [itemsVenta, setItemsVenta] = useState<Array<{
    id_articulo_stock?: number
    codigo_articulo?: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento: number
    observaciones?: string
  }>>([])
  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [articulosEncontrados, setArticulosEncontrados] = useState<ArticuloStock[]>([])
  const [buscandoArticulos, setBuscandoArticulos] = useState(false)
  const [mostrarModalEditarVenta, setMostrarModalEditarVenta] = useState(false)
  const [ventaEditando, setVentaEditando] = useState<Venta | null>(null)
  const [itemsVentaEditando, setItemsVentaEditando] = useState<VentaItem[]>([])
  const [busquedaArticuloEditar, setBusquedaArticuloEditar] = useState('')
  const [articulosEncontradosEditar, setArticulosEncontradosEditar] = useState<ArticuloStock[]>([])
  const [buscandoArticulosEditar, setBuscandoArticulosEditar] = useState(false)
  const [dropdownDocumentosAbierto, setDropdownDocumentosAbierto] = useState<number | null>(null)
  const [mostrarBuscadorClientes, setMostrarBuscadorClientes] = useState(false)
  
  // Presupuestos
  type PresupuestoConCliente = PresupuestoClienteRecord & {
    cliente_nombre?: string
    cliente_empresa?: string
    cliente_email?: string
  }
  const [presupuestos, setPresupuestos] = useState<PresupuestoConCliente[]>([])
  const [presupuestosFiltrados, setPresupuestosFiltrados] = useState<PresupuestoConCliente[]>([])
  const [filtroEstadoPresupuesto, setFiltroEstadoPresupuesto] = useState<string>('todos')
  const [busquedaPresupuesto, setBusquedaPresupuesto] = useState('')
  const [fechaDesdePresupuesto, setFechaDesdePresupuesto] = useState('')
  const [fechaHastaPresupuesto, setFechaHastaPresupuesto] = useState('')

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.export-dropdown')) {
        setDropdownDocumentosAbierto(null)
      }
    }

    if (dropdownDocumentosAbierto !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [dropdownDocumentosAbierto])

  // Verificar permisos
  useEffect(() => {
    if (authLoading) return // Esperar a que termine de cargar el usuario
    
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    
    // Solo cargar datos si tiene permisos
    if (isAdmin || isMostrador) {
      loadData()
    }
  }, [isAdmin, isMostrador, navigate, authLoading])

  // Escuchar eventos de venta creada desde otros componentes
  useEffect(() => {
    const handleVentaCreada = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log('Evento de venta creada recibido:', customEvent.detail)
      console.log('Recargando CRM...')
      // Esperar un momento para asegurar que la venta se guardó en la BD
      setTimeout(() => {
        loadData()
      }, 500)
    }

    window.addEventListener('venta-creada', handleVentaCreada)
    
    return () => {
      window.removeEventListener('venta-creada', handleVentaCreada)
    }
  }, []) // loadData no necesita estar en dependencias porque es estable

  // Función para verificar y crear recordatorios
  const verificarRecordatorios = async (oportunidades: OportunidadVenta[], ventas: Venta[]) => {
    if (!usuario) return

    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyISO = hoy.toISOString().split('T')[0]
      
      // Verificar oportunidades próximas a vencer (próximos 7 días)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + 7)
      const fechaLimiteISO = fechaLimite.toISOString().split('T')[0]

      for (const opp of oportunidades) {
        if (!opp.activo || opp.etapa === 'Cerrado' || opp.etapa === 'Perdido') continue

        // Verificar si hay seguimientos pendientes (con fecha_proxima_accion en el pasado o hoy)
        if (opp.seguimientos && opp.seguimientos.length > 0) {
          const seguimientosPendientes = opp.seguimientos.filter(seg => {
            if (!seg.fecha_proxima_accion) return false
            const fechaAccion = new Date(seg.fecha_proxima_accion)
            fechaAccion.setHours(0, 0, 0, 0)
            return fechaAccion <= hoy
          })

          if (seguimientosPendientes.length > 0 && opp.id_vendedor === usuario.id) {
            await apiService.createNotification({
              user_id: usuario.id,
              title: `⏰ Seguimiento Pendiente: ${opp.cliente_nombre}`,
              description: `Tienes ${seguimientosPendientes.length} seguimiento(s) pendiente(s) para la oportunidad ${opp.numero_oportunidad}`,
              type: 'warning'
            })
          }
        }

        // Verificar oportunidades próximas a vencer
        if (opp.fecha_cierre_estimada && opp.id_vendedor === usuario.id) {
          const fechaCierre = new Date(opp.fecha_cierre_estimada)
          fechaCierre.setHours(0, 0, 0, 0)
          const fechaCierreISO = fechaCierre.toISOString().split('T')[0]
          
          if (fechaCierreISO >= hoyISO && fechaCierreISO <= fechaLimiteISO) {
            const diasRestantes = Math.ceil((fechaCierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
            await apiService.createNotification({
              user_id: usuario.id,
              title: `📅 Oportunidad Próxima a Vencer: ${opp.cliente_nombre}`,
              description: `La oportunidad ${opp.numero_oportunidad} vence en ${diasRestantes} día(s). Valor estimado: $${(opp.valor_estimado || 0).toLocaleString()}`,
              type: diasRestantes <= 2 ? 'error' : 'warning',
              oportunidad_id: opp.id
            })
          }
        }
      }

      // Verificar ventas pendientes de pago (más de 7 días)
      const fechaLimitePago = new Date()
      fechaLimitePago.setDate(fechaLimitePago.getDate() - 7)
      const fechaLimitePagoISO = fechaLimitePago.toISOString().split('T')[0]

      for (const venta of ventas) {
        if (venta.estado_pago === 'Pendiente' && venta.id_vendedor === usuario.id) {
          const fechaVenta = new Date(venta.fecha_venta)
          fechaVenta.setHours(0, 0, 0, 0)
          const fechaVentaISO = fechaVenta.toISOString().split('T')[0]
          
          if (fechaVentaISO <= fechaLimitePagoISO) {
            const diasPendiente = Math.ceil((hoy.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24))
            await apiService.createNotification({
              user_id: usuario.id,
              title: `💰 Venta Pendiente de Pago: ${venta.cliente_nombre}`,
              description: `La venta ${venta.numero_venta} lleva ${diasPendiente} día(s) pendiente de pago. Monto: $${venta.valor_total.toLocaleString()}`,
              type: 'warning',
              venta_id: venta.id
            })
          }
        }
      }
    } catch (error) {
      console.error('Error verificando recordatorios:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Inicializar estadísticas de presupuestos (se actualizarán después de cargar)
      let totalPresupuestos = 0
      let presupuestosEnviados = 0
      let presupuestosAceptados = 0
      let presupuestosRechazados = 0
      let valorTotalPresupuestos = 0
      let tasaAceptacionPresupuestos = 0

      // Cargar oportunidades
      const oppResponse = await apiService.obtenerOportunidadesVenta()
      if (oppResponse.success && oppResponse.data) {
        setOportunidades(oppResponse.data)
        setOportunidadesFiltradas(oppResponse.data)
      }
      
      // Cargar ventas (sin filtros para obtener todas)
      const ventasResponse = await apiService.obtenerVentas()
      if (ventasResponse.success && ventasResponse.data) {
        console.log('Ventas cargadas en CRM:', ventasResponse.data.length)
        setVentas(ventasResponse.data)
        setVentasFiltradas(ventasResponse.data)
        
        // Calcular estadísticas básicas de ventas
        const totalVentas = ventasResponse.data.length
        const totalIngresos = ventasResponse.data.reduce((sum, v) => sum + v.valor_total, 0)
        const ventasPagadas = ventasResponse.data.filter(v => v.estado_pago === 'Pagado')
        const ingresosPagados = ventasPagadas.reduce((sum, v) => sum + v.valor_total, 0)
        const ventasPendientes = ventasResponse.data.filter(v => v.estado_pago === 'Pendiente')
        const ingresosPendientes = ventasPendientes.reduce((sum, v) => sum + v.valor_total, 0)
        const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0
        
        // Calcular KPIs avanzados de oportunidades
        const oportunidadesActivas = oppResponse.data?.filter(o => o.activo && o.etapa !== 'Cerrado' && o.etapa !== 'Perdido').length || 0
        const oportunidadesCerradas = oppResponse.data?.filter(o => o.etapa === 'Cerrado').length || 0
        const oportunidadesPerdidas = oppResponse.data?.filter(o => o.etapa === 'Perdido').length || 0
        const totalOportunidades = oppResponse.data?.length || 0
        const tasaConversion = totalOportunidades > 0 ? (oportunidadesCerradas / totalOportunidades) * 100 : 0
        
        // Calcular tiempo promedio de cierre (días entre creación y cierre)
        const oportunidadesConFecha = oppResponse.data?.filter(o => o.etapa === 'Cerrado' && o.created_at && o.updated_at) || []
        let tiempoTotalCierre = 0
        oportunidadesConFecha.forEach(opp => {
          const fechaCreacion = new Date(opp.created_at)
          const fechaCierre = new Date(opp.updated_at)
          const dias = Math.ceil((fechaCierre.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24))
          tiempoTotalCierre += dias
        })
        const tiempoPromedioCierre = oportunidadesConFecha.length > 0 ? tiempoTotalCierre / oportunidadesConFecha.length : 0
        
        // Valor promedio de oportunidad
        const oportunidadesConValor = oppResponse.data?.filter(o => o.valor_estimado && o.valor_estimado > 0) || []
        const valorTotalOportunidades = oportunidadesConValor.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
        const valorPromedioOportunidad = oportunidadesConValor.length > 0 ? valorTotalOportunidades / oportunidadesConValor.length : 0

        setEstadisticas({
          totalVentas,
          totalIngresos,
          ventasPagadas: ventasPagadas.length,
          ingresosPagados,
          ventasPendientes: ventasPendientes.length,
          ingresosPendientes,
          ticketPromedio,
          tasaConversion,
          tiempoPromedioCierre,
          valorPromedioOportunidad,
          oportunidadesActivas,
          oportunidadesCerradas,
          oportunidadesPerdidas,
          valorTotalOportunidades,
          totalPresupuestos,
          presupuestosEnviados,
          presupuestosAceptados,
          presupuestosRechazados,
          valorTotalPresupuestos,
          tasaAceptacionPresupuestos
        })
      } else {
        console.error('Error cargando ventas:', ventasResponse.error)
        setVentas([])
        setVentasFiltradas([])
        setEstadisticas({
          totalVentas: 0,
          totalIngresos: 0,
          ventasPagadas: 0,
          ingresosPagados: 0,
          ventasPendientes: 0,
          ingresosPendientes: 0,
          ticketPromedio: 0,
          tasaConversion: 0,
          tiempoPromedioCierre: 0,
          valorPromedioOportunidad: 0,
          oportunidadesActivas: 0,
          oportunidadesCerradas: 0,
          oportunidadesPerdidas: 0,
          valorTotalOportunidades: 0,
          totalPresupuestos: 0,
          presupuestosEnviados: 0,
          presupuestosAceptados: 0,
          presupuestosRechazados: 0,
          valorTotalPresupuestos: 0,
          tasaAceptacionPresupuestos: 0
        })
      }
      
      // Cargar presupuestos de ventas presenciales (no online, no compras)
      // Nota: getPresupuestosClientesAdmin devuelve presupuestos de clientes web
      // Para ventas presenciales, necesitaríamos una API diferente o filtrar
      const presupuestosResponse = await apiService.getPresupuestosClientesAdmin()
      if (presupuestosResponse.success && presupuestosResponse.data) {
        // Filtrar solo presupuestos de ventas presenciales (no clientes web)
        // Por ahora usamos todos, pero se puede filtrar por algún campo que identifique ventas presenciales
        setPresupuestos(presupuestosResponse.data)
        setPresupuestosFiltrados(presupuestosResponse.data)
        
        // Calcular estadísticas de presupuestos
        totalPresupuestos = presupuestosResponse.data.length
        presupuestosEnviados = presupuestosResponse.data.filter(p => p.estado === 'enviado').length
        presupuestosAceptados = presupuestosResponse.data.filter(p => p.estado === 'aceptado').length
        presupuestosRechazados = presupuestosResponse.data.filter(p => p.estado === 'rechazado').length
        valorTotalPresupuestos = presupuestosResponse.data.reduce((sum, p) => sum + (p.precio_total || 0), 0)
        tasaAceptacionPresupuestos = (presupuestosEnviados + presupuestosAceptados + presupuestosRechazados) > 0 
          ? (presupuestosAceptados / (presupuestosEnviados + presupuestosAceptados + presupuestosRechazados)) * 100 
          : 0
        
        // Actualizar estadísticas con datos de presupuestos
        setEstadisticas(prev => ({
          ...prev,
          totalPresupuestos,
          presupuestosEnviados,
          presupuestosAceptados,
          presupuestosRechazados,
          valorTotalPresupuestos,
          tasaAceptacionPresupuestos
        }))
      } else {
        console.error('Error cargando presupuestos:', presupuestosResponse.error)
        setPresupuestos([])
        setPresupuestosFiltrados([])
      }
      
      // Cargar órdenes disponibles
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        setOrdenesDisponibles(ordenesResponse.data)
      }

      // Verificar recordatorios después de cargar los datos
      if (oppResponse.success && oppResponse.data && ventasResponse.success && ventasResponse.data) {
        await verificarRecordatorios(oppResponse.data, ventasResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtros oportunidades
  useEffect(() => {
    let filtradas = oportunidades
    
    if (filtroEtapa !== 'todas') {
      filtradas = filtradas.filter(o => o.etapa === filtroEtapa)
    }
    
    if (busquedaOportunidad) {
      const busqueda = busquedaOportunidad.toLowerCase()
      filtradas = filtradas.filter(o =>
        o.cliente_nombre.toLowerCase().includes(busqueda) ||
        o.numero_oportunidad.toLowerCase().includes(busqueda) ||
        o.cliente_empresa?.toLowerCase().includes(busqueda) ||
        o.numero_op?.toLowerCase().includes(busqueda)
      )
    }
    
    setOportunidadesFiltradas(filtradas)
  }, [oportunidades, filtroEtapa, busquedaOportunidad])

  // Filtros ventas
  useEffect(() => {
    let filtradas = ventas
    
    // Filtro por estado de pago
    if (filtroEstadoPago !== 'todos') {
      filtradas = filtradas.filter(v => v.estado_pago === filtroEstadoPago)
    }
    
    // Filtro por método de pago
    if (filtroMetodoPago !== 'todos') {
      filtradas = filtradas.filter(v => v.metodo_pago === filtroMetodoPago)
    }
    
    // Filtro por vendedor
    if (filtroVendedor !== 'todos') {
      filtradas = filtradas.filter(v => v.nombre_vendedor === filtroVendedor)
    }
    
    // Filtro por fecha desde
    if (fechaDesde) {
      filtradas = filtradas.filter(v => v.fecha_venta >= fechaDesde)
    }
    
    // Filtro por fecha hasta
    if (fechaHasta) {
      filtradas = filtradas.filter(v => v.fecha_venta <= fechaHasta)
    }
    
    // Búsqueda de texto
    if (busquedaVenta) {
      const busqueda = busquedaVenta.toLowerCase().trim()
      if (busqueda) {
        filtradas = filtradas.filter(v => {
          // Buscar en cliente_nombre
          if (v.cliente_nombre?.toLowerCase().includes(busqueda)) return true
          
          // Buscar en numero_venta
          if (v.numero_venta?.toLowerCase().includes(busqueda)) return true
          
          // Buscar en numero_op (si existe)
          if (v.numero_op && v.numero_op.toLowerCase().includes(busqueda)) return true
          
          // Buscar en cliente_empresa
          if (v.cliente_empresa && v.cliente_empresa.toLowerCase().includes(busqueda)) return true
          
          // Buscar en cliente_telefono
          if (v.cliente_telefono && v.cliente_telefono.toLowerCase().includes(busqueda)) return true
          
          // Buscar en cliente_email
          if (v.cliente_email && v.cliente_email.toLowerCase().includes(busqueda)) return true
          
          // Buscar en cliente_dni_cuit
          if (v.cliente_dni_cuit && v.cliente_dni_cuit.toLowerCase().includes(busqueda)) return true
          
          // Buscar en nombre_vendedor
          if (v.nombre_vendedor && v.nombre_vendedor.toLowerCase().includes(busqueda)) return true
          
          // Buscar en metodo_pago
          if (v.metodo_pago && v.metodo_pago.toLowerCase().includes(busqueda)) return true
          
          // Buscar en observaciones
          if (v.observaciones && v.observaciones.toLowerCase().includes(busqueda)) return true
          
          // Buscar en items de la venta (descripción de artículos)
          if (v.items && v.items.length > 0) {
            const encontradoEnItems = v.items.some(item => 
              item.descripcion?.toLowerCase().includes(busqueda) ||
              item.codigo_articulo?.toLowerCase().includes(busqueda) ||
              item.observaciones?.toLowerCase().includes(busqueda)
            )
            if (encontradoEnItems) return true
          }
          
          // Buscar en valor_total (convertir a string)
          if (v.valor_total && v.valor_total.toString().includes(busqueda)) return true
          
          return false
        })
      }
    }
    
    setVentasFiltradas(filtradas)
  }, [ventas, filtroEstadoPago, filtroMetodoPago, filtroVendedor, fechaDesde, fechaHasta, busquedaVenta])

  // Filtros presupuestos
  useEffect(() => {
    let filtrados = presupuestos
    
    // Filtro por estado
    if (filtroEstadoPresupuesto !== 'todos') {
      filtrados = filtrados.filter(p => p.estado === filtroEstadoPresupuesto)
    }
    
    // Filtro por fecha desde
    if (fechaDesdePresupuesto) {
      filtrados = filtrados.filter(p => {
        const fechaCreacion = p.fecha_creacion?.split('T')[0] || ''
        return fechaCreacion >= fechaDesdePresupuesto
      })
    }
    
    // Filtro por fecha hasta
    if (fechaHastaPresupuesto) {
      filtrados = filtrados.filter(p => {
        const fechaCreacion = p.fecha_creacion?.split('T')[0] || ''
        return fechaCreacion <= fechaHastaPresupuesto
      })
    }
    
    // Búsqueda de texto
    if (busquedaPresupuesto) {
      const busqueda = busquedaPresupuesto.toLowerCase().trim()
      if (busqueda) {
        filtrados = filtrados.filter(p => {
          if (p.numero_presupuesto?.toLowerCase().includes(busqueda)) return true
          if (p.cliente_nombre?.toLowerCase().includes(busqueda)) return true
          if (p.cliente_empresa?.toLowerCase().includes(busqueda)) return true
          if (p.cliente_email?.toLowerCase().includes(busqueda)) return true
          if (p.observaciones_cliente?.toLowerCase().includes(busqueda)) return true
          if (p.observaciones_internas?.toLowerCase().includes(busqueda)) return true
          if (p.precio_total?.toString().includes(busqueda)) return true
          return false
        })
      }
    }
    
    setPresupuestosFiltrados(filtrados)
  }, [presupuestos, filtroEstadoPresupuesto, fechaDesdePresupuesto, fechaHastaPresupuesto, busquedaPresupuesto])

  // Buscar clientes
  useEffect(() => {
    if (busquedaCliente.trim().length < 1) {
      setClientesEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        const response = await apiService.buscarClientes(busquedaCliente.trim())
        if (response.success && response.data) {
          setClientesEncontrados(response.data)
        } else {
          setClientesEncontrados([])
        }
      } catch (error) {
        console.error('Error buscando clientes:', error)
        setClientesEncontrados([])
      } finally {
        setBuscandoClientes(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [busquedaCliente])

  const seleccionarCliente = (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    setBusquedaCliente(cliente.nombre)
    setClientesEncontrados([])
    setFormOportunidad({
      ...formOportunidad,
      cliente_nombre: cliente.nombre,
      cliente_telefono: cliente.telefono || '',
      cliente_email: cliente.email || '',
      cliente_dni_cuit: cliente.dni_cuit || '',
      cliente_empresa: cliente.empresa || '',
      cliente_direccion: cliente.direccion || '',
      id_cliente: cliente.id
    })
  }

  const handleCrearOportunidad = () => {
    setOportunidadEditando(null)
    setClienteSeleccionado(null)
    setBusquedaCliente('')
    setFormOportunidad({
      cliente_nombre: '',
      cliente_telefono: '',
      cliente_email: '',
      cliente_dni_cuit: '',
      cliente_empresa: '',
      cliente_direccion: '',
      descripcion: '',
      valor_estimado: '',
      probabilidad_cierre: 50,
      etapa: 'Prospecto',
      fecha_cierre_estimada: '',
      observaciones: '',
      id_cliente: null
    })
    setMostrarModalOportunidad(true)
  }

  const handleEditarOportunidad = (oportunidad: OportunidadVenta) => {
    setOportunidadEditando(oportunidad)
    setClienteSeleccionado(null)
    setBusquedaCliente(oportunidad.cliente_nombre)
    setFormOportunidad({
      cliente_nombre: oportunidad.cliente_nombre,
      cliente_telefono: oportunidad.cliente_telefono || '',
      cliente_email: oportunidad.cliente_email || '',
      cliente_dni_cuit: oportunidad.cliente_dni_cuit || '',
      cliente_empresa: oportunidad.cliente_empresa || '',
      cliente_direccion: oportunidad.cliente_direccion || '',
      descripcion: oportunidad.descripcion || '',
      valor_estimado: oportunidad.valor_estimado?.toString() || '',
      probabilidad_cierre: oportunidad.probabilidad_cierre,
      etapa: oportunidad.etapa,
      fecha_cierre_estimada: oportunidad.fecha_cierre_estimada || '',
      observaciones: oportunidad.observaciones || '',
      id_cliente: null // Se puede buscar y asociar después
    })
    setMostrarModalOportunidad(true)
  }

  const handleGuardarOportunidad = async () => {
    if (!usuario) return
    
    if (!formOportunidad.cliente_nombre.trim()) {
      alert('El nombre del cliente es obligatorio')
      return
    }

    try {
      if (oportunidadEditando) {
        // Actualizar
        const response = await apiService.actualizarOportunidadVenta(oportunidadEditando.id, {
          cliente_nombre: formOportunidad.cliente_nombre,
          cliente_telefono: formOportunidad.cliente_telefono || undefined,
          cliente_email: formOportunidad.cliente_email || undefined,
          cliente_dni_cuit: formOportunidad.cliente_dni_cuit || undefined,
          cliente_empresa: formOportunidad.cliente_empresa || undefined,
          cliente_direccion: formOportunidad.cliente_direccion || undefined,
          descripcion: formOportunidad.descripcion || undefined,
          valor_estimado: formOportunidad.valor_estimado ? parseFloat(formOportunidad.valor_estimado) : undefined,
          probabilidad_cierre: formOportunidad.probabilidad_cierre,
          etapa: formOportunidad.etapa,
          fecha_cierre_estimada: formOportunidad.fecha_cierre_estimada || undefined,
          observaciones: formOportunidad.observaciones || undefined
        })
        
        if (response.success) {
          await loadData()
          setMostrarModalOportunidad(false)
        } else {
          alert('Error al actualizar oportunidad: ' + response.error)
        }
      } else {
        // Buscar o crear cliente si no está seleccionado
        let idClienteFinal = formOportunidad.id_cliente
        if (!idClienteFinal && formOportunidad.cliente_nombre.trim()) {
          const clienteResponse = await apiService.buscarOCrearCliente({
            nombre: formOportunidad.cliente_nombre,
            dni_cuit: formOportunidad.cliente_dni_cuit || undefined,
            telefono: formOportunidad.cliente_telefono || undefined,
            email: formOportunidad.cliente_email || undefined,
            direccion: formOportunidad.cliente_direccion || undefined
          })
          if (clienteResponse.success && clienteResponse.data) {
            idClienteFinal = clienteResponse.data.id
          }
        }

        // Crear
        const response = await apiService.crearOportunidadVenta({
          cliente_nombre: formOportunidad.cliente_nombre,
          cliente_telefono: formOportunidad.cliente_telefono || undefined,
          cliente_email: formOportunidad.cliente_email || undefined,
          cliente_dni_cuit: formOportunidad.cliente_dni_cuit || undefined,
          cliente_empresa: formOportunidad.cliente_empresa || undefined,
          cliente_direccion: formOportunidad.cliente_direccion || undefined,
          descripcion: formOportunidad.descripcion || undefined,
          valor_estimado: formOportunidad.valor_estimado ? parseFloat(formOportunidad.valor_estimado) : undefined,
          probabilidad_cierre: formOportunidad.probabilidad_cierre,
          etapa: formOportunidad.etapa,
          fecha_cierre_estimada: formOportunidad.fecha_cierre_estimada || undefined,
          id_vendedor: usuario.id,
          nombre_vendedor: usuario.nombre,
          observaciones: formOportunidad.observaciones || undefined,
          id_cliente: idClienteFinal || undefined
        })
        
        if (response.success) {
          await loadData()
          setMostrarModalOportunidad(false)
        } else {
          alert('Error al crear oportunidad: ' + response.error)
        }
      }
    } catch (error: any) {
      console.error('Error guardando oportunidad:', error)
      alert('Error al guardar oportunidad: ' + error.message)
    }
  }

  const handleAgregarSeguimiento = (oportunidad: OportunidadVenta) => {
    setOportunidadParaSeguimiento(oportunidad)
    setFormSeguimiento({
      tipo_seguimiento: 'Llamada',
      descripcion: '',
      proxima_accion: '',
      fecha_proxima_accion: ''
    })
    setMostrarModalSeguimiento(true)
  }

  const handleGuardarSeguimiento = async () => {
    if (!usuario || !oportunidadParaSeguimiento) return
    
    if (!formSeguimiento.descripcion.trim()) {
      alert('La descripción es obligatoria')
      return
    }

    try {
      const response = await apiService.crearSeguimientoVenta({
        id_oportunidad: oportunidadParaSeguimiento.id,
        tipo_seguimiento: formSeguimiento.tipo_seguimiento,
        descripcion: formSeguimiento.descripcion,
        proxima_accion: formSeguimiento.proxima_accion || undefined,
        fecha_proxima_accion: formSeguimiento.fecha_proxima_accion || undefined,
        id_usuario: usuario.id,
        nombre_usuario: usuario.nombre
      })
      
      if (response.success) {
        await loadData()
        setMostrarModalSeguimiento(false)
      } else {
        alert('Error al crear seguimiento: ' + response.error)
      }
    } catch (error: any) {
      console.error('Error guardando seguimiento:', error)
      alert('Error al guardar seguimiento: ' + error.message)
    }
  }

  const handleConvertirAVenta = (oportunidad: OportunidadVenta) => {
    setOportunidadParaConvertir(oportunidad)
    setFormVenta({
      id_op: '',
      numero_op: '',
      valor_total: oportunidad.valor_estimado?.toString() || '',
      metodo_pago: 'Efectivo',
      estado_pago: 'Pendiente',
      fecha_venta: new Date().toISOString().split('T')[0],
      observaciones: ''
    })
    setItemsVenta([])
    setBusquedaArticulo('')
    setArticulosEncontrados([])
    setMostrarModalConvertir(true)
  }

  const buscarArticulos = async () => {
    if (!busquedaArticulo.trim() || busquedaArticulo.trim().length < 2) {
      setArticulosEncontrados([])
      return
    }

    setBuscandoArticulos(true)
    try {
      const response = await apiService.getArticulosStock(busquedaArticulo.trim(), false)
      if (response.success && response.data) {
        setArticulosEncontrados(response.data)
      } else {
        setArticulosEncontrados([])
      }
    } catch (error) {
      console.error('Error buscando artículos:', error)
      setArticulosEncontrados([])
    } finally {
      setBuscandoArticulos(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      buscarArticulos()
    }, 500)

    return () => clearTimeout(timer)
  }, [busquedaArticulo])

  const agregarArticuloAVenta = (articulo: ArticuloStock) => {
    if (itemsVenta.some(item => item.id_articulo_stock === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const nuevoItem = {
      id_articulo_stock: articulo.id,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.descripcion,
      cantidad: 1,
      precio_unitario: articulo.precio || 0,
      descuento: 0,
      observaciones: articulo.stock !== null && articulo.stock <= 0 ? 'Stock agotado' : undefined
    }

    setItemsVenta([...itemsVenta, nuevoItem])
    setBusquedaArticulo('')
    setArticulosEncontrados([])
    calcularValorTotal([...itemsVenta, nuevoItem])
  }

  const eliminarItemVenta = (index: number) => {
    const nuevosItems = itemsVenta.filter((_, i) => i !== index)
    setItemsVenta(nuevosItems)
    calcularValorTotal(nuevosItems)
  }

  const actualizarItemVenta = (index: number, campo: string, valor: any) => {
    const nuevosItems = [...itemsVenta]
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor }
    
    // Recalcular precio_total si cambia cantidad, precio_unitario o descuento
    if (campo === 'cantidad' || campo === 'precio_unitario' || campo === 'descuento') {
      // No actualizamos precio_total directamente, se calcula en el backend
    }
    
    setItemsVenta(nuevosItems)
    calcularValorTotal(nuevosItems)
  }

  const calcularValorTotal = (items: typeof itemsVenta) => {
    const total = items.reduce((sum, item) => {
      const precioItem = (item.precio_unitario * item.cantidad) - item.descuento
      return sum + precioItem
    }, 0)
    setFormVenta(prev => ({ ...prev, valor_total: total.toFixed(2) }))
  }

  const handleEditarVenta = (venta: Venta) => {
    setVentaEditando(venta)
    setItemsVentaEditando(venta.items || [])
    setBusquedaArticuloEditar('')
    setArticulosEncontradosEditar([])
    setMostrarModalEditarVenta(true)
  }

  useEffect(() => {
    if (!mostrarModalEditarVenta) return
    
    const timer = setTimeout(() => {
      if (!busquedaArticuloEditar.trim() || busquedaArticuloEditar.trim().length < 2) {
        setArticulosEncontradosEditar([])
        return
      }

      setBuscandoArticulosEditar(true)
      apiService.getArticulosStock(busquedaArticuloEditar.trim(), false)
        .then(response => {
          if (response.success && response.data) {
            setArticulosEncontradosEditar(response.data)
          } else {
            setArticulosEncontradosEditar([])
          }
        })
        .catch(error => {
          console.error('Error buscando artículos:', error)
          setArticulosEncontradosEditar([])
        })
        .finally(() => {
          setBuscandoArticulosEditar(false)
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [busquedaArticuloEditar, mostrarModalEditarVenta])

  const agregarArticuloAVentaEditando = async (articulo: ArticuloStock) => {
    if (!ventaEditando) return
    
    if (itemsVentaEditando.some(item => item.id_articulo_stock === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    try {
      const response = await apiService.agregarItemVenta({
        id_venta: ventaEditando.id,
        id_articulo_stock: articulo.id,
        codigo_articulo: articulo.codigo || undefined,
        descripcion: articulo.descripcion,
        cantidad: 1,
        precio_unitario: articulo.precio || 0,
        descuento: 0,
        observaciones: articulo.stock !== null && articulo.stock <= 0 ? 'Stock agotado' : undefined
      })

      if (response.success) {
        await loadData()
        // Recargar la venta actualizada
        const ventasResponse = await apiService.obtenerVentas()
        if (ventasResponse.success && ventasResponse.data) {
          const ventaActualizada = ventasResponse.data.find(v => v.id === ventaEditando.id)
          if (ventaActualizada) {
            setVentaEditando(ventaActualizada)
            setItemsVentaEditando(ventaActualizada.items || [])
          }
        }
        setBusquedaArticuloEditar('')
        setArticulosEncontradosEditar([])
      } else {
        alert('Error al agregar item: ' + response.error)
      }
    } catch (error: any) {
      console.error('Error agregando artículo:', error)
      alert('Error al agregar artículo: ' + error.message)
    }
  }

  const eliminarItemVentaEditando = async (itemId: number) => {
    if (!ventaEditando) return

    if (!confirm('¿Estás seguro de eliminar este item?')) return

    try {
      const response = await apiService.eliminarItemVenta(itemId)
      if (response.success) {
        await loadData()
        // Recargar la venta actualizada
        const ventasResponse = await apiService.obtenerVentas()
        if (ventasResponse.success && ventasResponse.data) {
          const ventaActualizada = ventasResponse.data.find(v => v.id === ventaEditando.id)
          if (ventaActualizada) {
            setVentaEditando(ventaActualizada)
            setItemsVentaEditando(ventaActualizada.items || [])
          }
        }
      } else {
        alert('Error al eliminar item: ' + response.error)
      }
    } catch (error: any) {
      console.error('Error eliminando item:', error)
      alert('Error al eliminar item: ' + error.message)
    }
  }

  const actualizarEstadoPagoVenta = async (venta: Venta, nuevoEstado: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado') => {
    if (!supabase) {
      alert('Error: Supabase no está inicializado')
      return
    }

    try {
      const { error } = await supabase
        .from('ventas')
        .update({ estado_pago: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('id', venta.id)
        .select()
        .single()

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error('Error actualizando estado de pago:', error)
      alert('Error al actualizar estado de pago: ' + error.message)
    }
  }

  const handleConvertirVentaAOP = async (venta: Venta) => {
    if (!usuario) {
      alert('Debes estar autenticado para convertir la venta a OP')
      return
    }

    try {
      // Construir descripción con items de la venta
      let descripcion = `Venta: ${venta.numero_venta}\n`
      descripcion += `Cliente: ${venta.cliente_nombre}\n`
      if (venta.metodo_pago) {
        descripcion += `Condición: ${venta.metodo_pago}\n`
      }
      descripcion += `Estado de pago: ${venta.estado_pago}\n\n`
      descripcion += 'Items:\n'
      
      if (venta.items && venta.items.length > 0) {
        venta.items.forEach((item, index) => {
          descripcion += `${index + 1}. ${item.descripcion} - Cantidad: ${item.cantidad} - Precio: $${item.precio_unitario}\n`
        })
      }

      if (venta.observaciones) {
        descripcion += `\nObservaciones: ${venta.observaciones}`
      }

      // Crear la OP usando el número de venta como número de OP
      const ordenResponse = await apiService.createOrden({
        numero_op: venta.numero_venta, // Usar el número de venta como número de OP
        cliente: venta.cliente_nombre,
        dni_cuit: venta.cliente_dni_cuit || undefined,
        descripcion: descripcion,
        estado: 'Diseño Gráfico',
        prioridad: 'Normal',
        fecha_entrega: venta.fecha_venta,
        sector: 'Diseño Gráfico',
        sector_inicial: 'Diseño Gráfico',
        nombre_creador: usuario.nombre,
        telefono_cliente: venta.cliente_telefono || undefined,
        email_cliente: venta.cliente_email || undefined,
        direccion_cliente: venta.cliente_direccion || undefined
      })

      if (!ordenResponse.success || !ordenResponse.data) {
        throw new Error(ordenResponse.error || 'Error al crear OP')
      }

      // Actualizar la venta con el ID de la OP
      await apiService.actualizarVenta(venta.id, {
        id_op: ordenResponse.data.id,
        numero_op: ordenResponse.data.numero_op
      })

      alert(`Venta convertida a OP exitosamente: ${ordenResponse.data.numero_op}`)
      await loadData()
    } catch (error: any) {
      console.error('Error convirtiendo venta a OP:', error)
      alert('Error al convertir a OP: ' + error.message)
    }
  }

  const handleGuardarVenta = async () => {
    if (!usuario || !oportunidadParaConvertir) return
    
    if (!formVenta.numero_op.trim()) {
      alert('El número de OP es obligatorio')
      return
    }
    
    if (!formVenta.valor_total || parseFloat(formVenta.valor_total) <= 0) {
      alert('El valor total debe ser mayor a 0')
      return
    }

    // Buscar ID de la OP
    const orden = ordenesDisponibles.find(o => o.numero_op === formVenta.numero_op)
    if (!orden) {
      alert('No se encontró la OP especificada')
      return
    }

    try {
      // Crear venta
      const response = await apiService.crearVentaDesdeOportunidad({
        id_oportunidad: oportunidadParaConvertir.id,
        id_op: orden.id,
        numero_op: formVenta.numero_op,
        valor_total: parseFloat(formVenta.valor_total),
        metodo_pago: formVenta.metodo_pago,
        estado_pago: formVenta.estado_pago,
        fecha_venta: formVenta.fecha_venta,
        id_vendedor: usuario.id,
        nombre_vendedor: usuario.nombre,
        observaciones: formVenta.observaciones || undefined
      })
      
      if (response.success && response.data) {
        // Agregar items si hay
        if (itemsVenta.length > 0) {
          for (const item of itemsVenta) {
            await apiService.agregarItemVenta({
              id_venta: response.data.id,
              id_articulo_stock: item.id_articulo_stock,
              codigo_articulo: item.codigo_articulo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              descuento: item.descuento,
              observaciones: item.observaciones
            })
          }
        }
        
        await loadData()
        setMostrarModalConvertir(false)
        setActiveTab('ventas')
      } else {
        alert('Error al crear venta: ' + response.error)
      }
    } catch (error: any) {
      console.error('Error guardando venta:', error)
      alert('Error al guardar venta: ' + error.message)
    }
  }

  const getEtapaColor = (etapa: string) => {
    const colores: Record<string, string> = {
      'Prospecto': '#8b5cf6',
      'Calificación': '#3b82f6',
      'Propuesta': '#f59e0b',
      'Negociación': '#ef4444',
      'Cerrado': '#10b981',
      'Perdido': '#6b7280'
    }
    return colores[etapa] || '#6b7280'
  }

  const getEstadoPagoColor = (estado: string) => {
    const colores: Record<string, string> = {
      'Pendiente': '#f59e0b',
      'Parcial': '#3b82f6',
      'Pagado': '#10b981',
      'Cancelado': '#ef4444'
    }
    return colores[estado] || '#6b7280'
  }

  if (loading) {
    return (
      <div className="crm-ventas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando CRM de Ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="crm-ventas-page">
      <header className="crm-header">
        <div className="header-content">
          <h1>💼 CRM de Ventas</h1>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/')}>
              ← Volver al Tablero
            </button>
            {activeTab === 'oportunidades' && (
              <button className="btn-primary" onClick={handleCrearOportunidad}>
                ➕ Nueva Oportunidad
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                console.log('Navegando a reportes...')
                navigate('/crm-ventas/reportes')
              }}
            >
              📊 Ver Reportes
            </button>
            {activeTab === 'ventas' && ventasFiltradas.length > 0 && (
              <div className="export-dropdown">
                <button className="btn-secondary">
                  📥 Exportar
                </button>
                <div className="export-menu">
                  <button onClick={() => exportarVentasPDF(ventasFiltradas, { fechaDesde, fechaHasta, estadoPago: filtroEstadoPago })}>
                    📄 Exportar a PDF
                  </button>
                  <button onClick={() => exportarVentasExcel(ventasFiltradas, { fechaDesde, fechaHasta, estadoPago: filtroEstadoPago })}>
                    📊 Exportar a Excel
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'oportunidades' && oportunidadesFiltradas.length > 0 && (
              <button className="btn-secondary" onClick={() => exportarOportunidadesPDF(oportunidadesFiltradas)}>
                📄 Exportar PDF
              </button>
            )}
          </div>
        </div>
        
        {/* Estadísticas Rápidas */}
        <div className="metricas-grid" style={{ marginTop: '24px' }}>
          <div className="metrica-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="metrica-icon">💰</div>
            <div className="metrica-content">
              <h3>Total Ingresos</h3>
              <p className="metrica-valor">${estadisticas.totalIngresos.toLocaleString()}</p>
              <p className="metrica-subtitle">{estadisticas.totalVentas} ventas</p>
            </div>
          </div>
          <div className="metrica-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="metrica-icon">✅</div>
            <div className="metrica-content">
              <h3>Ingresos Pagados</h3>
              <p className="metrica-valor">${estadisticas.ingresosPagados.toLocaleString()}</p>
              <p className="metrica-subtitle">{estadisticas.ventasPagadas} ventas</p>
            </div>
          </div>
          <div className="metrica-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="metrica-icon">⏳</div>
            <div className="metrica-content">
              <h3>Ingresos Pendientes</h3>
              <p className="metrica-valor">${estadisticas.ingresosPendientes.toLocaleString()}</p>
              <p className="metrica-subtitle">{estadisticas.ventasPendientes} ventas</p>
            </div>
          </div>
          <div className="metrica-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="metrica-icon">📊</div>
            <div className="metrica-content">
              <h3>Ticket Promedio</h3>
              <p className="metrica-valor">${estadisticas.ticketPromedio.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</p>
              <p className="metrica-subtitle">Por venta</p>
            </div>
          </div>
          {activeTab === 'oportunidades' && (
            <>
              <div className="metrica-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                <div className="metrica-icon">🎯</div>
                <div className="metrica-content">
                  <h3>Tasa de Conversión</h3>
                  <p className="metrica-valor">{estadisticas.tasaConversion.toFixed(1)}%</p>
                  <p className="metrica-subtitle">{estadisticas.oportunidadesCerradas} cerradas</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #ec4899' }}>
                <div className="metrica-icon">⏱️</div>
                <div className="metrica-content">
                  <h3>Tiempo Promedio</h3>
                  <p className="metrica-valor">{estadisticas.tiempoPromedioCierre.toFixed(0)} días</p>
                  <p className="metrica-subtitle">Cierre de oportunidades</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="metrica-icon">💎</div>
                <div className="metrica-content">
                  <h3>Valor Promedio</h3>
                  <p className="metrica-valor">${estadisticas.valorPromedioOportunidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="metrica-subtitle">Por oportunidad</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="metrica-icon">📈</div>
                <div className="metrica-content">
                  <h3>Oportunidades Activas</h3>
                  <p className="metrica-valor">{estadisticas.oportunidadesActivas}</p>
                  <p className="metrica-subtitle">En proceso</p>
                </div>
              </div>
            </>
          )}
          {activeTab === 'presupuestos' && (
            <>
              <div className="metrica-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                <div className="metrica-icon">📄</div>
                <div className="metrica-content">
                  <h3>Total Presupuestos</h3>
                  <p className="metrica-valor">{estadisticas.totalPresupuestos}</p>
                  <p className="metrica-subtitle">Creados</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <div className="metrica-icon">📤</div>
                <div className="metrica-content">
                  <h3>Enviados</h3>
                  <p className="metrica-valor">{estadisticas.presupuestosEnviados}</p>
                  <p className="metrica-subtitle">A clientes</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="metrica-icon">✅</div>
                <div className="metrica-content">
                  <h3>Aceptados</h3>
                  <p className="metrica-valor">{estadisticas.presupuestosAceptados}</p>
                  <p className="metrica-subtitle">Aprobados</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <div className="metrica-icon">💰</div>
                <div className="metrica-content">
                  <h3>Valor Total</h3>
                  <p className="metrica-valor">${estadisticas.valorTotalPresupuestos.toLocaleString()}</p>
                  <p className="metrica-subtitle">En presupuestos</p>
                </div>
              </div>
              <div className="metrica-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="metrica-icon">📊</div>
                <div className="metrica-content">
                  <h3>Tasa Aceptación</h3>
                  <p className="metrica-valor">{estadisticas.tasaAceptacionPresupuestos.toFixed(1)}%</p>
                  <p className="metrica-subtitle">De enviados</p>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Gráficos de Tendencias */}
        {activeTab === 'oportunidades' && oportunidades.length > 0 && (
          <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Gráfico de distribución por etapa */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Distribución por Etapa</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Prospecto', value: oportunidades.filter(o => o.etapa === 'Prospecto').length, color: '#8b5cf6' },
                      { name: 'Calificación', value: oportunidades.filter(o => o.etapa === 'Calificación').length, color: '#3b82f6' },
                      { name: 'Propuesta', value: oportunidades.filter(o => o.etapa === 'Propuesta').length, color: '#f59e0b' },
                      { name: 'Negociación', value: oportunidades.filter(o => o.etapa === 'Negociación').length, color: '#ef4444' },
                      { name: 'Cerrado', value: oportunidades.filter(o => o.etapa === 'Cerrado').length, color: '#10b981' },
                      { name: 'Perdido', value: oportunidades.filter(o => o.etapa === 'Perdido').length, color: '#6b7280' }
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Prospecto', value: oportunidades.filter(o => o.etapa === 'Prospecto').length, color: '#8b5cf6' },
                      { name: 'Calificación', value: oportunidades.filter(o => o.etapa === 'Calificación').length, color: '#3b82f6' },
                      { name: 'Propuesta', value: oportunidades.filter(o => o.etapa === 'Propuesta').length, color: '#f59e0b' },
                      { name: 'Negociación', value: oportunidades.filter(o => o.etapa === 'Negociación').length, color: '#ef4444' },
                      { name: 'Cerrado', value: oportunidades.filter(o => o.etapa === 'Cerrado').length, color: '#10b981' },
                      { name: 'Perdido', value: oportunidades.filter(o => o.etapa === 'Perdido').length, color: '#6b7280' }
                    ].filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Gráfico de valor por etapa */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Valor Estimado por Etapa</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { etapa: 'Prospecto', valor: oportunidades.filter(o => o.etapa === 'Prospecto').reduce((sum, o) => sum + (o.valor_estimado || 0), 0) },
                  { etapa: 'Calificación', valor: oportunidades.filter(o => o.etapa === 'Calificación').reduce((sum, o) => sum + (o.valor_estimado || 0), 0) },
                  { etapa: 'Propuesta', valor: oportunidades.filter(o => o.etapa === 'Propuesta').reduce((sum, o) => sum + (o.valor_estimado || 0), 0) },
                  { etapa: 'Negociación', valor: oportunidades.filter(o => o.etapa === 'Negociación').reduce((sum, o) => sum + (o.valor_estimado || 0), 0) },
                  { etapa: 'Cerrado', valor: oportunidades.filter(o => o.etapa === 'Cerrado').reduce((sum, o) => sum + (o.valor_estimado || 0), 0) }
                ].filter(item => item.valor > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="etapa" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <YAxis stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value: any) => `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {activeTab === 'ventas' && ventas.length > 0 && (
          <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Gráfico de ventas por día */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Tendencia de Ventas</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={(() => {
                  const porDia = ventas.reduce((acc, v) => {
                    const fecha = v.fecha_venta
                    if (!acc[fecha]) {
                      acc[fecha] = { cantidad: 0, total: 0 }
                    }
                    acc[fecha].cantidad += 1
                    acc[fecha].total += v.valor_total
                    return acc
                  }, {} as Record<string, { cantidad: number; total: number }>)
                  
                  return Object.entries(porDia)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(-14) // Últimas 2 semanas
                    .map(([fecha, datos]) => ({
                      fecha: formatArgentinaDate(fecha, 'dd/MM'),
                      cantidad: datos.cantidad,
                      total: Number(datos.total)
                    }))
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="fecha" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} name="Cantidad" />
                  <Line yAxisId="right" type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} name="Total ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Gráfico de ventas por método de pago */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Ventas por Método de Pago</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(() => {
                  const porMetodo = ventas.reduce((acc, v) => {
                    const metodo = v.metodo_pago || 'No especificado'
                    if (!acc[metodo]) {
                      acc[metodo] = { cantidad: 0, total: 0 }
                    }
                    acc[metodo].cantidad += 1
                    acc[metodo].total += v.valor_total
                    return acc
                  }, {} as Record<string, { cantidad: number; total: number }>)
                  
                  return Object.entries(porMetodo)
                    .map(([metodo, datos]) => ({
                      metodo,
                      cantidad: datos.cantidad,
                      total: Number(datos.total)
                    }))
                    .sort((a, b) => b.total - a.total)
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="metodo" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <YAxis stroke="rgba(255, 255, 255, 0.6)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Alertas y Recordatorios */}
        {usuario && (
          <div className="alertas-section" style={{ 
            marginTop: '24px', 
            padding: '16px', 
            background: 'rgba(245, 158, 11, 0.1)', 
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#fbbf24', fontSize: '1rem', fontWeight: 700 }}>
              ⚠️ Recordatorios Activos
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const hoy = new Date()
                hoy.setHours(0, 0, 0, 0)
                const hoyISO = hoy.toISOString().split('T')[0]
                const fechaLimite = new Date()
                fechaLimite.setDate(fechaLimite.getDate() + 7)
                const fechaLimiteISO = fechaLimite.toISOString().split('T')[0]
                const fechaLimitePago = new Date()
                fechaLimitePago.setDate(fechaLimitePago.getDate() - 7)
                const fechaLimitePagoISO = fechaLimitePago.toISOString().split('T')[0]

                const alertas: Array<{ tipo: string; mensaje: string; color: string }> = []

                // Oportunidades próximas a vencer
                if (activeTab === 'oportunidades') {
                  const oppsProximas = oportunidades.filter(opp => {
                    if (!opp.activo || opp.etapa === 'Cerrado' || opp.etapa === 'Perdido' || opp.id_vendedor !== usuario.id) return false
                    if (!opp.fecha_cierre_estimada) return false
                    const fechaCierre = new Date(opp.fecha_cierre_estimada)
                    fechaCierre.setHours(0, 0, 0, 0)
                    const fechaCierreISO = fechaCierre.toISOString().split('T')[0]
                    return fechaCierreISO >= hoyISO && fechaCierreISO <= fechaLimiteISO
                  })

                  if (oppsProximas.length > 0) {
                    alertas.push({
                      tipo: 'oportunidades',
                      mensaje: `${oppsProximas.length} oportunidad(es) próxima(s) a vencer en los próximos 7 días`,
                      color: '#f59e0b'
                    })
                  }

                  // Seguimientos pendientes
                  const seguimientosPendientes = oportunidades.reduce((count, opp) => {
                    if (!opp.activo || opp.etapa === 'Cerrado' || opp.etapa === 'Perdido' || opp.id_vendedor !== usuario.id) return count
                    if (!opp.seguimientos) return count
                    const pendientes = opp.seguimientos.filter(seg => {
                      if (!seg.fecha_proxima_accion) return false
                      const fechaAccion = new Date(seg.fecha_proxima_accion)
                      fechaAccion.setHours(0, 0, 0, 0)
                      return fechaAccion <= hoy
                    })
                    return count + pendientes.length
                  }, 0)

                  if (seguimientosPendientes > 0) {
                    alertas.push({
                      tipo: 'seguimientos',
                      mensaje: `${seguimientosPendientes} seguimiento(s) pendiente(s)`,
                      color: '#ef4444'
                    })
                  }
                }

                // Ventas pendientes de pago
                if (activeTab === 'ventas') {
                  const ventasPendientes = ventas.filter(v => {
                    if (v.estado_pago !== 'Pendiente' || v.id_vendedor !== usuario.id) return false
                    const fechaVenta = new Date(v.fecha_venta)
                    fechaVenta.setHours(0, 0, 0, 0)
                    const fechaVentaISO = fechaVenta.toISOString().split('T')[0]
                    return fechaVentaISO <= fechaLimitePagoISO
                  })

                  if (ventasPendientes.length > 0) {
                    const totalPendiente = ventasPendientes.reduce((sum, v) => sum + v.valor_total, 0)
                    alertas.push({
                      tipo: 'pagos',
                      mensaje: `${ventasPendientes.length} venta(s) pendiente(s) de pago por más de 7 días. Total: $${totalPendiente.toLocaleString()}`,
                      color: '#ef4444'
                    })
                  }
                }

                if (alertas.length === 0) {
                  return (
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                      ✅ No hay recordatorios pendientes
                    </p>
                  )
                }

                return alertas.map((alerta, index) => (
                  <div key={index} style={{ 
                    padding: '8px 12px', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${alerta.color}`
                  }}>
                    <p style={{ margin: 0, color: 'white', fontSize: '0.875rem' }}>
                      {alerta.mensaje}
                    </p>
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="crm-tabs">
        <button
          className={`tab-button ${activeTab === 'oportunidades' ? 'active' : ''}`}
          onClick={() => setActiveTab('oportunidades')}
        >
          📋 Oportunidades ({oportunidadesFiltradas.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'ventas' ? 'active' : ''}`}
          onClick={() => setActiveTab('ventas')}
        >
          💰 Ventas ({ventasFiltradas.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'presupuestos' ? 'active' : ''}`}
          onClick={() => setActiveTab('presupuestos')}
        >
          📄 Presupuestos ({presupuestosFiltrados.length})
        </button>
      </div>

      {/* Tab: Oportunidades */}
      {activeTab === 'oportunidades' && (
        <div className="crm-section">
          {/* Filtros */}
          <div className="filtros-section">
            <div className="filtro-group">
              <label>Etapa:</label>
              <select
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value)}
                className="filtro-select"
              >
                <option value="todas">Todas</option>
                <option value="Prospecto">Prospecto</option>
                <option value="Calificación">Calificación</option>
                <option value="Propuesta">Propuesta</option>
                <option value="Negociación">Negociación</option>
                <option value="Cerrado">Cerrado</option>
                <option value="Perdido">Perdido</option>
              </select>
            </div>
            <div className="filtro-group" style={{ flex: 1, minWidth: '300px' }}>
              <label>🔍 Buscar:</label>
              <input
                type="text"
                placeholder="Buscar por cliente, número de oportunidad, OP, empresa..."
                value={busquedaOportunidad}
                onChange={(e) => setBusquedaOportunidad(e.target.value)}
                className="filtro-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Lista de Oportunidades */}
          <div className="oportunidades-grid">
            {oportunidadesFiltradas.map((oportunidad) => (
              <div key={oportunidad.id} className="oportunidad-card">
                <div className="card-header">
                  <div>
                    <h3>{oportunidad.cliente_nombre}</h3>
                    <span className="numero-oportunidad">{oportunidad.numero_oportunidad}</span>
                  </div>
                  <span
                    className="etapa-badge"
                    style={{ backgroundColor: getEtapaColor(oportunidad.etapa) }}
                  >
                    {oportunidad.etapa}
                  </span>
                </div>
                
                {oportunidad.cliente_empresa && (
                  <p className="cliente-empresa">🏢 {oportunidad.cliente_empresa}</p>
                )}
                
                {oportunidad.descripcion && (
                  <p className="descripcion">{oportunidad.descripcion}</p>
                )}
                
                <div className="card-info">
                  {oportunidad.valor_estimado && (
                    <div className="info-item">
                      <strong>Valor estimado:</strong> ${oportunidad.valor_estimado.toLocaleString()}
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Probabilidad:</strong> {oportunidad.probabilidad_cierre}%
                  </div>
                  {oportunidad.fecha_cierre_estimada && (
                    <div className="info-item">
                      <strong>Cierre estimado:</strong> {formatArgentinaDate(oportunidad.fecha_cierre_estimada)}
                    </div>
                  )}
                  {oportunidad.numero_op && (
                    <div className="info-item">
                      <strong>OP asociada:</strong> {oportunidad.numero_op}
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Vendedor:</strong> {oportunidad.nombre_vendedor}
                  </div>
                </div>

                {oportunidad.seguimientos && oportunidad.seguimientos.length > 0 && (
                  <div className="seguimientos-section">
                    <strong>Últimos seguimientos:</strong>
                    {oportunidad.seguimientos.slice(0, 2).map((seg) => (
                      <div key={seg.id} className="seguimiento-item">
                        <span className="tipo-seguimiento">{seg.tipo_seguimiento}</span>
                        <span className="fecha-seguimiento">
                          {formatArgentinaDate(seg.fecha_seguimiento, 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="card-actions">
                  <button
                    className="btn-action"
                    onClick={() => handleEditarOportunidad(oportunidad)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => handleAgregarSeguimiento(oportunidad)}
                  >
                    📝 Seguimiento
                  </button>
                  {oportunidad.etapa !== 'Cerrado' && oportunidad.etapa !== 'Perdido' && (
                    <button
                      className="btn-action btn-primary"
                      onClick={() => handleConvertirAVenta(oportunidad)}
                    >
                      💰 Convertir a Venta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {oportunidadesFiltradas.length === 0 && (
            <div className="empty-state">
              <p>No hay oportunidades que coincidan con los filtros</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Ventas */}
      {activeTab === 'ventas' && (
        <div className="crm-section">
          {/* Filtros */}
          <div className="filtros-section">
            <div className="filtros-basicos" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="filtro-group">
                <label>Estado de pago:</label>
                <select
                  value={filtroEstadoPago}
                  onChange={(e) => setFiltroEstadoPago(e.target.value)}
                  className="filtro-select"
                >
                  <option value="todos">Todos</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Pagado">Pagado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
              <div className="filtro-group">
                <label>Desde:</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="filtro-input"
                />
              </div>
              <div className="filtro-group">
                <label>Hasta:</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="filtro-input"
                />
              </div>
              <div className="filtro-group" style={{ flex: 1, minWidth: '300px' }}>
                <label>🔍 Buscar:</label>
                <input
                  type="text"
                  placeholder="Buscar por cliente, número de venta, OP, teléfono, email..."
                  value={busquedaVenta}
                  onChange={(e) => setBusquedaVenta(e.target.value)}
                  className="filtro-input"
                  style={{ width: '100%' }}
                />
              </div>
              <button
                className="btn-secondary"
                onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                style={{ padding: '10px 16px', fontSize: '0.875rem' }}
              >
                {mostrarFiltrosAvanzados ? '▲' : '▼'} Filtros Avanzados
              </button>
            </div>
            
            {mostrarFiltrosAvanzados && (
              <div className="filtros-avanzados" style={{ 
                marginTop: '16px', 
                padding: '16px', 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div className="filtro-group">
                  <label>Método de pago:</label>
                  <select
                    value={filtroMetodoPago}
                    onChange={(e) => setFiltroMetodoPago(e.target.value)}
                    className="filtro-select"
                  >
                    <option value="todos">Todos</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="filtro-group">
                  <label>Vendedor:</label>
                  <select
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    className="filtro-select"
                  >
                    <option value="todos">Todos</option>
                    {Array.from(new Set(ventas.map(v => v.nombre_vendedor).filter(Boolean))).map(vendedor => (
                      <option key={vendedor} value={vendedor}>{vendedor}</option>
                    ))}
                  </select>
                </div>
                <div className="filtro-group" style={{ flex: 1 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setFiltroEstadoPago('todos')
                      setFiltroMetodoPago('todos')
                      setFiltroVendedor('todos')
                      setFechaDesde('')
                      setFechaHasta('')
                      setBusquedaVenta('')
                    }}
                    style={{ padding: '10px 16px', fontSize: '0.875rem' }}
                  >
                    🔄 Limpiar Filtros
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de Ventas */}
          <div className="ventas-grid">
            {ventasFiltradas.map((venta) => (
              <div key={venta.id} className="venta-card">
                <div className="card-header">
                  <div>
                    <h3>{venta.cliente_nombre}</h3>
                    <span className="numero-venta">{venta.numero_venta}</span>
                  </div>
                  <span
                    className="estado-badge"
                    style={{ backgroundColor: getEstadoPagoColor(venta.estado_pago) }}
                  >
                    {venta.estado_pago}
                  </span>
                </div>
                
                {venta.cliente_empresa && (
                  <p className="cliente-empresa">🏢 {venta.cliente_empresa}</p>
                )}
                
                <div className="card-info">
                  <div className="info-item">
                    <strong>OP:</strong> {venta.numero_op || 'Sin OP'}
                  </div>
                  <div className="info-item">
                    <strong>Valor total:</strong> ${venta.valor_total.toLocaleString()}
                  </div>
                  {venta.metodo_pago && (
                    <div className="info-item">
                      <strong>Método de pago:</strong> {venta.metodo_pago}
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Fecha:</strong> {formatArgentinaDate(venta.fecha_venta)}
                  </div>
                  <div className="info-item">
                    <strong>Vendedor:</strong> {venta.nombre_vendedor}
                  </div>
                  {venta.cliente_telefono && (
                    <div className="info-item">
                      <strong>Teléfono:</strong> {venta.cliente_telefono}
                    </div>
                  )}
                  {venta.cliente_email && (
                    <div className="info-item">
                      <strong>Email:</strong> {venta.cliente_email}
                    </div>
                  )}
                  {venta.cliente_dni_cuit && (
                    <div className="info-item">
                      <strong>DNI/CUIT:</strong> {venta.cliente_dni_cuit}
                    </div>
                  )}
                  {venta.items && venta.items.length > 0 && (
                    <div className="info-item">
                      <strong>Items:</strong> {venta.items.length} artículo{venta.items.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {venta.items && venta.items.length > 0 && (
                  <div className="items-section">
                    <strong>Items ({venta.items.length}):</strong>
                    {venta.items.map((item) => (
                      <div key={item.id} className="item-venta">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ flex: 1 }}>
                            <strong>{item.cantidad}x</strong> {item.descripcion}
                            {item.codigo_articulo && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '8px' }}>
                                ({item.codigo_articulo})
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, color: '#10b981', marginLeft: '12px' }}>
                            ${item.precio_total.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Precio unitario: ${item.precio_unitario.toLocaleString()}</span>
                          {item.descuento && item.descuento > 0 && (
                            <span style={{ color: '#f59e0b' }}>Descuento: ${item.descuento.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {venta.observaciones && (
                  <div className="items-section" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                    <strong>Observaciones:</strong>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                      {venta.observaciones}
                    </p>
                  </div>
                )}

                <div className="card-actions">
                  {venta.numero_op ? (
                    <button
                      className="btn-action"
                      onClick={() => navigate(`/op/${venta.numero_op}`)}
                    >
                      👁️ Ver OP
                    </button>
                  ) : (
                    <button
                      className="btn-action btn-primary"
                      onClick={() => handleConvertirVentaAOP(venta)}
                    >
                      📋 Convertir a OP
                    </button>
                  )}
                  <button
                    className="btn-action"
                    onClick={() => handleEditarVenta(venta)}
                  >
                    ✏️ Editar
                  </button>
                  <div className="export-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                    <button 
                      className="btn-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDropdownDocumentosAbierto(
                          dropdownDocumentosAbierto === venta.id ? null : venta.id
                        )
                      }}
                    >
                      📄 Documentos {dropdownDocumentosAbierto === venta.id ? '▼' : '▶'}
                    </button>
                    {dropdownDocumentosAbierto === venta.id && (
                      <div 
                        className="export-menu export-menu-visible"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          left: 'auto'
                        }}
                      >
                        <button 
                          onClick={() => {
                            generarFacturaRemitoPDF(venta, 'factura')
                            setDropdownDocumentosAbierto(null)
                          }}
                        >
                          🧾 Generar Factura
                        </button>
                        <button 
                          onClick={() => {
                            generarFacturaRemitoPDF(venta, 'remito')
                            setDropdownDocumentosAbierto(null)
                          }}
                        >
                          📋 Generar Remito
                        </button>
                      </div>
                    )}
                  </div>
                  <select
                    className="btn-action"
                    value={venta.estado_pago}
                    onChange={(e) => actualizarEstadoPagoVenta(venta, e.target.value as any)}
                    style={{ 
                      minWidth: '120px',
                      padding: '8px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Pendiente">💳 Pendiente</option>
                    <option value="Parcial">💳 Parcial</option>
                    <option value="Pagado">💳 Pagado</option>
                    <option value="Cancelado">💳 Cancelado</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {ventasFiltradas.length === 0 && (
            <div className="empty-state">
              <p>No hay ventas que coincidan con los filtros</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Presupuestos */}
      {activeTab === 'presupuestos' && (
        <div className="crm-section">
          {/* Filtros */}
          <div className="filtros-section">
            <div className="filtro-group">
              <label>Estado:</label>
              <select
                value={filtroEstadoPresupuesto}
                onChange={(e) => setFiltroEstadoPresupuesto(e.target.value)}
                className="filtro-select"
              >
                <option value="todos">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="enviado">Enviado</option>
                <option value="aceptado">Aceptado</option>
                <option value="rechazado">Rechazado</option>
                <option value="cancelado">Cancelado</option>
                <option value="convertido">Convertido</option>
              </select>
            </div>
            <div className="filtro-group">
              <label>Desde:</label>
              <input
                type="date"
                value={fechaDesdePresupuesto}
                onChange={(e) => setFechaDesdePresupuesto(e.target.value)}
                className="filtro-input"
              />
            </div>
            <div className="filtro-group">
              <label>Hasta:</label>
              <input
                type="date"
                value={fechaHastaPresupuesto}
                onChange={(e) => setFechaHastaPresupuesto(e.target.value)}
                className="filtro-input"
              />
            </div>
            <div className="filtro-group" style={{ flex: 1, minWidth: '300px' }}>
              <label>🔍 Buscar:</label>
              <input
                type="text"
                placeholder="Buscar por número, cliente, empresa, email..."
                value={busquedaPresupuesto}
                onChange={(e) => setBusquedaPresupuesto(e.target.value)}
                className="filtro-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Lista de Presupuestos */}
          <div className="ventas-grid">
            {presupuestosFiltrados.map((presupuesto) => {
              const getEstadoColor = (estado: string) => {
                switch (estado) {
                  case 'aceptado': return '#10b981'
                  case 'enviado': return '#3b82f6'
                  case 'borrador': return '#6b7280'
                  case 'rechazado': return '#ef4444'
                  case 'cancelado': return '#f59e0b'
                  case 'convertido': return '#8b5cf6'
                  default: return '#6b7280'
                }
              }

              return (
                <div key={presupuesto.id} className="venta-card">
                  <div className="card-header">
                    <div>
                      <h3>{presupuesto.cliente_nombre || 'Cliente'}</h3>
                      <span className="numero-oportunidad">{presupuesto.numero_presupuesto}</span>
                    </div>
                    <span
                      className="etapa-badge"
                      style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
                    >
                      {presupuesto.estado}
                    </span>
                  </div>
                  
                  {presupuesto.cliente_empresa && (
                    <p className="cliente-empresa">🏢 {presupuesto.cliente_empresa}</p>
                  )}
                  
                  <div className="card-info">
                    <div className="info-item">
                      <strong>Precio total:</strong> ${presupuesto.precio_total.toLocaleString()}
                    </div>
                    <div className="info-item">
                      <strong>Fecha creación:</strong> {formatArgentinaDate(presupuesto.fecha_creacion)}
                    </div>
                    {presupuesto.fecha_envio && (
                      <div className="info-item">
                        <strong>Fecha envío:</strong> {formatArgentinaDate(presupuesto.fecha_envio)}
                      </div>
                    )}
                    {presupuesto.fecha_vencimiento && (
                      <div className="info-item">
                        <strong>Fecha vencimiento:</strong> {formatArgentinaDate(presupuesto.fecha_vencimiento)}
                      </div>
                    )}
                    {presupuesto.cliente_email && (
                      <div className="info-item">
                        <strong>Email:</strong> {presupuesto.cliente_email}
                      </div>
                    )}
                    {presupuesto.id_op_asociada && (
                      <div className="info-item">
                        <strong>OP asociada:</strong> {presupuesto.id_op_asociada}
                      </div>
                    )}
                    {presupuesto.id_pedido_asociado && (
                      <div className="info-item">
                        <strong>Pedido asociado:</strong> {presupuesto.id_pedido_asociado}
                      </div>
                    )}
                  </div>

                  {presupuesto.observaciones_cliente && (
                    <div className="items-section" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                      <strong>Observaciones Cliente:</strong>
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        {presupuesto.observaciones_cliente}
                      </p>
                    </div>
                  )}

                  {presupuesto.observaciones_internas && (
                    <div className="items-section" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                      <strong>Observaciones Internas:</strong>
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        {presupuesto.observaciones_internas}
                      </p>
                    </div>
                  )}

                  <div className="card-actions">
                    {presupuesto.id_op_asociada && (
                      <button
                        className="btn-action"
                        onClick={() => navigate(`/op/${presupuesto.id_op_asociada}`)}
                      >
                        👁️ Ver OP
                      </button>
                    )}
                    {presupuesto.cliente_email && (
                      <a
                        href={`mailto:${presupuesto.cliente_email}`}
                        className="btn-action"
                        style={{ textDecoration: 'none' }}
                      >
                        ✉️ Email
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {presupuestosFiltrados.length === 0 && (
            <div className="empty-state">
              <p>No hay presupuestos que coincidan con los filtros</p>
            </div>
          )}
        </div>
      )}

      {/* Modal: Crear/Editar Oportunidad */}
      {mostrarModalOportunidad && (
        <div className="modal-overlay" onClick={() => setMostrarModalOportunidad(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{oportunidadEditando ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</h2>
              <button className="modal-close" onClick={() => setMostrarModalOportunidad(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cliente *</label>
                <div className="cliente-search-container" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value)
                      setFormOportunidad({ ...formOportunidad, cliente_nombre: e.target.value })
                    }}
                    placeholder="Buscar cliente por nombre, DNI, teléfono..."
                    style={{ paddingRight: buscandoClientes ? '35px' : '12px' }}
                  />
                  {buscandoClientes && (
                    <span className="loading-spinner" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>⏳</span>
                  )}
                  {clientesEncontrados.length > 0 && (
                    <div className="dropdown-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', marginTop: '4px' }}>
                      {clientesEncontrados.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="dropdown-item"
                          onClick={() => seleccionarCliente(cliente)}
                          style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)' }}
                        >
                          <strong>{cliente.nombre}</strong>
                          {cliente.dni_cuit && <div className="dropdown-subtext">DNI/CUIT: {cliente.dni_cuit}</div>}
                          {cliente.telefono && <div className="dropdown-subtext">Tel: {cliente.telefono}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSeleccionado && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', fontSize: '0.9rem' }}>
                    ✓ Cliente seleccionado: <strong>{clienteSeleccionado.nombre}</strong>
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formOportunidad.cliente_telefono}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, cliente_telefono: e.target.value })}
                    placeholder="Teléfono"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formOportunidad.cliente_email}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, cliente_email: e.target.value })}
                    placeholder="Email"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>DNI/CUIT</label>
                  <input
                    type="text"
                    value={formOportunidad.cliente_dni_cuit}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, cliente_dni_cuit: e.target.value })}
                    placeholder="DNI/CUIT"
                  />
                </div>
                <div className="form-group">
                  <label>Empresa</label>
                  <input
                    type="text"
                    value={formOportunidad.cliente_empresa}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, cliente_empresa: e.target.value })}
                    placeholder="Empresa"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input
                  type="text"
                  value={formOportunidad.cliente_direccion}
                  onChange={(e) => setFormOportunidad({ ...formOportunidad, cliente_direccion: e.target.value })}
                  placeholder="Dirección"
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formOportunidad.descripcion}
                  onChange={(e) => setFormOportunidad({ ...formOportunidad, descripcion: e.target.value })}
                  placeholder="Descripción del proyecto o necesidad"
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor Estimado</label>
                  <input
                    type="number"
                    value={formOportunidad.valor_estimado}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, valor_estimado: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Probabilidad de Cierre (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formOportunidad.probabilidad_cierre}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, probabilidad_cierre: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Etapa</label>
                  <select
                    value={formOportunidad.etapa}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, etapa: e.target.value as any })}
                  >
                    <option value="Prospecto">Prospecto</option>
                    <option value="Calificación">Calificación</option>
                    <option value="Propuesta">Propuesta</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Perdido">Perdido</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha Cierre Estimada</label>
                  <input
                    type="date"
                    value={formOportunidad.fecha_cierre_estimada}
                    onChange={(e) => setFormOportunidad({ ...formOportunidad, fecha_cierre_estimada: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formOportunidad.observaciones}
                  onChange={(e) => setFormOportunidad({ ...formOportunidad, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales"
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalOportunidad(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardarOportunidad}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar Seguimiento */}
      {mostrarModalSeguimiento && oportunidadParaSeguimiento && (
        <div className="modal-overlay" onClick={() => setMostrarModalSeguimiento(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar Seguimiento - {oportunidadParaSeguimiento.cliente_nombre}</h2>
              <button className="modal-close" onClick={() => setMostrarModalSeguimiento(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo de Seguimiento</label>
                <select
                  value={formSeguimiento.tipo_seguimiento}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, tipo_seguimiento: e.target.value as any })}
                >
                  <option value="Llamada">Llamada</option>
                  <option value="Email">Email</option>
                  <option value="Reunión">Reunión</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Visita">Visita</option>
                  <option value="Propuesta">Propuesta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <textarea
                  value={formSeguimiento.descripcion}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, descripcion: e.target.value })}
                  placeholder="Detalles del seguimiento"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Próxima Acción</label>
                <input
                  type="text"
                  value={formSeguimiento.proxima_accion}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, proxima_accion: e.target.value })}
                  placeholder="Qué hacer a continuación"
                />
              </div>
              <div className="form-group">
                <label>Fecha Próxima Acción</label>
                <input
                  type="date"
                  value={formSeguimiento.fecha_proxima_accion}
                  onChange={(e) => setFormSeguimiento({ ...formSeguimiento, fecha_proxima_accion: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalSeguimiento(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardarSeguimiento}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Convertir a Venta */}
      {mostrarModalConvertir && oportunidadParaConvertir && (
        <div className="modal-overlay" onClick={() => setMostrarModalConvertir(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Convertir a Venta - {oportunidadParaConvertir.cliente_nombre}</h2>
              <button className="modal-close" onClick={() => setMostrarModalConvertir(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Número de OP *</label>
                <input
                  type="text"
                  list="ordenes-list"
                  value={formVenta.numero_op}
                  onChange={(e) => {
                    setFormVenta({ ...formVenta, numero_op: e.target.value })
                    const orden = ordenesDisponibles.find(o => o.numero_op === e.target.value)
                    if (orden) {
                      setFormVenta(prev => ({ ...prev, id_op: orden.id.toString() }))
                    }
                  }}
                  placeholder="Número de OP"
                />
                <datalist id="ordenes-list">
                  {ordenesDisponibles.map((orden) => (
                    <option key={orden.id} value={orden.numero_op}>
                      {orden.cliente} - {orden.numero_op}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="form-row">
              <div className="form-group">
                <label>Valor Total *</label>
                <input
                  type="number"
                  value={formVenta.valor_total}
                  onChange={(e) => setFormVenta({ ...formVenta, valor_total: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  readOnly={itemsVenta.length > 0}
                  style={itemsVenta.length > 0 ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                />
                {itemsVenta.length > 0 && (
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    Calculado automáticamente desde items
                  </small>
                )}
              </div>
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formVenta.metodo_pago}
                    onChange={(e) => setFormVenta({ ...formVenta, metodo_pago: e.target.value as any })}
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Estado de Pago</label>
                  <select
                    value={formVenta.estado_pago}
                    onChange={(e) => setFormVenta({ ...formVenta, estado_pago: e.target.value as any })}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha de Venta</label>
                  <input
                    type="date"
                    value={formVenta.fecha_venta}
                    onChange={(e) => setFormVenta({ ...formVenta, fecha_venta: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formVenta.observaciones}
                  onChange={(e) => setFormVenta({ ...formVenta, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales"
                  rows={2}
                />
              </div>

              {/* Sección de Items desde Stock */}
              <div className="form-section-divider" style={{ marginTop: '24px', marginBottom: '16px' }}>
                <h3>📦 Items de Venta (desde Stock)</h3>
                <p className="section-description">Busca y agrega artículos del stock a esta venta</p>
              </div>

              {/* Búsqueda de artículos */}
              <div className="form-group">
                <label>Buscar Artículo en Stock</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={busquedaArticulo}
                    onChange={(e) => setBusquedaArticulo(e.target.value)}
                    placeholder="Buscar por código o descripción (mín. 2 caracteres)..."
                    style={{ paddingRight: '40px' }}
                  />
                  {buscandoArticulos && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                      🔍
                    </span>
                  )}
                </div>
                {articulosEncontrados.length > 0 && (
                  <div className="dropdown-list" style={{ position: 'relative', marginTop: '8px', maxHeight: '200px' }}>
                    {articulosEncontrados.map((articulo) => (
                      <div
                        key={articulo.id}
                        className="dropdown-item"
                        onClick={() => agregarArticuloAVenta(articulo)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div>
                          <strong>{articulo.descripcion}</strong>
                          {articulo.codigo && <div className="dropdown-subtext">Código: {articulo.codigo}</div>}
                          <div className="dropdown-subtext">
                            Precio: ${articulo.precio?.toLocaleString() || '0'} | 
                            Stock: {articulo.stock !== null ? articulo.stock : 'N/A'} {articulo.unidad || 'unidades'}
                            {articulo.stock !== null && articulo.stock <= 0 && (
                              <span style={{ color: '#ef4444', marginLeft: '8px' }}>⚠️ Agotado</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de items agregados */}
              {itemsVenta.length > 0 && (
                <div className="items-venta-section" style={{ marginTop: '16px' }}>
                  <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Items Agregados:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {itemsVenta.map((item, index) => (
                      <div key={index} className="item-venta-card" style={{ 
                        padding: '12px', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        borderRadius: '8px',
                        border: '1px solid var(--surface-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.descripcion}</strong>
                            {item.codigo_articulo && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Código: {item.codigo_articulo}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminarItemVenta(index)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#ef4444',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cantidad</label>
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.cantidad}
                              onChange={(e) => actualizarItemVenta(index, 'cantidad', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Unit.</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={(e) => actualizarItemVenta(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Descuento</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.descuento}
                              onChange={(e) => actualizarItemVenta(index, 'descuento', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          Subtotal: ${((item.precio_unitario * item.cantidad) - item.descuento).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      Total: ${formVenta.valor_total}
                    </strong>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalConvertir(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardarVenta}>
                Crear Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Venta */}
      {mostrarModalEditarVenta && ventaEditando && (
        <div className="modal-overlay" onClick={() => setMostrarModalEditarVenta(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Editar Venta - {ventaEditando.cliente_nombre}</h2>
              <button className="modal-close" onClick={() => setMostrarModalEditarVenta(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="card-info" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="info-item">
                  <strong>Número de Venta:</strong> {ventaEditando.numero_venta}
                </div>
                <div className="info-item">
                  <strong>OP:</strong> {ventaEditando.numero_op}
                </div>
                <div className="info-item">
                  <strong>Valor Total:</strong> ${ventaEditando.valor_total.toLocaleString()}
                </div>
                <div className="info-item">
                  <strong>Estado de Pago:</strong> {ventaEditando.estado_pago}
                </div>
              </div>

              {/* Búsqueda de artículos */}
              <div className="form-section-divider" style={{ marginTop: '24px', marginBottom: '16px' }}>
                <h3>📦 Agregar Items desde Stock</h3>
              </div>

              <div className="form-group">
                <label>Buscar Artículo en Stock</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={busquedaArticuloEditar}
                    onChange={(e) => setBusquedaArticuloEditar(e.target.value)}
                    placeholder="Buscar por código o descripción (mín. 2 caracteres)..."
                    style={{ paddingRight: '40px' }}
                  />
                  {buscandoArticulosEditar && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                      🔍
                    </span>
                  )}
                </div>
                {articulosEncontradosEditar.length > 0 && (
                  <div className="dropdown-list" style={{ position: 'relative', marginTop: '8px', maxHeight: '200px' }}>
                    {articulosEncontradosEditar.map((articulo) => (
                      <div
                        key={articulo.id}
                        className="dropdown-item"
                        onClick={() => agregarArticuloAVentaEditando(articulo)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div>
                          <strong>{articulo.descripcion}</strong>
                          {articulo.codigo && <div className="dropdown-subtext">Código: {articulo.codigo}</div>}
                          <div className="dropdown-subtext">
                            Precio: ${articulo.precio?.toLocaleString() || '0'} | 
                            Stock: {articulo.stock !== null ? articulo.stock : 'N/A'} {articulo.unidad || 'unidades'}
                            {articulo.stock !== null && articulo.stock <= 0 && (
                              <span style={{ color: '#ef4444', marginLeft: '8px' }}>⚠️ Agotado</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de items actuales */}
              <div className="items-venta-section" style={{ marginTop: '24px' }}>
                <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Items de la Venta:</h4>
                {itemsVentaEditando.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay items agregados</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {itemsVentaEditando.map((item) => (
                      <div key={item.id} className="item-venta-card" style={{ 
                        padding: '12px', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        borderRadius: '8px',
                        border: '1px solid var(--surface-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.descripcion}</strong>
                            {item.codigo_articulo && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Código: {item.codigo_articulo}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminarItemVentaEditando(item.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#ef4444',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            ✕ Eliminar
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px', fontSize: '0.9rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Cantidad: </span>
                            <strong>{item.cantidad}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Precio Unit.: </span>
                            <strong>${item.precio_unitario.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Total: </span>
                            <strong style={{ color: 'var(--brand)' }}>${item.precio_total.toLocaleString()}</strong>
                          </div>
                        </div>
                        {item.descuento && item.descuento > 0 && (
                          <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#10b981' }}>
                            Descuento: ${item.descuento.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalEditarVenta(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buscador de Clientes */}
      {mostrarBuscadorClientes && (
        <BuscadorClientesModal
          onClose={() => setMostrarBuscadorClientes(false)}
        />
      )}
    </div>
  )
}

export default CRMVentasPage

