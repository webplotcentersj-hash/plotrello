import { GoogleGenAI } from '@google/genai'
import type { Task, TeamMember, ActivityEvent } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { formatAgenticContextForPrompt } from '../utils/agentInsights'
import type { AgenticContextPayload } from '../utils/agentInsights'
import { getCompleteSystemContext, formatCompleteContextForPrompt, type CompleteSystemContext } from './plotAIContextService'
import {
  getRelevantConversations,
  getRelevantPatterns,
  getRelevantKnowledge,
  formatMemoryForPrompt,
  saveConversationMemory,
  savePatternMemory,
  saveKnowledgeMemory
} from './plotAIMemoryService'

// El nuevo SDK de Google GenAI puede usar la API key desde variable de entorno
// o se puede pasar en el constructor si es necesario
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

// Inicializar el cliente de Google GenAI
// El constructor puede recibir { apiKey } o usar la variable de entorno automáticamente
let ai: GoogleGenAI | null = null
try {
  if (GEMINI_API_KEY) {
    // Intentar con API key explícita primero
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  } else {
    // Si no hay API key, intentar sin parámetros (usará variable de entorno si existe)
    ai = new GoogleGenAI({})
  }
} catch (error) {
  console.warn('No se pudo inicializar GoogleGenAI:', error)
  ai = null
}

export interface SystemContext {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  statusDistribution: Record<string, number>
  workloadByMember: Array<{
    name: string
    taskCount: number
    highPriority: number
  }>
  recentActivity: Array<{
    user: string
    movement: string
    time: string
  }>
  teamMembers: Array<{ name: string; role: string }>
  columns: Array<{ id: string; label: string; description: string }>
}

export function getSystemContext(
  tasks: Task[],
  activity: ActivityEvent[],
  teamMembers: TeamMember[]
): SystemContext {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'almacen-entrega').length
  const inProgressTasks = tasks.filter((t) => 
    !['diseno-grafico', 'almacen-entrega'].includes(t.status)
  ).length

  const statusDistribution = tasks.reduce((acc, task) => {
    const column = BOARD_COLUMNS.find((col) => col.id === task.status)
    const label = column?.label || task.status
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const workloadByMember = teamMembers.map((member) => {
    const memberTasks = tasks.filter((task) => task.ownerId === member.id)
    return {
      name: member.name,
      taskCount: memberTasks.length,
      highPriority: memberTasks.filter((t) => t.priority === 'alta').length
    }
  })

  const recentActivity = activity.slice(0, 10).map((event) => {
    const member = teamMembers.find((m) => m.id === event.actorId)
    const fromCol = BOARD_COLUMNS.find((col) => col.id === event.from)
    const toCol = BOARD_COLUMNS.find((col) => col.id === event.to)
    return {
      user: member?.name || 'Desconocido',
      movement: `${fromCol?.label || event.from} → ${toCol?.label || event.to}`,
      time: new Date(event.timestamp).toLocaleString('es-AR')
    }
  })

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    statusDistribution,
    workloadByMember,
    recentActivity,
    teamMembers: teamMembers.map((m) => ({ name: m.name, role: m.role })),
    columns: BOARD_COLUMNS.map((col) => ({ id: col.id, label: col.label, description: col.description }))
  }
}

export interface GenerateContentOptions {
  model?: string
  contents: string
  systemContext?: SystemContext
  conversationHistory?: string
  attachments?: Array<{ name: string; type: string; content: string }>
  agenticContext?: AgenticContextPayload
  useCompleteContext?: boolean // Usar contexto completo de todas las tablas
  useMemory?: boolean // Usar sistema de memoria/aprendizaje
  learnFromResponse?: boolean // Aprender de esta interacción
  tasks?: Task[] // Tareas para contexto completo
  activity?: ActivityEvent[] // Actividad para contexto completo
  teamMembers?: TeamMember[] // Miembros del equipo para contexto completo
}

export async function generateContent(options: GenerateContentOptions): Promise<string> {
  if (!ai) {
    throw new Error('API key de Gemini no configurada. Por favor, configura VITE_GEMINI_API_KEY en tu archivo .env')
  }

  const {
    model = 'gemini-2.5-flash',
    contents,
    systemContext,
    conversationHistory,
    attachments,
    agenticContext,
    useCompleteContext = true,
    useMemory = true,
    learnFromResponse = true,
    tasks = [],
    activity = [],
    teamMembers = []
  } = options

  try {
    // Obtener contexto completo si está habilitado
    let completeContext: CompleteSystemContext | null = null
    if (useCompleteContext) {
      try {
        // Usar tasks, activity y teamMembers pasados, o convertir desde systemContext
        const tasksToUse = tasks.length > 0 ? tasks : []
        const activityToUse = activity.length > 0 ? activity : []
        const teamMembersToUse = teamMembers.length > 0 
          ? teamMembers 
          : systemContext?.teamMembers.map(m => ({ id: m.name, name: m.name, role: m.role })) || []
        
        completeContext = await getCompleteSystemContext(
          tasksToUse,
          activityToUse,
          teamMembersToUse
        )
      } catch (error) {
        console.warn('Error obteniendo contexto completo, usando contexto básico:', error)
      }
    }

    // Obtener memoria relevante si está habilitado
    let memoriaTexto = ''
    if (useMemory) {
      const conversacionesRelevantes = getRelevantConversations(contents)
      const patronesRelevantes = getRelevantPatterns()
      const conocimientosRelevantes = getRelevantKnowledge()
      memoriaTexto = formatMemoryForPrompt(contents, conversacionesRelevantes, patronesRelevantes, conocimientosRelevantes)
    }

    // Construir el prompt completo
    let prompt = contents

    // Contexto del sistema mejorado
    if (completeContext) {
      const contextText = `Eres PlotAI, un asistente inteligente AGÉNTICO especializado en gestión de producción gráfica e imprenta. Tienes acceso completo al sistema y puedes:

CAPACIDADES AGÉNTICAS:
- Analizar datos en tiempo real del sistema desde TODAS las tablas de la base de datos
- Identificar patrones y tendencias en órdenes, clientes, pedidos web, materiales, etc.
- Detectar problemas y cuellos de botella proactivamente
- Sugerir acciones concretas y optimizaciones basadas en datos reales
- Aprender del contexto histórico y actual
- Analizar archivos (imágenes, PDFs, documentos) con visión avanzada
- Generar reportes y insights profundos
- Acceder a información de clientes, pedidos web, artículos, proveedores, compras, etc.

${formatCompleteContextForPrompt(completeContext)}

INSTRUCCIONES AGÉNTICAS:
- Responde en español de manera clara, profesional y accionable
- Analiza los datos proporcionados y extrae insights profundos
- Identifica problemas proactivamente (cuellos de botella, sobrecargas, retrasos)
- Sugiere acciones concretas y priorizadas basadas en los datos reales
- Si hay archivos adjuntos, analízalos en detalle y relaciona con el contexto del sistema
- Aprende de los patrones que observas en los datos
- Sé proactivo: no solo respondas, también anticipa problemas y oportunidades
- Proporciona métricas, comparaciones y análisis cuantitativos cuando sea relevante
- Usa la información de todas las tablas para dar respuestas más completas y precisas

`
      prompt = contextText + prompt
    } else if (systemContext) {
      const contextText = `Eres PlotAI, un asistente inteligente AGÉNTICO especializado en gestión de producción gráfica e imprenta. Tienes acceso completo al sistema y puedes:

CAPACIDADES AGÉNTICAS:
- Analizar datos en tiempo real del sistema
- Identificar patrones y tendencias
- Detectar problemas y cuellos de botella
- Sugerir acciones concretas y optimizaciones
- Aprender del contexto histórico y actual
- Analizar archivos (imágenes, PDFs, documentos)
- Generar reportes y insights profundos

CONTEXTO DEL SISTEMA (DATOS EN TIEMPO REAL):
- Total de tareas: ${systemContext.totalTasks}
- Tareas completadas: ${systemContext.completedTasks}
- Tareas en progreso: ${systemContext.inProgressTasks}

DISTRIBUCIÓN POR ESTADO:
${Object.entries(systemContext.statusDistribution).map(([status, count]) => `- ${status}: ${count} tareas`).join('\n')}

CARGA DE TRABAJO POR PERSONA:
${systemContext.workloadByMember.map((w) => `- ${w.name}: ${w.taskCount} tareas (${w.highPriority} alta prioridad)`).join('\n')}

ACTIVIDAD RECIENTE:
${systemContext.recentActivity.map((a) => `- ${a.user}: ${a.movement} (${a.time})`).join('\n')}

MIEMBROS DEL EQUIPO:
${systemContext.teamMembers.map((m) => `- ${m.name} (${m.role})`).join('\n')}

COLUMNAS DEL TABLERO:
${systemContext.columns.map((c) => `- ${c.label} (${c.id}): ${c.description}`).join('\n')}

INSTRUCCIONES AGÉNTICAS:
- Responde en español de manera clara, profesional y accionable
- Analiza los datos proporcionados y extrae insights profundos
- Identifica problemas proactivamente (cuellos de botella, sobrecargas, retrasos)
- Sugiere acciones concretas y priorizadas
- Si hay archivos adjuntos, analízalos en detalle y relaciona con el contexto del sistema
- Aprende de los patrones que observas en los datos
- Sé proactivo: no solo respondas, también anticipa problemas y oportunidades
- Proporciona métricas, comparaciones y análisis cuantitativos cuando sea relevante

`
      prompt = contextText + prompt
    }

    // Agregar memoria si está disponible
    if (memoriaTexto) {
      prompt += memoriaTexto
    }

    if (agenticContext) {
      prompt += `\nINTELIGENCIA AGÉNTICA DERIVADA:\n${formatAgenticContextForPrompt(agenticContext)}\n`
      prompt += `\nConsidera estas señales para priorizar tu respuesta.\n`
    }

    if (attachments && attachments.length > 0) {
      const hasImages = attachments.some((att) => att.type.startsWith('image/'))
      
      if (hasImages) {
        // Para imágenes, usar modelo con capacidad de visión
        const imageAttachments = attachments.filter((att) => att.type.startsWith('image/'))
        const textAttachments = attachments.filter((att) => !att.type.startsWith('image/'))
        
        if (textAttachments.length > 0) {
          prompt += `\nARCHIVOS DE TEXTO ADJUNTOS:\n`
          textAttachments.forEach((att, idx) => {
            prompt += `\nArchivo ${idx + 1}: ${att.name} (${att.type})\n`
            prompt += `Contenido:\n${att.content.substring(0, 5000)}\n`
          })
        }

        // Para imágenes, usar el formato adecuado para Gemini Vision
        prompt += `\nIMÁGENES ADJUNTAS PARA ANÁLISIS:\n`
        imageAttachments.forEach((att, idx) => {
          prompt += `\nImagen ${idx + 1}: ${att.name}\n`
          prompt += `Por favor, analiza esta imagen en detalle. Identifica:\n`
          prompt += `- Contenido visual (textos, gráficos, diseños, materiales)\n`
          prompt += `- Calidad y características técnicas\n`
          prompt += `- Relación con el contexto del sistema de producción gráfica\n`
          prompt += `- Sugerencias o problemas detectados\n`
          // El contenido base64 se incluirá en el payload de la API
        })
        
        // Nota: Las imágenes se enviarán como partes separadas en el payload
      } else {
        // Solo archivos de texto
        prompt += `\nARCHIVOS ADJUNTOS:\n`
        attachments.forEach((att, idx) => {
          prompt += `\nArchivo ${idx + 1}: ${att.name} (${att.type})\n`
          prompt += `Contenido:\n${att.content.substring(0, 5000)}\n`
        })
        prompt += `\nPor favor, analiza estos archivos en el contexto del sistema de producción gráfica.\n`
      }
    }

    if (conversationHistory) {
      prompt += `\nHISTORIAL DE CONVERSACIÓN:\n${conversationHistory}\n\n`
    }

    prompt += `\nPlotAI: Responde de manera útil y contextualizada usando toda la información disponible.`

    // Preparar el payload para Gemini
    // Si hay imágenes, necesitamos enviarlas como partes separadas
    const hasImages = attachments?.some((att) => att.type.startsWith('image/'))
    
    let responseText = ''
    
    if (hasImages && attachments) {
      // Para imágenes, construir el payload con partes de texto e imagen
      const imageAttachments = attachments.filter((att) => att.type.startsWith('image/'))
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
      
      // Agregar el prompt de texto primero
      parts.push({ text: prompt })
      
      // Agregar cada imagen
      for (const att of imageAttachments) {
        // El contenido viene como [IMAGEN_BASE64:data:nombre] o directamente como base64
        let base64Data = ''
        let mimeType = att.type || 'image/jpeg'
        
        if (att.content.startsWith('[IMAGEN_BASE64:')) {
          // Formato: [IMAGEN_BASE64:base64data:nombre]
          const match = att.content.match(/\[IMAGEN_BASE64:(.+?):/)
          if (match && match[1]) {
            base64Data = match[1]
            // Si el base64 incluye el prefijo data:image/..., extraerlo
            if (base64Data.includes('data:')) {
              const dataMatch = base64Data.match(/data:([^;]+);base64,(.+)/)
              if (dataMatch) {
                mimeType = dataMatch[1]
                base64Data = dataMatch[2]
              }
            }
          }
        } else if (att.content.startsWith('data:')) {
          // Formato directo: data:image/...;base64,...
          const dataMatch = att.content.match(/data:([^;]+);base64,(.+)/)
          if (dataMatch) {
            mimeType = dataMatch[1]
            base64Data = dataMatch[2]
          }
        } else {
          // Asumir que es base64 puro
          base64Data = att.content
        }
        
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          })
        }
      }
      
      // Usar el modelo con capacidad de visión (gemini-2.5-flash tiene visión integrada)
      const visionModel = 'gemini-2.5-flash'
      const response = await ai.models.generateContent({
        model: visionModel,
        contents: parts
      })
      
      responseText = response.text || ''
    } else {
      // Sin imágenes, usar el método normal
      const response = await ai.models.generateContent({
        model,
        contents: prompt
      })
      
      responseText = response.text || ''
    }

    // Aprender de la respuesta si está habilitado
    if (learnFromResponse && responseText) {
      try {
        await saveConversationMemory(
          contents,
          responseText,
          {
            hasAttachments: attachments && attachments.length > 0,
            hasImages: hasImages,
            completeContext: completeContext !== null,
            memoryUsed: useMemory
          },
          3 // Utilidad por defecto
        )
      } catch (error) {
        console.warn('No se pudo guardar la conversación en memoria:', error)
      }
    }

    return responseText
  } catch (error) {
    console.error('Error generando contenido con PlotAI:', error)
    throw new Error(
      error instanceof Error 
        ? `Error al generar contenido: ${error.message}`
        : 'Error desconocido al generar contenido'
    )
  }
}

