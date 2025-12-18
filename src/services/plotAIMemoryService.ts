import { supabase } from './supabaseClient'

/**
 * Servicio de memoria y aprendizaje para PlotAI
 * Almacena conversaciones, patrones aprendidos y conocimiento adquirido
 */

export interface PlotAIMemory {
  id?: number
  tipo: 'conversacion' | 'patron' | 'conocimiento' | 'preferencia'
  categoria?: string
  contenido: string
  contexto?: Record<string, any>
  importancia: number // 1-10, donde 10 es más importante
  fecha_creacion: string
  fecha_actualizacion: string
  veces_usado?: number
}

export interface ConversationMemory {
  pregunta: string
  respuesta: string
  contexto: Record<string, any>
  timestamp: string
  utilidad: number // 1-5, qué tan útil fue la respuesta
}

/**
 * Almacena una conversación en memoria
 */
export async function saveConversationMemory(
  pregunta: string,
  respuesta: string,
  contexto: Record<string, any> = {},
  utilidad: number = 3
): Promise<void> {
  try {
    const memoria: PlotAIMemory = {
      tipo: 'conversacion',
      contenido: JSON.stringify({ pregunta, respuesta }),
      contexto,
      importancia: utilidad * 2, // Escala 1-5 a 2-10
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
      veces_usado: 1
    }
    
    // Guardar en localStorage para acceso rápido
    const conversaciones = getLocalConversations()
    conversaciones.push({
      pregunta,
      respuesta,
      contexto,
      timestamp: new Date().toISOString(),
      utilidad
    })
    
    // Mantener solo las últimas 100 conversaciones en localStorage
    if (conversaciones.length > 100) {
      conversaciones.shift()
    }
    
    localStorage.setItem('plotai_conversaciones', JSON.stringify(conversaciones))
    
    // Intentar guardar en Supabase si está disponible
    try {
      if (supabase) {
        await supabase.from('plotai_memoria').insert(memoria)
      }
    } catch (error) {
      console.warn('No se pudo guardar en Supabase, usando solo localStorage:', error)
    }
  } catch (error) {
    console.error('Error guardando conversación en memoria:', error)
  }
}

/**
 * Almacena un patrón aprendido
 */
export async function savePatternMemory(
  patron: string,
  categoria: string,
  contexto: Record<string, any> = {},
  importancia: number = 5
): Promise<void> {
  try {
    const memoria: PlotAIMemory = {
      tipo: 'patron',
      categoria,
      contenido: patron,
      contexto,
      importancia,
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
      veces_usado: 1
    }
    
    // Guardar en localStorage
    const patrones = getLocalPatterns()
    patrones.push({
      patron,
      categoria,
      contexto,
      importancia,
      timestamp: new Date().toISOString()
    })
    
    localStorage.setItem('plotai_patrones', JSON.stringify(patrones))
    
    // Intentar guardar en Supabase
    try {
      if (supabase) {
        await supabase.from('plotai_memoria').insert(memoria)
      }
    } catch (error) {
      console.warn('No se pudo guardar patrón en Supabase:', error)
    }
  } catch (error) {
    console.error('Error guardando patrón en memoria:', error)
  }
}

/**
 * Almacena conocimiento adquirido
 */
export async function saveKnowledgeMemory(
  conocimiento: string,
  categoria: string,
  contexto: Record<string, any> = {},
  importancia: number = 7
): Promise<void> {
  try {
    const memoria: PlotAIMemory = {
      tipo: 'conocimiento',
      categoria,
      contenido: conocimiento,
      contexto,
      importancia,
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
      veces_usado: 1
    }
    
    // Guardar en localStorage
    const conocimientos = getLocalKnowledge()
    conocimientos.push({
      conocimiento,
      categoria,
      contexto,
      importancia,
      timestamp: new Date().toISOString()
    })
    
    localStorage.setItem('plotai_conocimientos', JSON.stringify(conocimientos))
    
    // Intentar guardar en Supabase
    try {
      if (supabase) {
        await supabase.from('plotai_memoria').insert(memoria)
      }
    } catch (error) {
      console.warn('No se pudo guardar conocimiento en Supabase:', error)
    }
  } catch (error) {
    console.error('Error guardando conocimiento en memoria:', error)
  }
}

/**
 * Obtiene conversaciones relevantes para una pregunta
 */
export function getRelevantConversations(pregunta: string, limit: number = 5): ConversationMemory[] {
  try {
    const conversaciones = getLocalConversations()
    
    // Buscar conversaciones similares (búsqueda simple por palabras clave)
    const palabrasClave = pregunta.toLowerCase().split(/\s+/).filter((p: string) => p.length > 3)
    
    const relevantes = conversaciones
      .map((conv: ConversationMemory) => {
        const textoCompleto = `${conv.pregunta} ${conv.respuesta}`.toLowerCase()
        const coincidencias = palabrasClave.filter((palabra: string) => textoCompleto.includes(palabra)).length
        return { ...conv, score: coincidencias * conv.utilidad }
      })
      .filter(conv => conv.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(conv => ({
        pregunta: conv.pregunta,
        respuesta: conv.respuesta,
        contexto: conv.contexto,
        timestamp: conv.timestamp,
        utilidad: conv.utilidad
      }))
    
    return relevantes
  } catch (error) {
    console.error('Error obteniendo conversaciones relevantes:', error)
    return []
  }
}

/**
 * Obtiene patrones aprendidos relevantes
 */
export function getRelevantPatterns(categoria?: string, limit: number = 5): Array<{
  patron: string
  categoria: string
  importancia: number
  contexto: Record<string, any>
}> {
  try {
    const patrones = getLocalPatterns()
    
    let relevantes = patrones
    
    if (categoria) {
      relevantes = relevantes.filter(p => p.categoria === categoria)
    }
    
    return relevantes
      .sort((a, b) => b.importancia - a.importancia)
      .slice(0, limit)
      .map(p => ({
        patron: p.patron,
        categoria: p.categoria,
        importancia: p.importancia,
        contexto: p.contexto
      }))
  } catch (error) {
    console.error('Error obteniendo patrones relevantes:', error)
    return []
  }
}

/**
 * Obtiene conocimientos relevantes
 */
export function getRelevantKnowledge(categoria?: string, limit: number = 5): Array<{
  conocimiento: string
  categoria: string
  importancia: number
  contexto: Record<string, any>
}> {
  try {
    const conocimientos = getLocalKnowledge()
    
    let relevantes = conocimientos
    
    if (categoria) {
      relevantes = relevantes.filter(k => k.categoria === categoria)
    }
    
    return relevantes
      .sort((a, b) => b.importancia - a.importancia)
      .slice(0, limit)
      .map(k => ({
        conocimiento: k.conocimiento,
        categoria: k.categoria,
        importancia: k.importancia,
        contexto: k.contexto
      }))
  } catch (error) {
    console.error('Error obteniendo conocimientos relevantes:', error)
    return []
  }
}

/**
 * Formatea la memoria para el prompt de PlotAI
 */
export function formatMemoryForPrompt(
  _pregunta: string,
  conversaciones: ConversationMemory[],
  patrones: Array<{ patron: string; categoria: string; importancia: number }>,
  conocimientos: Array<{ conocimiento: string; categoria: string; importancia: number }>
): string {
  let memoriaTexto = '\n=== MEMORIA Y APRENDIZAJE ===\n\n'
  
  if (conversaciones.length > 0) {
    memoriaTexto += 'Conversaciones similares anteriores:\n'
    conversaciones.forEach((conv, idx) => {
      memoriaTexto += `${idx + 1}. Pregunta: ${conv.pregunta}\n`
      memoriaTexto += `   Respuesta: ${conv.respuesta.substring(0, 200)}...\n`
      memoriaTexto += `   Utilidad: ${conv.utilidad}/5\n\n`
    })
  }
  
  if (patrones.length > 0) {
    memoriaTexto += 'Patrones aprendidos:\n'
    patrones.forEach((patron, idx) => {
      memoriaTexto += `${idx + 1}. [${patron.categoria}] ${patron.patron} (Importancia: ${patron.importancia}/10)\n`
    })
    memoriaTexto += '\n'
  }
  
  if (conocimientos.length > 0) {
    memoriaTexto += 'Conocimientos adquiridos:\n'
    conocimientos.forEach((conoc, idx) => {
      memoriaTexto += `${idx + 1}. [${conoc.categoria}] ${conoc.conocimiento} (Importancia: ${conoc.importancia}/10)\n`
    })
    memoriaTexto += '\n'
  }
  
  if (conversaciones.length === 0 && patrones.length === 0 && conocimientos.length === 0) {
    memoriaTexto += 'Sin memoria previa relevante. Esta es una nueva interacción.\n\n'
  }
  
  return memoriaTexto
}

// Funciones auxiliares para localStorage

function getLocalConversations(): Array<{
  pregunta: string
  respuesta: string
  contexto: Record<string, any>
  timestamp: string
  utilidad: number
}> {
  try {
    const stored = localStorage.getItem('plotai_conversaciones')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function getLocalPatterns(): Array<{
  patron: string
  categoria: string
  contexto: Record<string, any>
  importancia: number
  timestamp: string
}> {
  try {
    const stored = localStorage.getItem('plotai_patrones')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function getLocalKnowledge(): Array<{
  conocimiento: string
  categoria: string
  contexto: Record<string, any>
  importancia: number
  timestamp: string
}> {
  try {
    const stored = localStorage.getItem('plotai_conocimientos')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Limpia la memoria antigua (más de 30 días)
 */
export function cleanOldMemory(): void {
  try {
    const ahora = new Date()
    const treintaDiasAtras = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Limpiar conversaciones antiguas
    const conversaciones = getLocalConversations()
    const conversacionesRecientes = conversaciones.filter(c => {
      const fecha = new Date(c.timestamp)
      return fecha >= treintaDiasAtras
    })
    localStorage.setItem('plotai_conversaciones', JSON.stringify(conversacionesRecientes))
    
    // Los patrones y conocimientos se mantienen (son más valiosos)
  } catch (error) {
    console.error('Error limpiando memoria antigua:', error)
  }
}

