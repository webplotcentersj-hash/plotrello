import { BOARD_COLUMNS } from '../data/mockData'
import type {
  ClienteRecord,
  HistorialMovimiento,
  HistorialEtapaTallerGrafico,
  HistorialEtapaInstalaciones,
  HistorialEtapaTallerImprenta,
  HistorialEtapaMetalurgica,
  MaterialRecord,
  Notification,
  OrdenTrabajo,
  SectorRecord,
  TareaSubitem,
  TareaRecord,
  UsuarioRecord,
  UserRole,
  LegajoEmpleado,
  ClienteWebRecord,
  ArticuloEmpresaRecord,
  ArticuloEmpresaImagenRecord,
  PedidoClienteRecord,
  PedidoClienteDetalle,
  MensajePedidoClienteRecord,
  PresupuestoClienteRecord,
  PresupuestoClienteItemRecord,
  ActaSectorRecord,
  TipoNovedad,
  HorarioEmpleado,
  Turno,
  Ausencia,
  Asistencia,
  SolicitudPermiso,
  Evaluacion,
  CriterioEvaluacion,
  Capacitacion,
  InscripcionCapacitacion,
  MenuDiario,
  MenuSeleccion
} from '../types/api'
import type {
  PedidoCompra,
  PedidoCompraComentario,
  StockMovimiento,
  ArticuloStock,
  EstadoPedido,
  PrioridadPedido,
  Proveedor,
  ProveedorProducto,
  Presupuesto,
  PrecioHistorial,
  ComparacionPresupuestos,
  EstadoPresupuesto,
  Pago,
  MovimientoBancario,
  ConciliacionBancaria,
  EstadoPago
} from '../types/pedidos'
import { supabase, stockSupabase } from './supabaseClient'
import bcrypt from 'bcryptjs'

const LEGACY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const hasLegacyBackend = Boolean(LEGACY_API_BASE_URL)

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

type ReaccionesMap = Record<string, number[]>

type ChatMessageUI = {
  id: number
  canal: string
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  tipo: 'message' | 'alert' | 'buzz'
  timestamp: string
  archivos_urls?: string[]
  reply_to_id?: number | null
  reacciones?: ReaccionesMap
  estado_entrega?: 'sent' | 'read'
}

const fallbackOrdenes: OrdenTrabajo[] = []

const fallbackHistorial: HistorialMovimiento[] = []

const fallbackUsuarios: UsuarioRecord[] = []

const fallbackSectores: SectorRecord[] = BOARD_COLUMNS.map((col, index) => ({
  id: index + 1,
  nombre: col.label,
  color: col.accent
}))

const fallbackMateriales: MaterialRecord[] = []

const fallbackMensajes: ChatMessageUI[] = []

// Mapeo de canales a room_id - cada canal tiene su propio room
const chatChannelToRoom: Record<string, number> = {
  'general': 1,
  'diseno': 2,
  'recursos-humanos': 3,
  'metalurgica': 4,
  'mostrador': 5,
  'taller-grafico': 6,
  'random': 7
}

// Mapeo inverso: room_id -> canal
const roomToChatChannel: Record<number, string> = {
  1: 'general',
  2: 'diseno',
  3: 'recursos-humanos',
  4: 'metalurgica',
  5: 'mostrador',
  6: 'taller-grafico',
  7: 'random'
}

class ApiService {
  private legacyRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    if (!LEGACY_API_BASE_URL) {
      return Promise.resolve({ success: false, error: 'Backend legacy no configurado' })
    }

    const token = localStorage.getItem('auth_token')

    return fetch(`${LEGACY_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(
            errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
          )
        }
        return response.json()
      })
      .catch((error) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión'
      }))
  }

  private handleFallback<T>(data: T): ApiResponse<T> {
    return { success: true, data }
  }

  // ========== ORDENES DE TRABAJO ==========
  async getOrdenByOpNumber(opNumber: string): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      // Crear cliente sin autenticación para acceso público
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return { success: false, error: 'Configuración de Supabase no encontrada' }
      }

      const publicClient = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data, error } = await publicClient
        .from('ordenes_trabajo')
        .select('*')
        .eq('numero_op', opNumber)
        .maybeSingle()

      if (error) {
        console.error('Error fetching orden by OP number:', error)
        return { success: false, error: error.message }
      }
      
      if (!data) {
        return { success: false, error: 'Orden no encontrada' }
      }
      
      return { success: true, data: data as OrdenTrabajo }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getOrdenes(): Promise<ApiResponse<OrdenTrabajo[]>> {
    if (supabase) {
      try {
        // Usar select('*') para obtener todas las columnas disponibles automáticamente
        const { data, error } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .order('fecha_creacion', { ascending: false })

        if (error) {
          console.error('Supabase getOrdenes error:', error)
          return { success: false, error: error.message }
        }

        // Si hay datos, asegurarse de que los campos opcionales estén definidos (aunque sean null)
        const normalizedData = (data || []).map((orden: any) => ({
          ...orden,
          foto_url: orden.foto_url || null,
          telefono_cliente: orden.telefono_cliente || null,
          email_cliente: orden.email_cliente || null,
          direccion_cliente: orden.direccion_cliente || null,
          whatsapp_link: orden.whatsapp_link || null,
          ubicacion_link: orden.ubicacion_link || null,
          drive_link: orden.drive_link || null
        }))

        return { success: true, data: normalizedData as OrdenTrabajo[] }
      } catch (err: any) {
        // Capturar errores de red (Failed to fetch, CORS, etc.)
        console.error('Error de conexión en getOrdenes:', err)
        const errorMessage = err?.message || 'Error de conexión con la base de datos'
        
        // Verificar si es un error de red
        if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
          return { 
            success: false, 
            error: 'No se pudo conectar con Supabase. Verifica tu conexión a internet y la configuración de VITE_SUPABASE_URL.' 
          }
        }
        
        return { success: false, error: errorMessage }
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes.php')
    }

    return this.handleFallback(fallbackOrdenes)
  }

  async getOrden(id: number): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'Orden no encontrada' }
      return { success: true, data: data as OrdenTrabajo }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`)
    }

    const orden = fallbackOrdenes.find((o) => o.id === id)
    return orden
      ? { success: true, data: orden }
      : { success: false, error: 'Orden no encontrada en fallback' }
  }

  async createOrden(orden: Partial<OrdenTrabajo>): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      // Capturar supabase en variable local para TypeScript
      const supabaseClient = supabase
      
      // SOLUCIÓN DIRECTA: Si hay campos de contacto o sectores múltiples, usar función SQL que evita schema cache
      const hasContactFields = orden.telefono_cliente || orden.direccion_cliente || orden.drive_link || 
          orden.ubicacion_link || orden.email_cliente || orden.whatsapp_link
      const hasMultipleSectors = orden.sectores && orden.sectores.length > 0
      
      if (hasContactFields || hasMultipleSectors) {
        try {
          console.log('🔄 Usando función SQL para crear orden (evita schema cache)')
          console.log('📋 Datos a enviar:', {
            p_sectores: orden.sectores,
            p_sector_inicial: orden.sector_inicial,
            p_sector: orden.sector_inicial || orden.sector,
            hasMultipleSectors,
            hasContactFields
          })
          // Normalizar etiquetas: asegurar que sea un array válido o null
          const etiquetasNormalizadas = orden.etiquetas && Array.isArray(orden.etiquetas) && orden.etiquetas.length > 0 
            ? orden.etiquetas.filter(e => e && e.trim().length > 0) // Filtrar etiquetas vacías
            : null
          
          console.log('🏷️ Etiquetas recibidas:', orden.etiquetas)
          console.log('🏷️ Etiquetas normalizadas:', etiquetasNormalizadas)
          
          const rpcParams = {
            p_numero_op: orden.numero_op || '',
            p_cliente: orden.cliente || '',
            p_descripcion: orden.descripcion || null,
            p_estado: orden.estado || 'Pendiente',
            p_prioridad: orden.prioridad || 'Normal',
            p_fecha_entrega: orden.fecha_entrega || new Date().toISOString().split('T')[0],
            p_operario_asignado: orden.operario_asignado || null,
            p_complejidad: orden.complejidad || 'Media',
            p_sector: orden.sectores && orden.sectores.length > 0 ? orden.sectores[0] : (orden.sector || 'Diseño Gráfico'), // Primer sector
            p_sectores: orden.sectores && orden.sectores.length > 0 ? orden.sectores : null,
            p_sector_inicial: orden.sectores && orden.sectores.length > 0 ? orden.sectores[0] : (orden.sector || null), // Para compatibilidad
            p_materiales: orden.materiales || null,
            p_nombre_creador: orden.nombre_creador || null,
            p_telefono_cliente: orden.telefono_cliente || null,
            p_email_cliente: orden.email_cliente || null,
            p_direccion_cliente: orden.direccion_cliente || null,
            p_whatsapp_link: orden.whatsapp_link || null,
            p_ubicacion_link: orden.ubicacion_link || null,
            p_drive_link: orden.drive_link || null,
            p_foto_url: orden.foto_url || null,
            p_dni_cuit: orden.dni_cuit || null,
            p_es_ficha_no_op: orden.es_ficha_no_op || false,
            p_planilla_preliminar: orden.planilla_preliminar || false,
            p_ficha_tecnica_pdf_url: orden.ficha_tecnica_pdf_url || null,
            p_etiquetas: etiquetasNormalizadas,
            p_brief_publico: orden.brief_publico || null,
            p_objetivo_proyecto: orden.objetivo_proyecto || null,
            p_publico_objetivo: orden.publico_objetivo || null,
            p_estilo_diseno: orden.estilo_diseno || null,
            p_referencias: orden.referencias || null,
            p_deadline_brief: orden.deadline_brief || null
          }
          
          console.log('🔍 Llamando función SQL con parámetros:', JSON.stringify(rpcParams, null, 2))
          console.log('🔍 Tipos de parámetros:', Object.entries(rpcParams).map(([k, v]) => `${k}: ${typeof v}${Array.isArray(v) ? ' (array)' : ''}`).join(', '))
          console.log('🏷️ p_etiquetas específicamente:', rpcParams.p_etiquetas, 'tipo:', typeof rpcParams.p_etiquetas, 'es array:', Array.isArray(rpcParams.p_etiquetas))
          
          const { data, error } = await supabaseClient.rpc('create_orden_with_contact', rpcParams)
          
          if (error) {
            console.error('❌ Error en RPC create_orden_with_contact:', error)
            console.error('❌ Parámetros enviados:', JSON.stringify(rpcParams, null, 2))
            console.error('❌ Etiquetas específicamente:', rpcParams.p_etiquetas)
          }
          
          console.log('📊 Respuesta RPC:', { 
            hasData: data !== null && data !== undefined, 
            dataType: typeof data, 
            isArray: Array.isArray(data),
            dataValue: data,
            hasError: error !== null,
            errorType: error ? typeof error : null
          })
          
          if (error) {
            console.error('❌ Error en función SQL:', error)
            console.error('❌ Detalles completos del error:', JSON.stringify(error, null, 2))
            console.error('❌ Propiedades del error:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              name: error.name
            })
            
            // Log adicional para debugging
            console.error('❌ Parámetros enviados:', JSON.stringify(rpcParams, null, 2))
            
            // Retornar el error en lugar de continuar silenciosamente
            const errorMsg = error.message || 'Error desconocido'
            const errorHint = error.hint ? ` (${error.hint})` : ''
            const errorDetails = error.details ? ` - ${error.details}` : ''
            
            return { 
              success: false, 
              error: `Error al crear orden: ${errorMsg}${errorHint}${errorDetails}` 
            }
          }
          
          console.log('📥 Respuesta de función SQL (raw):', { data, type: typeof data, isArray: Array.isArray(data) })
          
          if (data !== null && data !== undefined) {
            // La función ahora retorna solo el ID (integer)
            const ordenId = typeof data === 'number' ? data : (Array.isArray(data) && data.length > 0 ? data[0] : null)
            
            if (ordenId && typeof ordenId === 'number') {
              console.log('✅ Orden creada usando función SQL, ID:', ordenId)
              // Obtener la orden completa después de la creación
              const { data: fullOrden, error: fetchError } = await supabaseClient
                .from('ordenes_trabajo')
                .select('*')
                .eq('id', ordenId)
                .single()
              
              if (fetchError) {
                console.error('❌ Error obteniendo orden completa:', fetchError)
                return { success: false, error: `Error al obtener orden creada: ${fetchError.message}` }
              }
              
              if (fullOrden) {
                // Descontar stock si hay materiales asociados
                await this.descontarStockDeOrden(fullOrden.id, fullOrden.numero_op || '')
                console.log('✅ Orden completa obtenida:', fullOrden)
                return { success: true, data: fullOrden as OrdenTrabajo }
              }
              
              return { success: false, error: 'No se pudo obtener la orden creada' }
            } else {
              console.error('❌ La función retornó un ID inválido:', { data, ordenId, type: typeof ordenId })
              return { 
                success: false, 
                error: `La función SQL retornó un ID inválido: ${JSON.stringify(data)}` 
              }
            }
          } else {
            console.error('❌ La función SQL retornó null o undefined')
            return { 
              success: false, 
              error: 'La función SQL no retornó ningún ID. Verifica que la función se ejecutó correctamente.' 
            }
          }
        } catch (err) {
          console.error('❌ Excepción al usar función SQL:', err)
          const errorMessage = err instanceof Error ? err.message : String(err)
          return { 
            success: false, 
            error: `Error inesperado al crear orden: ${errorMessage}` 
          }
        }
      }
      
      // Preparar el objeto para insertar
      const ordenToInsert = { ...orden }
      
      // Asegurar que sectores sea un array válido
      if (ordenToInsert.sectores && ordenToInsert.sectores.length > 0) {
        ordenToInsert.sectores = ordenToInsert.sectores
      } else if (ordenToInsert.sector) {
        // Si no hay sectores múltiples, usar el sector único como array
        ordenToInsert.sectores = [ordenToInsert.sector]
      } else {
        ordenToInsert.sectores = null
      }
      
      // Asegurar que sector_inicial esté definido
      if (!ordenToInsert.sector_inicial && ordenToInsert.sector) {
        ordenToInsert.sector_inicial = ordenToInsert.sector
      }
      
      // Solo eliminar foto_url si está vacío, null o undefined (pero NUNCA eliminarlo si tiene valor)
      if (ordenToInsert.foto_url && ordenToInsert.foto_url.trim() !== '') {
        // Mantener foto_url - es importante
        console.log('📸 Foto URL presente:', ordenToInsert.foto_url)
      } else {
        // Solo eliminar si realmente está vacío
        delete ordenToInsert.foto_url
      }
      
      // Asegurar que dni_cuit se envíe correctamente (incluso si es null o string vacío)
      if (ordenToInsert.dni_cuit === undefined) {
        ordenToInsert.dni_cuit = null
      } else if (ordenToInsert.dni_cuit === '') {
        ordenToInsert.dni_cuit = null
      }
      
      console.log('📤 Creando orden. Payload completo:', JSON.stringify(ordenToInsert, null, 2))
      console.log('📞 Datos de contacto en payload:', {
        telefono: ordenToInsert.telefono_cliente || 'null',
        ubicacion: ordenToInsert.ubicacion_link || 'null',
        direccion: ordenToInsert.direccion_cliente || 'null',
        email: ordenToInsert.email_cliente || 'null',
        whatsapp: ordenToInsert.whatsapp_link || 'null',
        drive: ordenToInsert.drive_link || 'null',
        foto: ordenToInsert.foto_url ? 'presente' : 'null'
      })
      
      const performInsert = async (payload: Partial<OrdenTrabajo>) => {
        return supabaseClient.from('ordenes_trabajo').insert(payload).select().single()
      }

      // Intentar insertar primero con todos los datos
      let { data, error } = await performInsert(ordenToInsert)

      if (error) {
        console.error('❌ Error al crear orden:', error.message, error)
        const errorLower = error.message.toLowerCase()
        const isColumnError = errorLower.includes('column') || 
                              errorLower.includes('does not exist') || 
                              errorLower.includes('not found') ||
                              errorLower.includes('schema cache') ||
                              errorLower.includes('could not find')
        
        if (isColumnError) {
          // Separar foto_url de las otras columnas opcionales - foto_url es más importante
          const contactColumns = [
            'telefono_cliente',
            'email_cliente',
            'direccion_cliente',
            'whatsapp_link',
            'ubicacion_link',
            'drive_link'
          ]
          const allOptionalColumns = ['foto_url', ...contactColumns]

          // Detectar SOLO las columnas que específicamente están mencionadas en el error
          const missingColumns: string[] = []
          allOptionalColumns.forEach((col) => {
            // Buscar el nombre exacto de la columna en el error (con guiones bajos y espacios)
            const colPattern = col.toLowerCase().replace(/_/g, '[ _]')
            const regex = new RegExp(colPattern, 'i')
            if (regex.test(errorLower)) {
              missingColumns.push(col)
            }
          })
          
          if (missingColumns.length > 0) {
            console.warn(`⚠️ Columnas faltantes detectadas en el error: ${missingColumns.join(', ')}`)
            // Eliminar SOLO las columnas que específicamente faltan
            const sanitizedPayload: Partial<OrdenTrabajo> = { ...ordenToInsert }
            missingColumns.forEach((col) => {
              // @ts-expect-error index access
              delete sanitizedPayload[col]
            })

            console.log(`⚠️ Eliminando columnas faltantes: ${missingColumns.join(', ')}. Reintentando...`)
            console.log('📤 Payload sanitizado:', JSON.stringify(sanitizedPayload, null, 2))
            const fallback = await performInsert(sanitizedPayload)
            
            if (fallback.error) {
              console.error('❌ Error persistente después de eliminar columnas:', fallback.error.message)
              // Si aún falla, puede ser otra columna. Intentar sin SOLO las columnas de contacto (mantener foto_url si existe)
              const minimalPayload: Partial<OrdenTrabajo> = { ...sanitizedPayload }
              // Solo eliminar columnas de contacto, NO foto_url
              contactColumns.forEach((col) => {
                // @ts-expect-error index access
                delete minimalPayload[col]
              })
              
              // Si foto_url estaba en el error, también eliminarlo
              if (missingColumns.includes('foto_url')) {
                delete minimalPayload.foto_url
              }
              
              console.log('⚠️ Reintentando sin columnas de contacto...')
              const finalAttempt = await performInsert(minimalPayload)
              if (finalAttempt.error) {
                console.error('❌ Error final:', finalAttempt.error.message)
                return { success: false, error: finalAttempt.error.message }
              }
              console.log('✅ Orden creada sin algunas columnas opcionales')
              return { success: true, data: finalAttempt.data as OrdenTrabajo }
            }

            // Éxito después de eliminar columnas faltantes
            console.log(`✅ Orden creada. Columnas eliminadas: ${missingColumns.join(', ')}`)
            return { success: true, data: fallback.data as OrdenTrabajo }
          } else {
            // El error menciona "column" pero no menciona ninguna columna específica de contacto
            // Esto podría ser un error de otra columna. Intentar de todas formas.
            console.warn('⚠️ Error de columna detectado pero no se identificaron columnas de contacto específicas. Reintentando sin columnas de contacto...')
            const minimalPayload: Partial<OrdenTrabajo> = { ...ordenToInsert }
            contactColumns.forEach((col) => {
              // @ts-expect-error index access
              delete minimalPayload[col]
            })
            const finalAttempt = await performInsert(minimalPayload)
            if (finalAttempt.error) {
              console.error('❌ Error final:', finalAttempt.error.message)
              return { success: false, error: finalAttempt.error.message }
            }
            console.log('✅ Orden creada sin columnas de contacto (fallback)')
            return { success: true, data: finalAttempt.data as OrdenTrabajo }
          }
        }

        // Si el error NO es por columnas faltantes, retornar el error
        console.error('❌ Error no relacionado con columnas:', error.message)
        return { success: false, error: error.message }
      }
      
      // Log de éxito con datos guardados
      if (ordenToInsert.telefono_cliente || ordenToInsert.email_cliente || ordenToInsert.direccion_cliente) {
        console.log('✅ Orden creada con datos de contacto:', {
          telefono: ordenToInsert.telefono_cliente || 'no',
          email: ordenToInsert.email_cliente || 'no',
          direccion: ordenToInsert.direccion_cliente || 'no',
          whatsapp: ordenToInsert.whatsapp_link || 'no',
          ubicacion: ordenToInsert.ubicacion_link || 'no',
          drive: ordenToInsert.drive_link || 'no'
        })
      }

      return { success: true, data: data as OrdenTrabajo }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes.php', { method: 'POST', body: JSON.stringify(orden) })
    }

    const nuevo = { ...orden, id: fallbackOrdenes.length + 1 } as OrdenTrabajo
    fallbackOrdenes.push(nuevo)
    return { success: true, data: nuevo }
  }

  async updateOrden(id: number, orden: Partial<OrdenTrabajo>): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      // Capturar supabase en variable local para TypeScript
      const supabaseClient = supabase
      
      // SOLUCIÓN DIRECTA: Si hay campos de contacto, usar función SQL que evita schema cache
      if (orden.telefono_cliente || orden.direccion_cliente || orden.drive_link || 
          orden.ubicacion_link || orden.email_cliente || orden.whatsapp_link) {
        try {
          console.log('🔄 Usando función SQL para actualizar (evita schema cache)')
          const { data, error } = await supabaseClient.rpc('update_orden_with_contact', {
            p_id: id,
            p_telefono_cliente: orden.telefono_cliente || null,
            p_email_cliente: orden.email_cliente || null,
            p_direccion_cliente: orden.direccion_cliente || null,
            p_whatsapp_link: orden.whatsapp_link || null,
            p_ubicacion_link: orden.ubicacion_link || null,
            p_drive_link: orden.drive_link || null,
            p_foto_url: orden.foto_url || null
          })
          
          if (error) {
            console.error('❌ Error en función SQL:', error)
            // Si falla la función, continuar con el método normal
          } else if (data && data.length > 0) {
            console.log('✅ Orden actualizada usando función SQL')
            // Obtener la orden completa después de la actualización
            const { data: fullOrden, error: fetchError } = await supabaseClient
              .from('ordenes_trabajo')
              .select('*')
              .eq('id', id)
              .single()
            
            if (fetchError) {
              return { success: false, error: fetchError.message }
            }
            
            if (fullOrden) {
              // Descontar stock si hay materiales asociados (solo si se actualizaron materiales)
              // Nota: En actualización no descontamos automáticamente, solo al crear
              return { success: true, data: fullOrden as OrdenTrabajo }
            }
            
            return { success: false, error: 'No se pudo obtener la orden actualizada' }
          }
        } catch (err) {
          console.warn('⚠️ Error al usar función SQL, continuando con método normal:', err)
          // Continuar con el método normal si la función no existe o falla
        }
      }
      
      // Preparar el objeto para actualizar
      const ordenToUpdate = { ...orden }
      
      // Solo eliminar foto_url si está vacío, null o undefined (pero NUNCA eliminarlo si tiene valor)
      if (ordenToUpdate.foto_url && ordenToUpdate.foto_url.trim() !== '') {
        // Mantener foto_url - es importante
        console.log('📸 Foto URL presente en actualización:', ordenToUpdate.foto_url)
      } else {
        // Solo eliminar si realmente está vacío
        delete ordenToUpdate.foto_url
      }
      
      // Asegurar que dni_cuit se envíe correctamente (incluso si es null o string vacío)
      if (ordenToUpdate.dni_cuit === undefined) {
        // Si no viene en el update, no lo modificamos (mantener valor existente)
        delete ordenToUpdate.dni_cuit
      } else if (ordenToUpdate.dni_cuit === '') {
        ordenToUpdate.dni_cuit = null
      }
      
      console.log('📤 Actualizando orden. Payload completo:', JSON.stringify(ordenToUpdate, null, 2))
      console.log('📞 Datos de contacto en actualización:', {
        telefono: ordenToUpdate.telefono_cliente || 'null',
        ubicacion: ordenToUpdate.ubicacion_link || 'null',
        direccion: ordenToUpdate.direccion_cliente || 'null',
        email: ordenToUpdate.email_cliente || 'null',
        whatsapp: ordenToUpdate.whatsapp_link || 'null',
        drive: ordenToUpdate.drive_link || 'null',
        foto: ordenToUpdate.foto_url ? 'presente' : 'null'
      })

      const performUpdate = async (payload: Partial<OrdenTrabajo>) => {
        return supabaseClient
          .from('ordenes_trabajo')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
      }

      // Intentar actualizar primero con todos los datos
      let { data, error } = await performUpdate(ordenToUpdate)

      if (error) {
        console.error('❌ Error al actualizar orden:', error.message, error)
        const errorLower = error.message.toLowerCase()
        const isColumnError = errorLower.includes('column') || 
                              errorLower.includes('does not exist') || 
                              errorLower.includes('not found') ||
                              errorLower.includes('schema cache') ||
                              errorLower.includes('could not find')
        
        if (isColumnError) {
          // Separar foto_url de las otras columnas opcionales - foto_url es más importante
          const contactColumns = [
            'telefono_cliente',
            'email_cliente',
            'direccion_cliente',
            'whatsapp_link',
            'ubicacion_link',
            'drive_link'
          ]
          const allOptionalColumns = ['foto_url', ...contactColumns]

          // Detectar SOLO las columnas que específicamente están mencionadas en el error
          const missingColumns: string[] = []
          allOptionalColumns.forEach((col) => {
            // Buscar el nombre exacto de la columna en el error (con guiones bajos y espacios)
            const colPattern = col.toLowerCase().replace(/_/g, '[ _]')
            const regex = new RegExp(colPattern, 'i')
            if (regex.test(errorLower)) {
              missingColumns.push(col)
            }
          })
          
          if (missingColumns.length > 0) {
            console.warn(`⚠️ Columnas faltantes detectadas en el error: ${missingColumns.join(', ')}`)
            // Eliminar SOLO las columnas que específicamente faltan
            const sanitizedPayload: Partial<OrdenTrabajo> = { ...ordenToUpdate }
            missingColumns.forEach((col) => {
              // @ts-expect-error index access
              delete sanitizedPayload[col]
            })

            console.log(`⚠️ Eliminando columnas faltantes: ${missingColumns.join(', ')}. Reintentando...`)
            console.log('📤 Payload sanitizado:', JSON.stringify(sanitizedPayload, null, 2))
            const fallback = await performUpdate(sanitizedPayload)
            
            if (fallback.error) {
              console.error('❌ Error persistente después de eliminar columnas:', fallback.error.message)
              // Si aún falla, puede ser otra columna. Intentar sin SOLO las columnas de contacto (mantener foto_url si existe)
              const minimalPayload: Partial<OrdenTrabajo> = { ...sanitizedPayload }
              // Solo eliminar columnas de contacto, NO foto_url
              contactColumns.forEach((col) => {
                // @ts-expect-error index access
                delete minimalPayload[col]
              })
              
              // Si foto_url estaba en el error, también eliminarlo
              if (missingColumns.includes('foto_url')) {
                delete minimalPayload.foto_url
              }
              
              console.log('⚠️ Reintentando sin columnas de contacto...')
              const finalAttempt = await performUpdate(minimalPayload)
              if (finalAttempt.error) {
                console.error('❌ Error final:', finalAttempt.error.message)
                return { success: false, error: finalAttempt.error.message }
              }
              console.log('✅ Orden actualizada sin algunas columnas opcionales')
              return { success: true, data: finalAttempt.data as OrdenTrabajo }
            }

            // Éxito después de eliminar columnas faltantes
            console.log(`✅ Orden actualizada. Columnas eliminadas: ${missingColumns.join(', ')}`)
            return { success: true, data: fallback.data as OrdenTrabajo }
          } else {
            // El error menciona "column" pero no menciona ninguna columna específica de contacto
            // Esto podría ser un error de otra columna. Intentar de todas formas.
            console.warn('⚠️ Error de columna detectado pero no se identificaron columnas de contacto específicas. Reintentando sin columnas de contacto...')
            const minimalPayload: Partial<OrdenTrabajo> = { ...ordenToUpdate }
            contactColumns.forEach((col) => {
              // @ts-expect-error index access
              delete minimalPayload[col]
            })
            const finalAttempt = await performUpdate(minimalPayload)
            if (finalAttempt.error) {
              console.error('❌ Error final:', finalAttempt.error.message)
              return { success: false, error: finalAttempt.error.message }
            }
            console.log('✅ Orden actualizada sin columnas de contacto (fallback)')
            return { success: true, data: finalAttempt.data as OrdenTrabajo }
          }
        }

        // Si el error NO es por columnas faltantes, retornar el error
        console.error('❌ Error no relacionado con columnas:', error.message)
        return { success: false, error: error.message }
      }
      
      // Éxito - verificar que los datos se guardaron
      if (ordenToUpdate.telefono_cliente || ordenToUpdate.ubicacion_link || ordenToUpdate.direccion_cliente) {
        console.log('✅ Orden actualizada con datos de contacto:', {
          telefono: ordenToUpdate.telefono_cliente || 'no',
          ubicacion: ordenToUpdate.ubicacion_link || 'no',
          direccion: ordenToUpdate.direccion_cliente || 'no'
        })
      }
      
      // Log de éxito con datos guardados
      if (ordenToUpdate.telefono_cliente || ordenToUpdate.email_cliente || ordenToUpdate.direccion_cliente) {
        console.log('✅ Orden actualizada con datos de contacto:', {
          telefono: ordenToUpdate.telefono_cliente || 'no',
          email: ordenToUpdate.email_cliente || 'no',
          direccion: ordenToUpdate.direccion_cliente || 'no',
          whatsapp: ordenToUpdate.whatsapp_link || 'no',
          ubicacion: ordenToUpdate.ubicacion_link || 'no',
          drive: ordenToUpdate.drive_link || 'no'
        })
      }

      return { success: true, data: data as OrdenTrabajo }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(orden)
      })
    }

    const index = fallbackOrdenes.findIndex((o) => o.id === id)
    if (index === -1) return { success: false, error: 'Orden no encontrada' }
    fallbackOrdenes[index] = { ...fallbackOrdenes[index], ...orden }
    return { success: true, data: fallbackOrdenes[index] }
  }

  async deleteOrden(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase.from('ordenes_trabajo').delete().eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, { method: 'DELETE' })
    }

    const index = fallbackOrdenes.findIndex((o) => o.id === id)
    if (index >= 0) fallbackOrdenes.splice(index, 1)
    return { success: true }
  }

  async moveOrden(id: number, nuevoEstado: string, usuarioId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data: current, error: fetchError } = await supabase
        .from('ordenes_trabajo')
        .select('estado, sector')
        .eq('id', id)
        .maybeSingle()

      if (fetchError || !current) {
        return { success: false, error: fetchError?.message || 'Orden no encontrada' }
      }
      const currentEstado = (current as { estado: string; sector: string }).estado
      
      // Mapear el nuevo estado al sector correspondiente
      const estadoToSector: Record<string, string> = {
        'Diseño Gráfico': 'Diseño Gráfico',
        'Diseño en Proceso': 'Diseño en Proceso',
        'En Espera': 'En Espera',
        'Imprenta (Área de Impresión)': 'Imprenta (Área de Impresión)',
        'Taller de Imprenta': 'Taller de Imprenta',
        'Taller Gráfico': 'Taller Gráfico',
        'Instalaciones': 'Instalaciones',
        'Metalúrgica': 'Metalúrgica',
        'Finalizado en Taller': 'Finalizado en Taller',
        'Almacén de Entrega': 'Almacén de Entrega'
      }
      
      const nuevoSector = estadoToSector[nuevoEstado] || nuevoEstado

      // ⚠️ IMPORTANTE: Actualizar tanto estado como sector
      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update({ 
          estado: nuevoEstado,
          sector: nuevoSector  // Actualizar el sector también
        })
        .eq('id', id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Obtener nombre del usuario
      const usuarioData = localStorage.getItem('usuario')
      const nombreUsuario = usuarioData
        ? JSON.parse(usuarioData).nombre || 'Usuario'
        : 'Usuario'

      await supabase.from('historial_movimientos').insert({
        id_orden: id,
        estado_anterior: currentEstado,
        estado_nuevo: nuevoEstado,
        id_usuario: usuarioId,
        nombre_usuario: nombreUsuario,
        timestamp: new Date().toISOString()
      })

      // Si la orden llega a un estado final, finalizar el uso de impresora si está asignada
      // El trigger en la BD también lo hará automáticamente, pero esto asegura que se haga inmediatamente
      if (nuevoEstado === 'Finalizado en Taller' || nuevoEstado === 'Almacén de Entrega' || nuevoEstado === 'Entregado o Instalado') {
        try {
          const usoActivoResponse = await this.getUsoActivoPorOrden(id)
          if (usoActivoResponse.success && usoActivoResponse.data) {
            const usoActivo = usoActivoResponse.data as { id: number; id_impresora: number }
            const finalizarResponse = await this.finalizarUsoImpresora(usoActivo.id, usoActivo.id_impresora)
            if (!finalizarResponse.success) {
              console.error('Error al finalizar uso de impresora:', finalizarResponse.error)
            }
          }
        } catch (error) {
          console.error('Error al procesar finalización de impresora:', error)
        }
      }

      return { success: true, data: { id, estado: nuevoEstado } }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/ordenes/mover.php', {
        method: 'POST',
        body: JSON.stringify({ id_orden: id, estado_nuevo: nuevoEstado, id_usuario: usuarioId })
      })
    }

    return this.updateOrden(id, { estado: nuevoEstado })
  }

  async setOrdenWorkingUser(id: number, workingUser: string | null): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ usuario_trabajando_nombre: workingUser })
        .eq('id', id)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/ordenes.php?id=${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ usuario_trabajando_nombre: workingUser })
      })
    }

    const index = fallbackOrdenes.findIndex((orden) => orden.id === id)
    if (index >= 0) {
      fallbackOrdenes[index].usuario_trabajando_nombre = workingUser ?? null
      return { success: true }
    }

    return { success: false, error: 'Orden no encontrada' }
  }

  async marcarEntregado(id: number, entregado: boolean): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ entregado })
        .eq('id', id)

      if (error) return { success: false, error: error.message }

      // Registrar en historial si se marca como entregado
      if (entregado) {
        const usuarioData = localStorage.getItem('usuario')
        const nombreUsuario = usuarioData
          ? JSON.parse(usuarioData).nombre || 'Usuario'
          : 'Usuario'
        const usuarioId = Number(localStorage.getItem('usuario_id')) || 0

        await supabase.from('historial_movimientos').insert({
          id_orden: id,
          estado_anterior: 'Almacén de Entrega',
          estado_nuevo: 'Entregado (Archivado)',
          id_usuario: usuarioId,
          nombre_usuario: nombreUsuario,
          timestamp: new Date().toISOString(),
          comentario: 'Ficha marcada como entregada y archivada'
        })
      }

      return { success: true }
    }

    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async procesarEntrega(
    id: number,
    datosEntrega: {
      firmaDataUrl: string
      entregadoA: string
      dniRetira?: string
      observaciones?: string
      usuarioId: number
      usuarioNombre: string
    }
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      // Actualizar la orden con los datos de entrega
      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update({
          entregado: true,
          estado: 'Entregado o Instalado',
          firma_data_url: datosEntrega.firmaDataUrl,
          entregado_a: datosEntrega.entregadoA,
          dni_retira: datosEntrega.dniRetira || null,
          observaciones_entrega: datosEntrega.observaciones || null,
          fecha_entrega_efectiva: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) return { success: false, error: updateError.message }

      // Registrar en historial
      await supabase.from('historial_movimientos').insert({
        id_orden: id,
        estado_anterior: 'Almacén de Entrega',
        estado_nuevo: 'Entregado o Instalado',
        id_usuario: datosEntrega.usuarioId,
        nombre_usuario: datosEntrega.usuarioNombre,
        timestamp: new Date().toISOString(),
        comentario: `Orden entregada a ${datosEntrega.entregadoA}${datosEntrega.dniRetira ? ` (DNI: ${datosEntrega.dniRetira})` : ''}`
      })

      return { success: true }
    }

    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== SUBTAREAS / CHECKLIST =====
  async getSubitems(idOrden: number): Promise<ApiResponse<TareaSubitem[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tarea_subitems')
        .select('*')
        .eq('id_orden', idOrden)
        // Ordenar por id para evitar depender de columnas no presentes en esquemas antiguos
        .order('id', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as TareaSubitem[]) ?? [] }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async createSubitem(payload: {
    idOrden: number
    titulo: string
    duracionEstimadaMin?: number | null
  }): Promise<ApiResponse<TareaSubitem>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tarea_subitems')
        .insert({
          id_orden: payload.idOrden,
          titulo: payload.titulo,
          duracion_estimada_min: payload.duracionEstimadaMin ?? null
        })
        .select()
        .single()
      if (error || !data) return { success: false, error: error?.message || 'No se pudo crear la subtarea' }
      return { success: true, data: data as TareaSubitem }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async toggleSubitemDone(id: number, done: boolean, startedAt?: string | null): Promise<ApiResponse<void>> {
    if (supabase) {
      // si se marca como done y hay un timer en curso, sumarlo
      let extraSeconds = 0
      if (done && startedAt) {
        const started = new Date(startedAt).getTime()
        extraSeconds = Math.max(0, Math.round((Date.now() - started) / 1000))
      }

      const { error } = await supabase.rpc('tarea_subitems_toggle_done', {
        p_id: id,
        p_done: done,
        p_extra_seconds: extraSeconds
      }).select()

      // si la RPC no existe, hacer fallback con update
      if (error) {
        const updateData: Partial<TareaSubitem> & { tiempo_invertido_seg?: number } = {
          done,
          completado_en: done ? new Date().toISOString() : null,
          iniciado_en: null
        }
        if (extraSeconds > 0) {
          updateData.tiempo_invertido_seg = (await this.getSubitemTime(id)) + extraSeconds
        }
        const { error: upError } = await supabase.from('tarea_subitems').update(updateData).eq('id', id)
        if (upError) return { success: false, error: upError.message }
      }
      return { success: true }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  private async getSubitemTime(id: number): Promise<number> {
    if (!supabase) return 0
    const { data } = await supabase.from('tarea_subitems').select('tiempo_invertido_seg').eq('id', id).maybeSingle()
    return (data as { tiempo_invertido_seg?: number } | null)?.tiempo_invertido_seg ?? 0
  }

  async startSubitemTimer(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('tarea_subitems')
        .update({ iniciado_en: nowIso })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async stopSubitemTimer(id: number, startedAt?: string | null): Promise<ApiResponse<{ timeAdded: number }>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    if (!startedAt) {
      // solo limpiar iniciado_en
      const { error } = await supabase.from('tarea_subitems').update({ iniciado_en: null }).eq('id', id)
      if (error) return { success: false, error: error.message }
      return { success: true, data: { timeAdded: 0 } }
    }
    const started = new Date(startedAt).getTime()
    const extraSeconds = Math.max(0, Math.round((Date.now() - started) / 1000))
    const currentTime = await this.getSubitemTime(id)
    const { error } = await supabase
      .from('tarea_subitems')
      .update({
        iniciado_en: null,
        tiempo_invertido_seg: currentTime + extraSeconds
      })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: { timeAdded: extraSeconds } }
  }

  async renameSubitem(id: number, titulo: string): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const { error } = await supabase.from('tarea_subitems').update({ titulo }).eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async deleteSubitem(id: number): Promise<ApiResponse<void>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const { error } = await supabase.from('tarea_subitems').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // ========== HISTORIAL DE MOVIMIENTOS ==========
  async getHistorialMovimientos(filters?: {
    ordenId?: number
    usuarioId?: number
    limit?: number
  }): Promise<ApiResponse<HistorialMovimiento[]>> {
    if (supabase) {
      let query = supabase.from('historial_movimientos').select('*').order('timestamp', {
        ascending: false
      })

      if (filters?.ordenId) query = query.eq('id_orden', filters.ordenId)
      if (filters?.usuarioId) query = query.eq('id_usuario', filters.usuarioId)
      if (filters?.limit) query = query.limit(filters.limit)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as HistorialMovimiento[]) ?? [] }
    }

    if (hasLegacyBackend) {
      const params = new URLSearchParams()
      if (filters?.ordenId) params.append('orden_id', filters.ordenId.toString())
      if (filters?.usuarioId) params.append('usuario_id', filters.usuarioId.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())
      return this.legacyRequest(`/historial.php?${params.toString()}`)
    }

    return this.handleFallback(fallbackHistorial)
  }

  // ========== USUARIOS ==========
  async getLegajoEmpleado(idUsuario: number): Promise<ApiResponse<LegajoEmpleado | null>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_legajo_empleado', {
        p_id_usuario: idUsuario
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as LegajoEmpleado }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async crearActualizarLegajo(
    idUsuario: number,
    legajo: Partial<LegajoEmpleado>
  ): Promise<ApiResponse<LegajoEmpleado>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('crear_actualizar_legajo', {
        p_id_usuario: idUsuario,
        p_nombre: legajo.nombre || null,
        p_apellido: legajo.apellido || null,
        p_telefono: legajo.telefono || null,
        p_ubicacion: legajo.ubicacion || null,
        p_foto_url: legajo.foto_url || null,
        p_sector: legajo.sector || null,
        p_funciones: legajo.funciones || null,
        p_fecha_ingreso: legajo.fecha_ingreso || null,
        p_fecha_nacimiento: legajo.fecha_nacimiento || null,
        p_dni: legajo.dni || null,
        p_direccion: legajo.direccion || null,
        p_email: legajo.email || null,
        p_estado_civil: legajo.estado_civil || null,
        p_contacto_emergencia_nombre: legajo.contacto_emergencia_nombre || null,
        p_contacto_emergencia_telefono: legajo.contacto_emergencia_telefono || null,
        p_observaciones: legajo.observaciones || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as LegajoEmpleado }
      }

      return { success: false, error: 'No se recibieron datos del servidor' }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async uploadFotoEmpleado(file: File, idUsuario: number): Promise<ApiResponse<string>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      // Verificar que hay un usuario en localStorage (nuestro sistema de auth personalizado)
      const usuarioStr = localStorage.getItem('usuario')
      if (!usuarioStr) {
        return { success: false, error: 'Usuario no autenticado. Por favor, inicia sesión nuevamente.' }
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      // Usar un nombre único basado en el ID del usuario para permitir reemplazo
      const fileName = `empleados/${idUsuario}.${fileExt}`
      
      console.log('📤 Subiendo foto:', fileName, 'Usuario ID:', idUsuario)
      
      // Subir la nueva foto con upsert habilitado (reemplaza si existe)
      // Las políticas ahora permiten subida pública en la carpeta empleados/
      let uploadData = null
      let uploadError = null
      
      const uploadResult = await supabase.storage
        .from('legajos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Reemplazar si existe
        })
      
      uploadData = uploadResult.data
      uploadError = uploadResult.error

      if (uploadError) {
        console.error('❌ Error de upload:', uploadError)
        
        // Mensajes de error más descriptivos
        if (uploadError.message.includes('new row violates row-level security policy') || 
            uploadError.message.includes('row-level security') ||
            uploadError.message.includes('RLS')) {
          return { 
            success: false, 
            error: 'Error de permisos. Las políticas de Storage están bloqueando la subida. Contacta al administrador.' 
          }
        }
        
        if (uploadError.message.includes('JWT') || uploadError.message.includes('token') || uploadError.message.includes('Unauthorized')) {
          return { 
            success: false, 
            error: 'Error de autenticación. Por favor, recarga la página e intenta nuevamente.' 
          }
        }
        
        if (uploadError.message.includes('duplicate') || uploadError.message.includes('already exists')) {
          // Si ya existe, intentar eliminar y volver a subir
          console.log('⚠️ Archivo ya existe, intentando eliminar y volver a subir...')
          await supabase.storage.from('legajos').remove([fileName])
          
          // Reintentar subida
          const retryResult = await supabase.storage
            .from('legajos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            })
          
          if (retryResult.error) {
            return { success: false, error: retryResult.error.message }
          }
          
          uploadData = retryResult.data
        } else {
          return { success: false, error: uploadError.message }
        }
      }

      if (!uploadData) {
        return { success: false, error: 'No se recibieron datos del servidor después de subir la foto' }
      }

      console.log('✅ Foto subida exitosamente:', uploadData.path)

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('legajos')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        console.log('✅ URL pública obtenida:', urlData.publicUrl)
        return { success: true, data: urlData.publicUrl }
      }

      return { success: false, error: 'No se pudo obtener la URL de la imagen' }
    } catch (error: any) {
      console.error('❌ Error en uploadFotoEmpleado:', error)
      return { success: false, error: error.message || 'Error al subir la foto' }
    }
  }

  async getEstadisticasUsuario(
    idUsuario: number,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_usuario', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getEstadisticasSector(
    sector: string,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_sector', {
        p_sector: sector,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getEstadisticasPeriodo(
    fechaDesde: string,
    fechaHasta: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_estadisticas_periodo', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] }
      }

      return { success: true, data: null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsuarios(): Promise<ApiResponse<UsuarioRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as UsuarioRecord[]) ?? [] }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/usuarios.php')
    }

    return this.handleFallback(fallbackUsuarios)
  }

  async getSectores(): Promise<ApiResponse<SectorRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('sectores')
        .select('id, nombre, color, activo, orden_visualizacion')
        .order('orden_visualizacion', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as SectorRecord[]) ?? [] }
    }

    return this.handleFallback(fallbackSectores)
  }

  /**
   * Libro de Actas por Sector
   */
  async crearActaSector(params: {
    id_sector: number
    usuario_id: number
    usuario_nombre: string
    titulo: string
    contenido: string
    tipo_novedad?: TipoNovedad
    fecha?: string
  }): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_acta_sector', {
          p_id_sector: params.id_sector,
          p_usuario_id: params.usuario_id,
          p_usuario_nombre: params.usuario_nombre,
          p_titulo: params.titulo,
          p_contenido: params.contenido,
          p_tipo_novedad: params.tipo_novedad || 'general',
          p_fecha: params.fecha || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async listarActasSector(params?: {
    id_sector?: number
    sector_nombre?: string
    fecha_desde?: string
    fecha_hasta?: string
    tipo_novedad?: TipoNovedad
    limit?: number
    offset?: number
  }): Promise<ApiResponse<ActaSectorRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_actas_sector', {
          p_id_sector: params?.id_sector || null,
          p_sector_nombre: params?.sector_nombre || null,
          p_fecha_desde: params?.fecha_desde || null,
          p_fecha_hasta: params?.fecha_hasta || null,
          p_tipo_novedad: params?.tipo_novedad || null,
          p_limit: params?.limit || 100,
          p_offset: params?.offset || 0
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as ActaSectorRecord[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerActaSector(idActa: number): Promise<ApiResponse<ActaSectorRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_acta_sector', {
          p_id_acta: idActa
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Acta no encontrada' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarActaSector(params: {
    id_acta: number
    titulo?: string
    contenido?: string
    tipo_novedad?: TipoNovedad
    fecha?: string
  }): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_acta_sector', {
          p_id_acta: params.id_acta,
          p_titulo: params.titulo || null,
          p_contenido: params.contenido || null,
          p_tipo_novedad: params.tipo_novedad || null,
          p_fecha: params.fecha || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async eliminarActaSector(idActa: number): Promise<ApiResponse<{ id: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('eliminar_acta_sector', {
          p_id_acta: idActa
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo eliminar la acta' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getSubTareas(ordenId?: number): Promise<ApiResponse<TareaRecord[]>> {
    if (supabase) {
      let query = supabase
        .from('tareas')
        .select('*')
        .eq('es_sub_tarea', true)
        .neq('estado_kanban', 'Finalizado') // Ocultar sub-tareas completadas
        .order('id', { ascending: true })

      if (ordenId) {
        query = query.eq('id_orden', ordenId)
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as TareaRecord[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getMateriales(search?: string): Promise<ApiResponse<MaterialRecord[]>> {
    // Intentar usar la base de datos de stock primero
    if (stockSupabase) {
      try {
        // Usar la tabla 'articulos' que tiene el stock
        let query = stockSupabase
          .from('articulos')
          .select('id, codigo, descripcion, stock')
          .order('descripcion', {
            ascending: true
          })

        if (search && search.trim().length >= 2) {
          // Buscar por descripción o código
          query = query.or(`descripcion.ilike.%${search.trim()}%,codigo.ilike.%${search.trim()}%`)
        }

        const { data, error } = await query
        if (!error && data) {
          // Mapear articulos a MaterialRecord incluyendo el stock
          const materiales = data.map((articulo: any) => ({
            id: articulo.id,
            codigo: articulo.codigo || null,
            descripcion: articulo.descripcion,
            stock: articulo.stock ?? null
          }))
          return { success: true, data: materiales as MaterialRecord[] }
        }
        // Si hay error, continuar con fallback a base principal
        console.warn('⚠️ Error obteniendo materiales de stock, usando base principal:', error?.message)
      } catch (err) {
        console.warn('⚠️ Error conectando a base de stock, usando base principal:', err)
      }
    }

    // Fallback: usar la base de datos principal
    if (supabase) {
      let query = supabase.from('materiales').select('id, codigo, descripcion').order('descripcion', {
        ascending: true
      })

      if (search && search.trim().length >= 2) {
        query = query.ilike('descripcion', `%${search.trim()}%`)
      }

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as MaterialRecord[]) ?? [] }
    }

    // Fallback final: datos mock
    if (search && search.trim()) {
      const filtered = fallbackMateriales.filter((material) =>
        material.descripcion.toLowerCase().includes(search.trim().toLowerCase())
      )
      return { success: true, data: filtered }
    }

    return this.handleFallback(fallbackMateriales)
  }


  async getUsuario(id: number): Promise<ApiResponse<UsuarioRecord>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .eq('id', id)
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'Usuario no encontrado' }
      return { success: true, data: data as UsuarioRecord }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/usuarios.php?id=${id}`)
    }

    const usuario = fallbackUsuarios.find((u) => u.id === id)
    return usuario
      ? { success: true, data: usuario }
      : { success: false, error: 'Usuario no encontrado' }
  }

  async updateUsuario(
    id: number,
    updates: {
      nombre?: string
      rol?: UserRole
      password?: string
    }
  ): Promise<ApiResponse<UsuarioRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_usuario', {
          p_id: id,
          p_nombre: updates.nombre || null,
          p_rol: updates.rol || null,
          p_password: updates.password || null
        })

        if (error) {
          return { success: false, error: error.message }
        }

        if (data && Array.isArray(data) && data.length > 0) {
          return { success: true, data: data[0] as UsuarioRecord }
        }

        return { success: false, error: 'No se recibieron datos del servidor' }
      } catch (error: any) {
        return { success: false, error: error.message || 'Error al actualizar usuario' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async deleteUsuario(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_usuario', {
          p_id: id
        })

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message || 'Error al eliminar usuario' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async createUsuario(usuario: {
    nombre: string
    password: string
    rol: UserRole
  }): Promise<ApiResponse<UsuarioRecord>> {
    let lastError: string | null = null

    if (supabase) {
      // Usar función RPC para crear usuario con hash de contraseña
      console.log('🔍 [createUsuario] Intentando crear usuario:', {
        nombre: usuario.nombre.trim(),
        rol: usuario.rol,
        rolType: typeof usuario.rol,
        rolLength: usuario.rol?.length,
        rolCharCodes: usuario.rol?.split('').map(c => c.charCodeAt(0))
      })
      
      const { data, error } = await supabase.rpc('crear_usuario', {
        p_nombre: usuario.nombre.trim(),
        p_password: usuario.password,
        p_rol: usuario.rol
      })

      console.log('🔍 [createUsuario] Respuesta RPC:', { data, error })

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as UsuarioRecord }
      }

      // Si hay error específico de la RPC, retornar inmediatamente sin intentar fallbacks
      if (error) {
        const errorMsg = error.message || 'Error al crear usuario'
        console.error('❌ [createUsuario] Error de RPC:', {
          message: errorMsg,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        // Si es un error de validación (rol inválido, usuario duplicado, etc), no intentar fallbacks
        if (errorMsg.includes('Rol inválido') || errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
          return { success: false, error: errorMsg }
        }
        lastError = errorMsg
        console.warn('⚠️ Supabase RPC crear_usuario falló:', errorMsg)
      } else {
        lastError = 'La función RPC no retornó datos'
      }

      // Intentar fallback directo sobre la tabla usuarios usando hash local
      try {
        const passwordHash = await bcrypt.hash(usuario.password, 10)
        const { data: insertData, error: insertError } = await supabase
          .from('usuarios')
          .insert({
            nombre: usuario.nombre.trim(),
            password_hash: passwordHash,
            rol: usuario.rol
          })
          .select('id, nombre, rol')
          .single()

        if (!insertError && insertData) {
          console.warn('ℹ️ Usuario creado mediante inserción directa como fallback.')
          return { success: true, data: insertData as UsuarioRecord }
        }

        if (insertError) {
          lastError = insertError.message || lastError
          console.error('❌ Inserción directa falló:', insertError)
        }
      } catch (hashError) {
        lastError =
          (hashError instanceof Error ? hashError.message : null) ||
          'No se pudo generar el hash de la contraseña'
        console.error('❌ Error generando hash para inserción directa:', hashError)
      }
    }

    // Solo intentar backend legacy si Supabase no está disponible
    if (!supabase && hasLegacyBackend) {
      const legacyResponse = await this.legacyRequest<UsuarioRecord>('/usuarios.php', {
        method: 'POST',
        body: JSON.stringify(usuario)
      })

      if (legacyResponse.success) {
        return legacyResponse
      }

      lastError = legacyResponse.error || lastError
    } else if (!supabase) {
      // Fallback solo en entornos sin Supabase ni backend legacy (desarrollo)
      const nuevoUsuario: UsuarioRecord = {
        id: fallbackUsuarios.length + 1,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
      fallbackUsuarios.push(nuevoUsuario)
      return { success: true, data: nuevoUsuario }
    }

    return { success: false, error: lastError || 'No se pudo crear el usuario.' }
  }

  // ========== CLIENTES ==========
  async buscarClientes(query: string): Promise<ApiResponse<ClienteRecord[]>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('buscar_clientes', {
        p_query: query.trim()
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as ClienteRecord[]) ?? [] }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async buscarOCrearCliente(cliente: {
    nombre: string
    dni_cuit?: string
    telefono?: string
    email?: string
    direccion?: string
    ubicacion_link?: string
    drive_link?: string
  }): Promise<ApiResponse<ClienteRecord>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('buscar_o_crear_cliente', {
        p_nombre: cliente.nombre.trim(),
        p_dni_cuit: cliente.dni_cuit?.trim() || null,
        p_telefono: cliente.telefono?.trim() || null,
        p_email: cliente.email?.trim() || null,
        p_direccion: cliente.direccion?.trim() || null,
        p_ubicacion_link: cliente.ubicacion_link?.trim() || null,
        p_drive_link: cliente.drive_link?.trim() || null
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as ClienteRecord }
      }

      return { success: false, error: 'No se retornó el cliente creado' }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== CHAT ==========
  async getMensajesChat(canal: string, limit: number = 50): Promise<ApiResponse<ChatMessageUI[]>> {
    if (supabase) {
      const roomId = chatChannelToRoom[canal] ?? 1

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp, archivos_urls, reply_to_id, reacciones, estado_entrega')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }

      const mensajes =
        data?.map((msg: any) => {
          // Parsear archivos_urls si existe
          let archivosUrls: string[] | undefined = undefined
          if (msg.archivos_urls) {
            try {
              if (typeof msg.archivos_urls === 'string') {
                archivosUrls = JSON.parse(msg.archivos_urls)
              } else if (Array.isArray(msg.archivos_urls)) {
                archivosUrls = msg.archivos_urls
              }
            } catch (e) {
              console.error('Error parseando archivos_urls:', e)
            }
          }
          
          let reacciones: ReaccionesMap | undefined = undefined
          const rawReacciones = msg.reacciones
          if (rawReacciones) {
            try {
              if (typeof rawReacciones === 'string') {
                reacciones = JSON.parse(rawReacciones)
              } else {
                reacciones = rawReacciones as ReaccionesMap
              }
            } catch (e) {
              console.error('Error parseando reacciones:', e)
            }
          }

          return {
            id: msg.id,
            canal: roomToChatChannel[msg.room_id] ?? canal,
            usuario_id: msg.id_usuario,
            nombre_usuario: msg.nombre_usuario,
            contenido: msg.mensaje,
            tipo: inferChatType(msg.mensaje),
            timestamp: msg.timestamp,
            archivos_urls: archivosUrls,
            reply_to_id: msg.reply_to_id,
            reacciones,
            estado_entrega: (msg.estado_entrega as ChatMessageUI['estado_entrega']) ?? 'sent'
          }
        }) ?? []

      return { success: true, data: (mensajes.reverse() as ChatMessageUI[]) }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/chat/mensajes.php?canal=${canal}&limit=${limit}`)
    }

    return this.handleFallback(fallbackMensajes)
  }

  async marcarChatLeido(canal: string, usuarioId: number): Promise<void> {
    if (!supabase) return
    const roomId = chatChannelToRoom[canal] ?? 1
    try {
      await supabase.rpc('chat_marcar_leido', { p_user_id: usuarioId, p_room_id: roomId })
    } catch (e) {
      console.error('Error marcando chat como leído', e)
    }
  }

  async obtenerLastSeenOtros(canal: string, usuarioId: number): Promise<ApiResponse<string | null>> {
    if (!supabase) return { success: true, data: null }
    const roomId = chatChannelToRoom[canal] ?? 1
    try {
      const { data, error } = await supabase.rpc('chat_last_seen_otros', { p_room_id: roomId, p_user_id: usuarioId })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: data as string | null }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al obtener last_seen' }
    }
  }

  async toggleReaccionChat(params: { canal: string; messageId: number; usuarioId: number; emoji: string }): Promise<ApiResponse<ReaccionesMap>> {
    if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
    const roomId = chatChannelToRoom[params.canal] ?? 1
    try {
      const { data, error } = await supabase.rpc('chat_toggle_reaccion', {
        p_room_id: roomId,
        p_message_id: params.messageId,
        p_user_id: params.usuarioId,
        p_emoji: params.emoji
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ReaccionesMap }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error al reaccionar' }
    }
  }

  async enviarMensajeChat(mensaje: {
    canal: string
    contenido: string
    usuario_id: number
    tipo?: string
    archivosUrls?: string[]
    replyToId?: number | null
  }): Promise<ApiResponse<ChatMessageUI>> {
    if (supabase) {
      const roomId = chatChannelToRoom[mensaje.canal] ?? 1

      // Asegurar que el room existe antes de insertar
      await this.ensureChatRoomExists(roomId, mensaje.canal)

      const payload: any = {
        room_id: roomId,
        id_usuario: mensaje.usuario_id,
        nombre_usuario: localStorage.getItem('usuario')
          ? JSON.parse(localStorage.getItem('usuario') || '{}').nombre
          : 'Usuario',
        mensaje:
          mensaje.tipo === 'buzz'
            ? 'Te ha enviado un zumbido!'
            : mensaje.tipo === 'alert'
              ? '¡Atención! Revisar esto de inmediato.'
              : mensaje.contenido,
        reply_to_id: mensaje.replyToId ?? null,
        estado_entrega: 'sent'
      }

      // Agregar URLs de archivos si existen
      if (mensaje.archivosUrls && mensaje.archivosUrls.length > 0) {
        payload.archivos_urls = mensaje.archivosUrls
      }

      const { data, error } = await supabase.from('chat_messages').insert(payload).select().single()

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        data: {
          id: data.id,
          canal: mensaje.canal,
          usuario_id: mensaje.usuario_id,
          nombre_usuario: payload.nombre_usuario,
          contenido: payload.mensaje,
          tipo: mensaje.tipo === 'alert' ? 'alert' : mensaje.tipo === 'buzz' ? 'buzz' : 'message',
          timestamp: data.timestamp,
          archivos_urls: mensaje.archivosUrls,
          reply_to_id: mensaje.replyToId ?? null,
          reacciones: {},
          estado_entrega: 'sent'
        } as ChatMessageUI
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/chat/mensajes.php', {
        method: 'POST',
        body: JSON.stringify(mensaje)
      })
    }

    const nuevoMensaje: ChatMessageUI = {
      id: fallbackMensajes.length + 1,
      canal: mensaje.canal,
      usuario_id: mensaje.usuario_id,
      contenido: mensaje.contenido,
      tipo: (mensaje.tipo as ChatMessageUI['tipo']) || 'message',
      timestamp: new Date().toISOString()
    }

    fallbackMensajes.push(nuevoMensaje)
    return { success: true, data: nuevoMensaje }
  }

  async enviarZumbido(
    _usuarioDestinoId: number,
    usuarioOrigenId: number,
    canal: string
  ): Promise<ApiResponse<ChatMessageUI>> {
    return this.enviarMensajeChat({
      canal,
      contenido: 'Te ha enviado un zumbido!',
      usuario_id: usuarioOrigenId,
      tipo: 'buzz'
    })
  }

  async enviarAlerta(
    _usuarioDestinoId: number,
    usuarioOrigenId: number,
    canal: string
  ): Promise<ApiResponse<ChatMessageUI>> {
    return this.enviarMensajeChat({
      canal,
      contenido: '¡Atención! Revisar esto de inmediato.',
      usuario_id: usuarioOrigenId,
      tipo: 'alert'
    })
  }

  // ========== AUTENTICACIÓN ==========
  async login(usuario: string, password: string): Promise<ApiResponse<{ usuario: UsuarioRecord }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('login_usuario', {
          p_usuario: usuario,
          p_password: password
        })

        if (error) {
          console.error('Error en login_usuario RPC:', error)
          return { success: false, error: `Error de autenticación: ${error.message}` }
        }

        // La función puede retornar un array vacío o null si las credenciales son inválidas
        if (!data || (Array.isArray(data) && data.length === 0)) {
          console.warn('Login fallido: credenciales inválidas o usuario no encontrado')
          return { success: false, error: 'Usuario o contraseña incorrectos' }
        }

        const usuarioDb = Array.isArray(data) ? data[0] : data

        if (!usuarioDb || !usuarioDb.id) {
          console.error('Login fallido: datos de usuario inválidos', usuarioDb)
          return { success: false, error: 'Error al obtener datos del usuario' }
        }

        // Asegurar que el usuario existe en la tabla usuarios para notificaciones
        await this.ensureUsuarioExists(usuarioDb.id, usuarioDb.nombre, usuarioDb.rol)

        localStorage.setItem('usuario', JSON.stringify(usuarioDb))
        localStorage.setItem('usuario_id', usuarioDb.id.toString())

        return { success: true, data: { usuario: usuarioDb } }
      } catch (err) {
        console.error('Excepción en login:', err)
        return { 
          success: false, 
          error: err instanceof Error ? err.message : 'Error inesperado al iniciar sesión' 
        }
      }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/auth/login.php', {
        method: 'POST',
        body: JSON.stringify({ usuario, password })
      })
    }

    const mockUsuario: UsuarioRecord = {
      id: 1,
      nombre: usuario || 'Dev',
      rol: 'administracion'
    }

    localStorage.setItem('usuario', JSON.stringify(mockUsuario))
    return { success: true, data: { usuario: mockUsuario } }
  }

  async logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('usuario')

    if (supabase) {
      await supabase.rpc('logout_usuario')
      return { success: true }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/auth/logout.php', { method: 'POST' })
    }

    return { success: true }
  }

  async verificarToken() {
    if (supabase) {
      const usuario = localStorage.getItem('usuario')
      return usuario ? { success: true, data: JSON.parse(usuario) } : { success: false }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest('/auth/verificar.php')
    }

    return { success: true }
  }

  // ========== ARCHIVOS ==========
  async subirArchivo(ordenId: number, archivo: File) {
    if (supabase) {
      const { data, error } = await supabase.storage
        .from('archivos')
        .upload(`ordenes/${ordenId}/${archivo.name}`, archivo, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    if (hasLegacyBackend) {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('orden_id', ordenId.toString())

      try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${LEGACY_API_BASE_URL}/archivos/subir.php`, {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: formData
        })

        if (!response.ok) throw new Error('Error al subir archivo')
        return await response.json()
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }

    return { success: false, error: 'Storage no disponible en modo mock' }
  }

  async getArchivosOrden(ordenId: number) {
    if (supabase) {
      // Obtener archivos desde la tabla enlaces_adjuntos
      const { data, error } = await supabase
        .from('enlaces_adjuntos')
        .select('*')
        .eq('id_orden', ordenId)
        .order('creado_en', { ascending: false })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/archivos.php?orden_id=${ordenId}`)
    }

    return { success: true, data: [] }
  }

  async guardarArchivoOrden(ordenId: number, nombreArchivo: string, urlArchivo: string): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('enlaces_adjuntos')
        .insert({
          id_orden: ordenId,
          titulo: nombreArchivo,
          url: urlArchivo
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async eliminarArchivoOrden(archivoId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('enlaces_adjuntos')
        .delete()
        .eq('id', archivoId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== COMENTARIOS ==========
  async getComentariosOrden(ordenId: number): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('comentarios_orden')
        .select('*')
        .eq('id_orden', ordenId)
        .order('timestamp', { ascending: false })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: true, data: [] }
  }

  async addComentarioOrden(ordenId: number, comentario: string, usuarioNombre: string): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('comentarios_orden')
        .insert({
          id_orden: ordenId,
          comentario,
          usuario_nombre: usuarioNombre,
          timestamp: new Date().toISOString()
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ========== IMPRESORAS ==========
  async getImpresoras(includeInactivas: boolean = false): Promise<ApiResponse<any[]>> {
    if (supabase) {
      let query = supabase
        .from('impresoras')
        .select('*')
      
      if (!includeInactivas) {
        query = query.eq('activa', true)
      }
      
      const { data, error } = await query.order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getImpresorasOcupacion(): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('v_impresoras_ocupacion')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsoImpresora(impresoraId: number, limit: number = 50): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .select(`
          *,
          ordenes_trabajo:id_orden(numero_op, cliente, descripcion)
        `)
        .eq('id_impresora', impresoraId)
        .order('fecha_inicio', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async iniciarUsoImpresora(impresoraId: number, ordenId: number, operario?: string): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .insert({
          id_impresora: impresoraId,
          id_orden: ordenId,
          estado: 'En Proceso',
          operario: operario || null
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      
      // Actualizar estado de la impresora a "En Uso"
      await supabase
        .from('impresoras')
        .update({ estado: 'En Uso' })
        .eq('id', impresoraId)

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getUsoActivoPorOrden(ordenId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .select('id, id_impresora')
        .eq('id_orden', ordenId)
        .eq('estado', 'En Proceso')
        .maybeSingle()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data || null }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async finalizarUsoImpresora(usoId: number, impresoraId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      // Finalizar el uso actual
      const { data, error } = await supabase
        .from('impresora_uso')
        .update({
          fecha_fin: new Date().toISOString(),
          estado: 'Completado'
        })
        .eq('id', usoId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      
      // Verificar si hay otros usos activos para esta impresora (trabajos en cola)
      const { data: otrosUsos, error: otrosUsosError } = await supabase
        .from('impresora_uso')
        .select('id')
        .eq('id_impresora', impresoraId)
        .eq('estado', 'En Proceso')
        .order('fecha_inicio', { ascending: true })
        .limit(1)

      if (otrosUsosError) {
        console.error('Error al verificar otros usos:', otrosUsosError)
      }

      // Si hay otros trabajos en cola, mantener "En Uso"
      // Si no hay más trabajos, cambiar a "Disponible"
      if (otrosUsos && otrosUsos.length > 0) {
        // Mantener en "En Uso" porque hay trabajos en cola
        await supabase
          .from('impresoras')
          .update({ estado: 'En Uso' })
          .eq('id', impresoraId)
      } else {
        // No hay más trabajos, cambiar a "Disponible"
        await supabase
          .from('impresoras')
          .update({ estado: 'Disponible' })
          .eq('id', impresoraId)
      }

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async cambiarEstadoImpresora(
    impresoraId: number,
    nuevoEstado: 'Disponible' | 'En Uso' | 'Mantenimiento' | 'Fuera de Servicio',
    motivo?: string,
    usuarioId?: number,
    usuarioNombre?: string
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      // Obtener estado actual
      const { data: impresoraActual } = await supabase
        .from('impresoras')
        .select('estado')
        .eq('id', impresoraId)
        .single()

      if (!impresoraActual) {
        return { success: false, error: 'Impresora no encontrada' }
      }

      // Actualizar estado
      const { data, error } = await supabase
        .from('impresoras')
        .update({ estado: nuevoEstado })
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }

      // Registrar en historial
      if (motivo || usuarioId || usuarioNombre) {
        await supabase
          .from('impresora_historial_estado')
          .insert({
            id_impresora: impresoraId,
            estado_anterior: impresoraActual.estado,
            estado_nuevo: nuevoEstado,
            motivo: motivo || null,
            usuario_id: usuarioId || null,
            usuario_nombre: usuarioNombre || null
          })
      }

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getHistorialImpresora(impresoraId: number, limit: number = 50): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_historial_estado')
        .select('*')
        .eq('id_impresora', impresoraId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async getTrabajosActivosImpresora(impresoraId: number): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('v_impresora_trabajos_activos')
        .select('*')
        .eq('id_impresora', impresoraId)
        .order('fecha_inicio', { ascending: true }) // Ordenar por fecha ascendente (el primero es el que está imprimiendo)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as any[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async asignarOrdenAImpresora(
    impresoraId: number,
    ordenId: number,
    operario?: string,
    metrosCuadrados?: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      // Verificar que la impresora esté disponible o en uso
      const { data: impresora } = await supabase
        .from('impresoras')
        .select('estado')
        .eq('id', impresoraId)
        .single()

      if (!impresora) {
        return { success: false, error: 'Impresora no encontrada' }
      }

      if (impresora.estado === 'Mantenimiento' || impresora.estado === 'Fuera de Servicio') {
        return { success: false, error: 'La impresora no está disponible para asignar trabajos' }
      }

      // Crear registro de uso
      const { data, error } = await supabase
        .from('impresora_uso')
        .insert({
          id_impresora: impresoraId,
          id_orden: ordenId,
          estado: 'En Proceso',
          operario: operario || null,
          metros_cuadrados: metrosCuadrados || null
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }

      // Actualizar estado de la impresora a "En Uso" automáticamente
      await supabase
        .from('impresoras')
        .update({ estado: 'En Uso' })
        .eq('id', impresoraId)

      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarMetrosImpresora(
    usoId: number,
    metrosCuadrados: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresora_uso')
        .update({ metros_cuadrados: metrosCuadrados })
        .eq('id', usoId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async crearImpresora(
    nombre: string,
    modelo?: string,
    capacidadMaximaHoras?: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresoras')
        .insert({
          nombre,
          modelo: modelo || null,
          estado: 'Disponible',
          capacidad_maxima_horas_dia: capacidadMaximaHoras || 24.0,
          activa: true
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async actualizarImpresora(
    impresoraId: number,
    updates: {
      nombre?: string
      modelo?: string
      capacidad_maxima_horas_dia?: number
      activa?: boolean
    }
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresoras')
        .update(updates)
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async eliminarImpresora(impresoraId: number): Promise<ApiResponse<any>> {
    if (supabase) {
      // Verificar que no tenga trabajos activos
      const { data: trabajosActivos } = await supabase
        .from('impresora_uso')
        .select('id')
        .eq('id_impresora', impresoraId)
        .eq('estado', 'En Proceso')
        .limit(1)

      if (trabajosActivos && trabajosActivos.length > 0) {
        return { success: false, error: 'No se puede eliminar una impresora con trabajos activos' }
      }

      // Marcar como inactiva en lugar de eliminar (soft delete)
      const { data, error } = await supabase
        .from('impresoras')
        .update({ activa: false })
        .eq('id', impresoraId)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // ============================================
  // NOTIFICACIONES
  // ============================================

  async getUserNotifications(userId: number, limit: number = 50): Promise<ApiResponse<Notification[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }
      return { success: true, data: (data as Notification[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async createNotification(notification: {
    user_id: number
    title: string
    description?: string
    type?: 'info' | 'success' | 'warning' | 'error' | 'mention'
    orden_id?: number
    pedido_id?: number
    solicitud_id?: number
    capacitacion_id?: number
  }): Promise<ApiResponse<Notification>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          description: notification.description || null,
          type: notification.type || 'info',
          orden_id: notification.orden_id || null,
          pedido_id: notification.pedido_id || null,
          solicitud_id: notification.solicitud_id || null,
          capacitacion_id: notification.capacitacion_id || null,
          is_read: false
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Notification }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Enviar notificación masiva a usuarios
   */
  async enviarNotificacionMasiva(params: {
    titulo: string
    descripcion: string
    tipo?: 'info' | 'success' | 'warning' | 'error' | 'mention'
    rol_filtro?: string
    sector_filtro?: string
    enviar_a_todos?: boolean
    id_usuario_emisor?: number
  }): Promise<ApiResponse<{ notificaciones_creadas: number; usuarios_notificados: number; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('enviar_notificacion_masiva', {
          p_titulo: params.titulo,
          p_descripcion: params.descripcion,
          p_tipo: params.tipo || 'info',
          p_rol_filtro: params.rol_filtro || null,
          p_sector_filtro: params.sector_filtro || null,
          p_enviar_a_todos: params.enviar_a_todos || false,
          p_id_usuario_emisor: params.id_usuario_emisor || null
        })

        if (error) {
          console.error('Error enviando notificación masiva:', error)
          return { success: false, error: error.message }
        }

        if (data && typeof data === 'object' && 'success' in data) {
          const result = data as any
          if (result.success) {
            return {
              success: true,
              data: {
                notificaciones_creadas: result.notificaciones_creadas || 0,
                usuarios_notificados: result.usuarios_notificados || 0,
                mensaje: result.mensaje || 'Notificaciones enviadas'
              }
            }
          } else {
            return { success: false, error: result.error || 'Error desconocido' }
          }
        }

        return { success: false, error: 'Respuesta inválida del servidor' }
      } catch (error: any) {
        console.error('Error en enviarNotificacionMasiva:', error)
        return { success: false, error: error.message || 'Error al enviar notificaciones' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async obtenerEstadisticasNotificaciones(): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_estadisticas_notificaciones')

        if (error) {
          console.error('Error obteniendo estadísticas:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data || {} }
      } catch (error: any) {
        console.error('Error en obtenerEstadisticasNotificaciones:', error)
        return { success: false, error: error.message || 'Error al obtener estadísticas' }
      }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // Helper para obtener usuarios de compras y administración
  private async getUsuariosComprasAdmin(): Promise<number[]> {
    if (!supabase) {
      console.warn('⚠️ Supabase no configurado en getUsuariosComprasAdmin')
      return []
    }
    
    try {
      console.log('🔍 Buscando usuarios con rol compras o administracion...')
      
      // Primero intentar con compras y administracion
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .in('rol', ['compras', 'administracion'])
      
      if (error) {
        console.error('❌ Error obteniendo usuarios de compras/admin:', error)
        // Si hay error, intentar obtener todos los usuarios como fallback
        return await this.getAllUsuariosIds()
      }
      
      if (data && data.length > 0) {
        console.log(`✅ Encontrados ${data.length} usuarios de compras/admin:`, data.map(u => `${u.nombre} (${u.rol})`))
        return data.map(u => u.id)
      }
      
      // Si no hay usuarios de compras/admin, intentar con gerencia
      console.warn('⚠️ No se encontraron usuarios con rol compras o administracion, buscando gerencia...')
      const { data: dataGerencia, error: errorGerencia } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .in('rol', ['gerencia'])
      
      if (!errorGerencia && dataGerencia && dataGerencia.length > 0) {
        console.log(`✅ Encontrados ${dataGerencia.length} usuarios de gerencia:`, dataGerencia.map(u => `${u.nombre} (${u.rol})`))
        return dataGerencia.map(u => u.id)
      }
      
      // Si tampoco hay gerencia, obtener TODOS los usuarios como último recurso
      console.warn('⚠️ No se encontraron usuarios específicos, notificando a todos los usuarios...')
      return await this.getAllUsuariosIds()
    } catch (error) {
      console.error('❌ Excepción obteniendo usuarios de compras/admin:', error)
      // En caso de error, intentar obtener todos los usuarios
      return await this.getAllUsuariosIds()
    }
  }

  // Helper para obtener todos los IDs de usuarios (fallback)
  private async getAllUsuariosIds(): Promise<number[]> {
    if (!supabase) return []
    
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
      
      if (error || !data || data.length === 0) {
        console.warn('⚠️ No se encontraron usuarios en la base de datos')
        return []
      }
      
      console.log(`✅ Encontrados ${data.length} usuarios totales para notificar:`, data.map(u => `${u.nombre} (${u.rol})`))
      return data.map(u => u.id)
    } catch (error) {
      console.error('❌ Error obteniendo todos los usuarios:', error)
      return []
    }
  }

  // Helper para asegurar que un usuario existe en la tabla usuarios
  private async ensureUsuarioExists(id: number, nombre: string, rol: string): Promise<void> {
    if (!supabase) return
    
    try {
      // Verificar si el usuario ya existe
      const { data: existingUser, error: checkError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', id)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error verificando usuario:', checkError)
        return
      }
      
      // Si el usuario no existe, intentar crearlo
      if (!existingUser) {
        console.log(`📝 Usuario ${id} (${nombre}) no existe en tabla usuarios, intentando crear...`)
        
        // Obtener el password_hash del usuario desde la función de login si es posible
        // Como no tenemos acceso directo, usamos un hash placeholder que no será usado para login
        // El usuario ya está autenticado, así que esto es solo para mantener la integridad de la tabla
        const placeholderHash = '$2a$10$placeholder.hash.for.notification.user.sync'
        
        // Intentar insertar el usuario
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert({
            id: id,
            nombre: nombre,
            rol: rol,
            password_hash: placeholderHash
          })
          .select()
        
        if (insertError) {
          // Si falla por constraint de id único, intentar actualizar
          if (insertError.code === '23505') {
            console.log(`ℹ️ Usuario ${id} ya existe, actualizando...`)
            const { error: updateError } = await supabase
              .from('usuarios')
              .update({ nombre, rol })
              .eq('id', id)
            
            if (updateError) {
              console.error('Error actualizando usuario:', updateError)
            } else {
              console.log(`✅ Usuario ${id} actualizado en tabla usuarios`)
            }
          } else {
            console.error('Error creando usuario:', insertError)
            // Si falla por otro motivo, al menos intentar actualizar nombre y rol
            const { error: updateError } = await supabase
              .from('usuarios')
              .update({ nombre, rol })
              .eq('id', id)
            
            if (!updateError) {
              console.log(`✅ Usuario ${id} actualizado como fallback`)
            }
          }
        } else {
          console.log(`✅ Usuario ${id} creado en tabla usuarios`)
        }
      } else {
        // Si el usuario existe, asegurarse de que nombre y rol estén actualizados
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({ nombre, rol })
          .eq('id', id)
        
        if (!updateError) {
          console.log(`✅ Usuario ${id} sincronizado en tabla usuarios`)
        }
      }
    } catch (error) {
      console.error('Excepción en ensureUsuarioExists:', error)
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async markAllNotificationsAsRead(userId: number): Promise<ApiResponse<void>> {
    if (supabase) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  // Método privado para asegurar que un chat_room existe
  // ===== PEDIDOS DE COMPRA =====
  async crearPedidoCompra(pedido: {
    id_solicitante: number
    nombre_solicitante: string
    sector_solicitante?: string
    id_proveedor?: number // ID del proveedor externo
    prioridad?: PrioridadPedido
    motivo?: string
    observaciones?: string
    fecha_entrega_estimada?: string
    items: Array<{
      id_articulo_stock?: number
      codigo_articulo?: string
      descripcion: string
      cantidad_solicitada: number
      unidad?: string
      observaciones?: string
    }>
  }): Promise<ApiResponse<PedidoCompra>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      console.log('📦 Creando pedido de compra:', {
        solicitante: pedido.nombre_solicitante,
        items: pedido.items.length
      })

      // Verificar si el usuario existe en la BD antes de crear el pedido
      let idSolicitanteFinal: number | null = null
      if (pedido.id_solicitante && pedido.id_solicitante > 0) {
        const { data: usuarioExiste, error: errorUsuario } = await supabase
          .from('usuarios')
          .select('id')
          .eq('id', pedido.id_solicitante)
          .single()
        
        if (usuarioExiste && !errorUsuario) {
          idSolicitanteFinal = pedido.id_solicitante
          console.log(`✅ Usuario ${pedido.id_solicitante} encontrado en BD`)
        } else {
          console.warn(`⚠️ Usuario con ID ${pedido.id_solicitante} no existe en BD, creando pedido sin ID. Error: ${errorUsuario?.message || 'No encontrado'}`)
          idSolicitanteFinal = null
        }
      } else {
        console.log('ℹ️ No se proporcionó ID de solicitante válido, creando pedido sin ID')
      }

      // Crear el pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos_compras')
        .insert({
          id_solicitante: idSolicitanteFinal,
          nombre_solicitante: pedido.nombre_solicitante,
          sector_solicitante: pedido.sector_solicitante || null,
          id_proveedor: pedido.id_proveedor || null,
          prioridad: pedido.prioridad || 'Normal',
          motivo: pedido.motivo || null,
          observaciones: pedido.observaciones || null,
          fecha_entrega_estimada: pedido.fecha_entrega_estimada || null,
          estado: 'Pendiente'
        })
        .select()
        .single()

      if (pedidoError) {
        console.error('❌ Error creando pedido:', pedidoError)
        return { 
          success: false, 
          error: `Error al crear pedido: ${pedidoError.message}. Código: ${pedidoError.code || 'N/A'}. Detalles: ${pedidoError.details || 'N/A'}` 
        }
      }

      if (!pedidoData || !pedidoData.id) {
        return { success: false, error: 'El pedido se creó pero no se retornó el ID' }
      }

      // Crear los items del pedido
      if (pedido.items && pedido.items.length > 0) {
        const itemsData = pedido.items.map(item => ({
          id_pedido: pedidoData.id,
          id_articulo_stock: item.id_articulo_stock || null,
          codigo_articulo: item.codigo_articulo || null,
          descripcion: item.descripcion,
          cantidad_solicitada: item.cantidad_solicitada,
          unidad: item.unidad || 'unidad',
          observaciones: item.observaciones || null
        }))

        console.log('📦 Insertando items del pedido:', itemsData.length)

        const { error: itemsError } = await supabase
          .from('pedidos_compras_items')
          .insert(itemsData)

        if (itemsError) {
          console.error('❌ Error insertando items:', itemsError)
          // Si falla la inserción de items, eliminar el pedido
          await supabase.from('pedidos_compras').delete().eq('id', pedidoData.id)
          return { 
            success: false, 
            error: `Error al crear items del pedido: ${itemsError.message}. Código: ${itemsError.code || 'N/A'}. Detalles: ${itemsError.details || 'N/A'}` 
          }
        }

        console.log('✅ Items del pedido creados exitosamente')
      }

      // Notificar a usuarios de compras y administración
      // Intentar obtener usuarios de la BD primero
      let usuariosComprasAdmin = await this.getUsuariosComprasAdmin()
      const numeroPedido = pedidoData.numero_pedido || `#${pedidoData.id}`
      
      console.log('🔔 Usuarios de compras/admin encontrados en BD:', usuariosComprasAdmin.length, usuariosComprasAdmin)
      
      // Si no hay usuarios en BD pero hay id_solicitante, intentar notificar al solicitante
      // (esto es un fallback para cuando los usuarios están en otra parte)
      if (usuariosComprasAdmin.length === 0 && idSolicitanteFinal) {
        console.log('⚠️ No hay usuarios en BD, pero hay id_solicitante. Intentando notificar al solicitante como fallback.')
        // No notificamos al solicitante cuando crea su propio pedido, eso no tiene sentido
        // En su lugar, simplemente logueamos que no hay usuarios para notificar
        console.warn('⚠️ No se encontraron usuarios de compras/admin para notificar. Las notificaciones se crearán cuando haya usuarios en la tabla usuarios.')
      }
      
      // Crear notificaciones solo si hay usuarios
      for (const userId of usuariosComprasAdmin) {
        try {
          const notificationResult = await this.createNotification({
            user_id: userId,
            title: '📦 Nuevo pedido de compra',
            description: `${pedido.nombre_solicitante} solicitó productos${pedido.sector_solicitante ? ` (${pedido.sector_solicitante})` : ''}. Pedido ${numeroPedido}`,
            type: 'info',
            pedido_id: pedidoData.id
          })
          
          if (notificationResult.success) {
            console.log(`✅ Notificación creada para usuario ${userId}`)
          } else {
            console.error(`❌ Error creando notificación para usuario ${userId}:`, notificationResult.error)
          }
        } catch (error) {
          console.error(`❌ Excepción al crear notificación para usuario ${userId}:`, error)
        }
      }

      // Obtener el pedido completo con items
      const pedidoCompleto = await this.getPedidoCompra(pedidoData.id)
      if (pedidoCompleto.success) {
        console.log('✅ Pedido de compra creado exitosamente:', pedidoData.id)
      }
      return pedidoCompleto
    } catch (error) {
      console.error('❌ Excepción al crear pedido:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al crear pedido' 
      }
    }
  }

  async getPedidosCompra(filters?: {
    estado?: EstadoPedido
    id_solicitante?: number
    id_aprobador?: number
    prioridad?: PrioridadPedido
  }): Promise<ApiResponse<PedidoCompra[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('pedidos_compras')
          .select(`
            *,
            items:pedidos_compras_items(*),
            comentarios:pedidos_compras_comentarios(*)
          `)
          .order('fecha_solicitud', { ascending: false })

        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.id_solicitante) {
          query = query.eq('id_solicitante', filters.id_solicitante)
        }
        if (filters?.id_aprobador) {
          query = query.eq('id_aprobador', filters.id_aprobador)
        }
        if (filters?.prioridad) {
          query = query.eq('prioridad', filters.prioridad)
        }

        const { data, error } = await query

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: (data as PedidoCompra[]) || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPedidoCompra(id: number): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_compras')
          .select(`
            *,
            items:pedidos_compras_items(*),
            comentarios:pedidos_compras_comentarios(*),
            proveedor:proveedores(*)
          `)
          .eq('id', id)
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: data as PedidoCompra }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async aprobarPedidoCompra(
    id: number,
    aprobador: { id: number; nombre: string },
    itemsAprobados?: Array<{ id: number; cantidad_aprobada: number }>
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        // Actualizar el pedido
        const { error: updateError } = await supabase
          .from('pedidos_compras')
          .update({
            estado: 'Aprobado',
            fecha_aprobacion: new Date().toISOString(),
            id_aprobador: aprobador.id,
            nombre_aprobador: aprobador.nombre
          })
          .eq('id', id)

        if (updateError) {
          return { success: false, error: updateError.message }
        }

        // Actualizar cantidades aprobadas en items si se proporcionan
        if (itemsAprobados && itemsAprobados.length > 0) {
          for (const item of itemsAprobados) {
            await supabase
              .from('pedidos_compras_items')
              .update({ cantidad_aprobada: item.cantidad_aprobada })
              .eq('id', item.id)
          }
        }

        // Obtener el pedido para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante) {
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: '✅ Pedido aprobado',
            description: `Tu pedido ${pedido.data.numero_pedido} fue aprobado por ${aprobador.nombre}`,
            type: 'success',
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async rechazarPedidoCompra(
    id: number,
    aprobador: { id: number; nombre: string },
    motivo_rechazo: string
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('pedidos_compras')
          .update({
            estado: 'Rechazado',
            fecha_rechazo: new Date().toISOString(),
            id_aprobador: aprobador.id,
            nombre_aprobador: aprobador.nombre,
            motivo_rechazo
          })
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        // Obtener el pedido para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante) {
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: '❌ Pedido rechazado',
            description: `Tu pedido ${pedido.data.numero_pedido} fue rechazado por ${aprobador.nombre}. Motivo: ${motivo_rechazo}`,
            type: 'error',
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async agregarComentarioPedido(
    id_pedido: number,
    comentario: {
      id_usuario: number
      nombre_usuario: string
      comentario: string
      es_interno?: boolean
    }
  ): Promise<ApiResponse<PedidoCompraComentario>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_compras_comentarios')
          .insert({
            id_pedido,
            id_usuario: comentario.id_usuario,
            nombre_usuario: comentario.nombre_usuario,
            comentario: comentario.comentario,
            es_interno: comentario.es_interno || false
          })
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Notificar al solicitante si el comentario no es interno
        if (!comentario.es_interno) {
          const { data: pedidoData } = await supabase
            .from('pedidos_compras')
            .select('id_solicitante, numero_pedido')
            .eq('id', id_pedido)
            .single()
          
          if (pedidoData && pedidoData.id_solicitante && pedidoData.id_solicitante !== comentario.id_usuario) {
            await this.createNotification({
              user_id: pedidoData.id_solicitante,
              title: '💬 Nuevo comentario en tu pedido',
              description: `${comentario.nombre_usuario} comentó en el pedido ${pedidoData.numero_pedido}`,
              type: 'info',
              pedido_id: id_pedido
            })
          }
        }

        return { success: true, data: data as PedidoCompraComentario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPedidoCompra(
    id: number,
    updates: Partial<PedidoCompra>
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('pedidos_compras')
          .update(updates)
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        return await this.getPedidoCompra(id)
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEstadoPedido(
    id: number,
    estado: EstadoPedido
  ): Promise<ApiResponse<PedidoCompra>> {
    if (supabase) {
      try {
        // Obtener el pedido antes de actualizar para saber el estado anterior
        const pedidoAnterior = await this.getPedidoCompra(id)
        const estadoAnterior = pedidoAnterior.success && pedidoAnterior.data ? pedidoAnterior.data.estado : 'Desconocido'
        
        const updateData: any = { estado }
        
        if (estado === 'Completado') {
          updateData.fecha_completado = new Date().toISOString()
        }

        const { error } = await supabase
          .from('pedidos_compras')
          .update(updateData)
          .eq('id', id)

        if (error) {
          return { success: false, error: error.message }
        }

        // Obtener el pedido actualizado para notificar al solicitante
        const pedido = await this.getPedidoCompra(id)
        if (pedido.success && pedido.data && pedido.data.id_solicitante && estadoAnterior !== estado) {
          let notificationTitle = '🔄 Estado del pedido actualizado'
          let notificationType: 'info' | 'success' = 'info'
          
          if (estado === 'En Compra') {
            notificationTitle = '🛒 Pedido en compra'
            notificationType = 'info'
          } else if (estado === 'Completado') {
            notificationTitle = '🎉 Pedido completado'
            notificationType = 'success'
          }
          
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: notificationTitle,
            description: `El estado de tu pedido ${pedido.data.numero_pedido} cambió de "${estadoAnterior}" a "${estado}"`,
            type: notificationType,
            pedido_id: id
          })
        }

        return pedido
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== STOCK =====
  // Función privada para descontar stock al crear una orden
  private async descontarStockDeOrden(ordenId: number, numeroOp: string): Promise<void> {
    if (!supabase || !stockSupabase) return

    try {
      // Obtener materiales asociados a la orden desde orden_materiales
      const { data: ordenMateriales, error: materialesError } = await supabase
        .from('orden_materiales')
        .select('id_material, cantidad, materiales(id, codigo, descripcion)')
        .eq('id_orden', ordenId)

      if (materialesError || !ordenMateriales || ordenMateriales.length === 0) {
        // No hay materiales asociados, no hacer nada
        return
      }

      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      const usuarioData = localStorage.getItem('usuario')
      const nombreUsuario = usuarioData ? JSON.parse(usuarioData).nombre || 'Sistema' : 'Sistema'

      // Para cada material, buscar en stock y descontar
      for (const ordenMaterial of ordenMateriales) {
        const material = ordenMaterial.materiales as any
        if (!material) continue

        // Buscar artículo en stock por código o descripción
        let articuloStock: ArticuloStock | null = null

        if (material.codigo) {
          const { data: articulosPorCodigo } = await stockSupabase
            .from('articulos')
            .select('*')
            .eq('codigo', material.codigo)
            .maybeSingle()

          if (articulosPorCodigo) {
            articuloStock = articulosPorCodigo as ArticuloStock
          }
        }

        // Si no se encontró por código, buscar por descripción
        if (!articuloStock && material.descripcion) {
          const { data: articulosPorDesc } = await stockSupabase
            .from('articulos')
            .select('*')
            .ilike('descripcion', `%${material.descripcion}%`)
            .limit(1)
            .maybeSingle()

          if (articulosPorDesc) {
            articuloStock = articulosPorDesc as ArticuloStock
          }
        }

        if (articuloStock && articuloStock.stock !== null && articuloStock.stock > 0) {
          const cantidadAnterior = articuloStock.stock
          const cantidadADescontar = Number(ordenMaterial.cantidad) || 1
          const cantidadNueva = Math.max(0, cantidadAnterior - cantidadADescontar)

          // Actualizar stock en la base de stock
          await stockSupabase
            .from('articulos')
            .update({ stock: cantidadNueva })
            .eq('id', articuloStock.id)

          // Registrar movimiento de stock
          await supabase.from('stock_movimientos').insert({
            id_articulo_stock: articuloStock.id,
            codigo_articulo: articuloStock.codigo || null,
            descripcion: articuloStock.descripcion,
            tipo_movimiento: 'Salida',
            cantidad: cantidadADescontar,
            cantidad_anterior: cantidadAnterior,
            cantidad_nueva: cantidadNueva,
            motivo: `Orden de trabajo ${numeroOp}`,
            id_orden_trabajo: ordenId,
            id_usuario: usuarioId,
            nombre_usuario: nombreUsuario
          })

          // Verificar si el stock quedó bajo y crear alerta si es necesario
          if (cantidadNueva <= 10 && cantidadNueva > 0) {
            await this.crearAlertaStockBajo(articuloStock, cantidadNueva)
          } else if (cantidadNueva === 0) {
            await this.crearAlertaStockAgotado(articuloStock)
          }
        }
      }
    } catch (error) {
      console.error('Error descontando stock de orden:', error)
      // No lanzar error para no interrumpir la creación de la orden
    }
  }

  // Función privada para crear alerta de stock bajo
  private async crearAlertaStockBajo(articulo: ArticuloStock, stockActual: number): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si ya existe una notificación reciente para este artículo
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: notificacionesExistentes } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('type', 'stock_bajo')
        .eq('related_id', articulo.id.toString())
        .gte('timestamp', hace24Horas)
        .limit(1)

      // Si ya hay una notificación reciente, no crear otra
      if (notificacionesExistentes && notificacionesExistentes.length > 0) {
        return
      }

      // Crear notificación para usuarios de compras y admin
      const { data: usuariosCompras } = await supabase
        .from('usuarios')
        .select('id')
        .in('rol', ['compras', 'administracion', 'gerencia'])

      if (usuariosCompras) {
        for (const usuario of usuariosCompras) {
          await supabase.from('user_notifications').insert({
            user_id: usuario.id,
            type: 'stock_bajo',
            title: `Stock Bajo: ${articulo.descripcion}`,
            description: `El artículo "${articulo.descripcion}" tiene stock bajo (${stockActual} unidades).`,
            related_id: articulo.id.toString(),
            read: false
          })
        }
      }
    } catch (error) {
      console.error('Error creando alerta de stock bajo:', error)
    }
  }

  // Función privada para crear alerta de stock agotado
  private async crearAlertaStockAgotado(articulo: ArticuloStock): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si ya existe una notificación reciente
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: notificacionesExistentes } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('type', 'stock_agotado')
        .eq('related_id', articulo.id.toString())
        .gte('timestamp', hace24Horas)
        .limit(1)

      if (notificacionesExistentes && notificacionesExistentes.length > 0) {
        return
      }

      // Crear notificación para usuarios de compras y admin
      const { data: usuariosCompras } = await supabase
        .from('usuarios')
        .select('id')
        .in('rol', ['compras', 'administracion', 'gerencia'])

      if (usuariosCompras) {
        for (const usuario of usuariosCompras) {
          await supabase.from('user_notifications').insert({
            user_id: usuario.id,
            type: 'stock_agotado',
            title: `⚠️ Stock Agotado: ${articulo.descripcion}`,
            description: `El artículo "${articulo.descripcion}" se ha agotado. Se requiere reposición urgente.`,
            related_id: articulo.id.toString(),
            read: false
          })
        }
      }
    } catch (error) {
      console.error('Error creando alerta de stock agotado:', error)
    }
  }

  async crearArticuloStock(articulo: {
    codigo?: string
    descripcion: string
    stock?: number
    stock_minimo?: number
    unidad?: string
    precio?: number
    categoria?: string
    proveedor?: string
    sector?: string
  }): Promise<ApiResponse<ArticuloStock>> {
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Creando artículo en stock:', articulo.descripcion)

      const { data, error } = await stockSupabase
        .from('articulos')
        .insert({
          codigo: articulo.codigo || null,
          descripcion: articulo.descripcion,
          stock: articulo.stock !== null && articulo.stock !== undefined ? Number(articulo.stock) : 0,
          stock_minimo: articulo.stock_minimo !== null && articulo.stock_minimo !== undefined ? Number(articulo.stock_minimo) : 0,
          unidad: articulo.unidad || 'unidad',
          precio: articulo.precio !== null && articulo.precio !== undefined ? Number(articulo.precio) : null,
          categoria: articulo.categoria || null,
          proveedor: articulo.proveedor || null,
          sector: articulo.sector || 'Gral'
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error creando artículo:', error)
        return { 
          success: false, 
          error: `Error al crear artículo: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}. Hint: ${error.hint || 'N/A'}` 
        }
      }

      if (!data) {
        return { success: false, error: 'El artículo se creó pero no se retornó' }
      }

      console.log('✅ Artículo creado exitosamente:', data.id)
      return { success: true, data: data as ArticuloStock }
    } catch (error) {
      console.error('❌ Excepción al crear artículo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al crear artículo' 
      }
    }
  }

  async actualizarArticuloStock(
    id: number,
    articulo: {
      codigo?: string
      descripcion?: string
      stock?: number
      stock_minimo?: number
      unidad?: string
      precio?: number
      categoria?: string
      proveedor?: string
      sector?: string
    }
  ): Promise<ApiResponse<ArticuloStock>> {
    if (!stockSupabase) {
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Actualizando artículo en stock:', id)

      const updateData: any = {}
      if (articulo.codigo !== undefined) updateData.codigo = articulo.codigo || null
      if (articulo.descripcion !== undefined) updateData.descripcion = articulo.descripcion
      if (articulo.stock !== undefined) {
        // Asegurar que stock sea un número válido
        updateData.stock = articulo.stock !== null && articulo.stock !== undefined 
          ? Number(articulo.stock) 
          : null
      }
      if (articulo.stock_minimo !== undefined) {
        // Asegurar que stock_minimo sea un número válido
        updateData.stock_minimo = articulo.stock_minimo !== null && articulo.stock_minimo !== undefined 
          ? Number(articulo.stock_minimo) 
          : null
      }
      if (articulo.unidad !== undefined) updateData.unidad = articulo.unidad
      if (articulo.precio !== undefined) updateData.precio = articulo.precio !== null && articulo.precio !== undefined ? Number(articulo.precio) : null
      if (articulo.categoria !== undefined) updateData.categoria = articulo.categoria || null
      if (articulo.proveedor !== undefined) updateData.proveedor = articulo.proveedor || null
      if (articulo.sector !== undefined) updateData.sector = articulo.sector || 'Gral'

      const { data, error } = await stockSupabase
        .from('articulos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error actualizando artículo:', error)
        return { 
          success: false, 
          error: `Error al actualizar artículo: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}` 
        }
      }

      if (!data) {
        return { success: false, error: 'El artículo se actualizó pero no se retornó' }
      }

      console.log('✅ Artículo actualizado exitosamente:', id)
      return { success: true, data: data as ArticuloStock }
    } catch (error) {
      console.error('❌ Excepción al actualizar artículo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al actualizar artículo' 
      }
    }
  }

  async getArticulosStock(search?: string, stockBajo?: boolean, sector?: string): Promise<ApiResponse<ArticuloStock[]>> {
    if (!stockSupabase) {
      console.warn('⚠️ No hay conexión a la base de datos de stock. Verifica VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY')
      return { success: false, error: 'No hay conexión a la base de datos de stock. Verifica las variables de entorno VITE_STOCK_SUPABASE_URL y VITE_STOCK_SUPABASE_ANON_KEY' }
    }

    try {
      console.log('📦 Obteniendo artículos de stock:', { search, stockBajo, sector })

      let query = stockSupabase
        .from('articulos')
        .select('id, codigo, descripcion, stock, stock_minimo, unidad, precio, categoria, proveedor, activo, sector')
        .order('descripcion', { ascending: true })

      // Filtrar por sector
      if (sector && sector !== 'Todos') {
        if (sector === 'Gral') {
          query = query.or('sector.is.null,sector.eq.Gral')
        } else {
          query = query.eq('sector', sector)
        }
      }

      // Búsqueda mejorada - busca en descripción y código
      if (search && search.trim().length >= 2) {
        const searchTerm = search.trim()
        query = query.or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
      }

      if (stockBajo) {
        // Filtrar artículos con stock bajo (<= stock_minimo) o agotado (<= 0 o null)
        query = query.or('stock.is.null,stock.lte.0')
        // También filtrar por stock <= stock_minimo cuando ambos existen
        // Esto requiere una consulta más compleja, pero por ahora usamos el filtro básico
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error obteniendo artículos de stock:', error)
        return { 
          success: false, 
          error: `Error al obtener artículos: ${error.message}. Código: ${error.code || 'N/A'}. Detalles: ${error.details || 'N/A'}` 
        }
      }

      // Filtrar por stock bajo si es necesario (filtro adicional en memoria para casos complejos)
      let articulosFiltrados = data || []
      if (stockBajo) {
        articulosFiltrados = articulosFiltrados.filter((art: any) => {
          const stock = art.stock !== null && art.stock !== undefined ? Number(art.stock) : 0
          const stockMinimo = art.stock_minimo !== null && art.stock_minimo !== undefined ? Number(art.stock_minimo) : 10
          return stock === 0 || stock <= stockMinimo
        })
      }

      // Normalizar los datos para asegurar tipos correctos
      const articulosNormalizados = articulosFiltrados.map((art: any) => ({
        id: art.id,
        codigo: art.codigo || null,
        descripcion: art.descripcion,
        stock: art.stock !== null && art.stock !== undefined ? Number(art.stock) : null,
        stock_minimo: art.stock_minimo !== null && art.stock_minimo !== undefined ? Number(art.stock_minimo) : null,
        unidad: art.unidad || 'unidad',
        precio: art.precio !== null && art.precio !== undefined ? Number(art.precio) : null,
        categoria: art.categoria || null,
        proveedor: art.proveedor || null,
        activo: art.activo !== null && art.activo !== undefined ? Boolean(art.activo) : true,
        sector: art.sector || 'Gral'
      }))

      console.log(`✅ Artículos obtenidos: ${articulosNormalizados.length}`)
      return { success: true, data: articulosNormalizados as ArticuloStock[] }
    } catch (error) {
      console.error('❌ Excepción al obtener artículos:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al obtener artículos' 
      }
    }
  }

  async registrarMovimientoStock(movimiento: {
    id_articulo_stock: number
    codigo_articulo?: string
    descripcion: string
    tipo_movimiento: 'Entrada' | 'Salida' | 'Ajuste' | 'Pedido' | 'Venta' | 'Devolución'
    cantidad: number
    cantidad_anterior?: number
    cantidad_nueva?: number
    motivo?: string
    id_orden_trabajo?: number
    id_pedido_compra?: number
    id_usuario?: number
    nombre_usuario?: string
  }): Promise<ApiResponse<StockMovimiento>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('stock_movimientos')
          .insert(movimiento)
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Actualizar stock en la base de stock si es necesario
        if (stockSupabase && movimiento.cantidad_nueva !== undefined) {
          await stockSupabase
            .from('articulos')
            .update({ stock: movimiento.cantidad_nueva })
            .eq('id', movimiento.id_articulo_stock)
        }

        return { success: true, data: data as StockMovimiento }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getMovimientosStock(filters?: {
    id_articulo_stock?: number
    tipo_movimiento?: string
    id_orden_trabajo?: number
    id_pedido_compra?: number
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<StockMovimiento[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('stock_movimientos')
          .select('*')
          .order('created_at', { ascending: false })

        if (filters?.id_articulo_stock) {
          query = query.eq('id_articulo_stock', filters.id_articulo_stock)
        }
        if (filters?.tipo_movimiento) {
          query = query.eq('tipo_movimiento', filters.tipo_movimiento)
        }
        if (filters?.id_orden_trabajo) {
          query = query.eq('id_orden_trabajo', filters.id_orden_trabajo)
        }
        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.fecha_desde) {
          query = query.gte('created_at', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('created_at', filters.fecha_hasta)
        }

        const { data, error } = await query

        if (error) {
          return { success: false, error: error.message }
        }

        return { success: true, data: (data as StockMovimiento[]) || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== ATENCIONES MOSTRADOR ====================
  
  async crearAtencionMostrador(data: {
    cliente_nombre: string
    tipo: 'virtual' | 'consulta' | 'venta'
    usuario_id: number
    usuario_nombre: string
    orden_id?: number
    cliente_id?: number
    notas?: string
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('crear_atencion_mostrador', {
          p_cliente_nombre: data.cliente_nombre,
          p_tipo: data.tipo,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_orden_id: data.orden_id || null,
          p_cliente_id: data.cliente_id || null,
          p_notas: data.notas || null
        })

        if (error) {
          console.error('Error creando atención:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error creando atención:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerAtencionesMostrador(fechaInicio?: string, fechaFin?: string): Promise<ApiResponse<Array<{
    id: number
    cliente_id: number | null
    cliente_nombre: string
    tipo: 'virtual' | 'consulta' | 'venta'
    orden_id: number | null
    usuario_id: number
    usuario_nombre: string
    fecha_atencion: string
    notas: string | null
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_atenciones_mostrador', {
          p_fecha_inicio: fechaInicio || null,
          p_fecha_fin: fechaFin || null
        })

        if (error) {
          console.error('Error obteniendo atenciones:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<{
          id: number
          cliente_id: number | null
          cliente_nombre: string
          tipo: 'virtual' | 'consulta' | 'venta'
          orden_id: number | null
          usuario_id: number
          usuario_nombre: string
          fecha_atencion: string
          notas: string | null
        }> }
      } catch (error) {
        console.error('Error obteniendo atenciones:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  private async ensureChatRoomExists(roomId: number, canalNombre: string): Promise<void> {
    if (!supabase) return

    try {
      // Verificar si el room existe
      const { data: existingRoom, error: checkError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Error verificando chat_room:', checkError)
      }

      // Si no existe, crearlo
      if (!existingRoom) {
        const roomNames: Record<number, string> = {
          1: 'General',
          2: 'Producción',
          3: 'Diseño',
          4: 'Imprenta',
          5: 'Instalaciones',
          6: 'Random',
          7: 'Taller Gráfico',
          8: 'Mostrador'
        }

        const { error: insertError } = await supabase
          .from('chat_rooms')
          .insert({
            id: roomId,
            nombre: roomNames[roomId] || canalNombre,
            tipo: 'publico'
          })

        if (insertError) {
          console.warn('Error creando chat_room:', insertError)
          // Si falla por IDENTITY, intentar sin especificar ID
          if (insertError.code === '23505' || insertError.message.includes('identity')) {
            const { error: retryError } = await supabase
              .from('chat_rooms')
              .insert({
                nombre: roomNames[roomId] || canalNombre,
                tipo: 'publico'
              })
            if (retryError) {
              console.error('Error creando chat_room sin ID:', retryError)
            }
          }
        } else {
          console.log(`✅ Chat room ${roomId} creado exitosamente`)
        }
      }
    } catch (error) {
      console.warn('Error en ensureChatRoomExists:', error)
    }
  }

  // ===== ETIQUETAS DISPONIBLES =====
  async getEtiquetasDisponibles(): Promise<ApiResponse<Array<{ nombre: string; veces_usada: number; color: string }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_etiquetas_disponibles')
        
        if (error) {
          console.error('Error obteniendo etiquetas disponibles:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true, data: data || [] }
      } catch (error) {
        console.error('Excepción obteniendo etiquetas disponibles:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener el color de una etiqueta específica
   */
  async obtenerColorEtiqueta(nombre: string): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_color_etiqueta', {
          p_nombre: nombre.trim()
        })
        
        if (error) {
          console.error('Error obteniendo color de etiqueta:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true, data: data || '#6B7280' }
      } catch (error) {
        console.error('Excepción obteniendo color de etiqueta:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async guardarEtiquetaDisponible(nombre: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('agregar_etiqueta_disponible', {
          p_nombre: nombre.trim()
        })
        
        if (error) {
          console.error('Error guardando etiqueta disponible:', error)
          return { success: false, error: error.message }
        }
        
        return { success: true }
      } catch (error) {
        console.error('Excepción guardando etiqueta disponible:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== REVISIONES Y APROBACIONES ====================
  
  async solicitarRevisionOrden(data: {
    id_orden: number
    usuario_revisor_id: number
    usuario_revisor_nombre: string
    comentarios?: string
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('solicitar_revision_orden', {
          p_id_orden: data.id_orden,
          p_usuario_revisor_id: data.usuario_revisor_id,
          p_usuario_revisor_nombre: data.usuario_revisor_nombre,
          p_comentarios: data.comentarios || null
        })

        if (error) {
          console.error('Error solicitando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error solicitando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async aprobarRevisionOrden(idRevision: number, comentarios?: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('aprobar_revision_orden', {
          p_id_revision: idRevision,
          p_comentarios: comentarios || null
        })

        if (error) {
          console.error('Error aprobando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error aprobando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async rechazarRevisionOrden(idRevision: number, comentarios: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('rechazar_revision_orden', {
          p_id_revision: idRevision,
          p_comentarios: comentarios
        })

        if (error) {
          console.error('Error rechazando revisión:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error rechazando revisión:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerRevisionesOrden(idOrden: number): Promise<ApiResponse<Array<import('../types/api').RevisionOrden>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_revisiones_orden', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error obteniendo revisiones:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').RevisionOrden> }
      } catch (error) {
        console.error('Error obteniendo revisiones:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== GALERÍA DE TRABAJOS ====================
  
  async agregarTrabajoGaleria(data: {
    id_orden: number
    numero_op: string
    cliente: string
    titulo?: string
    descripcion?: string
    imagen_url: string
    categoria?: string
    tags?: string[]
    fecha_completado?: string
    usuario_subio_id?: number
    usuario_subio_nombre?: string
    visible_publico?: boolean
    destacado?: boolean
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('agregar_trabajo_galeria', {
          p_id_orden: data.id_orden,
          p_numero_op: data.numero_op,
          p_cliente: data.cliente,
          p_titulo: data.titulo || null,
          p_descripcion: data.descripcion || null,
          p_imagen_url: data.imagen_url,
          p_categoria: data.categoria || null,
          p_tags: data.tags || null,
          p_fecha_completado: data.fecha_completado || new Date().toISOString().split('T')[0],
          p_usuario_subio_id: data.usuario_subio_id || null,
          p_usuario_subio_nombre: data.usuario_subio_nombre || null,
          p_visible_publico: data.visible_publico !== undefined ? data.visible_publico : true,
          p_destacado: data.destacado !== undefined ? data.destacado : false
        })

        if (error) {
          console.error('Error agregando trabajo a galería:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error agregando trabajo a galería:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTrabajosGaleria(filtros?: {
    categoria?: string
    limit?: number
    offset?: number
    solo_destacados?: boolean
    solo_publicos?: boolean
  }): Promise<ApiResponse<Array<import('../types/api').TrabajoGaleria>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_trabajos_galeria', {
          p_categoria: filtros?.categoria || null,
          p_limit: filtros?.limit || 50,
          p_offset: filtros?.offset || 0,
          p_solo_destacados: filtros?.solo_destacados || false,
          p_solo_publicos: filtros?.solo_publicos !== undefined ? filtros.solo_publicos : true
        })

        if (error) {
          console.error('Error obteniendo trabajos de galería:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').TrabajoGaleria> }
      } catch (error) {
        console.error('Error obteniendo trabajos de galería:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerCategoriasGaleria(): Promise<ApiResponse<Array<import('../types/api').CategoriaGaleria>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_categorias_galeria')

        if (error) {
          console.error('Error obteniendo categorías:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').CategoriaGaleria> }
      } catch (error) {
        console.error('Error obteniendo categorías:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== REGISTRO DE TIEMPO DE TRABAJO ====================
  
  async iniciarTiempoTrabajo(data: {
    id_orden: number
    usuario_id: number
    usuario_nombre: string
    hora_inicio?: string
    descripcion?: string
    tipo_trabajo?: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        // Construir parámetros dinámicamente - no pasar p_hora_inicio si no está definido
        // para que use el valor por defecto (CURRENT_TIME) en la función SQL
        const rpcParams: any = {
          p_id_orden: data.id_orden,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_tipo_trabajo: data.tipo_trabajo || 'diseno'
        }
        
        // Solo agregar p_hora_inicio si está definido
        if (data.hora_inicio) {
          rpcParams.p_hora_inicio = data.hora_inicio
        }
        
        // Solo agregar p_descripcion si está definido
        if (data.descripcion) {
          rpcParams.p_descripcion = data.descripcion
        }
        
        const { data: result, error } = await supabase.rpc('iniciar_tiempo_trabajo', rpcParams)

        if (error) {
          console.error('Error iniciando tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error iniciando tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async finalizarTiempoTrabajo(idRegistro: number, horaFin?: string, descripcion?: string): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        // Construir parámetros dinámicamente - no pasar p_hora_fin si no está definido
        // para que use el valor por defecto (CURRENT_TIME) en la función SQL
        const rpcParams: any = {
          p_id_registro: idRegistro
        }
        
        // Solo agregar p_hora_fin si está definido
        if (horaFin) {
          rpcParams.p_hora_fin = horaFin
        }
        
        // Solo agregar p_descripcion si está definido
        if (descripcion) {
          rpcParams.p_descripcion = descripcion
        }
        
        const { data: result, error } = await supabase.rpc('finalizar_tiempo_trabajo', rpcParams)

        if (error) {
          console.error('Error finalizando tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error finalizando tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async registrarTiempoManual(data: {
    id_orden: number
    usuario_id: number
    usuario_nombre: string
    fecha?: string
    hora_inicio: string
    hora_fin: string
    tiempo_minutos?: number
    descripcion?: string
    tipo_trabajo?: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  }): Promise<ApiResponse<number>> {
    if (supabase) {
      try {
        const { data: result, error } = await supabase.rpc('registrar_tiempo_manual', {
          p_id_orden: data.id_orden,
          p_usuario_id: data.usuario_id,
          p_usuario_nombre: data.usuario_nombre,
          p_fecha: data.fecha || null,
          p_hora_inicio: data.hora_inicio,
          p_hora_fin: data.hora_fin,
          p_tiempo_minutos: data.tiempo_minutos || null,
          p_descripcion: data.descripcion || null,
          p_tipo_trabajo: data.tipo_trabajo || 'diseno'
        })

        if (error) {
          console.error('Error registrando tiempo manual:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: result as number }
      } catch (error) {
        console.error('Error registrando tiempo manual:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTiempoTrabajoOrden(idOrden: number): Promise<ApiResponse<Array<import('../types/api').RegistroTiempo>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_tiempo_trabajo_orden', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error obteniendo tiempo de trabajo:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').RegistroTiempo> }
      } catch (error) {
        console.error('Error obteniendo tiempo de trabajo:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerTiempoUsuario(usuarioId: number, fechaDesde?: string, fechaHasta?: string): Promise<ApiResponse<Array<import('../types/api').TiempoUsuario>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_tiempo_usuario', {
          p_usuario_id: usuarioId,
          p_fecha_desde: fechaDesde || null,
          p_fecha_hasta: fechaHasta || null
        })

        if (error) {
          console.error('Error obteniendo tiempo de usuario:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as Array<import('../types/api').TiempoUsuario> }
      } catch (error) {
        console.error('Error obteniendo tiempo de usuario:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ==================== BRIEF PÚBLICO - FORMULARIO CLIENTE ====================
  
  // Crear un nuevo brief público (sin necesidad de OP)
  async crearBriefPublico(usuarioId?: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_brief_publico', {
          p_creado_por: usuarioId || null
        })

        if (error) {
          console.error('Error creando brief público:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as string }
      } catch (error) {
        console.error('Error creando brief público:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Generar token para una OP existente (compatibilidad hacia atrás)
  async generarBriefToken(idOrden: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('generar_brief_token', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error generando token de brief:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as string }
      } catch (error) {
        console.error('Error generando token de brief:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Obtener brief por token (nueva estructura)
  async obtenerBriefPorToken(token: string): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_brief_por_token', {
          p_token: token
        })

        if (error) {
          console.error('Error obteniendo brief por token:', error)
          return { success: false, error: error.message }
        }

        if (!data || data.length === 0) {
          return { success: false, error: 'Token no válido' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        console.error('Error obteniendo brief por token:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Obtener orden por token de brief (compatibilidad hacia atrás)
  async obtenerOrdenPorBriefToken(token: string): Promise<ApiResponse<Partial<OrdenTrabajo>>> {
    // Primero intentar obtener desde la nueva tabla de briefs
    const briefResponse = await this.obtenerBriefPorToken(token)
    if (briefResponse.success && briefResponse.data) {
      // Si tiene orden asociada, obtenerla
      if (briefResponse.data.id_orden_asociada) {
        const ordenResponse = await this.getOrden(briefResponse.data.id_orden_asociada)
        if (ordenResponse.success) {
          return ordenResponse
        }
      }
        // Si no tiene orden, devolver los datos del brief como si fuera una orden
        const briefData = briefResponse.data
        return { 
          success: true, 
          data: {
            numero_op: briefData.numero_op || 'Pendiente',
            cliente: briefData.cliente || briefData.cliente_nombre_completo || 'Cliente',
            cliente_nombre_completo: briefData.cliente_nombre_completo || null,
            cliente_empresa: briefData.cliente_empresa || null,
            telefono_cliente: briefData.telefono_cliente || null,
            email_cliente: briefData.email_cliente || null,
            tipo_producto_servicio: Array.isArray(briefData.tipo_producto_servicio) ? briefData.tipo_producto_servicio : null,
            tipo_producto_otro: briefData.tipo_producto_otro || null,
            necesita_asesoramiento: briefData.necesita_asesoramiento || false,
            donde_colocados: briefData.donde_colocados || null,
            digital_o_impresion: briefData.digital_o_impresion || null,
            cantidades: briefData.cantidades || null,
            objetivo_proyecto: briefData.objetivo_proyecto || null,
            material_logo: briefData.material_logo || null,
            material_textos: briefData.material_textos || null,
            material_imagenes: briefData.material_imagenes || null,
            tiene_referencias: briefData.tiene_referencias || false,
            referencias_links: briefData.referencias_links || null,
            brief_publico: briefData.brief_publico || null,
            estilo_diseno: briefData.estilo_diseno || null,
            referencias: briefData.referencias || null,
            fecha_limite_brief: briefData.fecha_limite_brief || null,
            es_urgencia: briefData.es_urgencia || false
          } as Partial<OrdenTrabajo>
        }
    }
    
    // Fallback: intentar con la función antigua (compatibilidad)
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_orden_por_brief_token', {
          p_token: token
        })

        if (error) {
          console.error('Error obteniendo orden por token:', error)
          return { success: false, error: error.message }
        }

        if (!data || data.length === 0) {
          return { success: false, error: 'Token no válido' }
        }

        return { success: true, data: data[0] as Partial<OrdenTrabajo> }
      } catch (error) {
        console.error('Error obteniendo orden por token:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Listar briefs pendientes (sin OP asociada)
  async listarBriefsPendientes(): Promise<ApiResponse<any[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_briefs_pendientes')

        if (error) {
          console.error('Error listando briefs pendientes:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: (data || []) as any[] }
      } catch (error) {
        console.error('Error listando briefs pendientes:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Asociar un brief a una orden
  async asociarBriefAOrden(tokenBrief: string, idOrden: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('asociar_brief_a_orden', {
          p_token_brief: tokenBrief,
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error asociando brief a orden:', error)
          return { success: false, error: error.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error asociando brief a orden:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarBriefPublico(data: {
    token: string
    cliente_nombre_completo?: string
    cliente_empresa?: string
    telefono_cliente?: string
    email_cliente?: string
    tipo_producto_servicio?: string[]
    tipo_producto_otro?: string
    necesita_asesoramiento?: boolean
    donde_colocados?: string
    digital_o_impresion?: string
    cantidades?: string
    objetivo_proyecto?: string
    material_logo?: string
    material_textos?: string
    material_imagenes?: string
    tiene_referencias?: boolean
    referencias_links?: string
    brief_publico?: string
    estilo_diseno?: string
    referencias?: string
    fecha_limite_brief?: string
    es_urgencia?: boolean
  }): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        // Intentar con la nueva función primero
        let updateError = null
        try {
          const result = await supabase.rpc('actualizar_brief_publico_completo', {
            p_token: data.token,
            p_cliente_nombre_completo: data.cliente_nombre_completo || null,
            p_cliente_empresa: data.cliente_empresa || null,
            p_telefono_cliente: data.telefono_cliente || null,
            p_email_cliente: data.email_cliente || null,
            p_tipo_producto_servicio: data.tipo_producto_servicio || null,
            p_tipo_producto_otro: data.tipo_producto_otro || null,
            p_necesita_asesoramiento: data.necesita_asesoramiento || false,
            p_donde_colocados: data.donde_colocados || null,
            p_digital_o_impresion: data.digital_o_impresion || null,
            p_cantidades: data.cantidades || null,
            p_objetivo_proyecto: data.objetivo_proyecto || null,
            p_material_logo: data.material_logo || null,
            p_material_textos: data.material_textos || null,
            p_material_imagenes: data.material_imagenes || null,
            p_tiene_referencias: data.tiene_referencias || false,
            p_referencias_links: data.referencias_links || null,
            p_brief_publico: data.brief_publico || null,
            p_estilo_diseno: data.estilo_diseno || null,
            p_referencias: data.referencias || null,
            p_fecha_limite_brief: data.fecha_limite_brief || null,
            p_es_urgencia: data.es_urgencia || false
          })
          updateError = result.error
        } catch (e) {
          // Si falla, intentar con la función antigua (compatibilidad)
          const result = await supabase.rpc('actualizar_brief_publico', {
            p_token: data.token,
            p_cliente_nombre_completo: data.cliente_nombre_completo || null,
            p_cliente_empresa: data.cliente_empresa || null,
            p_telefono_cliente: data.telefono_cliente || null,
            p_email_cliente: data.email_cliente || null,
            p_tipo_producto_servicio: data.tipo_producto_servicio || null,
            p_tipo_producto_otro: data.tipo_producto_otro || null,
            p_necesita_asesoramiento: data.necesita_asesoramiento || false,
            p_donde_colocados: data.donde_colocados || null,
            p_digital_o_impresion: data.digital_o_impresion || null,
            p_cantidades: data.cantidades || null,
            p_objetivo_proyecto: data.objetivo_proyecto || null,
            p_material_logo: data.material_logo || null,
            p_material_textos: data.material_textos || null,
            p_material_imagenes: data.material_imagenes || null,
            p_tiene_referencias: data.tiene_referencias || false,
            p_referencias_links: data.referencias_links || null,
            p_brief_publico: data.brief_publico || null,
            p_estilo_diseno: data.estilo_diseno || null,
            p_referencias: data.referencias || null,
            p_fecha_limite_brief: data.fecha_limite_brief || null,
            p_es_urgencia: data.es_urgencia || false
          })
          updateError = result.error
        }

        if (updateError) {
          console.error('Error actualizando brief público:', updateError)
          return { success: false, error: updateError.message }
        }

        return { success: true }
      } catch (error) {
        console.error('Error actualizando brief público:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== PROVEEDORES ==========
  
  async getProveedores(activos?: boolean): Promise<ApiResponse<Proveedor[]>> {
    if (supabase) {
      try {
        let query = supabase.from('proveedores').select('*').order('nombre', { ascending: true })
        if (activos !== undefined) {
          query = query.eq('activo', activos)
        }
        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as Proveedor[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getProveedor(id: number): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .select('*')
          .eq('id', id)
          .single()
        if (error) return { success: false, error: error.message }
        if (!data) return { success: false, error: 'Proveedor no encontrado' }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearProveedor(proveedor: {
    nombre: string
    razon_social?: string
    cuit?: string
    contacto_nombre?: string
    telefono?: string
    email?: string
    direccion?: string
    ciudad?: string
    provincia?: string
    codigo_postal?: string
    sitio_web?: string
    notas?: string
  }): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .insert(proveedor)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarProveedor(id: number, proveedor: Partial<Proveedor>): Promise<ApiResponse<Proveedor>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .update(proveedor)
          .eq('id', id)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Proveedor }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async eliminarProveedor(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('proveedores')
          .update({ activo: false })
          .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getProductosProveedor(idProveedor: number): Promise<ApiResponse<ProveedorProducto[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .select('*')
          .eq('id_proveedor', idProveedor)
          .eq('activo', true)
          .order('descripcion', { ascending: true })
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as ProveedorProducto[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearProductoProveedor(producto: {
    id_proveedor: number
    codigo_producto?: string
    descripcion: string
    unidad?: string
    precio_unitario?: number
    moneda?: string
    stock_disponible?: number
    tiempo_entrega_dias?: number
    observaciones?: string
  }): Promise<ApiResponse<ProveedorProducto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .insert({
            ...producto,
            moneda: producto.moneda || 'ARS',
            unidad: producto.unidad || 'unidad'
          })
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ProveedorProducto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarProductoProveedor(id: number, producto: Partial<ProveedorProducto>): Promise<ApiResponse<ProveedorProducto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('proveedores_productos')
          .update(producto)
          .eq('id', id)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ProveedorProducto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getHistorialPrecios(idProveedor?: number, codigoProducto?: string): Promise<ApiResponse<PrecioHistorial[]>> {
    if (supabase) {
      try {
        let query = supabase.from('precios_historial').select('*').order('fecha_cambio', { ascending: false })
        if (idProveedor) {
          query = query.eq('id_proveedor', idProveedor)
        }
        if (codigoProducto) {
          query = query.eq('codigo_producto', codigoProducto)
        }
        const { data, error } = await query.limit(100)
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as PrecioHistorial[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ========== PRESUPUESTOS ==========

  async crearPresupuesto(presupuesto: {
    id_pedido_compra?: number
    id_proveedor: number
    fecha_vencimiento?: string
    condiciones_pago?: string
    tiempo_entrega_dias?: number
    observaciones?: string
    items: Array<{
      id_item_pedido?: number
      codigo_producto?: string
      descripcion: string
      cantidad: number
      unidad?: string
      precio_unitario: number
      observaciones?: string
    }>
  }): Promise<ApiResponse<Presupuesto>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Calcular monto total
        const montoTotal = presupuesto.items.reduce((sum, item) => {
          return sum + (item.precio_unitario * item.cantidad)
        }, 0)

        // Generar número de presupuesto
        const numeroPresupuesto = `PRES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

        // Crear presupuesto
        const { data: presupuestoData, error: presupuestoError } = await supabase
          .from('presupuestos')
          .insert({
            numero_presupuesto: numeroPresupuesto,
            id_pedido_compra: presupuesto.id_pedido_compra || null,
            id_proveedor: presupuesto.id_proveedor,
            fecha_vencimiento: presupuesto.fecha_vencimiento || null,
            condiciones_pago: presupuesto.condiciones_pago || null,
            tiempo_entrega_dias: presupuesto.tiempo_entrega_dias || null,
            observaciones: presupuesto.observaciones || null,
            monto_total: montoTotal,
            id_usuario_solicitante: usuario?.id || null,
            nombre_usuario_solicitante: usuario?.nombre || null
          })
          .select()
          .single()

        if (presupuestoError) return { success: false, error: presupuestoError.message }

        // Crear items del presupuesto
        const items = presupuesto.items.map(item => ({
          id_presupuesto: presupuestoData.id,
          id_item_pedido: item.id_item_pedido || null,
          codigo_producto: item.codigo_producto || null,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad || 'unidad',
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_unitario * item.cantidad,
          observaciones: item.observaciones || null
        }))

        const { error: itemsError } = await supabase
          .from('presupuestos_items')
          .insert(items)

        if (itemsError) {
          // Si falla la inserción de items, eliminar el presupuesto creado
          await supabase.from('presupuestos').delete().eq('id', presupuestoData.id)
          return { success: false, error: itemsError.message }
        }

        // Obtener el presupuesto completo con items
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos')
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .eq('id', presupuestoData.id)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }

        return { success: true, data: presupuestoCompleto as Presupuesto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPresupuestos(filters?: {
    id_pedido_compra?: number
    id_proveedor?: number
    estado?: EstadoPresupuesto
  }): Promise<ApiResponse<Presupuesto[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('presupuestos')
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .order('fecha_solicitud', { ascending: false })

        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.id_proveedor) {
          query = query.eq('id_proveedor', filters.id_proveedor)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as Presupuesto[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPresupuesto(id: number, updates: {
    estado?: EstadoPresupuesto
    fecha_recepcion?: string
    fecha_aceptacion?: string
    archivo_adjunto_url?: string
    observaciones?: string
  }): Promise<ApiResponse<Presupuesto>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('presupuestos')
          .update(updates)
          .eq('id', id)
          .select(`
            *,
            items:presupuestos_items(*),
            proveedor:proveedores(*)
          `)
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Presupuesto }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async compararPresupuestos(idPedidoCompra: number, comparacion: {
    id_presupuesto_seleccionado: number
    notas_comparacion?: string
    criterio_seleccion?: string
  }): Promise<ApiResponse<ComparacionPresupuestos>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const { data, error } = await supabase
          .from('comparacion_presupuestos')
          .insert({
            id_pedido_compra: idPedidoCompra,
            id_presupuesto_seleccionado: comparacion.id_presupuesto_seleccionado,
            notas_comparacion: comparacion.notas_comparacion || null,
            criterio_seleccion: comparacion.criterio_seleccion || null,
            id_usuario_comparador: usuario?.id || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }

        // Actualizar el presupuesto seleccionado a "Aceptado"
        await supabase
          .from('presupuestos')
          .update({ estado: 'Aceptado', fecha_aceptacion: new Date().toISOString() })
          .eq('id', comparacion.id_presupuesto_seleccionado)

        return { success: true, data: data as ComparacionPresupuestos }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== CONCILIACIÓN BANCARIA =====
  async crearPago(pago: {
    id_pedido_compra?: number
    id_proveedor?: number
    monto_total: number
    moneda: string
    fecha_vencimiento?: string
    metodo_pago?: string
    banco?: string
    cuenta_bancaria?: string
    observaciones?: string
  }): Promise<ApiResponse<Pago>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Generar número de pago
        const { data: ultimoPago } = await supabase
          .from('pagos')
          .select('numero_pago')
          .order('id', { ascending: false })
          .limit(1)
          .single()

        let numeroPago = 'PAG-0001'
        if (ultimoPago?.numero_pago) {
          const ultimoNumero = parseInt(ultimoPago.numero_pago.split('-')[1])
          numeroPago = `PAG-${String(ultimoNumero + 1).padStart(4, '0')}`
        }

        const { data, error } = await supabase
          .from('pagos')
          .insert({
            numero_pago: numeroPago,
            id_pedido_compra: pago.id_pedido_compra || null,
            id_proveedor: pago.id_proveedor || null,
            monto_total: pago.monto_total,
            monto_pagado: 0,
            moneda: pago.moneda,
            fecha_vencimiento: pago.fecha_vencimiento || null,
            metodo_pago: pago.metodo_pago || null,
            banco: pago.banco || null,
            cuenta_bancaria: pago.cuenta_bancaria || null,
            estado: 'Pendiente',
            observaciones: pago.observaciones || null,
            id_usuario_registro: usuario?.id || null,
            nombre_usuario_registro: usuario?.nombre || null
          })
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPagos(filters?: {
    id_pedido_compra?: number
    id_proveedor?: number
    estado?: EstadoPago
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<Pago[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('pagos')
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .order('created_at', { ascending: false })

        if (filters?.id_pedido_compra) {
          query = query.eq('id_pedido_compra', filters.id_pedido_compra)
        }
        if (filters?.id_proveedor) {
          query = query.eq('id_proveedor', filters.id_proveedor)
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado)
        }
        if (filters?.fecha_desde) {
          query = query.gte('created_at', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('created_at', filters.fecha_hasta)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarPago(id: number, updates: {
    monto_pagado?: number
    fecha_pago?: string
    numero_comprobante?: string
    estado?: EstadoPago
    fecha_conciliacion?: string
    observaciones?: string
  }): Promise<ApiResponse<Pago>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const updateData: any = { ...updates }
        if (updates.fecha_conciliacion && usuario) {
          updateData.id_usuario_conciliacion = usuario.id
        }

        const { data, error } = await supabase
          .from('pagos')
          .update(updateData)
          .eq('id', id)
          .select(`
            *,
            pedido:pedidos_compras(*),
            proveedor:proveedores(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as Pago }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearMovimientoBancario(movimiento: {
    fecha_movimiento: string
    fecha_valor?: string
    tipo: 'Ingreso' | 'Egreso'
    concepto: string
    monto: number
    moneda: string
    banco: string
    cuenta_bancaria: string
    numero_comprobante?: string
    referencia?: string
    id_pago_asociado?: number
    observaciones?: string
  }): Promise<ApiResponse<MovimientoBancario>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('movimientos_bancarios')
          .insert({
            ...movimiento,
            conciliado: false
          })
          .select(`
            *,
            pago:pagos(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as MovimientoBancario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getMovimientosBancarios(filters?: {
    banco?: string
    cuenta_bancaria?: string
    conciliado?: boolean
    fecha_desde?: string
    fecha_hasta?: string
    tipo?: 'Ingreso' | 'Egreso'
  }): Promise<ApiResponse<MovimientoBancario[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('movimientos_bancarios')
          .select(`
            *,
            pago:pagos(*)
          `)
          .order('fecha_movimiento', { ascending: false })

        if (filters?.banco) {
          query = query.eq('banco', filters.banco)
        }
        if (filters?.cuenta_bancaria) {
          query = query.eq('cuenta_bancaria', filters.cuenta_bancaria)
        }
        if (filters?.conciliado !== undefined) {
          query = query.eq('conciliado', filters.conciliado)
        }
        if (filters?.fecha_desde) {
          query = query.gte('fecha_movimiento', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('fecha_movimiento', filters.fecha_hasta)
        }
        if (filters?.tipo) {
          query = query.eq('tipo', filters.tipo)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as MovimientoBancario[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async conciliarMovimiento(idMovimiento: number, idPago: number): Promise<ApiResponse<MovimientoBancario>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        const { data, error } = await supabase
          .from('movimientos_bancarios')
          .update({
            id_pago_asociado: idPago,
            conciliado: true,
            fecha_conciliacion: new Date().toISOString(),
            id_usuario_conciliacion: usuario?.id || null
          })
          .eq('id', idMovimiento)
          .select(`
            *,
            pago:pagos(*)
          `)
          .single()

        if (error) return { success: false, error: error.message }

        // Actualizar el estado del pago si corresponde
        const { data: pagoData } = await supabase
          .from('pagos')
          .select('monto_total, monto_pagado')
          .eq('id', idPago)
          .single()

        if (pagoData && data) {
          const nuevoMontoPagado = (pagoData.monto_pagado || 0) + data.monto
          const nuevoEstado: EstadoPago = nuevoMontoPagado >= pagoData.monto_total ? 'Completado' : nuevoMontoPagado > 0 ? 'Parcial' : 'Pendiente'

          await supabase
            .from('pagos')
            .update({
              monto_pagado: nuevoMontoPagado,
              estado: nuevoEstado,
              fecha_pago: nuevoEstado === 'Completado' ? new Date().toISOString() : null,
              fecha_conciliacion: new Date().toISOString(),
              id_usuario_conciliacion: usuario?.id || null
            })
            .eq('id', idPago)
        }

        return { success: true, data: data as MovimientoBancario }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async crearConciliacion(conciliacion: {
    fecha_desde: string
    fecha_hasta: string
    banco: string
    cuenta_bancaria: string
    saldo_inicial: number
    observaciones?: string
  }): Promise<ApiResponse<ConciliacionBancaria>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null

        // Obtener movimientos del período
        const { data: movimientos } = await supabase
          .from('movimientos_bancarios')
          .select('*')
          .eq('banco', conciliacion.banco)
          .eq('cuenta_bancaria', conciliacion.cuenta_bancaria)
          .gte('fecha_movimiento', conciliacion.fecha_desde)
          .lte('fecha_movimiento', conciliacion.fecha_hasta)

        const totalIngresos = movimientos?.filter(m => m.tipo === 'Ingreso').reduce((sum, m) => sum + m.monto, 0) || 0
        const totalEgresos = movimientos?.filter(m => m.tipo === 'Egreso').reduce((sum, m) => sum + m.monto, 0) || 0
        const saldoFinal = conciliacion.saldo_inicial + totalIngresos - totalEgresos
        const movimientosConciliados = movimientos?.filter(m => m.conciliado).length || 0
        const movimientosPendientes = movimientos?.filter(m => !m.conciliado).length || 0

        const { data, error } = await supabase
          .from('conciliaciones_bancarias')
          .insert({
            fecha_conciliacion: new Date().toISOString(),
            fecha_desde: conciliacion.fecha_desde,
            fecha_hasta: conciliacion.fecha_hasta,
            banco: conciliacion.banco,
            cuenta_bancaria: conciliacion.cuenta_bancaria,
            saldo_inicial: conciliacion.saldo_inicial,
            saldo_final: saldoFinal,
            total_ingresos: totalIngresos,
            total_egresos: totalEgresos,
            movimientos_conciliados: movimientosConciliados,
            movimientos_pendientes: movimientosPendientes,
            id_usuario: usuario?.id || null,
            nombre_usuario: usuario?.nombre || null,
            observaciones: conciliacion.observaciones || null
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ConciliacionBancaria }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getConciliaciones(filters?: {
    banco?: string
    cuenta_bancaria?: string
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<ConciliacionBancaria[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('conciliaciones_bancarias')
          .select('*')
          .order('fecha_conciliacion', { ascending: false })

        if (filters?.banco) {
          query = query.eq('banco', filters.banco)
        }
        if (filters?.cuenta_bancaria) {
          query = query.eq('cuenta_bancaria', filters.cuenta_bancaria)
        }
        if (filters?.fecha_desde) {
          query = query.gte('fecha_conciliacion', filters.fecha_desde)
        }
        if (filters?.fecha_hasta) {
          query = query.lte('fecha_conciliacion', filters.fecha_hasta)
        }

        const { data, error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ConciliacionBancaria[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ===== HISTORIAL ETAPAS TALLER GRÁFICO =====
  async obtenerHistorialEtapasInstalaciones(idOrden: number): Promise<ApiResponse<HistorialEtapaInstalaciones[]>> {
    if (supabase) {
      const { data, error } = await supabase.rpc('obtener_historial_etapas_instalaciones', {
        p_id_orden: idOrden
      })

      if (error) {
        console.error('Error obteniendo historial de etapas de instalaciones:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as HistorialEtapaInstalaciones[]) ?? [] }
    }

    return { success: false, error: 'Supabase no configurado' }
  }

  async obtenerHistorialEtapasTallerGrafico(idOrden: number): Promise<ApiResponse<HistorialEtapaTallerGrafico[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_taller_grafico', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaTallerGrafico[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerHistorialEtapasTallerImprenta(idOrden: number): Promise<ApiResponse<HistorialEtapaTallerImprenta[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_taller_imprenta', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaTallerImprenta[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async obtenerHistorialEtapasMetalurgica(idOrden: number): Promise<ApiResponse<HistorialEtapaMetalurgica[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_historial_etapas_metalurgica', {
          p_id_orden: idOrden
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as HistorialEtapaMetalurgica[]) ?? [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaTallerGrafico(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_etapa_taller_grafico', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaInstalaciones(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_etapa_instalaciones', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaTallerImprenta(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_etapa_taller_imprenta', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async actualizarEtapaMetalurgica(
    ordenId: number,
    nuevaEtapa: string,
    nombreUsuario: string
  ): Promise<ApiResponse<OrdenTrabajo>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_etapa_metalurgica', {
          p_id_orden: ordenId,
          p_nueva_etapa: nuevaEtapa,
          p_nombre_usuario: nombreUsuario
        })

        if (error) return { success: false, error: error.message }
        
        // Obtener la orden actualizada
        const { data: orden, error: fetchError } = await supabase
          .from('ordenes_trabajo')
          .select('*')
          .eq('id', ordenId)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: orden as OrdenTrabajo }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // ============================================
  // SISTEMA DE PEDIDOS WEB
  // ============================================

  /**
   * Autenticar cliente web
   */
  async autenticarClienteWeb(usuario: string, password: string): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        console.log('Intentando autenticar cliente:', usuario)
        const { data, error } = await supabase.rpc('autenticar_cliente', {
          p_usuario: usuario,
          p_password: password
        })

        console.log('Respuesta RPC:', { data, error })

        if (error) {
          console.error('Error en RPC:', error)
          return { success: false, error: error.message || 'Error al autenticar' }
        }
        
        if (!data || data.length === 0) {
          return { success: false, error: 'Usuario o contraseña incorrectos' }
        }

        // La función SQL retorna campos limitados, necesitamos obtener el registro completo
        const clienteData = data[0]
        console.log('Datos recibidos de autenticar_cliente:', clienteData)
        
        // Obtener el registro completo con todos los campos incluyendo 'activo'
        if (supabase && clienteData.id) {
        const { data: clienteCompleto, error: errorCompleto } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', clienteData.id)
          .eq('es_cliente_web', true)
          .single()
          
          if (errorCompleto) {
            console.error('Error obteniendo cliente completo:', errorCompleto)
            // Si falla, usar los datos básicos y asumir activo=true
            return { 
              success: true, 
              data: { ...clienteData, activo: true } as ClienteWebRecord 
            }
          }
          
          if (clienteCompleto) {
            return { success: true, data: clienteCompleto as ClienteWebRecord }
          }
        }

        // Fallback: usar datos básicos con activo=true
        return { 
          success: true, 
          data: { ...clienteData, activo: true } as ClienteWebRecord 
        }
      } catch (error) {
        console.error('Excepción en autenticarClienteWeb:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear cliente web (solo trabajadores)
   */
  async crearClienteWeb(cliente: {
    usuario: string
    password: string
    nombre: string
    apellido?: string
    empresa?: string
    telefono?: string
    email?: string
    dni_cuit?: string
    direccion?: string
  }): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_cliente', {
          p_usuario: cliente.usuario,
          p_password: cliente.password,
          p_nombre: cliente.nombre,
          p_apellido: cliente.apellido || null,
          p_empresa: cliente.empresa || null,
          p_telefono: cliente.telefono || null,
          p_email: cliente.email || null,
          p_dni_cuit: cliente.dni_cuit || null,
          p_direccion: cliente.direccion || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el cliente' }
        }

        return { success: true, data: data[0] as ClienteWebRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar cliente web (solo trabajadores)
   */
  async actualizarClienteWeb(
    id: number,
    cliente: {
      password?: string
      nombre?: string
      apellido?: string
      empresa?: string
      telefono?: string
      email?: string
      dni_cuit?: string
      direccion?: string
      activo?: boolean
    }
  ): Promise<ApiResponse<ClienteWebRecord>> {
    if (supabase) {
      try {
        // Construir objeto de parámetros solo con los campos que se proporcionaron
        const params: Record<string, any> = {
          p_id: id
        }
        
        if (cliente.password !== undefined) params.p_password = cliente.password || null
        if (cliente.nombre !== undefined) params.p_nombre = cliente.nombre || null
        if (cliente.apellido !== undefined) params.p_apellido = cliente.apellido || null
        if (cliente.empresa !== undefined) params.p_empresa = cliente.empresa || null
        if (cliente.telefono !== undefined) params.p_telefono = cliente.telefono || null
        if (cliente.email !== undefined) params.p_email = cliente.email || null
        if (cliente.dni_cuit !== undefined) params.p_dni_cuit = cliente.dni_cuit || null
        if (cliente.direccion !== undefined) params.p_direccion = cliente.direccion || null
        if (cliente.activo !== undefined) params.p_activo = cliente.activo

        console.log('Llamando a actualizar_cliente con params:', params)
        const { data, error } = await supabase.rpc('actualizar_cliente', params)

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el cliente' }
        }

        return { success: true, data: data[0] as ClienteWebRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener todos los clientes web (solo trabajadores)
   * Ahora usa la tabla unificada clientes con es_cliente_web = true
   */
  async getClientesWeb(): Promise<ApiResponse<ClienteWebRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('es_cliente_web', true)
          .order('created_at', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ClienteWebRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener artículos de empresa (catálogo)
   */
  async getArticulosEmpresa(visibleClientes?: boolean, incluirInactivos?: boolean): Promise<ApiResponse<ArticuloEmpresaRecord[]>> {
    if (supabase) {
      try {
        let query = supabase
          .from('articulos_empresa')
          .select('*')
          .order('nombre', { ascending: true })

        if (!incluirInactivos) {
          query = query.eq('activo', true)
        }

        if (visibleClientes !== undefined) {
          query = query.eq('visible_clientes', visibleClientes)
        }

        const { data, error } = await query

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as ArticuloEmpresaRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener categorías de artículos
   */
  async obtenerCategoriasArticulos(): Promise<ApiResponse<string[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_categorias_articulos')

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []).map((item: any) => item.categoria) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener subcategorías de una categoría
   */
  async obtenerSubcategoriasArticulos(categoria: string): Promise<ApiResponse<string[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_subcategorias_articulos', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []).map((item: any) => item.subcategoria) }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Guardar categoría automáticamente
   */
  async guardarCategoriaArticulo(categoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('guardar_categoria_articulo', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Guardar subcategoría automáticamente
   */
  async guardarSubcategoriaArticulo(categoria: string, subcategoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('guardar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria: subcategoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar categoría
   */
  async eliminarCategoriaArticulo(categoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_categoria_articulo', {
          p_categoria: categoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar nombre de categoría
   */
  async actualizarCategoriaArticulo(categoriaAntigua: string, categoriaNueva: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_categoria_articulo', {
          p_categoria_antigua: categoriaAntigua,
          p_categoria_nueva: categoriaNueva
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar subcategoría
   */
  async eliminarSubcategoriaArticulo(categoria: string, subcategoria: string): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria: subcategoria
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar nombre de subcategoría
   */
  async actualizarSubcategoriaArticulo(
    categoria: string,
    subcategoriaAntigua: string,
    subcategoriaNueva: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('actualizar_subcategoria_articulo', {
          p_categoria: categoria,
          p_subcategoria_antigua: subcategoriaAntigua,
          p_subcategoria_nueva: subcategoriaNueva
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Generar código automático para artículo
   */
  async generarCodigoArticulo(): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('generar_codigo_articulo_empresa')

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as string }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear artículo de empresa
   */
  async crearArticuloEmpresa(articulo: {
    codigo?: string
    nombre: string
    descripcion?: string
    categoria?: string
    subcategoria?: string
    precio_base?: number
    imagen_url?: string
    tiempo_estimado_dias?: number
    requiere_archivos?: boolean
    visible_clientes?: boolean
  }): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (supabase) {
      try {
        // Generar código automático si no se proporciona
        let codigoFinal = articulo.codigo
        if (!codigoFinal) {
          const codigoResponse = await this.generarCodigoArticulo()
          if (!codigoResponse.success) {
            return { success: false, error: codigoResponse.error || 'Error al generar código' }
          }
          codigoFinal = codigoResponse.data!
        }

        // Guardar categoría automáticamente si se proporciona
        if (articulo.categoria) {
          await this.guardarCategoriaArticulo(articulo.categoria)
        }

        // Guardar subcategoría automáticamente si se proporciona
        if (articulo.categoria && articulo.subcategoria) {
          await this.guardarSubcategoriaArticulo(articulo.categoria, articulo.subcategoria)
        }

        const { data, error } = await supabase.rpc('crear_articulo_empresa', {
          p_codigo: codigoFinal,
          p_nombre: articulo.nombre,
          p_descripcion: articulo.descripcion || null,
          p_categoria: articulo.categoria || null,
          p_precio_base: articulo.precio_base || null,
          p_imagen_url: articulo.imagen_url || null,
          p_tiempo_estimado_dias: articulo.tiempo_estimado_dias || null,
          p_requiere_archivos: articulo.requiere_archivos || false,
          p_visible_clientes: articulo.visible_clientes !== undefined ? articulo.visible_clientes : true
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el artículo' }
        }

        // Obtener el artículo completo
        const { data: articuloCompleto, error: errorCompleto } = await supabase
          .from('articulos_empresa')
          .select('*')
          .eq('id', data[0].id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: articuloCompleto as ArticuloEmpresaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar artículo de empresa
   */
  async actualizarArticuloEmpresa(
    id: number,
    articulo: {
      codigo?: string
      nombre?: string
      descripcion?: string
      categoria?: string
      subcategoria?: string
      precio_base?: number
      imagen_url?: string
      tiempo_estimado_dias?: number
      requiere_archivos?: boolean
      visible_clientes?: boolean
      activo?: boolean
    }
  ): Promise<ApiResponse<ArticuloEmpresaRecord>> {
    if (supabase) {
      try {
        // Guardar categoría automáticamente si se proporciona
        if (articulo.categoria) {
          await this.guardarCategoriaArticulo(articulo.categoria)
        }

        // Guardar subcategoría automáticamente si se proporciona
        if (articulo.categoria && articulo.subcategoria) {
          await this.guardarSubcategoriaArticulo(articulo.categoria, articulo.subcategoria)
        }

        const { data, error } = await supabase.rpc('actualizar_articulo_empresa', {
          p_id: id,
          p_codigo: articulo.codigo || null,
          p_nombre: articulo.nombre || null,
          p_descripcion: articulo.descripcion || null,
          p_categoria: articulo.categoria || null,
          p_subcategoria: articulo.subcategoria || null,
          p_precio_base: articulo.precio_base || null,
          p_imagen_url: articulo.imagen_url || null,
          p_tiempo_estimado_dias: articulo.tiempo_estimado_dias || null,
          p_requiere_archivos: articulo.requiere_archivos !== undefined ? articulo.requiere_archivos : null,
          p_visible_clientes: articulo.visible_clientes !== undefined ? articulo.visible_clientes : null,
          p_activo: articulo.activo !== undefined ? articulo.activo : null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el artículo' }
        }

        // Obtener el artículo completo
        const { data: articuloCompleto, error: errorCompleto } = await supabase
          .from('articulos_empresa')
          .select('*')
          .eq('id', id)
          .single()

        if (errorCompleto) return { success: false, error: errorCompleto.message }
        return { success: true, data: articuloCompleto as ArticuloEmpresaRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar artículo de empresa (marcar como inactivo)
   */
  async eliminarArticuloEmpresa(id: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_articulo_empresa', {
          p_id: id
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener imágenes de un artículo
   */
  async obtenerImagenesArticuloEmpresa(idArticulo: number): Promise<ApiResponse<ArticuloEmpresaImagenRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_imagenes_articulo_empresa', {
          p_id_articulo: idArticulo
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data || [] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Agregar imagen a un artículo
   */
  async agregarImagenArticuloEmpresa(
    idArticulo: number,
    imagenUrl: string,
    orden?: number
  ): Promise<ApiResponse<ArticuloEmpresaImagenRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('agregar_imagen_articulo_empresa', {
          p_id_articulo: idArticulo,
          p_imagen_url: imagenUrl,
          p_orden: orden || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo agregar la imagen' }
        }
        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Eliminar imagen de un artículo
   */
  async eliminarImagenArticuloEmpresa(idImagen: number): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('eliminar_imagen_articulo_empresa', {
          p_id_imagen: idImagen
        })

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Subir imagen de artículo de empresa
   */
  async uploadImagenArticuloEmpresa(file: File, articuloId?: number): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = articuloId 
          ? `articulos-empresa/${articuloId}_${Date.now()}.${fileExt}`
          : `articulos-empresa/temp_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('archivos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || 'image/jpeg'
          })

        if (uploadError) {
          return { success: false, error: uploadError.message }
        }

        const { data: urlData } = supabase.storage
          .from('archivos')
          .getPublicUrl(fileName)

        if (!urlData?.publicUrl) {
          return { success: false, error: 'No se pudo obtener la URL pública' }
        }

        return { success: true, data: urlData.publicUrl }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear pedido de cliente
   */
  async crearPedidoCliente(pedido: {
    id_cliente: number
    fecha_limite_deseada?: string
    observaciones_cliente?: string
    items: Array<{
      id_articulo: number
      cantidad: number
      precio_unitario: number
      precio_total: number
      descripcion_personalizada?: string
    }>
    es_urgente?: boolean
    requiere_delivery?: boolean
    direccion_delivery?: string
    tipo_producto_servicio?: string[]
    tipo_producto_otro?: string
    necesita_asesoramiento?: boolean
    donde_colocados?: string
    digital_o_impresion?: string
    cantidades?: string
    objetivo_proyecto?: string
    material_logo?: string
    material_textos?: string
    material_imagenes?: string
    tiene_referencias?: boolean
    referencias_links?: string
    brief_publico?: string
    estilo_diseno?: string
    referencias?: string
  }): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const itemsJsonb = pedido.items.map(item => ({
          id_articulo: item.id_articulo,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_total,
          descripcion_personalizada: item.descripcion_personalizada || null
        }))

        const { data, error } = await supabase.rpc('crear_pedido_cliente', {
          p_id_cliente: pedido.id_cliente,
          p_fecha_limite_deseada: pedido.fecha_limite_deseada || null,
          p_observaciones_cliente: pedido.observaciones_cliente || null,
          p_items: itemsJsonb,
          p_es_urgente: pedido.es_urgente || false,
          p_requiere_delivery: pedido.requiere_delivery || false,
          p_direccion_delivery: pedido.direccion_delivery || null,
          p_tipo_producto_servicio: pedido.tipo_producto_servicio || null,
          p_tipo_producto_otro: pedido.tipo_producto_otro || null,
          p_necesita_asesoramiento: pedido.necesita_asesoramiento || false,
          p_donde_colocados: pedido.donde_colocados || null,
          p_digital_o_impresion: pedido.digital_o_impresion || null,
          p_cantidades: pedido.cantidades || null,
          p_objetivo_proyecto: pedido.objetivo_proyecto || null,
          p_material_logo: pedido.material_logo || null,
          p_material_textos: pedido.material_textos || null,
          p_material_imagenes: pedido.material_imagenes || null,
          p_tiene_referencias: pedido.tiene_referencias || false,
          p_referencias_links: pedido.referencias_links || null,
          p_brief_publico: pedido.brief_publico || null,
          p_estilo_diseno: pedido.estilo_diseno || null,
          p_referencias: pedido.referencias || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el pedido' }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener pedidos de un cliente
   */
  async getPedidosCliente(idCliente: number): Promise<ApiResponse<PedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_pedidos_cliente', {
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as PedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener detalle completo de un pedido
   */
  async getDetallePedidoCliente(idPedido: number): Promise<ApiResponse<PedidoClienteDetalle>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_detalle_pedido_cliente', {
          p_id_pedido: idPedido
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Pedido no encontrado' }
        }

        const result = data[0]
        return {
          success: true,
          data: {
            pedido: result.pedido as PedidoClienteDetalle['pedido'],
            items: result.items as PedidoClienteDetalle['items'],
            archivos: result.archivos as PedidoClienteDetalle['archivos']
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar pedido cliente (solo campos editables)
   */
  async actualizarPedidoCliente(
    idPedido: number,
    idCliente: number,
    datos: {
      fecha_limite_deseada?: string
      observaciones_cliente?: string
      es_urgente?: boolean
      requiere_delivery?: boolean
      direccion_delivery?: string
      brief_publico?: string
      objetivo_proyecto?: string
      estilo_diseno?: string
      referencias?: string
      referencias_links?: string
    }
  ): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente,
          p_fecha_limite_deseada: datos.fecha_limite_deseada || null,
          p_observaciones_cliente: datos.observaciones_cliente || null,
          p_es_urgente: datos.es_urgente !== undefined ? datos.es_urgente : null,
          p_requiere_delivery: datos.requiere_delivery !== undefined ? datos.requiere_delivery : null,
          p_direccion_delivery: datos.direccion_delivery || null,
          p_brief_publico: datos.brief_publico || null,
          p_objetivo_proyecto: datos.objetivo_proyecto || null,
          p_estilo_diseno: datos.estilo_diseno || null,
          p_referencias: datos.referencias || null,
          p_referencias_links: datos.referencias_links || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el pedido' }
        }

        // Obtener el pedido completo actualizado
        const detalleResponse = await this.getDetallePedidoCliente(idPedido)
        if (detalleResponse.success && detalleResponse.data) {
          return { success: true, data: detalleResponse.data.pedido as PedidoClienteRecord }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Cancelar pedido cliente
   */
  async cancelarPedidoCliente(
    idPedido: number,
    idCliente: number
  ): Promise<ApiResponse<PedidoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('cancelar_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo cancelar el pedido' }
        }

        // Obtener el pedido completo actualizado
        const detalleResponse = await this.getDetallePedidoCliente(idPedido)
        if (detalleResponse.success && detalleResponse.data) {
          return { success: true, data: detalleResponse.data.pedido as PedidoClienteRecord }
        }

        return { success: true, data: data[0] as PedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Convertir pedido a OP
   */
  async convertirPedidoAOp(params: {
    id_pedido: number
    id_usuario_convertidor: number
    nombre_usuario_convertidor: string
    sector_inicial?: string
    observaciones?: string
  }): Promise<ApiResponse<{ id_op: number; numero_op: string; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('convertir_pedido_a_op', {
          p_id_pedido: params.id_pedido,
          p_id_usuario_convertidor: params.id_usuario_convertidor,
          p_nombre_usuario_convertidor: params.nombre_usuario_convertidor,
          p_sector_inicial: params.sector_inicial || 'Diseño Gráfico',
          p_observaciones: params.observaciones || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo convertir el pedido' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Subir archivo de pedido cliente
   */
  async uploadArchivoPedidoCliente(
    file: File,
    idPedido: number,
    idItem?: number
  ): Promise<ApiResponse<string>> {
    if (supabase) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${idPedido}_${Date.now()}.${fileExt}`
        const filePath = idItem ? `${idPedido}/${idItem}/${fileName}` : `${idPedido}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('pedidos-clientes')
          .upload(filePath, file)

        if (uploadError) return { success: false, error: uploadError.message }

        const { data: urlData } = supabase.storage
          .from('pedidos-clientes')
          .getPublicUrl(filePath)

        // Guardar referencia en la base de datos
        const { error: dbError } = await supabase.from('pedidos_clientes_archivos').insert({
          id_pedido: idPedido,
          id_item: idItem || null,
          url: urlData.publicUrl,
          nombre_archivo: file.name,
          tipo: file.type,
          tamaño: file.size
        })

        if (dbError) return { success: false, error: dbError.message }

        return { success: true, data: urlData.publicUrl }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener todos los pedidos pendientes (para trabajadores)
   */
  // ==================== PRESUPUESTOS DE CLIENTES ====================

  /**
   * Crear presupuesto de cliente
   */
  async crearPresupuestoCliente(params: {
    id_cliente: number
    items: Array<{
      id_articulo: number
      cantidad: number
      precio_unitario: number
      precio_total: number
      descripcion_personalizada?: string
    }>
    fecha_vencimiento?: string
    observaciones_cliente?: string
    estado?: 'borrador' | 'enviado'
  }): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('crear_presupuesto_cliente', {
          p_id_cliente: params.id_cliente,
          p_items: params.items,
          p_fecha_vencimiento: params.fecha_vencimiento || null,
          p_observaciones_cliente: params.observaciones_cliente || null,
          p_estado: params.estado || 'borrador'
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo crear el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', data[0].id)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar presupuesto de cliente
   */
  async actualizarPresupuestoCliente(
    idPresupuesto: number,
    params: {
      items?: Array<{
        id_articulo: number
        cantidad: number
        precio_unitario: number
        precio_total: number
        descripcion_personalizada?: string
      }>
      fecha_vencimiento?: string
      observaciones_cliente?: string
      estado?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado'
    }
  ): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('actualizar_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto,
          p_items: params.items || null,
          p_fecha_vencimiento: params.fecha_vencimiento || null,
          p_observaciones_cliente: params.observaciones_cliente || null,
          p_estado: params.estado || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo actualizar el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', idPresupuesto)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Enviar presupuesto (cambiar de borrador a enviado)
   */
  async enviarPresupuestoCliente(idPresupuesto: number): Promise<ApiResponse<PresupuestoClienteRecord>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('enviar_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo enviar el presupuesto' }
        }

        // Obtener el presupuesto completo
        const { data: presupuestoCompleto, error: fetchError } = await supabase
          .from('presupuestos_clientes')
          .select('*')
          .eq('id', idPresupuesto)
          .single()

        if (fetchError) return { success: false, error: fetchError.message }
        return { success: true, data: presupuestoCompleto as PresupuestoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener presupuestos de un cliente
   */
  async getPresupuestosCliente(idCliente: number): Promise<ApiResponse<PresupuestoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_presupuestos_cliente', {
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as PresupuestoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener detalle de presupuesto
   */
  async getDetallePresupuestoCliente(idPresupuesto: number): Promise<ApiResponse<{
    presupuesto: PresupuestoClienteRecord & { cliente?: any }
    items: PresupuestoClienteItemRecord[]
  }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_detalle_presupuesto_cliente', {
          p_id_presupuesto: idPresupuesto
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Presupuesto no encontrado' }
        }

        return {
          success: true,
          data: {
            presupuesto: data[0].presupuesto as PresupuestoClienteRecord & { cliente?: any },
            items: (data[0].items || []) as PresupuestoClienteItemRecord[]
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Listar presupuestos (administración)
   */
  async getPresupuestosClientesAdmin(filters?: {
    estado?: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'cancelado' | 'convertido'
    id_cliente?: number
    fecha_desde?: string
    fecha_hasta?: string
  }): Promise<ApiResponse<Array<PresupuestoClienteRecord & {
    cliente_nombre?: string
    cliente_empresa?: string
    cliente_email?: string
  }>>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('listar_presupuestos_clientes_admin', {
          p_estado: filters?.estado || null,
          p_id_cliente: filters?.id_cliente || null,
          p_fecha_desde: filters?.fecha_desde || null,
          p_fecha_hasta: filters?.fecha_hasta || null
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as any }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Convertir presupuesto a pedido
   */
  async convertirPresupuestoAPedido(
    idPresupuesto: number,
    observacionesInternas?: string
  ): Promise<ApiResponse<{ id_pedido: number; numero_pedido: string; mensaje: string }>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('convertir_presupuesto_a_pedido_cliente', {
          p_id_presupuesto: idPresupuesto,
          p_observaciones_internas: observacionesInternas || null
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'No se pudo convertir el presupuesto' }
        }

        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  async getPedidosPendientes(): Promise<ApiResponse<PedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos_clientes')
          .select(`
            *,
            cliente:clientes!pedidos_clientes_id_cliente_fkey(*)
          `)
          .in('estado', ['pendiente', 'en_revision', 'aprobado'])
          .order('fecha_pedido', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as PedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener OP por número (para clientes)
   */
  async obtenerOpPorNumeroCliente(
    numeroOp: string,
    idCliente: number
  ): Promise<ApiResponse<any>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_op_por_numero_cliente', {
          p_numero_op: numeroOp,
          p_id_cliente: idCliente
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'OP no encontrada' }
        }
        return { success: true, data: data[0] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener mensajes de un pedido
   */
  async obtenerMensajesPedido(
    idPedido: number,
    _idCliente: number
  ): Promise<ApiResponse<MensajePedidoClienteRecord[]>> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('obtener_mensajes_pedido_cliente', {
          p_id_pedido: idPedido
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data || []) as MensajePedidoClienteRecord[] }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Crear mensaje en un pedido
   */
  async crearMensajePedido(
    idPedido: number,
    idCliente: number,
    mensaje: string,
    esDelCliente: boolean = true
  ): Promise<ApiResponse<MensajePedidoClienteRecord>> {
    if (supabase) {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        const usuario = usuarioStr ? JSON.parse(usuarioStr) : null
        
        const { data, error } = await supabase.rpc('crear_mensaje_pedido_cliente', {
          p_id_pedido: idPedido,
          p_id_cliente: idCliente,
          p_mensaje: mensaje,
          p_es_del_cliente: esDelCliente,
          p_id_usuario: esDelCliente ? null : (usuario?.id || null)
        })

        if (error) return { success: false, error: error.message }
        if (!data || data.length === 0) {
          return { success: false, error: 'Error al crear mensaje' }
        }
        return { success: true, data: data[0] as MensajePedidoClienteRecord }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Actualizar estado de pedido cliente
   */
  async actualizarEstadoPedidoCliente(
    idPedido: number,
    nuevoEstado: PedidoClienteRecord['estado'],
    observacionesInternas?: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const updateData: any = { estado: nuevoEstado }
        if (observacionesInternas) {
          updateData.observaciones_internas = observacionesInternas
        }

        const { error } = await supabase
          .from('pedidos_clientes')
          .update(updateData)
          .eq('id', idPedido)

        if (error) return { success: false, error: error.message }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Notificar cambios en checklists de fichas No OP
  async notificarChecklistFichaNoOP(
    idOrden: number,
    tipoChecklist: 'ficha_tecnica_cargada' | 'presupuesto_enviado',
    numeroOP: string
  ): Promise<ApiResponse<void>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('notificar_checklist_ficha_no_op', {
          p_id_orden: idOrden,
          p_tipo_checklist: tipoChecklist,
          p_numero_op: numeroOP
        })

        if (error) {
          console.error('Error notificando checklist:', error)
          return { success: false, error: error.message }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  // Transformar ficha No OP en OP real cuando se finaliza
  async transformarFichaNoOPAOP(idOrden: number): Promise<ApiResponse<{ nuevo_numero_op: string }>> {
    if (supabase) {
      try {
        const { error } = await supabase.rpc('transformar_ficha_no_op_a_op', {
          p_id_orden: idOrden
        })

        if (error) {
          console.error('Error transformando ficha No OP a OP:', error)
          return { success: false, error: error.message }
        }

        // Obtener el nuevo número de OP
        const { data: ordenData, error: ordenError } = await supabase
          .from('ordenes_trabajo')
          .select('numero_op')
          .eq('id', idOrden)
          .single()

        if (ordenError || !ordenData) {
          return { success: false, error: 'No se pudo obtener el nuevo número de OP' }
        }

        return { success: true, data: { nuevo_numero_op: ordenData.numero_op } }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
      }
    }
    return { success: false, error: 'No hay conexión a Supabase' }
  }

  /**
   * Obtener preferencias de un cliente por DNI/CUIT
   */
  async obtenerPreferenciasCliente(dniCuit: string): Promise<ApiResponse<{
    id: number
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
    created_at: string
    updated_at: string
  } | null>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_preferencias_cliente', {
        p_dni_cuit: dniCuit
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || data.length === 0) {
        return { success: true, data: null }
      }

      return { success: true, data: data[0] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Guardar/actualizar preferencias de un cliente
   */
  async guardarPreferenciasCliente(
    dniCuit: string,
    preferencias?: string | null,
    notasInternas?: string | null,
    esVIP?: boolean
  ): Promise<ApiResponse<{
    id: number
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
  }>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('guardar_preferencias_cliente', {
        p_dni_cuit: dniCuit,
        p_preferencias: preferencias || null,
        p_notas_internas: notasInternas || null,
        p_es_vip: esVIP || false
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'No se pudo guardar las preferencias' }
      }

      return { success: true, data: data[0] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  /**
   * Obtener todas las preferencias de clientes
   */
  async obtenerTodasPreferenciasClientes(): Promise<ApiResponse<Array<{
    dni_cuit: string
    preferencias: string | null
    notas_internas: string | null
    es_vip: boolean
  }>>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_todas_preferencias_clientes')

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ============================================
  // HORARIOS Y TURNOS
  // ============================================

  async crearHorario(
    idUsuario: number,
    tipoHorario: 'fijo' | 'flexible' | 'turnos',
    diaSemana: number | null = null,
    horaEntrada: string | null = null,
    horaSalida: string | null = null,
    horasSemanales: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    observaciones: string | null = null,
    activo: boolean = true
  ): Promise<ApiResponse<HorarioEmpleado>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_actualizar_horario', {
        p_id_usuario: idUsuario,
        p_tipo_horario: tipoHorario,
        p_dia_semana: diaSemana,
        p_hora_entrada: horaEntrada,
        p_hora_salida: horaSalida,
        p_horas_semanales: horasSemanales,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_observaciones: observaciones,
        p_activo: activo
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as HorarioEmpleado }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerHorariosUsuario(idUsuario: number): Promise<ApiResponse<HorarioEmpleado[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_horarios_usuario', {
        p_id_usuario: idUsuario
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as HorarioEmpleado[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarHorario(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_horario', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async crearTurno(
    idUsuario: number,
    fecha: string,
    horaEntrada: string,
    horaSalida: string,
    tipoTurno: 'normal' | 'extra' | 'nocturno' = 'normal',
    observaciones: string | null = null
  ): Promise<ApiResponse<Turno>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_actualizar_turno', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_entrada: horaEntrada,
        p_hora_salida: horaSalida,
        p_tipo_turno: tipoTurno,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Turno }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerTurnos(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Turno[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_turnos', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Turno[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarTurno(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_turno', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async crearAusencia(
    idUsuario: number,
    tipoAusencia: 'vacaciones' | 'licencia' | 'inasistencia' | 'permiso' | 'enfermedad',
    fechaInicio: string,
    fechaFin: string,
    motivo: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Ausencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_ausencia', {
        p_id_usuario: idUsuario,
        p_tipo_ausencia: tipoAusencia,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_motivo: motivo,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Ausencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerAusencias(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null,
    estado: string | null = null
  ): Promise<ApiResponse<Ausencia[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_ausencias', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_estado: estado
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Ausencia[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async aprobarRechazarAusencia(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    observaciones: string | null = null
  ): Promise<ApiResponse<Ausencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_rechazar_ausencia', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_observaciones: observaciones
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Ausencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async eliminarAusencia(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_ausencia', {
        p_id: id
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as boolean }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async registrarEntrada(
    idUsuario: number,
    fecha: string | null = null,
    horaEntrada: string | null = null
  ): Promise<ApiResponse<Asistencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_entrada', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_entrada: horaEntrada
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Asistencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async registrarSalida(
    idUsuario: number,
    fecha: string | null = null,
    horaSalida: string | null = null
  ): Promise<ApiResponse<Asistencia>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_salida', {
        p_id_usuario: idUsuario,
        p_fecha: fecha,
        p_hora_salida: horaSalida
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Asistencia }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  async obtenerAsistencia(
    idUsuario: number | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Asistencia[]>> {
    if (!supabase) {
      return { success: false, error: 'No hay conexión a Supabase' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_asistencia', {
        p_id_usuario: idUsuario,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as Asistencia[]) || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
  }

  // ============================================
  // SOLICITUDES Y PERMISOS
  // ============================================

  async crearSolicitudPermiso(
    idUsuario: number,
    tipoSolicitud: 'turno' | 'ausencia' | 'vacaciones' | 'ropa' | 'permiso' | 'otro',
    titulo: string,
    descripcion: string | null = null,
    fechaSolicitud: string | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    diasSolicitados: number | null = null,
    observaciones: string | null = null,
    archivoAdjuntoUrl: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_solicitud_permiso', {
        p_id_usuario: idUsuario,
        p_tipo_solicitud: tipoSolicitud,
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_fecha_solicitud: fechaSolicitud,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_dias_solicitados: diasSolicitados,
        p_observaciones: observaciones,
        p_archivo_adjunto_url: archivoAdjuntoUrl
      })

      if (error) throw error

      const solicitud = data as SolicitudPermiso

      // Obtener nombre del usuario que creó la solicitud
      const usuariosResponse = await this.getUsuarios()
      const usuarioSolicitante = usuariosResponse.data?.find(u => u.id === idUsuario)
      const nombreUsuario = usuarioSolicitante?.nombre || 'Usuario'

      // Notificar a usuarios de RRHH y Admin
      if (usuariosResponse.success && usuariosResponse.data) {
        const usuariosRRHH = usuariosResponse.data.filter(
          u => u.rol === 'recursos-humanos' || u.rol === 'administracion'
        )

        for (const usuarioRRHH of usuariosRRHH) {
          const tipoIcon = {
            turno: '🕐',
            ausencia: '❌',
            vacaciones: '🏖️',
            ropa: '👕',
            permiso: '✅',
            otro: '📝'
          }[tipoSolicitud] || '📋'

          await this.createNotification({
            user_id: usuarioRRHH.id,
            title: `${tipoIcon} Nueva Solicitud de ${tipoSolicitud}`,
            description: `${nombreUsuario} ha creado una solicitud: "${titulo}"${descripcion ? ` - ${descripcion}` : ''}`,
            type: 'info',
            solicitud_id: solicitud.id
          })
        }
      }

      return {
        success: true,
        data: solicitud
      }
    } catch (error: any) {
      console.error('Error al crear solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al crear solicitud'
      }
    }
  }

  async obtenerSolicitudesPermisos(
    idUsuario: number | null = null,
    estado: string | null = null,
    tipoSolicitud: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_solicitudes_permisos', {
        p_id_usuario: idUsuario,
        p_estado: estado,
        p_tipo_solicitud: tipoSolicitud,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as SolicitudPermiso[]
      }
    } catch (error: any) {
      console.error('Error al obtener solicitudes:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener solicitudes'
      }
    }
  }

  async aprobarRechazarSolicitud(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    motivoRechazo: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<SolicitudPermiso>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Primero obtener la solicitud para notificar al usuario
      const solicitudResponse = await this.obtenerSolicitudesPermisos(null, null, null, null, null)
      const solicitud = solicitudResponse.data?.find(s => s.id === id)

      const { data, error } = await supabase.rpc('aprobar_rechazar_solicitud', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_motivo_rechazo: motivoRechazo,
        p_observaciones: observaciones
      })

      if (error) throw error

      const solicitudActualizada = data as SolicitudPermiso

      // Notificar al usuario que creó la solicitud
      if (solicitud && solicitud.id_usuario) {
        const usuariosResponse = await this.getUsuarios()
        const usuarioAprobador = usuariosResponse.data?.find(u => u.id === idAprobador)
        const nombreAprobador = usuarioAprobador?.nombre || 'RRHH'

        if (estado === 'aprobado') {
          await this.createNotification({
            user_id: solicitud.id_usuario,
            title: `✅ Solicitud Aprobada`,
            description: `Tu solicitud "${solicitud.titulo}" ha sido aprobada por ${nombreAprobador}.${observaciones ? ` Observaciones: ${observaciones}` : ''}`,
            type: 'success',
            solicitud_id: solicitud.id
          })
        } else {
          await this.createNotification({
            user_id: solicitud.id_usuario,
            title: `❌ Solicitud Rechazada`,
            description: `Tu solicitud "${solicitud.titulo}" ha sido rechazada por ${nombreAprobador}.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
            type: 'error',
            solicitud_id: solicitud.id
          })
        }
      }

      return {
        success: true,
        data: solicitudActualizada
      }
    } catch (error: any) {
      console.error('Error al aprobar/rechazar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al procesar solicitud'
      }
    }
  }

  async cancelarSolicitud(
    id: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_solicitud', {
        p_id: id,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar solicitud'
      }
    }
  }

  async eliminarSolicitud(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_solicitud', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar solicitud:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar solicitud'
      }
    }
  }

  // ============================================
  // EVALUACIONES DE DESEMPEÑO
  // ============================================

  async crearEvaluacion(
    idUsuarioEvaluado: number,
    idUsuarioEvaluador: number,
    tipoEvaluacion: 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'periodo_prueba' | 'especial',
    periodoEvaluacion: string,
    fechaEvaluacion: string | null = null,
    fechaInicioPeriodo: string | null = null,
    fechaFinPeriodo: string | null = null,
    comentariosEvaluador: string | null = null,
    objetivosCumplidos: string | null = null,
    areasMejora: string | null = null,
    recomendaciones: string | null = null
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_evaluacion', {
        p_id_usuario_evaluado: idUsuarioEvaluado,
        p_id_usuario_evaluador: idUsuarioEvaluador,
        p_tipo_evaluacion: tipoEvaluacion,
        p_periodo_evaluacion: periodoEvaluacion,
        p_fecha_evaluacion: fechaEvaluacion,
        p_fecha_inicio_periodo: fechaInicioPeriodo,
        p_fecha_fin_periodo: fechaFinPeriodo,
        p_comentarios_evaluador: comentariosEvaluador,
        p_objetivos_cumplidos: objetivosCumplidos,
        p_areas_mejora: areasMejora,
        p_recomendaciones: recomendaciones
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al crear evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al crear evaluación'
      }
    }
  }

  async obtenerEvaluaciones(
    idUsuarioEvaluado: number | null = null,
    idUsuarioEvaluador: number | null = null,
    estado: string | null = null,
    tipoEvaluacion: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<Evaluacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_evaluaciones', {
        p_id_usuario_evaluado: idUsuarioEvaluado,
        p_id_usuario_evaluador: idUsuarioEvaluador,
        p_estado: estado,
        p_tipo_evaluacion: tipoEvaluacion,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Evaluacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener evaluaciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener evaluaciones'
      }
    }
  }

  async obtenerCriteriosEvaluacion(idEvaluacion: number): Promise<ApiResponse<CriterioEvaluacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_criterios_evaluacion', {
        p_id_evaluacion: idEvaluacion
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as CriterioEvaluacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener criterios:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener criterios'
      }
    }
  }

  async agregarCriterioEvaluacion(
    idEvaluacion: number,
    criterio: string,
    calificacion: number,
    descripcion: string | null = null,
    peso: number = 1.0,
    comentarios: string | null = null
  ): Promise<ApiResponse<CriterioEvaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('agregar_criterio_evaluacion', {
        p_id_evaluacion: idEvaluacion,
        p_criterio: criterio,
        p_calificacion: calificacion,
        p_descripcion: descripcion,
        p_peso: peso,
        p_comentarios: comentarios
      })

      if (error) throw error

      return {
        success: true,
        data: data as CriterioEvaluacion
      }
    } catch (error: any) {
      console.error('Error al agregar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al agregar criterio'
      }
    }
  }

  async actualizarCriterioEvaluacion(
    id: number,
    criterio: string | null = null,
    descripcion: string | null = null,
    calificacion: number | null = null,
    peso: number | null = null,
    comentarios: string | null = null
  ): Promise<ApiResponse<CriterioEvaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('actualizar_criterio_evaluacion', {
        p_id: id,
        p_criterio: criterio,
        p_descripcion: descripcion,
        p_calificacion: calificacion,
        p_peso: peso,
        p_comentarios: comentarios
      })

      if (error) throw error

      return {
        success: true,
        data: data as CriterioEvaluacion
      }
    } catch (error: any) {
      console.error('Error al actualizar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar criterio'
      }
    }
  }

  async actualizarEvaluacion(
    id: number,
    tipoEvaluacion: string | null = null,
    periodoEvaluacion: string | null = null,
    fechaEvaluacion: string | null = null,
    fechaInicioPeriodo: string | null = null,
    fechaFinPeriodo: string | null = null,
    estado: string | null = null,
    comentariosEvaluador: string | null = null,
    comentariosEvaluado: string | null = null,
    objetivosCumplidos: string | null = null,
    areasMejora: string | null = null,
    recomendaciones: string | null = null
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('actualizar_evaluacion', {
        p_id: id,
        p_tipo_evaluacion: tipoEvaluacion,
        p_periodo_evaluacion: periodoEvaluacion,
        p_fecha_evaluacion: fechaEvaluacion,
        p_fecha_inicio_periodo: fechaInicioPeriodo,
        p_fecha_fin_periodo: fechaFinPeriodo,
        p_estado: estado,
        p_comentarios_evaluador: comentariosEvaluador,
        p_comentarios_evaluado: comentariosEvaluado,
        p_objetivos_cumplidos: objetivosCumplidos,
        p_areas_mejora: areasMejora,
        p_recomendaciones: recomendaciones
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al actualizar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar evaluación'
      }
    }
  }

  async aprobarEvaluacion(
    id: number,
    idAprobador: number
  ): Promise<ApiResponse<Evaluacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_evaluacion', {
        p_id: id,
        p_id_aprobador: idAprobador
      })

      if (error) throw error

      return {
        success: true,
        data: data as Evaluacion
      }
    } catch (error: any) {
      console.error('Error al aprobar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al aprobar evaluación'
      }
    }
  }

  async eliminarCriterioEvaluacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_criterio_evaluacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar criterio:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar criterio'
      }
    }
  }

  async eliminarEvaluacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_evaluacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar evaluación:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar evaluación'
      }
    }
  }

  // ============================================
  // CAPACITACIONES
  // ============================================

  async crearCapacitacion(
    titulo: string,
    descripcion: string | null = null,
    creadoPor: number,
    tipoCapacitacion: 'presencial' | 'virtual' | 'mixta' | 'online' = 'presencial',
    categoria: string | null = null,
    duracionHoras: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    fechaLimiteInscripcion: string | null = null,
    cupoMaximo: number | null = null,
    lugar: string | null = null,
    linkVirtual: string | null = null,
    instructor: string | null = null,
    esObligatoria: boolean = false,
    requiereAprobacion: boolean = true,
    materialAdjuntoUrl: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Capacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('crear_capacitacion', {
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_creado_por: creadoPor,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_duracion_horas: duracionHoras,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_fecha_limite_inscripcion: fechaLimiteInscripcion,
        p_cupo_maximo: cupoMaximo,
        p_lugar: lugar,
        p_link_virtual: linkVirtual,
        p_instructor: instructor,
        p_es_obligatoria: esObligatoria,
        p_requiere_aprobacion: requiereAprobacion,
        p_material_adjunto_url: materialAdjuntoUrl,
        p_observaciones: observaciones
      })

      if (error) throw error

      const capacitacionCreada = data as Capacitacion

      // Notificar a todos los usuarios sobre la nueva capacitación
      if (capacitacionCreada.estado === 'abierta') {
        await this.enviarNotificacionMasiva({
          titulo: `📚 Nueva Capacitación: ${titulo}`,
          descripcion: descripcion || `Se ha creado una nueva capacitación. ${esObligatoria ? '⚠️ Esta capacitación es obligatoria.' : ''}`,
          tipo: esObligatoria ? 'warning' : 'info',
          enviar_a_todos: true,
          id_usuario_emisor: creadoPor
        })
      }

      return {
        success: true,
        data: capacitacionCreada
      }
    } catch (error: any) {
      console.error('Error al crear capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al crear capacitación'
      }
    }
  }

  async obtenerCapacitaciones(
    estado: string | null = null,
    tipoCapacitacion: string | null = null,
    categoria: string | null = null,
    fechaDesde: string | null = null,
    fechaHasta: string | null = null,
    idUsuario: number | null = null
  ): Promise<ApiResponse<Capacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_capacitaciones', {
        p_estado: estado,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Capacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener capacitaciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener capacitaciones'
      }
    }
  }

  async inscribirseCapacitacion(
    idCapacitacion: number,
    idUsuario: number
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('inscribirse_capacitacion', {
        p_id_capacitacion: idCapacitacion,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      const inscripcion = data as InscripcionCapacitacion

      // Obtener información de la capacitación para la notificación
      const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, idUsuario)
      const capacitacion = capacitacionRes.data?.find(c => c.id === idCapacitacion)

      // Notificar al usuario sobre su inscripción
      if (inscripcion.estado === 'pendiente') {
        await this.createNotification({
          user_id: idUsuario,
          title: '📚 Inscripción Pendiente de Aprobación',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" está pendiente de aprobación por Recursos Humanos.`,
          type: 'info',
          capacitacion_id: idCapacitacion
        })
      } else {
        await this.createNotification({
          user_id: idUsuario,
          title: '✅ Inscripción Confirmada',
          description: `Te has inscrito exitosamente a "${capacitacion?.titulo || 'la capacitación'}".`,
          type: 'success',
          capacitacion_id: idCapacitacion
        })
      }

      return {
        success: true,
        data: inscripcion
      }
    } catch (error: any) {
      console.error('Error al inscribirse:', error)
      return {
        success: false,
        error: error.message || 'Error al inscribirse a la capacitación'
      }
    }
  }

  async aprobarRechazarInscripcion(
    id: number,
    estado: 'aprobado' | 'rechazado',
    idAprobador: number,
    motivoRechazo: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('aprobar_rechazar_inscripcion', {
        p_id: id,
        p_estado: estado,
        p_id_aprobador: idAprobador,
        p_motivo_rechazo: motivoRechazo || ''
      })

      if (error) throw error

      const inscripcionActualizada = data as InscripcionCapacitacion

      // Obtener información de la capacitación
      const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, inscripcionActualizada.id_usuario)
      const capacitacion = capacitacionRes.data?.find(c => c.id === inscripcionActualizada.id_capacitacion)

      // Notificar al usuario sobre la aprobación/rechazo
      if (estado === 'aprobado') {
        await this.createNotification({
          user_id: inscripcionActualizada.id_usuario,
          title: '✅ Inscripción Aprobada',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" ha sido aprobada.`,
          type: 'success',
          capacitacion_id: inscripcionActualizada.id_capacitacion
        })
      } else if (estado === 'rechazado') {
        await this.createNotification({
          user_id: inscripcionActualizada.id_usuario,
          title: '❌ Inscripción Rechazada',
          description: `Tu inscripción a "${capacitacion?.titulo || 'la capacitación'}" ha sido rechazada.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
          type: 'error',
          capacitacion_id: inscripcionActualizada.id_capacitacion
        })
      }

      return {
        success: true,
        data: inscripcionActualizada
      }
    } catch (error: any) {
      console.error('Error al aprobar/rechazar inscripción:', error)
      return {
        success: false,
        error: error.message || 'Error al procesar la inscripción'
      }
    }
  }

  async obtenerInscripcionesCapacitacion(
    idCapacitacion: number,
    estado: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_inscripciones_capacitacion', {
        p_id_capacitacion: idCapacitacion,
        p_estado: estado
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as InscripcionCapacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener inscripciones:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener inscripciones'
      }
    }
  }

  async obtenerCapacitacionesUsuario(
    idUsuario: number,
    estadoInscripcion: string | null = null
  ): Promise<ApiResponse<Capacitacion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_capacitaciones_usuario', {
        p_id_usuario: idUsuario,
        p_estado_inscripcion: estadoInscripcion
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as Capacitacion[]
      }
    } catch (error: any) {
      console.error('Error al obtener capacitaciones del usuario:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener capacitaciones'
      }
    }
  }

  async actualizarCapacitacion(
    id: number,
    titulo: string | null = null,
    descripcion: string | null = null,
    tipoCapacitacion: string | null = null,
    categoria: string | null = null,
    duracionHoras: number | null = null,
    fechaInicio: string | null = null,
    fechaFin: string | null = null,
    fechaLimiteInscripcion: string | null = null,
    cupoMaximo: number | null = null,
    lugar: string | null = null,
    linkVirtual: string | null = null,
    instructor: string | null = null,
    estado: string | null = null,
    esObligatoria: boolean | null = null,
    requiereAprobacion: boolean | null = null,
    materialAdjuntoUrl: string | null = null,
    observaciones: string | null = null
  ): Promise<ApiResponse<Capacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Obtener capacitación actual para comparar estado
      const capacitacionActualRes = await this.obtenerCapacitaciones(null, null, null, null, null, null)
      const capacitacionActual = capacitacionActualRes.data?.find(c => c.id === id)

      const { data, error } = await supabase.rpc('actualizar_capacitacion', {
        p_id: id,
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_tipo_capacitacion: tipoCapacitacion,
        p_categoria: categoria,
        p_duracion_horas: duracionHoras,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_fecha_limite_inscripcion: fechaLimiteInscripcion,
        p_cupo_maximo: cupoMaximo,
        p_lugar: lugar,
        p_link_virtual: linkVirtual,
        p_instructor: instructor,
        p_estado: estado,
        p_es_obligatoria: esObligatoria,
        p_requiere_aprobacion: requiereAprobacion,
        p_material_adjunto_url: materialAdjuntoUrl,
        p_observaciones: observaciones
      })

      if (error) throw error

      const capacitacionActualizada = data as Capacitacion

      // Si el estado cambió a "abierta" y antes no lo era, notificar a todos
      if (estado === 'abierta' && capacitacionActual?.estado !== 'abierta') {
        await this.enviarNotificacionMasiva({
          titulo: `📚 Nueva Capacitación Disponible: ${capacitacionActualizada.titulo}`,
          descripcion: capacitacionActualizada.descripcion || `Se ha abierto una nueva capacitación. ${capacitacionActualizada.es_obligatoria ? '⚠️ Esta capacitación es obligatoria.' : ''}`,
          tipo: capacitacionActualizada.es_obligatoria ? 'warning' : 'info',
          enviar_a_todos: true
        })
      }

      // Si se canceló, notificar a los inscritos
      if (estado === 'cancelada' && capacitacionActual?.estado !== 'cancelada') {
        const inscripcionesRes = await this.obtenerInscripcionesCapacitacion(id, null)
        if (inscripcionesRes.success && inscripcionesRes.data) {
          for (const inscripcion of inscripcionesRes.data) {
            if (inscripcion.estado !== 'cancelado' && inscripcion.estado !== 'completado') {
              await this.createNotification({
                user_id: inscripcion.id_usuario,
                title: '⚠️ Capacitación Cancelada',
                description: `La capacitación "${capacitacionActualizada.titulo}" ha sido cancelada.`,
                type: 'warning',
                capacitacion_id: id
              })
            }
          }
        }
      }

      return {
        success: true,
        data: capacitacionActualizada
      }
    } catch (error: any) {
      console.error('Error al actualizar capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al actualizar capacitación'
      }
    }
  }

  async registrarAsistenciaCapacitacion(
    idInscripcion: number,
    asistio: boolean,
    calificacion: number | null = null,
    comentarios: string | null = null
  ): Promise<ApiResponse<InscripcionCapacitacion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('registrar_asistencia_capacitacion', {
        p_id_inscripcion: idInscripcion,
        p_asistio: asistio,
        p_calificacion: calificacion,
        p_comentarios: comentarios
      })

      if (error) throw error

      const inscripcionActualizada = data as InscripcionCapacitacion

      // Obtener información de la capacitación
      const inscripcionRes = await this.obtenerInscripcionesCapacitacion(inscripcionActualizada.id_capacitacion, null)
      const inscripcionCompleta = inscripcionRes.data?.find(i => i.id === idInscripcion)
      
      if (inscripcionCompleta) {
        const capacitacionRes = await this.obtenerCapacitaciones(null, null, null, null, null, inscripcionCompleta.id_usuario)
        const capacitacion = capacitacionRes.data?.find(c => c.id === inscripcionActualizada.id_capacitacion)

        // Notificar al usuario sobre su asistencia y calificación
        if (asistio && calificacion !== null) {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '📊 Calificación Registrada',
            description: `Tu asistencia y calificación (${calificacion}/10) han sido registradas para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'success',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        } else if (asistio) {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '✅ Asistencia Registrada',
            description: `Tu asistencia ha sido registrada para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'success',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        } else {
          await this.createNotification({
            user_id: inscripcionCompleta.id_usuario,
            title: '⚠️ Ausencia Registrada',
            description: `Se ha registrado tu ausencia para "${capacitacion?.titulo || 'la capacitación'}".`,
            type: 'warning',
            capacitacion_id: inscripcionActualizada.id_capacitacion
          })
        }
      }

      return {
        success: true,
        data: inscripcionActualizada
      }
    } catch (error: any) {
      console.error('Error al registrar asistencia:', error)
      return {
        success: false,
        error: error.message || 'Error al registrar asistencia'
      }
    }
  }

  async cancelarInscripcion(
    idInscripcion: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_inscripcion', {
        p_id_inscripcion: idInscripcion,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar inscripción:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar inscripción'
      }
    }
  }

  async eliminarCapacitacion(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_capacitacion', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar capacitación:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar capacitación'
      }
    }
  }

  // ========== MENÚ DIARIO ==========
  
  async crearActualizarMenuDiario(
    platos: string[],
    creadoPor: number,
    fecha: string | null = null
  ): Promise<ApiResponse<MenuDiario>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      // Si no se especifica fecha, no pasamos el parámetro para que use el DEFAULT CURRENT_DATE
      const params: any = {
        p_creado_por: creadoPor,
        p_platos: platos.filter(p => p && p.trim() !== '')
      }
      
      // Solo agregar p_fecha si se especifica explícitamente
      if (fecha) {
        params.p_fecha = fecha
      }
      
      const { data, error } = await supabase.rpc('crear_actualizar_menu_diario', params)

      if (error) throw error

      return {
        success: true,
        data: data as MenuDiario
      }
    } catch (error: any) {
      console.error('Error al crear/actualizar menú diario:', error)
      return {
        success: false,
        error: error.message || 'Error al crear/actualizar menú diario'
      }
    }
  }

  async obtenerMenusDiarios(
    fechaDesde: string | null = null,
    fechaHasta: string | null = null
  ): Promise<ApiResponse<MenuDiario[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_menus_diarios', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as MenuDiario[]
      }
    } catch (error: any) {
      console.error('Error al obtener menús diarios:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener menús diarios'
      }
    }
  }

  async obtenerMenuDiaActual(): Promise<ApiResponse<MenuDiario | null>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_menu_dia_actual')

      if (error) throw error

      return {
        success: true,
        data: (data && data.length > 0) ? data[0] as MenuDiario : null
      }
    } catch (error: any) {
      console.error('Error al obtener menú del día actual:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener menú del día actual'
      }
    }
  }

  async seleccionarPlatoMenu(
    idMenu: number,
    idUsuario: number,
    idPlato: number
  ): Promise<ApiResponse<MenuSeleccion>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('seleccionar_plato_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario,
        p_id_plato: idPlato
      })

      if (error) throw error

      return {
        success: true,
        data: data as MenuSeleccion
      }
    } catch (error: any) {
      console.error('Error al seleccionar plato:', error)
      return {
        success: false,
        error: error.message || 'Error al seleccionar plato'
      }
    }
  }

  async obtenerSeleccionesMenu(idMenu: number): Promise<ApiResponse<MenuSeleccion[]>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_selecciones_menu', {
        p_id_menu: idMenu
      })

      if (error) throw error

      return {
        success: true,
        data: (data || []) as MenuSeleccion[]
      }
    } catch (error: any) {
      console.error('Error al obtener selecciones del menú:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener selecciones del menú'
      }
    }
  }

  async obtenerSeleccionUsuarioMenu(
    idMenu: number,
    idUsuario: number
  ): Promise<ApiResponse<MenuSeleccion | null>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('obtener_seleccion_usuario_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: (data && data.length > 0) ? data[0] as MenuSeleccion : null
      }
    } catch (error: any) {
      console.error('Error al obtener selección del usuario:', error)
      return {
        success: false,
        error: error.message || 'Error al obtener selección del usuario'
      }
    }
  }

  async eliminarMenuDiario(id: number): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('eliminar_menu_diario', {
        p_id: id
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al eliminar menú diario:', error)
      return {
        success: false,
        error: error.message || 'Error al eliminar menú diario'
      }
    }
  }

  async cancelarSeleccionMenu(
    idMenu: number,
    idUsuario: number
  ): Promise<ApiResponse<boolean>> {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' }
    }

    try {
      const { data, error } = await supabase.rpc('cancelar_seleccion_menu', {
        p_id_menu: idMenu,
        p_id_usuario: idUsuario
      })

      if (error) throw error

      return {
        success: true,
        data: data as boolean
      }
    } catch (error: any) {
      console.error('Error al cancelar selección:', error)
      return {
        success: false,
        error: error.message || 'Error al cancelar selección'
      }
    }
  }
}

function inferChatType(message: string): ChatMessageUI['tipo'] {
  if (!message) return 'message'
  if (message.toLowerCase().includes('zumbido')) return 'buzz'
  if (message.toLowerCase().includes('alerta') || message.includes('¡Atención!')) return 'alert'
  return 'message'
}

export const apiService = new ApiService()
export default apiService

