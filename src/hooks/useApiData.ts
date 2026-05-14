import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { Task, ActivityEvent, TeamMember } from '../types/board'

/**
 * Hook para cargar datos desde la API
 */
export function useApiData() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Cargar datos en paralelo
        const [ordenesRes, usuariosRes, historialRes] = await Promise.all([
          apiService.getOrdenes(),
          apiService.getUsuarios(),
          apiService.getHistorialMovimientos({ limit: 100 })
        ])

        if (ordenesRes.success && ordenesRes.data) {
          // Mapear órdenes a tareas
          const mappedTasks: Task[] = ordenesRes.data.map((orden: any) => ({
            id: `task-${orden.id}`,
            opNumber: orden.numero_op,
            title: orden.cliente,
            summary: orden.descripcion || '',
            status: mapEstadoToStatus(orden.estado),
            priority: mapPrioridadToPriority(orden.prioridad),
            ownerId: orden.operario_asignado || '',
            createdBy: orden.nombre_creador || 'Sistema',
            tags: [],
            materials: orden.materiales ? orden.materiales.split(',') : [],
            assignedSector: orden.sector || '',
            photoUrl: '',
            storyPoints: 0,
            progress: orden.estado === 'Almacén de Entrega' ? 100 : 0,
            createdAt: orden.fecha_creacion,
            dueDate: orden.fecha_entrega,
            updatedAt: orden.fecha_ingreso,
            impact: mapComplejidadToImpact(orden.complejidad)
          }))
          setTasks(mappedTasks)
        }

        if (usuariosRes.success && usuariosRes.data) {
          // Mapear usuarios a miembros del equipo
          const mappedMembers: TeamMember[] = usuariosRes.data.map((usuario: any) => ({
            id: `user-${usuario.id}`,
            name: usuario.nombre,
            role: usuario.rol,
            avatar: usuario.nombre.charAt(0).toUpperCase(),
            productivity: 0
          }))
          setTeamMembers(mappedMembers)
        }

        if (historialRes.success && historialRes.data) {
          // Mapear historial a eventos de actividad
          const mappedActivity: ActivityEvent[] = historialRes.data.map((mov: any) => ({
            id: `activity-${mov.id}`,
            taskId: String(mov.id_orden),
            from: mapEstadoToStatus(mov.estado_anterior),
            to: mapEstadoToStatus(mov.estado_nuevo),
            actorId: String(mov.id_usuario ?? ''),
            actorName: typeof mov.nombre_usuario === 'string' ? mov.nombre_usuario.trim() || null : null,
            timestamp: mov.timestamp,
            note: mov.comentario || ''
          }))
          setActivity(mappedActivity)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return { tasks, activity, teamMembers, loading, error, setTasks, setActivity }
}

// Funciones de mapeo
function mapEstadoToStatus(estado: string): any {
  const mapping: Record<string, any> = {
    'Diseño Gráfico': 'diseno-grafico',
    'Diseño en Proceso': 'diseno-proceso',
    'En Espera': 'en-espera',
    'Imprenta (Área de Impresión)': 'imprenta',
    'Taller de Imprenta': 'taller-imprenta',
    'Taller Gráfico': 'taller-grafico',
    'Instalaciones': 'instalaciones',
    'Metalúrgica': 'metalurgica',
    'Finalizado en Taller': 'finalizado-taller',
    'Almacén de Entrega': 'almacen-entrega',
    'Entregado o Instalado': 'almacen-entrega'
  }
  return mapping[estado] || 'diseno-grafico'
}

function mapPrioridadToPriority(prioridad: string): 'alta' | 'media' | 'baja' {
  const mapping: Record<string, 'alta' | 'media' | 'baja'> = {
    'Alta': 'alta',
    'Normal': 'media',
    'Media': 'media',
    'Baja': 'baja'
  }
  return mapping[prioridad] || 'media'
}

function mapComplejidadToImpact(complejidad: string): 'alta' | 'media' | 'low' {
  const mapping: Record<string, 'alta' | 'media' | 'low'> = {
    'Alta': 'alta',
    'Media': 'media',
    'Baja': 'low'
  }
  return mapping[complejidad] || 'media'
}

