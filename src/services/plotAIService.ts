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
  saveConversationMemory
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
  userName?: string // Nombre del usuario que está hablando
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
    teamMembers = [],
    userName
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
          : systemContext?.teamMembers.map(m => ({ 
              id: m.name, 
              name: m.name, 
              role: m.role,
              avatar: '',
              productivity: 0
            })) || []
        
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

    // Detectar saludos y responder de manera conversacional
    const saludos = ['hola', 'hi', 'hey', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos']
    const esSaludo = saludos.some(saludo => contents.toLowerCase().trim().startsWith(saludo.toLowerCase()))
    
    // Contexto del sistema mejorado
    if (completeContext) {
      const nombreUsuario = userName ? `\nUSUARIO ACTUAL: Estás hablando con ${userName}. Usa su nombre cuando sea apropiado para hacer la conversación más personal.\n` : ''
      
      const contextText = `Eres PlotAI, un asistente inteligente AGÉNTICO especializado en gestión de producción gráfica e imprenta. Eres amigable, conversacional y profesional. Tienes acceso completo al sistema y puedes:

${nombreUsuario}

PERSONALIDAD Y ESTILO:
- Eres amigable, conversacional y accesible
- Respondes saludos de manera natural y cálida, usando el nombre del usuario cuando sea apropiado
- Mantienes un tono profesional pero cercano, como un compañero de trabajo inteligente
- Te adaptas al contexto de la conversación
- Eres proactivo en ayudar a resolver problemas y optimizar procesos

CAPACIDADES AGÉNTICAS:
- Analizar datos en tiempo real del sistema desde TODAS las tablas de la base de datos
- Identificar patrones y tendencias en órdenes, clientes, pedidos web, materiales, etc.
- Detectar problemas y cuellos de botella proactivamente
- Sugerir acciones concretas y optimizaciones basadas en datos reales
- Aprender del contexto histórico y actual
- Analizar archivos (imágenes, PDFs, documentos) con visión avanzada y análisis profundo
- ANALIZAR IMÁGENES: Puedes analizar fotos, diseños, gráficos, textos en imágenes con detalle
- ANALIZAR PDFs: Puedes leer y analizar documentos PDF completos, extrayendo texto, imágenes y estructura
- Generar reportes y insights profundos
- Acceder a información de clientes, pedidos web, artículos, proveedores, compras, etc.
- AYUDAR EN PROCESOS DE TRABAJO: Puedes guiar al usuario paso a paso en procesos del sistema
- RESOLVER PROBLEMAS: Puedes diagnosticar problemas, sugerir soluciones y ayudar a implementarlas

${formatCompleteContextForPrompt(completeContext)}

INSTRUCCIONES AGÉNTICAS:
- Responde en español de manera clara, profesional, conversacional y accionable
- Usa el nombre del usuario cuando sea apropiado para personalizar la conversación
- Analiza los datos proporcionados y extrae insights profundos
- Identifica problemas proactivamente (cuellos de botella, sobrecargas, retrasos)
- Sugiere acciones concretas y priorizadas basadas en los datos reales
- AYUDA EN PROCESOS: Si el usuario pregunta sobre cómo hacer algo, guíalo paso a paso
- RESUELVE PROBLEMAS: Si el usuario tiene un problema, diagnostícalo, sugiere soluciones y ayuda a implementarlas
- Si hay archivos adjuntos, analízalos en detalle y relaciona con el contexto del sistema
- Aprende de los patrones que observas en los datos
- Sé proactivo: no solo respondas, también anticipa problemas y oportunidades
- Proporciona métricas, comparaciones y análisis cuantitativos cuando sea relevante
- Usa la información de todas las tablas para dar respuestas más completas y precisas
- Mantén un tono conversacional y natural, como si fueras un compañero de trabajo inteligente
- Cuando ayudes con procesos, sé específico y claro en los pasos a seguir
- Cuando resuelvas problemas, ofrece múltiples soluciones cuando sea posible

`
      prompt = contextText + prompt
      
      // Si es un saludo, agregar instrucción específica
      if (esSaludo) {
        const saludoPersonalizado = userName 
          ? `\nNOTA: El usuario ${userName} te está saludando. Responde de manera amigable y conversacional usando su nombre, preguntando en qué puedes ayudar. Ejemplo: "¡Hola ${userName}! ¿En qué te puedo ayudar hoy?" o "¡Hola ${userName}! Estoy aquí para ayudarte con lo que necesites del sistema."\n`
          : `\nNOTA: El usuario te está saludando. Responde de manera amigable y conversacional, preguntando en qué puedes ayudar. Ejemplo: "¡Hola! ¿En qué te puedo ayudar hoy?" o "¡Hola! Estoy aquí para ayudarte con lo que necesites del sistema."\n`
        prompt += saludoPersonalizado
      }
    } else if (systemContext) {
      const nombreUsuario = userName ? `\nUSUARIO ACTUAL: Estás hablando con ${userName}. Usa su nombre cuando sea apropiado para hacer la conversación más personal.\n` : ''
      
      const contextText = `Eres PlotAI, un asistente inteligente AGÉNTICO especializado en gestión de producción gráfica e imprenta. Eres amigable, conversacional y profesional. Tienes acceso completo al sistema y puedes:

${nombreUsuario}

PERSONALIDAD Y ESTILO:
- Eres amigable, conversacional y accesible
- Respondes saludos de manera natural y cálida, usando el nombre del usuario cuando sea apropiado
- Mantienes un tono profesional pero cercano, como un compañero de trabajo inteligente
- Te adaptas al contexto de la conversación
- Eres proactivo en ayudar a resolver problemas y optimizar procesos

CAPACIDADES AGÉNTICAS:
- Analizar datos en tiempo real del sistema
- Identificar patrones y tendencias
- Detectar problemas y cuellos de botella
- Sugerir acciones concretas y optimizaciones
- Aprender del contexto histórico y actual
- Analizar archivos (imágenes, PDFs, documentos)
- Generar reportes y insights profundos
- AYUDAR EN PROCESOS DE TRABAJO: Puedes guiar al usuario paso a paso en procesos del sistema
- RESOLVER PROBLEMAS: Puedes diagnosticar problemas, sugerir soluciones y ayudar a implementarlas

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
- Responde en español de manera clara, profesional, conversacional y accionable
- Usa el nombre del usuario cuando sea apropiado para personalizar la conversación
- Si el usuario te saluda, responde de manera amigable y pregunta en qué puedes ayudar
- Analiza los datos proporcionados y extrae insights profundos
- Identifica problemas proactivamente (cuellos de botella, sobrecargas, retrasos)
- Sugiere acciones concretas y priorizadas
- AYUDA EN PROCESOS: Si el usuario pregunta sobre cómo hacer algo, guíalo paso a paso
- RESUELVE PROBLEMAS: Si el usuario tiene un problema, diagnostícalo, sugiere soluciones y ayuda a implementarlas
- Si hay archivos adjuntos, analízalos en detalle y relaciona con el contexto del sistema
- Aprende de los patrones que observas en los datos
- Sé proactivo: no solo respondas, también anticipa problemas y oportunidades
- Proporciona métricas, comparaciones y análisis cuantitativos cuando sea relevante
- Mantén un tono conversacional y natural, como si fueras un compañero de trabajo inteligente
- Cuando ayudes con procesos, sé específico y claro en los pasos a seguir
- Cuando resuelvas problemas, ofrece múltiples soluciones cuando sea posible

`
      prompt = contextText + prompt
      
      // Si es un saludo, agregar instrucción específica
      if (esSaludo) {
        const saludoPersonalizado = userName 
          ? `\nNOTA: El usuario ${userName} te está saludando. Responde de manera amigable y conversacional usando su nombre, preguntando en qué puedes ayudar. Ejemplo: "¡Hola ${userName}! ¿En qué te puedo ayudar hoy?" o "¡Hola ${userName}! Estoy aquí para ayudarte con lo que necesites del sistema."\n`
          : `\nNOTA: El usuario te está saludando. Responde de manera amigable y conversacional, preguntando en qué puedes ayudar. Ejemplo: "¡Hola! ¿En qué te puedo ayudar hoy?" o "¡Hola! Estoy aquí para ayudarte con lo que necesites del sistema."\n`
        prompt += saludoPersonalizado
      }
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
      const hasImages = attachments.some((att) => att.type.startsWith('image/') || att.content.startsWith('[IMAGEN_BASE64:'))
      const hasPDFs = attachments.some((att) => att.type === 'application/pdf' || att.content.startsWith('[PDF_BASE64:') || att.content.startsWith('[PDF_TEXT:'))
      
      if (hasImages || hasPDFs) {
        // Separar por tipo de archivo
        const imageAttachmentsFiltered = attachments.filter((att) => 
          att.type.startsWith('image/') || att.content.startsWith('[IMAGEN_BASE64:')
        )
        const pdfAttachmentsFiltered = attachments.filter((att) => 
          att.type === 'application/pdf' || att.content.startsWith('[PDF_BASE64:') || att.content.startsWith('[PDF_TEXT:')
        )
        const textAttachmentsFiltered = attachments.filter((att) => 
          !att.type.startsWith('image/') && 
          att.type !== 'application/pdf' && 
          !att.content.startsWith('[IMAGEN_BASE64:') &&
          !att.content.startsWith('[PDF_BASE64:') &&
          !att.content.startsWith('[PDF_TEXT:')
        )
        
        if (textAttachmentsFiltered.length > 0) {
          prompt += `\nARCHIVOS DE TEXTO ADJUNTOS:\n`
          textAttachmentsFiltered.forEach((att, idx) => {
            prompt += `\nArchivo ${idx + 1}: ${att.name} (${att.type})\n`
            prompt += `Contenido:\n${att.content.substring(0, 10000)}\n`
          })
        }

        // Análisis de imágenes
        if (imageAttachmentsFiltered.length > 0) {
          prompt += `\n📸 IMÁGENES ADJUNTAS PARA ANÁLISIS VISUAL DETALLADO:\n`
          prompt += `Tienes ${imageAttachmentsFiltered.length} imagen(es) para analizar. Por favor, analiza cada una en detalle:\n\n`
          imageAttachmentsFiltered.forEach((att, idx) => {
            prompt += `IMAGEN ${idx + 1}: ${att.name}\n`
            prompt += `Analiza esta imagen completamente y proporciona:\n`
            prompt += `1. CONTENIDO VISUAL:\n`
            prompt += `   - Textos visibles (lee todo el texto que veas)\n`
            prompt += `   - Gráficos, logos, diseños, ilustraciones\n`
            prompt += `   - Colores, tipografías, estilos\n`
            prompt += `   - Elementos de diseño (formas, líneas, composición)\n`
            prompt += `2. CARACTERÍSTICAS TÉCNICAS:\n`
            prompt += `   - Calidad de la imagen (resolución, nitidez)\n`
            prompt += `   - Formato y características técnicas\n`
            prompt += `   - Problemas técnicos detectados (píxeles, compresión, etc.)\n`
            prompt += `3. CONTEXTO DE PRODUCCIÓN GRÁFICA:\n`
            prompt += `   - Tipo de trabajo (impresión, digital, señalética, etc.)\n`
            prompt += `   - Materiales sugeridos según el diseño\n`
            prompt += `   - Procesos de producción necesarios\n`
            prompt += `   - Tiempos estimados de producción\n`
            prompt += `4. SUGERENCIAS Y PROBLEMAS:\n`
            prompt += `   - Problemas detectados (calidad, formato, diseño)\n`
            prompt += `   - Sugerencias de mejora\n`
            prompt += `   - Compatibilidad con procesos de producción\n`
            prompt += `   - Recomendaciones específicas\n\n`
          })
        }

        // Análisis de PDFs
        if (pdfAttachmentsFiltered.length > 0) {
          prompt += `\n📄 PDFs ADJUNTOS PARA ANÁLISIS DETALLADO:\n`
          prompt += `Tienes ${pdfAttachmentsFiltered.length} PDF(s) para analizar. Por favor, analiza cada uno completamente:\n\n`
          pdfAttachmentsFiltered.forEach((att, idx) => {
            prompt += `PDF ${idx + 1}: ${att.name}\n`
            if (att.content.startsWith('[PDF_TEXT:')) {
              // PDF con texto extraído
              const textMatch = att.content.match(/\[PDF_TEXT:[^:]+:(.+)\]/s)
              if (textMatch && textMatch[1]) {
                prompt += `CONTENIDO DEL PDF:\n${textMatch[1]}\n\n`
              }
            }
            prompt += `Analiza este PDF completamente y proporciona:\n`
            prompt += `1. CONTENIDO DEL DOCUMENTO:\n`
            prompt += `   - Texto completo (lee y extrae todo el texto)\n`
            prompt += `   - Estructura del documento (páginas, secciones)\n`
            prompt += `   - Información clave (números, fechas, nombres, etc.)\n`
            prompt += `2. ELEMENTOS VISUALES:\n`
            prompt += `   - Imágenes, gráficos, tablas, diagramas\n`
            prompt += `   - Diseño y formato del documento\n`
            prompt += `   - Logos, marcas, elementos gráficos\n`
            prompt += `3. CONTEXTO DE PRODUCCIÓN:\n`
            prompt += `   - Tipo de trabajo requerido\n`
            prompt += `   - Especificaciones técnicas mencionadas\n`
            prompt += `   - Materiales o procesos indicados\n`
            prompt += `   - Cantidades, medidas, dimensiones\n`
            prompt += `4. ANÁLISIS Y RECOMENDACIONES:\n`
            prompt += `   - Problemas detectados en el documento\n`
            prompt += `   - Sugerencias de mejora\n`
            prompt += `   - Compatibilidad con procesos de producción\n`
            prompt += `   - Acciones recomendadas\n\n`
          })
        }
      } else {
        // Solo archivos de texto
        prompt += `\nARCHIVOS ADJUNTOS:\n`
        attachments.forEach((att, idx) => {
          prompt += `\nArchivo ${idx + 1}: ${att.name} (${att.type})\n`
          prompt += `Contenido:\n${att.content.substring(0, 10000)}\n`
        })
        prompt += `\nPor favor, analiza estos archivos en el contexto del sistema de producción gráfica.\n`
      }
    }

    if (conversationHistory) {
      prompt += `\nHISTORIAL DE CONVERSACIÓN:\n${conversationHistory}\n\n`
    }

    prompt += `\nPlotAI: Responde de manera útil y contextualizada usando toda la información disponible.`

    // Preparar el payload para Gemini
    // Si hay imágenes o PDFs, necesitamos enviarlas como partes separadas
    let responseText = ''
    
    const hasImagesForVision = attachments?.some((att) => att.type.startsWith('image/') || att.content.startsWith('[IMAGEN_BASE64:'))
    const hasPDFsForVision = attachments?.some((att) => att.type === 'application/pdf' || att.content.startsWith('[PDF_BASE64:') || att.content.startsWith('[PDF_TEXT:'))
    
    if ((hasImagesForVision || hasPDFsForVision) && attachments) {
      // Para imágenes y PDFs, construir el payload con partes de texto e imagen
      const imageAttachmentsForVision = attachments.filter((att) => 
        att.type.startsWith('image/') || att.content.startsWith('[IMAGEN_BASE64:')
      )
      const pdfAttachmentsForVision = attachments.filter((att) => 
        att.type === 'application/pdf' || att.content.startsWith('[PDF_BASE64:')
      )
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
      
      // Agregar el prompt de texto primero
      parts.push({ text: prompt })
      
      // Agregar cada imagen
      for (const att of imageAttachmentsForVision) {
        let base64Data = ''
        let mimeType = att.type || 'image/jpeg'
        
        if (att.content.startsWith('[IMAGEN_BASE64:')) {
          const match = att.content.match(/\[IMAGEN_BASE64:(.+?):/)
          if (match && match[1]) {
            base64Data = match[1]
            if (base64Data.includes('data:')) {
              const dataMatch = base64Data.match(/data:([^;]+);base64,(.+)/)
              if (dataMatch) {
                mimeType = dataMatch[1]
                base64Data = dataMatch[2]
              }
            }
          }
        } else if (att.content.startsWith('data:')) {
          const dataMatch = att.content.match(/data:([^;]+);base64,(.+)/)
          if (dataMatch) {
            mimeType = dataMatch[1]
            base64Data = dataMatch[2]
          }
        } else {
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
      
      // Agregar cada PDF como imagen (Gemini puede analizar PDFs mejor como imágenes)
      for (const att of pdfAttachmentsForVision) {
        if (att.content.startsWith('[PDF_BASE64:')) {
          const match = att.content.match(/\[PDF_BASE64:(.+?):/)
          if (match && match[1]) {
            let base64Data = match[1]
            let mimeType = 'application/pdf'
            
            if (base64Data.includes('data:')) {
              const dataMatch = base64Data.match(/data:([^;]+);base64,(.+)/)
              if (dataMatch) {
                mimeType = dataMatch[1]
                base64Data = dataMatch[2]
              }
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
      // Sin imágenes ni PDFs, usar el método normal
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

