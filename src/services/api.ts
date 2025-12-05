import { BOARD_COLUMNS } from '../data/mockData'
import type {
  HistorialMovimiento,
  MaterialRecord,
  Notification,
  OrdenTrabajo,
  SectorRecord,
  TareaRecord,
  UsuarioRecord,
  UserRole
} from '../types/api'
import { supabase } from './supabaseClient'
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
              
              console.log('✅ Orden completa obtenida:', fullOrden)
              return { success: true, data: fullOrden as OrdenTrabajo }
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
            
            return { success: true, data: fullOrden as OrdenTrabajo }
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

      if (!error && data && data.length > 0) {
        return { success: true, data: data[0] as UsuarioRecord }
      }

      lastError =
        error?.message ||
        'No se pudo crear el usuario mediante Supabase. Intentando backend legacy...'
      console.warn('⚠️ Supabase RPC crear_usuario falló, intentando backend legacy.', lastError)

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

    if (hasLegacyBackend) {
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
      const { data, error } = await supabase.storage.from('archivos').list(`ordenes/${ordenId}`)
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    if (hasLegacyBackend) {
      return this.legacyRequest(`/archivos.php?orden_id=${ordenId}`)
    }

    return { success: true, data: [] }
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
  async getImpresoras(): Promise<ApiResponse<any[]>> {
    if (supabase) {
      const { data, error } = await supabase
        .from('impresoras')
        .select('*')
        .eq('activa', true)
        .order('nombre', { ascending: true })

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

  async finalizarUsoImpresora(usoId: number, impresoraId: number): Promise<ApiResponse<any>> {
    if (supabase) {
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
      
      // Verificar si hay otros usos activos para esta impresora
      const { data: otrosUsos } = await supabase
        .from('impresora_uso')
        .select('id')
        .eq('id_impresora', impresoraId)
        .eq('estado', 'En Proceso')
        .limit(1)

      // Si no hay otros usos activos, cambiar estado a "Disponible"
      if (!otrosUsos || otrosUsos.length === 0) {
        await supabase
          .from('impresoras')
          .update({ estado: 'Disponible' })
          .eq('id', impresoraId)
      }

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
          is_read: false
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Notification }
    }

    return { success: false, error: 'Supabase no configurado' }
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

