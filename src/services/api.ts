import { BOARD_COLUMNS } from '../data/mockData'
import type {
  ClienteRecord,
  HistorialMovimiento,
  MaterialRecord,
  Notification,
  OrdenTrabajo,
  SectorRecord,
  TareaSubitem,
  TareaRecord,
  UsuarioRecord,
  UserRole
} from '../types/api'
import type {
  PedidoCompra,
  PedidoCompraComentario,
  StockMovimiento,
  ArticuloStock,
  EstadoPedido,
  PrioridadPedido
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

type ChatMessageUI = {
  id: number
  canal: string
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  tipo: 'message' | 'alert' | 'buzz'
  timestamp: string
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
  general: 1,
  produccion: 2,
  diseno: 3,
  imprenta: 4,
  instalaciones: 5,
  random: 6,
  'taller-grafico': 7,
  mostrador: 8
}

// Mapeo inverso: room_id -> canal
const roomToChatChannel: Record<number, string> = {
  1: 'general',
  2: 'produccion',
  3: 'diseno',
  4: 'imprenta',
  5: 'instalaciones',
  6: 'random',
  7: 'taller-grafico',
  8: 'mostrador'
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
            p_dni_cuit: orden.dni_cuit || null
          }
          
          console.log('🔍 Llamando función SQL con parámetros:', JSON.stringify(rpcParams, null, 2))
          console.log('🔍 Tipos de parámetros:', Object.entries(rpcParams).map(([k, v]) => `${k}: ${typeof v}${Array.isArray(v) ? ' (array)' : ''}`).join(', '))
          
          const { data, error } = await supabaseClient.rpc('create_orden_with_contact', rpcParams)
          
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

  async createUsuario(usuario: {
    nombre: string
    password: string
    rol: UserRole
  }): Promise<ApiResponse<UsuarioRecord>> {
    let lastError: string | null = null

    if (supabase) {
      // Usar función RPC para crear usuario con hash de contraseña
      const { data, error } = await supabase.rpc('crear_usuario', {
        p_nombre: usuario.nombre.trim(),
        p_password: usuario.password,
        p_rol: usuario.rol
      })

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] as UsuarioRecord }
      }

      // Si hay error específico de la RPC, retornar inmediatamente sin intentar fallbacks
      if (error) {
        const errorMsg = error.message || 'Error al crear usuario'
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
        .select('id, room_id, id_usuario, nombre_usuario, mensaje, timestamp')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) return { success: false, error: error.message }

      const mensajes =
        data?.map((msg: any) => ({
          id: msg.id,
          canal: roomToChatChannel[msg.room_id] ?? canal,
          usuario_id: msg.id_usuario,
          nombre_usuario: msg.nombre_usuario,
          contenido: msg.mensaje,
          tipo: inferChatType(msg.mensaje),
          timestamp: msg.timestamp
        })) ?? []

      return { success: true, data: (mensajes.reverse() as ChatMessageUI[]) }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/chat/mensajes.php?canal=${canal}&limit=${limit}`)
    }

    return this.handleFallback(fallbackMensajes)
  }

  async enviarMensajeChat(mensaje: {
    canal: string
    contenido: string
    usuario_id: number
    tipo?: string
  }): Promise<ApiResponse<ChatMessageUI>> {
    if (supabase) {
      const roomId = chatChannelToRoom[mensaje.canal] ?? 1

      // Asegurar que el room existe antes de insertar
      await this.ensureChatRoomExists(roomId, mensaje.canal)

      const payload = {
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
              : mensaje.contenido
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
          timestamp: data.timestamp
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
          is_read: false
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Notification }
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
    prioridad?: PrioridadPedido
    motivo?: string
    observaciones?: string
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
          prioridad: pedido.prioridad || 'Normal',
          motivo: pedido.motivo || null,
          observaciones: pedido.observaciones || null,
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
            comentarios:pedidos_compras_comentarios(*)
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
          await this.createNotification({
            user_id: pedido.data.id_solicitante,
            title: '🔄 Estado del pedido actualizado',
            description: `El estado de tu pedido ${pedido.data.numero_pedido} cambió de "${estadoAnterior}" a "${estado}"`,
            type: 'info',
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
}

function inferChatType(message: string): ChatMessageUI['tipo'] {
  if (!message) return 'message'
  if (message.toLowerCase().includes('zumbido')) return 'buzz'
  if (message.toLowerCase().includes('alerta') || message.includes('¡Atención!')) return 'alert'
  return 'message'
}

export const apiService = new ApiService()
export default apiService

