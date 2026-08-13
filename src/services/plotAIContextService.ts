import { supabase } from './supabaseClient'
import type { Task, TeamMember, ActivityEvent } from '../types/board'

/**
 * Servicio completo de contexto para PlotAI
 * Accede a todas las tablas de la base de datos para proporcionar contexto completo
 */

export interface CompleteSystemContext {
  // Órdenes de Trabajo
  ordenes: {
    total: number
    porEstado: Record<string, number>
    porPrioridad: Record<string, number>
    porSector: Record<string, number>
    urgentes: number
    atrasadas: number
    completadasHoy: number
    enProceso: number
  }
  
  // Clientes
  clientes: {
    total: number
    activos: number
    web: number
    nuevosEsteMes: number
  }
  
  // Pedidos Web
  pedidosWeb: {
    total: number
    pendientes: number
    enRevision: number
    convertidos: number
    cancelados: number
    urgentes: number
  }
  
  // Artículos
  articulos: {
    total: number
    activos: number
    porCategoria: Record<string, number>
  }
  
  // Usuarios y Equipo
  usuarios: {
    total: number
    porRol: Record<string, number>
    online: number
    trabajando: number
  }
  
  // Materiales y Stock
  materiales: {
    total: number
    masUsados: Array<{ codigo: string; descripcion: string; vecesUsado: number }>
  }
  
  // Pedidos de Compras
  pedidosCompras: {
    total: number
    pendientes: number
    aprobados: number
    enCompra: number
    completados: number
  }
  
  // Proveedores
  proveedores: {
    total: number
    activos: number
  }

  // Ventas / Facturación
  ventas?: {
    totalFacturas: number
    facturasEmitidas: number
    totalVentas: number
    promedioTicket: number
    porTipoComprobante: Record<string, number>
  }

  // Presupuestos de ventas
  presupuestosVentas?: {
    total: number
    aceptados: number
    rechazados: number
    cancelados: number
    convertidos: number
    valorTotal: number
    valorAceptados: number
  }
  
  // Actividad Reciente
  actividadReciente: Array<{
    tipo: string
    descripcion: string
    usuario: string
    timestamp: string
  }>
  
  // Métricas de Rendimiento
  rendimiento: {
    promedioTiempoCompletado: number
    tasaCompletacion: number
    eficienciaPorSector: Record<string, number>
  }
  
  // Alertas y Problemas
  alertas: Array<{
    tipo: string
    severidad: 'baja' | 'media' | 'alta' | 'critica'
    mensaje: string
  }>

  // Mostrador: Cuenta Corriente
  cuentaCorriente?: {
    total: number // Clientes habilitados para comprar a cuenta en Mostrador
  }

  // Atención al público: Reclamos
  reclamos?: {
    total: number
    porEstado: Record<string, number>
    nuevos: number
    enCurso: number
    recientes: Array<{ id: number; cliente: string; descripcion: string; estado: string }>
  }
}

/**
 * Obtiene el contexto completo del sistema desde todas las tablas
 */
export async function getCompleteSystemContext(
  tasks: Task[],
  _activity: ActivityEvent[],
  teamMembers: TeamMember[]
): Promise<CompleteSystemContext> {
  try {
    if (!supabase) {
      throw new Error('Supabase no está configurado')
    }
    
    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Consultas paralelas para mejor rendimiento
    const [
      ordenesData,
      clientesData,
      pedidosWebData,
      articulosData,
      usuariosData,
      materialesData,
      pedidosComprasData,
      proveedoresData,
      historialMovimientos,
      tiempoTrabajoData,
      chatMessagesData,
      facturasData,
      presupuestosVentasData,
      cuentaCorrienteRes,
      reclamosData
    ] = await Promise.all([
      // Órdenes de Trabajo
      supabase
        .from('ordenes_trabajo')
        .select(
          'id, estado, prioridad, sector, fecha_entrega, fecha_creacion, entregado, fecha_entrega_efectiva, usuario_trabajando_id, visible_en_tablero'
        )
        .then(r => r.data || []),
      
      // Clientes
      supabase
        .from('clientes_publico')
        .select('id, activo, es_cliente_web, created_at')
        .then(r => r.data || []),
      
      // Pedidos Web
      supabase
        .from('pedidos_clientes')
        .select('id, estado, es_urgente, fecha_pedido')
        .then(r => r.data || []),
      
      // Artículos
      supabase
        .from('articulos_empresa')
        .select('id, categoria, activo')
        .then(r => r.data || []),
      
      // Usuarios
      supabase
        .from('usuarios_publico')
        .select('id, rol, last_seen')
        .then(r => r.data || []),
      
      // Materiales más usados
      supabase
        .from('orden_materiales')
        .select('id_material, cantidad')
        .then(r => r.data || []),
      
      // Pedidos de Compras
      supabase
        .from('pedidos_compras')
        .select('id, estado')
        .then(r => r.data || []),
      
      // Proveedores
      supabase
        .from('proveedores')
        .select('id, activo')
        .then(r => r.data || []),
      
      // Historial de Movimientos (últimos 50)
      supabase
        .from('historial_movimientos')
        .select('id_orden, nombre_usuario, estado_anterior, estado_nuevo, timestamp')
        .order('timestamp', { ascending: false })
        .limit(50)
        .then(r => r.data || []),
      
      // Tiempo de Trabajo
      supabase
        .from('tiempo_trabajo')
        .select('id_orden, tiempo_minutos, fecha')
        .then(r => r.data || []),
      
      // Mensajes del Chat (últimos 20)
      supabase
        .from('chat_messages')
        .select('nombre_usuario, mensaje, timestamp')
        .order('timestamp', { ascending: false })
        .limit(20)
        .then(r => r.data || []),

      // Facturas de venta (para contexto de ventas)
      supabase
        .from('facturas_venta')
        .select('id, estado, total, tipo_comprobante')
        .then(r => r.data || []),

      // Presupuestos de ventas
      supabase
        .from('presupuestos_ventas')
        .select('id, estado, precio_total')
        .then(r => r.data || []),

      // Cuenta Corriente (Mostrador): clientes habilitados a comprar a cuenta
      (async (): Promise<{ count: number }> => {
        try {
          const r = await supabase
            .from('clientes_cuenta_corriente')
            .select('id', { count: 'exact', head: true })
          return { count: r.count ?? 0 }
        } catch {
          return { count: 0 }
        }
      })(),

      // Reclamos (Atención al público)
      supabase
        .from('atencion_reclamos')
        .select('id, cliente_nombre, cliente_email, descripcion, estado, prioridad, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(r => r.data || [])
    ])
    
    // Solo órdenes visibles en tablero (alineado con getOrdenes / kanban; evita contradicción de totales)
    type OrdenStatsRow = {
      visible_en_tablero?: boolean | null
      estado?: string
      prioridad?: string
      sector?: string
      fecha_entrega?: string
      entregado?: boolean
      fecha_entrega_efectiva?: string
      usuario_trabajando_id?: number | null
    }
    const ordenesVisibles = (ordenesData as OrdenStatsRow[]).filter(
      (o) => o.visible_en_tablero !== false
    )

    // Procesar datos de órdenes
    const ordenesPorEstado: Record<string, number> = {}
    const ordenesPorPrioridad: Record<string, number> = {}
    const ordenesPorSector: Record<string, number> = {}
    let urgentes = 0
    let atrasadas = 0
    let completadasHoy = 0
    let enProceso = 0

    ordenesVisibles.forEach((orden: OrdenStatsRow) => {
      const est = orden.estado ?? ''
      const pri = orden.prioridad ?? ''
      const sec = orden.sector ?? ''
      ordenesPorEstado[est] = (ordenesPorEstado[est] || 0) + 1
      ordenesPorPrioridad[pri] = (ordenesPorPrioridad[pri] || 0) + 1
      ordenesPorSector[sec] = (ordenesPorSector[sec] || 0) + 1
      
      // Urgentes
      if (orden.prioridad === 'Alta' || orden.prioridad === 'Urgente') {
        urgentes++
      }
      
      // Atrasadas
      if (orden.fecha_entrega && new Date(orden.fecha_entrega) < now && !orden.entregado) {
        atrasadas++
      }
      
      // Completadas hoy
      if (orden.entregado && orden.fecha_entrega_efectiva) {
        const fechaEntrega = new Date(orden.fecha_entrega_efectiva)
        if (fechaEntrega.toDateString() === now.toDateString()) {
          completadasHoy++
        }
      }
      
      // En proceso
      if (orden.estado !== 'Pendiente' && orden.estado !== 'Finalizado' && !orden.entregado) {
        enProceso++
      }
    })
    
    // Procesar clientes
    const clientesActivos = clientesData.filter((c: { activo?: boolean }) => c.activo).length
    const clientesWeb = clientesData.filter((c: { es_cliente_web?: boolean }) => c.es_cliente_web).length
    const clientesNuevosMes = clientesData.filter((c: { created_at?: string }) => {
      if (!c.created_at) return false
      const fechaCreacion = new Date(c.created_at)
      return fechaCreacion >= inicioMes
    }).length
    
    // Procesar pedidos web
    const pedidosPendientes = pedidosWebData.filter((p: { estado?: string }) => p.estado === 'pendiente').length
    const pedidosEnRevision = pedidosWebData.filter((p: { estado?: string }) => p.estado === 'en_revision').length
    const pedidosConvertidos = pedidosWebData.filter((p: { estado?: string }) =>
      p.estado === 'convertido_completo' || p.estado === 'convertido_parcial'
    ).length
    const pedidosCancelados = pedidosWebData.filter((p: { estado?: string }) => p.estado === 'cancelado').length
    const pedidosUrgentes = pedidosWebData.filter((p: { es_urgente?: boolean }) => p.es_urgente).length

    // Procesar artículos
    const articulosActivos = articulosData.filter((a: { activo?: boolean }) => a.activo).length
    const articulosPorCategoria: Record<string, number> = {}
    articulosData.forEach((art: { categoria?: string }) => {
      if (art.categoria) {
        articulosPorCategoria[art.categoria] = (articulosPorCategoria[art.categoria] || 0) + 1
      }
    })
    
    // Procesar usuarios
    const usuariosPorRol: Record<string, number> = {}
    let usuariosOnline = 0
    usuariosData.forEach((usuario: { rol?: string; last_seen?: string }) => {
      usuariosPorRol[usuario.rol!] = (usuariosPorRol[usuario.rol!] || 0) + 1
      if (usuario.last_seen) {
        const lastSeen = new Date(usuario.last_seen)
        const minutosDesdeUltimaVez = (now.getTime() - lastSeen.getTime()) / (1000 * 60)
        if (minutosDesdeUltimaVez < 15) {
          usuariosOnline++
        }
      }
    })
    
    // Obtener materiales más usados
    const materialesUsados: Record<number, number> = {}
    materialesData.forEach((mat: { id_material?: number; cantidad?: number }) => {
      const id = mat.id_material!
      materialesUsados[id] = (materialesUsados[id] || 0) + (mat.cantidad || 1)
    })
    
    // Obtener detalles de materiales más usados
    const materialesIds = Object.keys(materialesUsados)
      .map(id => parseInt(id))
      .sort((a, b) => materialesUsados[b] - materialesUsados[a])
      .slice(0, 10)
    
    const materialesDetalles = materialesIds.length > 0
      ? await supabase
          .from('materiales')
          .select('id, codigo, descripcion')
          .in('id', materialesIds)
          .then(r => r.data || [])
      : []
    
    const materialesMasUsados = materialesDetalles.map((mat: { id?: number; codigo?: string; descripcion?: string }) => ({
      codigo: mat.codigo || 'N/A',
      descripcion: mat.descripcion || '',
      vecesUsado: materialesUsados[mat.id!] ?? 0
    }))
    
    // Procesar pedidos de compras
    const pedidosComprasPendientes = pedidosComprasData.filter((p: { estado?: string }) => p.estado === 'Pendiente').length
    const pedidosComprasAprobados = pedidosComprasData.filter((p: { estado?: string }) => p.estado === 'Aprobado').length
    const pedidosComprasEnCompra = pedidosComprasData.filter((p: { estado?: string }) => p.estado === 'En Compra').length
    const pedidosComprasCompletados = pedidosComprasData.filter((p: { estado?: string }) => p.estado === 'Completado').length
    
    // Procesar actividad reciente
    const actividadReciente: Array<{
      tipo: string
      descripcion: string
      usuario: string
      timestamp: string
    }> = []
    
    historialMovimientos.forEach((mov: { estado_anterior?: string; estado_nuevo?: string; nombre_usuario?: string; timestamp?: string }) => {
      actividadReciente.push({
        tipo: 'movimiento',
        descripcion: `OP movida de ${mov.estado_anterior || 'N/A'} a ${mov.estado_nuevo || 'N/A'}`,
        usuario: mov.nombre_usuario || 'Desconocido',
        timestamp: mov.timestamp || ''
      })
    })

    chatMessagesData.forEach((msg: { mensaje?: string; nombre_usuario?: string; timestamp?: string }) => {
      actividadReciente.push({
        tipo: 'chat',
        descripcion: (msg.mensaje || '').substring(0, 50),
        usuario: msg.nombre_usuario || 'Desconocido',
        timestamp: msg.timestamp || ''
      })
    })
    
    actividadReciente.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    actividadReciente.splice(20) // Mantener solo los 20 más recientes
    
    // Calcular métricas de rendimiento
    const tiemposCompletados = tiempoTrabajoData
      .filter((t: { tiempo_minutos?: number }) => t.tiempo_minutos)
      .map((t: { tiempo_minutos?: number }) => t.tiempo_minutos || 0)

    const promedioTiempoCompletado = tiemposCompletados.length > 0
      ? tiemposCompletados.reduce((a: number, b: number) => a + b, 0) / tiemposCompletados.length
      : 0
    
    const totalOrdenes = ordenesVisibles.length
    const ordenesCompletadas = ordenesVisibles.filter((o: { entregado?: boolean }) => o.entregado).length
    const tasaCompletacion = totalOrdenes > 0 ? (ordenesCompletadas / totalOrdenes) * 100 : 0
    
    // Eficiencia por sector (simplificado)
    const eficienciaPorSector: Record<string, number> = {}
    Object.keys(ordenesPorSector).forEach(sector => {
      const ordenesSector = ordenesVisibles.filter((o: { sector?: string }) => o.sector === sector)
      const completadasSector = ordenesSector.filter((o: { entregado?: boolean }) => o.entregado).length
      eficienciaPorSector[sector] = ordenesSector.length > 0
        ? (completadasSector / ordenesSector.length) * 100
        : 0
    })
    
    // Procesar ventas (facturas)
    const totalFacturas = facturasData.length
    const facturasEmitidas = facturasData.filter((f: any) => f.estado === 'Emitida').length
    const totalVentas = facturasData.reduce((acc: number, f: any) => acc + (f.total || 0), 0)
    const promedioTicket = totalFacturas > 0 ? totalVentas / totalFacturas : 0
    const porTipoComprobante: Record<string, number> = {}
    facturasData.forEach((f: any) => {
      if (!f.tipo_comprobante) return
      porTipoComprobante[f.tipo_comprobante] = (porTipoComprobante[f.tipo_comprobante] || 0) + 1
    })

    // Procesar presupuestos de ventas
    const totalPresupuestosVentas = presupuestosVentasData.length
    const presupuestosAceptados = presupuestosVentasData.filter((p: any) => p.estado === 'aceptado' || p.estado === 'Aceptado').length
    const presupuestosRechazados = presupuestosVentasData.filter((p: any) => p.estado === 'rechazado' || p.estado === 'Rechazado').length
    const presupuestosCancelados = presupuestosVentasData.filter((p: any) => p.estado === 'cancelado' || p.estado === 'Cancelado').length
    const presupuestosConvertidos = presupuestosVentasData.filter((p: any) => p.estado === 'convertido' || p.estado === 'Convertido').length
    const valorTotalPresupuestos = presupuestosVentasData.reduce((acc: number, p: any) => acc + (p.precio_total || 0), 0)
    const valorPresupuestosAceptados = presupuestosVentasData
      .filter((p: any) => p.estado === 'aceptado' || p.estado === 'Aceptado')
      .reduce((acc: number, p: any) => acc + (p.precio_total || 0), 0)

    // Generar alertas
    const alertas: Array<{
      tipo: string
      severidad: 'baja' | 'media' | 'alta' | 'critica'
      mensaje: string
    }> = []
    
    if (atrasadas > 0) {
      alertas.push({
        tipo: 'atrasos',
        severidad: atrasadas > 10 ? 'critica' : atrasadas > 5 ? 'alta' : 'media',
        mensaje: `${atrasadas} órdenes están atrasadas`
      })
    }
    
    if (urgentes > 20) {
      alertas.push({
        tipo: 'sobrecarga',
        severidad: 'alta',
        mensaje: `${urgentes} órdenes urgentes en el sistema`
      })
    }
    
    if (pedidosPendientes > 10) {
      alertas.push({
        tipo: 'pedidos_web',
        severidad: 'media',
        mensaje: `${pedidosPendientes} pedidos web pendientes de revisión`
      })
    }

    if (pedidosComprasData.filter((p: any) => ['pendiente', 'Pendiente', 'borrador'].includes(p.estado)).length > 5) {
      const comprasPend = pedidosComprasData.filter((p: any) =>
        ['pendiente', 'Pendiente', 'borrador'].includes(p.estado)
      ).length
      alertas.push({
        tipo: 'compras',
        severidad: 'media',
        mensaje: `${comprasPend} pedidos de compra pendientes/aprobación`
      })
    }

    if ((presupuestosVentasData.filter((p: any) => ['pendiente', 'enviado', 'Pendiente', 'Enviado'].includes(p.estado)).length || 0) > 8) {
      const presupPend = presupuestosVentasData.filter((p: any) =>
        ['pendiente', 'enviado', 'Pendiente', 'Enviado'].includes(p.estado)
      ).length
      alertas.push({
        tipo: 'presupuestos',
        severidad: 'media',
        mensaje: `${presupPend} presupuestos de venta en seguimiento`
      })
    }
    
    // Contar usuarios trabajando
    const usuariosTrabajando = ordenesVisibles.filter((o: any) => o.usuario_trabajando_id).length

    // Procesar reclamos (Atención al público)
    const reclamosPorEstado: Record<string, number> = {}
    let reclamosNuevos = 0
    let reclamosEnCurso = 0
    const reclamosRecientes: Array<{ id: number; cliente: string; descripcion: string; estado: string }> = []
    reclamosData.forEach((r: any) => {
      const est = r.estado || 'nuevo'
      reclamosPorEstado[est] = (reclamosPorEstado[est] || 0) + 1
      if (est === 'nuevo') reclamosNuevos++
      if (['nuevo', 'abierto', 'en_curso', 'en_revision'].includes(est)) reclamosEnCurso++
      if (reclamosRecientes.length < 10) {
        reclamosRecientes.push({
          id: r.id,
          cliente: r.cliente_nombre || r.cliente_email || 'Sin nombre',
          descripcion: (r.descripcion || '').slice(0, 80),
          estado: est
        })
      }
    })
    if (reclamosNuevos > 0) {
      alertas.push({
        tipo: 'reclamos',
        severidad: reclamosNuevos > 5 ? 'alta' : 'media',
        mensaje: `${reclamosNuevos} reclamo(s) nuevo(s) sin atender en Atención al público`
      })
    }
    
    return {
      ordenes: {
        total: ordenesVisibles.length,
        porEstado: ordenesPorEstado,
        porPrioridad: ordenesPorPrioridad,
        porSector: ordenesPorSector,
        urgentes,
        atrasadas,
        completadasHoy,
        enProceso
      },
      clientes: {
        total: clientesData.length,
        activos: clientesActivos,
        web: clientesWeb,
        nuevosEsteMes: clientesNuevosMes
      },
      pedidosWeb: {
        total: pedidosWebData.length,
        pendientes: pedidosPendientes,
        enRevision: pedidosEnRevision,
        convertidos: pedidosConvertidos,
        cancelados: pedidosCancelados,
        urgentes: pedidosUrgentes
      },
      articulos: {
        total: articulosData.length,
        activos: articulosActivos,
        porCategoria: articulosPorCategoria
      },
      usuarios: {
        total: usuariosData.length,
        porRol: usuariosPorRol,
        online: usuariosOnline,
        trabajando: usuariosTrabajando
      },
      materiales: {
        total: materialesData.length,
        masUsados: materialesMasUsados
      },
      pedidosCompras: {
        total: pedidosComprasData.length,
        pendientes: pedidosComprasPendientes,
        aprobados: pedidosComprasAprobados,
        enCompra: pedidosComprasEnCompra,
        completados: pedidosComprasCompletados
      },
      proveedores: {
        total: proveedoresData.length,
        activos: proveedoresData.filter((p: { activo?: boolean }) => p.activo).length
      },
      ventas: {
        totalFacturas,
        facturasEmitidas,
        totalVentas,
        promedioTicket,
        porTipoComprobante
      },
      presupuestosVentas: {
        total: totalPresupuestosVentas,
        aceptados: presupuestosAceptados,
        rechazados: presupuestosRechazados,
        cancelados: presupuestosCancelados,
        convertidos: presupuestosConvertidos,
        valorTotal: valorTotalPresupuestos,
        valorAceptados: valorPresupuestosAceptados
      },
      actividadReciente,
      rendimiento: {
        promedioTiempoCompletado,
        tasaCompletacion,
        eficienciaPorSector
      },
      alertas,
      cuentaCorriente: {
        total: (cuentaCorrienteRes as { count?: number })?.count ?? 0
      },
      reclamos: {
        total: reclamosData.length,
        porEstado: reclamosPorEstado,
        nuevos: reclamosNuevos,
        enCurso: reclamosEnCurso,
        recientes: reclamosRecientes
      }
    }
  } catch (error) {
    console.error('Error obteniendo contexto completo del sistema:', error)
    // Retornar contexto básico en caso de error
    return {
      ordenes: {
        total: tasks.length,
        porEstado: {},
        porPrioridad: {},
        porSector: {},
        urgentes: 0,
        atrasadas: 0,
        completadasHoy: 0,
        enProceso: 0
      },
      clientes: { total: 0, activos: 0, web: 0, nuevosEsteMes: 0 },
      pedidosWeb: { total: 0, pendientes: 0, enRevision: 0, convertidos: 0, cancelados: 0, urgentes: 0 },
      articulos: { total: 0, activos: 0, porCategoria: {} },
      usuarios: { total: teamMembers.length, porRol: {}, online: 0, trabajando: 0 },
      materiales: { total: 0, masUsados: [] },
      pedidosCompras: { total: 0, pendientes: 0, aprobados: 0, enCompra: 0, completados: 0 },
      proveedores: { total: 0, activos: 0 },
      ventas: {
        totalFacturas: 0,
        facturasEmitidas: 0,
        totalVentas: 0,
        promedioTicket: 0,
        porTipoComprobante: {}
      },
      presupuestosVentas: {
        total: 0,
        aceptados: 0,
        rechazados: 0,
        cancelados: 0,
        convertidos: 0,
        valorTotal: 0,
        valorAceptados: 0
      },
      actividadReciente: [],
      rendimiento: { promedioTiempoCompletado: 0, tasaCompletacion: 0, eficienciaPorSector: {} },
      alertas: [],
      cuentaCorriente: { total: 0 },
      reclamos: {
        total: 0,
        porEstado: {},
        nuevos: 0,
        enCurso: 0,
        recientes: []
      }
    }
  }
}

/**
 * Formatea el contexto completo para el prompt de PlotAI
 */
export function formatCompleteContextForPrompt(context: CompleteSystemContext): string {
  return `
CONTEXTO COMPLETO DEL SISTEMA PLOTRELLO:

NOTA PARA PLOTAI (precisión):
- Los totales de órdenes abajo refieren filas de trabajo **visibles en tablero** (alineado con el kanban), no uses estos agregados para adivinar datos de una OP puntual.
- Para cliente/estado/columna de una OP específica usá el "ÍNDICE COMPLETO DE OPs EN TABLERO" del bloque kanban, no inventes a partir de totales.

=== ÓRDENES DE TRABAJO ===
Total: ${context.ordenes.total}
- En proceso: ${context.ordenes.enProceso}
- Urgentes: ${context.ordenes.urgentes}
- Atrasadas: ${context.ordenes.atrasadas}
- Completadas hoy: ${context.ordenes.completadasHoy}

Distribución por Estado:
${Object.entries(context.ordenes.porEstado).map(([estado, count]) => `  - ${estado}: ${count}`).join('\n')}

Distribución por Prioridad:
${Object.entries(context.ordenes.porPrioridad).map(([prioridad, count]) => `  - ${prioridad}: ${count}`).join('\n')}

Distribución por Sector:
${Object.entries(context.ordenes.porSector).map(([sector, count]) => `  - ${sector}: ${count}`).join('\n')}

=== CLIENTES ===
Total: ${context.clientes.total}
- Activos: ${context.clientes.activos}
- Clientes Web: ${context.clientes.web}
- Nuevos este mes: ${context.clientes.nuevosEsteMes}

=== PEDIDOS WEB ===
Total: ${context.pedidosWeb.total}
- Pendientes: ${context.pedidosWeb.pendientes}
- En revisión: ${context.pedidosWeb.enRevision}
- Convertidos: ${context.pedidosWeb.convertidos}
- Cancelados: ${context.pedidosWeb.cancelados}
- Urgentes: ${context.pedidosWeb.urgentes}

=== ARTÍCULOS ===
Total: ${context.articulos.total}
- Activos: ${context.articulos.activos}

Por Categoría:
${Object.entries(context.articulos.porCategoria).map(([cat, count]) => `  - ${cat}: ${count}`).join('\n')}

=== USUARIOS Y EQUIPO ===
Total: ${context.usuarios.total}
- En línea: ${context.usuarios.online}
- Trabajando actualmente: ${context.usuarios.trabajando}

Por Rol:
${Object.entries(context.usuarios.porRol).map(([rol, count]) => `  - ${rol}: ${count}`).join('\n')}

=== MATERIALES ===
Total registrados: ${context.materiales.total}

Materiales más usados:
${context.materiales.masUsados.slice(0, 5).map((m, i) => `  ${i + 1}. ${m.codigo} - ${m.descripcion} (usado ${m.vecesUsado} veces)`).join('\n')}

=== PEDIDOS DE COMPRAS ===
Total: ${context.pedidosCompras.total}
- Pendientes: ${context.pedidosCompras.pendientes}
- Aprobados: ${context.pedidosCompras.aprobados}
- En compra: ${context.pedidosCompras.enCompra}
- Completados: ${context.pedidosCompras.completados}

=== PROVEEDORES ===
Total: ${context.proveedores.total}
- Activos: ${context.proveedores.activos}

=== VENTAS / FACTURACIÓN ===
Total de facturas: ${context.ventas?.totalFacturas ?? 0}
- Facturas emitidas: ${context.ventas?.facturasEmitidas ?? 0}
- Total vendido (monto): $${(context.ventas?.totalVentas ?? 0).toLocaleString('es-AR')}
- Ticket promedio: $${(context.ventas?.promedioTicket ?? 0).toLocaleString('es-AR')}

Por tipo de comprobante:
${context.ventas ? Object.entries(context.ventas.porTipoComprobante).map(([tipo, count]) => `  - ${tipo}: ${count}`).join('\n') : '  (sin datos)'}

=== PRESUPUESTOS DE VENTAS ===
Total de presupuestos: ${context.presupuestosVentas?.total ?? 0}
- Aceptados: ${context.presupuestosVentas?.aceptados ?? 0}
- Rechazados: ${context.presupuestosVentas?.rechazados ?? 0}
- Cancelados: ${context.presupuestosVentas?.cancelados ?? 0}
- Convertidos a venta: ${context.presupuestosVentas?.convertidos ?? 0}
- Valor total presupuestado: $${(context.presupuestosVentas?.valorTotal ?? 0).toLocaleString('es-AR')}
- Valor aceptado: $${(context.presupuestosVentas?.valorAceptados ?? 0).toLocaleString('es-AR')}

=== RENDIMIENTO ===
- Promedio tiempo completado: ${context.rendimiento.promedioTiempoCompletado.toFixed(1)} minutos
- Tasa de completación: ${context.rendimiento.tasaCompletacion.toFixed(1)}%

Eficiencia por Sector:
${Object.entries(context.rendimiento.eficienciaPorSector).map(([sector, eficiencia]) => `  - ${sector}: ${eficiencia.toFixed(1)}%`).join('\n')}

=== ACTIVIDAD RECIENTE ===
${context.actividadReciente.slice(0, 10).map(a => `[${a.tipo.toUpperCase()}] ${a.usuario}: ${a.descripcion} (${new Date(a.timestamp).toLocaleString('es-AR')})`).join('\n')}

=== MOSTRADOR - CUENTA CORRIENTE ===
Clientes habilitados para comprar a cuenta en Mostrador: ${context.cuentaCorriente?.total ?? 0}

=== RECLAMOS (Atención al público) ===
Total: ${context.reclamos?.total ?? 0}
- Nuevos (sin abrir): ${context.reclamos?.nuevos ?? 0}
- En curso (nuevo/abierto/en_curso/en_revision): ${context.reclamos?.enCurso ?? 0}

Por estado:
${context.reclamos ? Object.entries(context.reclamos.porEstado).map(([estado, count]) => `  - ${estado}: ${count}`).join('\n') : '  (sin datos)'}

Reclamos recientes:
${context.reclamos?.recientes?.length ? context.reclamos.recientes.map(r => `  #${r.id} - ${r.cliente}: ${r.descripcion}... [${r.estado}]`).join('\n') : '  (ninguno)'}

=== ALERTAS ===
${context.alertas.length > 0 
  ? context.alertas.map(a => `[${a.severidad.toUpperCase()}] ${a.mensaje}`).join('\n')
  : 'Sin alertas críticas'
}
`
}

