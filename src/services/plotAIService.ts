import { GoogleGenAI } from '@google/genai'
import type { Task, TeamMember, ActivityEvent } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { formatAgenticContextForPrompt } from '../utils/agentInsights'
import type { AgenticContextPayload } from '../utils/agentInsights'
import { getCompleteSystemContext, formatCompleteContextForPrompt, type CompleteSystemContext } from './plotAIContextService'
import { formatKanbanDetailedContext } from './plotAIKanbanContext'
import {
  getRelevantConversations,
  getRelevantPatterns,
  getRelevantKnowledge,
  formatMemoryForPrompt,
  saveConversationMemory
} from './plotAIMemoryService'
import { formatManualForPrompt } from './plotAIManualService'

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

/** Conocimiento actual del sistema para que PlotAI esté al día con las últimas funcionalidades */
const PLOTAI_SYSTEM_KNOWLEDGE = `
CONOCIMIENTO ACTUAL DEL SISTEMA (actualizado):
- **Imprenta (Área de Impresión)**: En esta columna del tablero hay un modal "IMPRESIÓN DIGITAL" con etapas: En Proceso, Pausa, Fichas técnicas, Delivery, Taller de Imprenta, Para Embalar, Embalado. El usuario puede abrirlo desde la ficha para cambiar la etapa interna de la OP.
- **Mostrador**: Incluye Ventas (venta rápida, convertir venta a OP), Reportes de ventas, y **Cuenta Corriente**: clientes habilitados para comprar a cuenta en mostrador; se gestionan desde "Cuenta Corriente" en el dashboard de Mostrador.
- **Entrega**: Existe la opción "Firma en tablet": se abre la ruta /firma-cliente/:numeroOP para que el cliente firme en una tablet (nombre de quien retira, DNI, firma digital). La firma se guarda y se puede ver desde la pantalla de entrega en PC.
- **Columnas del tablero**: Diseño Gráfico, Diseño en Proceso, En Espera, Imprenta (Área de Impresión), Taller de Imprenta, Taller Gráfico, Instalaciones, Metalúrgica, Finalizado en Taller, Almacén de Entrega. Cada columna puede tener sub-etapas (ej. Taller Gráfico, Instalaciones, Taller de Imprenta, Metalúrgica, Impresión Digital en Imprenta).
- **Ventas**: Se pueden crear ventas directas desde Mostrador; después de una venta se puede "Convertirla a OP" para generar una orden de trabajo vinculada.
- **Reclamos (Atención al público)**: Los reclamos de clientes se gestionan en /atencion-publico, pestaña "Estado de reclamos". Podés informar sobre reclamos (cantidad, estados, recientes), sugerir crear uno cuando un usuario reporte un problema con un cliente, y guiar al usuario a esa sección. Los reclamos pueden asignarse a sectores (Diseño, Taller, Mostrador, etc.) y generan notificaciones.
- Usá siempre los datos del contexto proporcionado para dar números y estados exactos; si te preguntan por estas funcionalidades, explicá cómo funcionan con precisión.
`

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
      
      // Formatear contexto detallado del kanban
      const kanbanContext = formatKanbanDetailedContext(tasks, activity, teamMembers)
      
      const contextText = `Sos PlotAI, el asistente inteligente AGÉNTICO de toda la plataforma Plotlab. Eres PROFESIONAL, PRECISO y CONFIABLE. Tenés acceso a TODAS las áreas del sistema (producción, ventas, presupuestos, compras, stock, clientes web, RRHH, ERP, dashboards y reportes) y debés responder siempre con información EXACTA basada en datos reales.

${nombreUsuario}

PERSONALIDAD Y ESTILO:
- Eres PROFESIONAL y PRECISO: siempre proporcionas información exacta basada en datos reales
- Eres CONFIABLE: tus respuestas están respaldadas por datos del sistema en tiempo real
- Mantienes un tono profesional y serio cuando se trata de información crítica del negocio
- Eres proactivo en identificar problemas y oportunidades basándote en datos concretos
- Cuando proporcionas información sobre OPs, estados, o movimientos, SIEMPRE usa datos reales del sistema

CAPACIDADES AGÉNTICAS:
- Analizar datos en tiempo real del sistema desde TODAS las tablas de la base de datos
- Proporcionar información PRECISA sobre el estado actual del kanban
- Identificar patrones y tendencias en órdenes, clientes, pedidos web, materiales, etc.
- Detectar problemas y cuellos de botella proactivamente con datos concretos
- Sugerir acciones concretas y optimizaciones basadas en datos reales y verificables
- Analizar archivos (imágenes, PDFs, documentos) con visión avanzada y análisis profundo
- ANALIZAR IMÁGENES: Puedes analizar fotos, diseños, gráficos, textos en imágenes con detalle
- ANALIZAR PDFs: Puedes leer y analizar documentos PDF completos, extrayendo texto, imágenes y estructura
- NO debes simular o mostrar código de generación de imágenes/videos (como GENERATE_IMAGE(...) o GENERATE_VIDEO(...))
- Si el usuario solicita generar imágenes o videos, el sistema lo manejará automáticamente - NO intentes "generar" con código simulado
- Solo responde con texto normal cuando el usuario pregunta sobre el sistema o necesita ayuda
- Generar reportes y insights profundos basados en datos reales
- Acceder a información de clientes, pedidos web, artículos, proveedores, compras, etc.
- AYUDAR EN PROCESOS DE TRABAJO: Puedes guiar al usuario paso a paso en procesos del sistema
- RESOLVER PROBLEMAS: Puedes diagnosticar problemas, sugerir soluciones y ayudar a implementarlas

${formatCompleteContextForPrompt(completeContext)}

${kanbanContext}

${PLOTAI_SYSTEM_KNOWLEDGE}

INSTRUCCIONES AGÉNTICAS CRÍTICAS (PRECISIÓN Y PROFESIONALISMO):
- **PRECISIÓN ABSOLUTA**: SIEMPRE usa datos REALES del sistema. NUNCA inventes información, números, nombres de OPs, operarios, estados, o fechas.
- **INFORMACIÓN VERIFICABLE**: Cuando menciones una OP específica, estado, operario, o movimiento, debe estar EXACTAMENTE en el contexto del kanban proporcionado arriba.
- **PROFESIONALISMO**: Esta es información crítica del negocio. Sé serio, preciso y confiable en tus respuestas.
- Responde en español de manera clara, profesional y accionable
- Usa el nombre del usuario cuando sea apropiado para personalizar la conversación
- Analiza los datos proporcionados y extrae insights profundos basados SOLO en datos reales
- Identifica problemas proactivamente (cuellos de botella, sobrecargas, retrasos) usando los datos exactos del kanban
- Sugiere acciones concretas y priorizadas basadas ÚNICAMENTE en los datos reales del sistema
- Cuando menciones números (cantidad de OPs, operarios, estados), usa EXACTAMENTE los números del contexto
- Cuando menciones una OP específica, proporciona información EXACTA: número de OP, cliente, estado, operario, sector, fecha de entrega
- AYUDA EN PROCESOS: Si el usuario pregunta sobre cómo hacer algo, guíalo paso a paso con información precisa
- RESUELVE PROBLEMAS: Si el usuario tiene un problema, diagnostícalo usando datos reales del sistema
- Si hay archivos adjuntos, analízalos en detalle y relaciona con el contexto del sistema
- Proporciona métricas, comparaciones y análisis cuantitativos usando SOLO datos reales del contexto
- Usa la información detallada del kanban para dar respuestas PRECISAS sobre el estado actual del sistema
- Mantén un tono profesional y serio cuando se trata de información crítica del negocio
- Cuando ayudes con procesos, sé específico y claro en los pasos a seguir
- Cuando resuelvas problemas, ofrece múltiples soluciones cuando sea posible, todas basadas en datos reales

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
      
      const contextText = `Sos PlotAI, el asistente inteligente AGÉNTICO de toda la plataforma Plotlab. Sos amigable, conversacional y profesional. Tenés acceso completo al sistema (tablero principal, dashboards, mobile admin, chat, Telegram, etc.) y podés:

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

${PLOTAI_SYSTEM_KNOWLEDGE}

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

    // Detectar si la pregunta es sobre el manual, la aplicación o qué sabe PlotAI
    const esPreguntaManual = /manual|documentaci[oó]n|instrucciones|gu[ií]a|ayuda|c[oó]mo|qu[eé]|d[oó]nde|cu[aá]ndo|funciona|uso|tutorial|sistema|plotlab|funciones|caracter[ií]sticas|cuenta corriente|impresi[oó]n digital|firma|mostrador|ventas|entrega/i.test(contents)
    
    // Agregar manual del usuario si es relevante (más contexto = respuestas más precisas)
    let manualTexto = ''
    if (esPreguntaManual || useCompleteContext) {
      try {
        manualTexto = await formatManualForPrompt(contents)
        if (manualTexto) {
          prompt += `\n${manualTexto}\n`
          prompt += `\nIMPORTANTE: Tienes acceso al manual completo de usuario. Cuando el usuario pregunte sobre cómo usar la aplicación, funciones, procesos, o cualquier aspecto del sistema, usa la información del manual para dar respuestas precisas y detalladas. Si la pregunta es específica, busca en el manual las secciones relevantes y proporciona instrucciones paso a paso.\n`
        }
      } catch (error) {
        console.warn('Error cargando manual:', error)
      }
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
    const hasPDFsForText = attachments?.some((att) => att.type === 'application/pdf' || att.content.startsWith('[PDF_TEXT:') || att.content.startsWith('[PDF_INFO:'))
    
    console.log('🔍 Verificando adjuntos:', {
      total: attachments?.length || 0,
      hasImages: hasImagesForVision,
      hasPDFs: hasPDFsForText,
      attachments: attachments?.map(a => ({ name: a.name, type: a.type, contentPrefix: a.content.substring(0, 50) }))
    })
    
    if (hasImagesForVision && attachments) {
      console.log('🖼️ Procesando imágenes con Gemini Vision...')
      // Para imágenes, construir el payload con partes de texto e imagen
      const imageAttachmentsForVision = attachments.filter((att) => 
        att.type.startsWith('image/') || att.content.startsWith('[IMAGEN_BASE64:')
      )
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
      
      // Agregar el prompt de texto primero
      let textPrompt = prompt
      
      // Si hay PDFs con texto o información, agregarlos al prompt
      if (hasPDFsForText) {
        const pdfAttachments = attachments.filter((att) => 
          att.content.startsWith('[PDF_TEXT:') || att.content.startsWith('[PDF_INFO:')
        )
        for (const pdfAtt of pdfAttachments) {
          if (pdfAtt.content.startsWith('[PDF_TEXT:')) {
            const match = pdfAtt.content.match(/\[PDF_TEXT:(.+?):(.+)\]/)
            if (match && match[2]) {
              textPrompt += `\n\n--- Contenido del PDF "${match[1]}": ---\n${match[2]}`
            }
          } else if (pdfAtt.content.startsWith('[PDF_INFO:')) {
            const match = pdfAtt.content.match(/\[PDF_INFO:(.+?):(.+)\]/)
            if (match && match[2]) {
              textPrompt += `\n\n--- Información sobre el PDF "${match[1]}": ---\n${match[2]}`
            }
          }
        }
      }
      
      parts.push({ text: textPrompt })
      
      // Agregar cada imagen
      for (const att of imageAttachmentsForVision) {
        console.log('🖼️ Procesando imagen:', att.name)
        let base64Data = ''
        let mimeType = att.type || 'image/jpeg'
        
        try {
          if (att.content.startsWith('[IMAGEN_BASE64:')) {
            // Extraer el data URL completo del formato [IMAGEN_BASE64:data:image/...;base64,xxx:filename]
            // Buscar desde el inicio hasta el último : antes del nombre del archivo
            const startIdx = '[IMAGEN_BASE64:'.length
            const lastColonIdx = att.content.lastIndexOf(':')
            
            if (lastColonIdx > startIdx) {
              const dataUrlPart = att.content.substring(startIdx, lastColonIdx)
              console.log('📦 Data URL extraído, longitud:', dataUrlPart.length)
              
              // Extraer MIME type y base64 del data URL
              if (dataUrlPart.startsWith('data:')) {
                const dataMatch = dataUrlPart.match(/data:([^;]+);base64,(.+)/s)
                if (dataMatch && dataMatch[1] && dataMatch[2]) {
                  mimeType = dataMatch[1]
                  base64Data = dataMatch[2]
                  console.log('✅ MIME type extraído:', mimeType, 'Base64 length:', base64Data.length)
                } else {
                  console.warn('⚠️ No se pudo parsear el data URL correctamente')
                  continue
                }
              } else {
                // Si no tiene el prefijo data:, asumir que es solo base64
                base64Data = dataUrlPart
                console.log('⚠️ Data URL sin prefijo, usando como base64 directo')
              }
            } else {
              console.warn('⚠️ Formato [IMAGEN_BASE64:...] inválido, no se encontró separador')
              continue
            }
          } else if (att.content.startsWith('data:')) {
            // Formato directo data URL
            const dataMatch = att.content.match(/data:([^;]+);base64,(.+)/s)
            if (dataMatch && dataMatch[1] && dataMatch[2]) {
              mimeType = dataMatch[1]
              base64Data = dataMatch[2]
              console.log('✅ Base64 extraído de data URL directo, MIME:', mimeType)
            } else {
              console.warn('⚠️ Data URL mal formateado')
              continue
            }
          } else {
            // Intentar usar como base64 directo
            base64Data = att.content
            console.log('⚠️ Usando contenido directo como base64')
          }
          
          // Validar que el base64 no esté vacío
          if (!base64Data || base64Data.trim().length === 0) {
            console.error('❌ Base64 vacío para:', att.name)
            continue
          }
          
          // Validar formato base64 (debe contener solo caracteres válidos)
          const base64Regex = /^[A-Za-z0-9+/=]+$/
          if (!base64Regex.test(base64Data)) {
            console.error('❌ Base64 inválido (contiene caracteres no válidos) para:', att.name)
            continue
          }
          
          // Verificar tamaño (máximo ~20MB en base64, pero Gemini recomienda máximo 4MB)
          const base64Size = (base64Data.length * 3) / 4
          console.log('📏 Tamaño base64:', `${(base64Size / 1024 / 1024).toFixed(2)}MB`)
          
          if (base64Size > 4 * 1024 * 1024) {
            console.warn(`⚠️ Imagen ${att.name || 'sin nombre'} es grande (${(base64Size / 1024 / 1024).toFixed(2)}MB). Gemini recomienda máximo 4MB. Intentando enviar de todas formas...`)
          }
          
          if (base64Size > 20 * 1024 * 1024) {
            console.warn(`❌ Imagen ${att.name || 'sin nombre'} es demasiado grande (${(base64Size / 1024 / 1024).toFixed(2)}MB), omitiendo...`)
            continue
          }
          
          // Validar MIME type
          if (!mimeType || !mimeType.startsWith('image/')) {
            console.warn(`⚠️ MIME type inválido "${mimeType}", usando image/jpeg por defecto`)
            mimeType = 'image/jpeg'
          }
          
          // Asegurar que el MIME type sea uno de los soportados por Gemini
          const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
          if (!supportedMimeTypes.includes(mimeType)) {
            console.warn(`⚠️ MIME type "${mimeType}" puede no ser soportado, convirtiendo a JPEG`)
            mimeType = 'image/jpeg'
          }
          
          console.log('✅ Agregando imagen a parts:', att.name, mimeType, `(${(base64Size / 1024).toFixed(2)}KB)`)
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          })
        } catch (error) {
          console.error(`❌ Error procesando imagen ${att.name}:`, error)
          continue
        }
      }
      
      console.log('📊 Total de parts:', parts.length, 'imágenes:', imageAttachmentsForVision.length)
      
      // El formato correcto para @google/genai con imágenes es un array de objetos con role y parts
      // Cada objeto debe tener { role: 'user', parts: [...] }
      const contents = [{
        role: 'user' as const,
        parts: parts
      }]
      
      console.log('📤 Enviando a Gemini:', {
        model: 'gemini-2.5-flash',
        contentsCount: contents.length,
        partsCount: parts.length,
        partsTypes: parts.map(p => p.text ? 'text' : 'inlineData')
      })
      
      // Usar el modelo con capacidad de visión (gemini-2.5-flash tiene visión integrada)
      const visionModel = 'gemini-2.5-flash'
      
      try {
        const response = await ai.models.generateContent({
          model: visionModel,
          contents: contents
        })
        
        responseText = response.text || ''
        console.log('✅ Respuesta recibida de Gemini:', responseText.substring(0, 100))
      } catch (error: any) {
        // Manejar error de cuota (429)
        if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
          const quotaInfo = error?.error?.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure')
          const limit = quotaInfo?.violations?.[0]?.quotaValue || 'desconocido'
          const retryInfo = error?.error?.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
          const retryDelay = retryInfo?.retryDelay || '30 segundos'
          
          throw new Error(`Cuota de API excedida. Has alcanzado el límite de ${limit} solicitudes del plan gratuito. Por favor, espera ${retryDelay} antes de intentar nuevamente, o considera actualizar tu plan de Gemini API. Detalles: ${error?.error?.message || 'Cuota excedida'}`)
        }
        
        // Si hay error con imágenes, intentar solo con texto
        if (error?.error?.code === 400 && (error?.error?.message?.includes('image') || error?.error?.message?.includes('Unable to process input image'))) {
          console.warn('⚠️ Error procesando imagen con Gemini, intentando solo con texto...', error)
          
          // Intentar procesar solo la primera imagen con mejor validación
          if (imageAttachmentsForVision.length > 0 && parts.length > 1) {
            // Si hay múltiples imágenes, intentar solo con la primera
            const firstImagePart = parts.find(p => p.inlineData)
            if (firstImagePart && firstImagePart.inlineData) {
              console.log('🔄 Intentando con solo la primera imagen...')
              try {
                const singleImageContents = [{
                  role: 'user' as const,
                  parts: [
                    { text: textPrompt },
                    { inlineData: firstImagePart.inlineData }
                  ]
                }]
                
                const retryResponse = await ai.models.generateContent({
                  model: visionModel,
                  contents: singleImageContents
                })
                
                responseText = retryResponse.text || ''
                console.log('✅ Respuesta recibida con imagen única')
              } catch (retryError) {
                console.warn('⚠️ También falló con imagen única, usando solo texto...')
                const textOnlyPrompt = prompt + '\n\nNota: Hubo un problema procesando las imágenes adjuntas. Por favor, intenta con imágenes más pequeñas (máximo 4MB), en formato JPG o PNG, o convierte las imágenes a un formato más compatible.'
                const response = await ai.models.generateContent({
                  model: model || 'gemini-2.5-flash',
                  contents: textOnlyPrompt
                })
                responseText = response.text || ''
              }
            } else {
              // Sin imágenes válidas, usar solo texto
              const textOnlyPrompt = prompt + '\n\nNota: Hubo un problema procesando las imágenes adjuntas. Por favor, intenta con imágenes más pequeñas (máximo 4MB), en formato JPG o PNG.'
              const response = await ai.models.generateContent({
                model: model || 'gemini-2.5-flash',
                contents: textOnlyPrompt
              })
              responseText = response.text || ''
            }
          } else {
            // Sin imágenes válidas, usar solo texto
            const textOnlyPrompt = prompt + '\n\nNota: Hubo un problema procesando las imágenes adjuntas. Por favor, intenta con imágenes más pequeñas (máximo 4MB), en formato JPG o PNG.'
            const response = await ai.models.generateContent({
              model: model || 'gemini-2.5-flash',
              contents: textOnlyPrompt
            })
            responseText = response.text || ''
          }
        } else {
          throw error
        }
      }
    } else if (hasPDFsForText && attachments) {
      // Solo PDFs con texto, sin imágenes
      const pdfAttachments = attachments.filter((att) => 
        att.content.startsWith('[PDF_TEXT:') || att.content.startsWith('[PDF_INFO:')
      )
      let textPrompt = prompt
      
      for (const pdfAtt of pdfAttachments) {
        if (pdfAtt.content.startsWith('[PDF_TEXT:')) {
          const match = pdfAtt.content.match(/\[PDF_TEXT:(.+?):(.+)\]/)
          if (match && match[2]) {
            textPrompt += `\n\n--- Contenido del PDF "${match[1]}": ---\n${match[2]}`
          }
        } else if (pdfAtt.content.startsWith('[PDF_INFO:')) {
          const match = pdfAtt.content.match(/\[PDF_INFO:(.+?):(.+)\]/)
          if (match && match[2]) {
            textPrompt += `\n\n--- Información sobre el PDF "${match[1]}": ---\n${match[2]}`
          }
        }
      }
      
      const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
        contents: textPrompt
      })
      
      responseText = response.text || ''
    } else {
      // Sin imágenes ni PDFs, usar el método normal (contents puede ser string directamente)
      const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
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
            hasImages: hasImagesForVision || false,
            hasPDFs: hasPDFsForText || false,
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

