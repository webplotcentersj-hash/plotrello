/**
 * Servicio para cargar y gestionar el manual de usuario en PlotAI
 */

let manualCache: string | null = null
let manualLoading: Promise<string> | null = null
let manualInitialized = false

/**
 * Inicializa y precarga el manual al inicio de la aplicación
 * Esta función debe llamarse cuando se carga la app
 */
export async function initializeManual(): Promise<void> {
  if (manualInitialized || manualLoading) {
    return
  }

  console.log('📚 Inicializando manual de usuario...')
  manualLoading = loadManual()
  
  try {
    await manualLoading
    manualInitialized = true
    console.log('✅ Manual de usuario precargado correctamente')
  } catch (error) {
    console.error('❌ Error precargando manual:', error)
    manualInitialized = true // Marcar como inicializado para evitar reintentos infinitos
  }
}

/**
 * Función interna para cargar el manual
 */
async function loadManual(): Promise<string> {
  try {
    // Intentar cargar desde la carpeta public usando fetch
    const response = await fetch('/MANUAL_USUARIO.md')
    if (response.ok) {
      manualCache = await response.text()
      console.log('✅ Manual cargado correctamente desde /MANUAL_USUARIO.md')
      return manualCache
    } else {
      // Si no se encuentra en /, intentar con ruta relativa
      const response2 = await fetch('./MANUAL_USUARIO.md')
      if (response2.ok) {
        manualCache = await response2.text()
        console.log('✅ Manual cargado correctamente desde ./MANUAL_USUARIO.md')
        return manualCache
      }
      throw new Error(`No se pudo cargar el manual: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.warn('⚠️ No se pudo cargar el manual desde fetch, usando fallback:', error)
    // Fallback: intentar importar estáticamente
    try {
      // @ts-ignore - Importación dinámica de archivo raw
      const manualModule = await import('../../MANUAL_USUARIO.md?raw')
      manualCache = manualModule.default || ''
      console.log('✅ Manual cargado correctamente desde import estático')
      return manualCache
    } catch (importError) {
      console.warn('❌ No se pudo cargar el manual:', importError)
      manualCache = ''
      return ''
    }
  } finally {
    manualLoading = null
  }
}

/**
 * Obtiene el contenido completo del manual
 * Si ya está precargado, retorna inmediatamente
 */
export async function getManualContent(): Promise<string> {
  // Si ya está en cache, retornar inmediatamente
  if (manualCache) {
    return manualCache
  }

  // Si hay una carga en progreso, esperar a que termine
  if (manualLoading) {
    return manualLoading
  }

  // Si no se ha inicializado, cargar ahora
  if (!manualInitialized) {
    await initializeManual()
  }

  return manualCache || ''
}

/**
 * Versión síncrona (usa cache si está disponible)
 */
export function getManualContentSync(): string {
  return manualCache || ''
}

/**
 * Busca secciones relevantes del manual basado en una consulta
 */
export async function searchManual(query: string, maxSections: number = 5): Promise<string> {
  const manual = await getManualContent()
  if (!manual) return ''

  const queryLower = query.toLowerCase()
  const lines = manual.split('\n')
  const relevantSections: Array<{ title: string; content: string; score: number }> = []
  let currentSection: { title: string; content: string } | null = null
  let currentContent: string[] = []

  // Buscar secciones relevantes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Detectar títulos de sección (empiezan con ##)
    if (line.startsWith('##')) {
      // Guardar sección anterior si existe
      if (currentSection && currentContent.length > 0) {
        const content = currentContent.join('\n')
        const score = calculateRelevanceScore(queryLower, currentSection.title + ' ' + content)
        if (score > 0) {
          relevantSections.push({
            ...currentSection,
            content,
            score
          })
        }
      }
      
      // Nueva sección
      currentSection = {
        title: line.replace(/^##+\s*/, '').trim(),
        content: ''
      }
      currentContent = []
    } else if (currentSection) {
      currentContent.push(line)
    }
  }

  // Agregar última sección
  if (currentSection && currentContent.length > 0) {
    const content = currentContent.join('\n')
    const score = calculateRelevanceScore(queryLower, currentSection.title + ' ' + content)
    if (score > 0) {
      relevantSections.push({
        ...currentSection,
        content,
        score
      })
    }
  }

  // Ordenar por relevancia y tomar las mejores
  relevantSections.sort((a, b) => b.score - a.score)
  const topSections = relevantSections.slice(0, maxSections)

  // Formatear resultado
  if (topSections.length === 0) {
    return ''
  }

  let result = '=== MANUAL DE USUARIO - SECCIONES RELEVANTES ===\n\n'
  topSections.forEach((section, idx) => {
    result += `[Sección ${idx + 1}] ${section.title}\n`
    result += `${section.content.substring(0, 2000)}${section.content.length > 2000 ? '...' : ''}\n\n`
  })

  return result
}

/**
 * Calcula un score de relevancia basado en palabras clave
 */
function calculateRelevanceScore(query: string, text: string): number {
  const queryWords = query.split(/\s+/).filter(w => w.length > 2)
  const textLower = text.toLowerCase()
  let score = 0

  queryWords.forEach(word => {
    const wordLower = word.toLowerCase()
    // Coincidencia exacta de palabra
    const exactMatches = (textLower.match(new RegExp(`\\b${wordLower}\\b`, 'g')) || []).length
    score += exactMatches * 10
    
    // Coincidencia parcial
    if (textLower.includes(wordLower)) {
      score += 5
    }
  })

  // Bonus si el título contiene palabras clave
  const titleMatch = textLower.split('\n')[0] || ''
  if (titleMatch.includes(query)) {
    score += 20
  }

  return score
}

/**
 * Obtiene una sección específica del manual por título
 */
export async function getManualSection(sectionTitle: string): Promise<string> {
  const manual = await getManualContent()
  if (!manual) return ''

  const lines = manual.split('\n')
  let inSection = false
  let sectionContent: string[] = []
  let currentTitle = ''

  for (const line of lines) {
    if (line.startsWith('##')) {
      // Si estábamos en una sección, terminamos
      if (inSection && currentTitle.toLowerCase().includes(sectionTitle.toLowerCase())) {
        break
      }
      
      // Nueva sección
      currentTitle = line.replace(/^##+\s*/, '').trim()
      inSection = currentTitle.toLowerCase().includes(sectionTitle.toLowerCase())
      sectionContent = inSection ? [] : sectionContent
    } else if (inSection) {
      sectionContent.push(line)
    }
  }

  return sectionContent.join('\n')
}

/**
 * Formatea el manual completo para incluir en el prompt
 * (versión resumida para no exceder límites de tokens)
 */
export async function formatManualForPrompt(query?: string): Promise<string> {
  const manual = await getManualContent()
  if (!manual) return ''

  // Si hay una consulta, buscar secciones relevantes
  if (query) {
    const relevantSections = await searchManual(query, 8)
    if (relevantSections) {
      return relevantSections + '\n\nNOTA: Este es un extracto del manual de usuario. Si necesitas más información sobre algún tema específico, puedo buscar secciones más detalladas.\n'
    }
  }

  // Si no hay consulta o no se encontraron secciones relevantes, devolver índice y primeras secciones
  const lines = manual.split('\n')
  const tableOfContents: string[] = []
  let sectionCount = 0

  for (let i = 0; i < lines.length && sectionCount < 10; i++) {
    const line = lines[i]
    if (line.startsWith('##')) {
      const title = line.replace(/^##+\s*/, '').trim()
      tableOfContents.push(title)
      sectionCount++
    }
  }

  // Obtener las primeras secciones importantes
  const importantSections = [
    'Introducción',
    'Acceso e Inicio de Sesión',
    'Interfaz Principal',
    'Tablero Kanban',
    'Gestión de Órdenes de Trabajo',
    'PlotAI - Asistente Inteligente'
  ]

  let result = '=== MANUAL DE USUARIO - TRELLO PLOT ===\n\n'
  result += 'TABLA DE CONTENIDOS:\n'
  tableOfContents.slice(0, 30).forEach((title, idx) => {
    result += `${idx + 1}. ${title}\n`
  })
  result += '\n\n'

  // Agregar contenido de secciones importantes
  for (const sectionTitle of importantSections) {
    const section = await getManualSection(sectionTitle)
    if (section) {
      result += `=== ${sectionTitle} ===\n`
      result += `${section.substring(0, 1500)}${section.length > 1500 ? '...' : ''}\n\n`
    }
  }

  result += '\nNOTA: Este es un resumen del manual. Puedo buscar secciones específicas si me preguntas sobre algún tema en particular.\n'

  return result
}

