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
      chatMessagesData
    ] = await Promise.all([
      // Órdenes de Trabajo
      supabase
        .from('ordenes_trabajo')
        .select('id, estado, prioridad, sector, fecha_entrega, fecha_creacion, entregado, fecha_entrega_efectiva, usuario_trabajando_id')
        .then(r => r.data || []),
      
      // Clientes
      supabase
        .from('clientes')
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
        .from('usuarios')
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
        .then(r => r.data || [])
    ])
    
    // Procesar datos de órdenes
    const ordenesPorEstado: Record<string, number> = {}
    const ordenesPorPrioridad: Record<string, number> = {}
    const ordenesPorSector: Record<string, number> = {}
    let urgentes = 0
    let atrasadas = 0
    let completadasHoy = 0
    let enProceso = 0
    
    ordenesData.forEach(orden => {
      // Por estado
      ordenesPorEstado[orden.estado] = (ordenesPorEstado[orden.estado] || 0) + 1
      
      // Por prioridad
      ordenesPorPrioridad[orden.prioridad] = (ordenesPorPrioridad[orden.prioridad] || 0) + 1
      
      // Por sector
      ordenesPorSector[orden.sector] = (ordenesPorSector[orden.sector] || 0) + 1
      
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
    const clientesActivos = clientesData.filter(c => c.activo).length
    const clientesWeb = clientesData.filter(c => c.es_cliente_web).length
    const clientesNuevosMes = clientesData.filter(c => {
      if (!c.created_at) return false
      const fechaCreacion = new Date(c.created_at)
      return fechaCreacion >= inicioMes
    }).length
    
    // Procesar pedidos web
    const pedidosPendientes = pedidosWebData.filter(p => p.estado === 'pendiente').length
    const pedidosEnRevision = pedidosWebData.filter(p => p.estado === 'en_revision').length
    const pedidosConvertidos = pedidosWebData.filter(p => 
      p.estado === 'convertido_completo' || p.estado === 'convertido_parcial'
    ).length
    const pedidosCancelados = pedidosWebData.filter(p => p.estado === 'cancelado').length
    const pedidosUrgentes = pedidosWebData.filter(p => p.es_urgente).length
    
    // Procesar artículos
    const articulosActivos = articulosData.filter(a => a.activo).length
    const articulosPorCategoria: Record<string, number> = {}
    articulosData.forEach(art => {
      if (art.categoria) {
        articulosPorCategoria[art.categoria] = (articulosPorCategoria[art.categoria] || 0) + 1
      }
    })
    
    // Procesar usuarios
    const usuariosPorRol: Record<string, number> = {}
    let usuariosOnline = 0
    usuariosData.forEach(usuario => {
      usuariosPorRol[usuario.rol] = (usuariosPorRol[usuario.rol] || 0) + 1
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
    materialesData.forEach(mat => {
      materialesUsados[mat.id_material] = (materialesUsados[mat.id_material] || 0) + (mat.cantidad || 1)
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
    
    const materialesMasUsados = materialesDetalles.map(mat => ({
      codigo: mat.codigo || 'N/A',
      descripcion: mat.descripcion,
      vecesUsado: materialesUsados[mat.id]
    }))
    
    // Procesar pedidos de compras
    const pedidosComprasPendientes = pedidosComprasData.filter(p => p.estado === 'Pendiente').length
    const pedidosComprasAprobados = pedidosComprasData.filter(p => p.estado === 'Aprobado').length
    const pedidosComprasEnCompra = pedidosComprasData.filter(p => p.estado === 'En Compra').length
    const pedidosComprasCompletados = pedidosComprasData.filter(p => p.estado === 'Completado').length
    
    // Procesar actividad reciente
    const actividadReciente: Array<{
      tipo: string
      descripcion: string
      usuario: string
      timestamp: string
    }> = []
    
    historialMovimientos.forEach(mov => {
      actividadReciente.push({
        tipo: 'movimiento',
        descripcion: `OP movida de ${mov.estado_anterior || 'N/A'} a ${mov.estado_nuevo || 'N/A'}`,
        usuario: mov.nombre_usuario || 'Desconocido',
        timestamp: mov.timestamp
      })
    })
    
    chatMessagesData.forEach(msg => {
      actividadReciente.push({
        tipo: 'chat',
        descripcion: msg.mensaje?.substring(0, 50) || '',
        usuario: msg.nombre_usuario || 'Desconocido',
        timestamp: msg.timestamp
      })
    })
    
    actividadReciente.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    actividadReciente.splice(20) // Mantener solo los 20 más recientes
    
    // Calcular métricas de rendimiento
    const tiemposCompletados = tiempoTrabajoData
      .filter(t => t.tiempo_minutos)
      .map(t => t.tiempo_minutos || 0)
    
    const promedioTiempoCompletado = tiemposCompletados.length > 0
      ? tiemposCompletados.reduce((a, b) => a + b, 0) / tiemposCompletados.length
      : 0
    
    const totalOrdenes = ordenesData.length
    const ordenesCompletadas = ordenesData.filter(o => o.entregado).length
    const tasaCompletacion = totalOrdenes > 0 ? (ordenesCompletadas / totalOrdenes) * 100 : 0
    
    // Eficiencia por sector (simplificado)
    const eficienciaPorSector: Record<string, number> = {}
    Object.keys(ordenesPorSector).forEach(sector => {
      const ordenesSector = ordenesData.filter(o => o.sector === sector)
      const completadasSector = ordenesSector.filter(o => o.entregado).length
      eficienciaPorSector[sector] = ordenesSector.length > 0
        ? (completadasSector / ordenesSector.length) * 100
        : 0
    })
    
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
    
    // Contar usuarios trabajando
    const usuariosTrabajando = ordenesData.filter((o: any) => o.usuario_trabajando_id).length
    
    return {
      ordenes: {
        total: ordenesData.length,
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
        activos: proveedoresData.filter(p => p.activo).length
      },
      actividadReciente,
      rendimiento: {
        promedioTiempoCompletado,
        tasaCompletacion,
        eficienciaPorSector
      },
      alertas
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
      actividadReciente: [],
      rendimiento: { promedioTiempoCompletado: 0, tasaCompletacion: 0, eficienciaPorSector: {} },
      alertas: []
    }
  }
}

/**
 * Formatea el contexto completo para el prompt de PlotAI
 */
export function formatCompleteContextForPrompt(context: CompleteSystemContext): string {
  return `
CONTEXTO COMPLETO DEL SISTEMA PLOTRELLO:

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

=== RENDIMIENTO ===
- Promedio tiempo completado: ${context.rendimiento.promedioTiempoCompletado.toFixed(1)} minutos
- Tasa de completación: ${context.rendimiento.tasaCompletacion.toFixed(1)}%

Eficiencia por Sector:
${Object.entries(context.rendimiento.eficienciaPorSector).map(([sector, eficiencia]) => `  - ${sector}: ${eficiencia.toFixed(1)}%`).join('\n')}

=== ACTIVIDAD RECIENTE ===
${context.actividadReciente.slice(0, 10).map(a => `[${a.tipo.toUpperCase()}] ${a.usuario}: ${a.descripcion} (${new Date(a.timestamp).toLocaleString('es-AR')})`).join('\n')}

=== ALERTAS ===
${context.alertas.length > 0 
  ? context.alertas.map(a => `[${a.severidad.toUpperCase()}] ${a.mensaje}`).join('\n')
  : 'Sin alertas críticas'
}
`
}

