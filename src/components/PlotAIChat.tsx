import { useState, useRef, useEffect, useMemo } from 'react'
import type { Task, TeamMember, ActivityEvent, TaskStatus, Priority } from '../types/board'
import { generateContent, getSystemContext } from '../services/plotAIService'
import { buildAgenticContext } from '../utils/agentInsights'
import { BOARD_COLUMNS } from '../data/mockData'
import { useAuth } from '../hooks/useAuth'
import './PlotAIChat.css'

type PlotAIChatProps = {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  onClose: () => void
  onCreateTask?: (newTask: Omit<Task, 'id'>, options?: { openChecklist?: boolean }) => Promise<void>
}

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string
    }
  }>
}

type SpeechRecognitionInstance = {
  start: () => void
  stop: () => void
  abort?: () => void
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  attachments?: Array<{ name: string; type: string; content: string }>
}

const stripEmailDomain = (value?: string | null) => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const atIndex = trimmed.indexOf('@')
  return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
}

const PlotAIChat = ({ tasks, activity, teamMembers, onClose, onCreateTask }: PlotAIChatProps) => {
  const { usuario } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! ¿En qué te puedo ayudar hoy?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const agenticContext = useMemo(() => buildAgenticContext(tasks, activity, teamMembers), [tasks, activity, teamMembers])
  const [isMicSupported, setIsMicSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isCreateOpOpen, setIsCreateOpOpen] = useState(false)
  const [isCreatingOp, setIsCreatingOp] = useState(false)
  const [createOpFeedback, setCreateOpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [quickOpForm, setQuickOpForm] = useState<{
    opNumber: string
    cliente: string
    dniCuit: string
    descripcion: string
    priority: Priority
    dueDate: string
    status: TaskStatus
    ownerId: string
    impact: Task['impact']
  }>({
    opNumber: '',
    cliente: '',
    dniCuit: '',
    descripcion: '',
    priority: 'media',
    dueDate: '',
    status: 'diseno-grafico',
    ownerId: teamMembers[0]?.id ?? '',
    impact: 'media'
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognitionClass = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass()
        recognition.lang = 'es-AR'
        recognition.continuous = false
        recognition.interimResults = false
        recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
          const transcript = Array.from(event.results)
            .map((result) => {
              const resultItem = result as { 0: { transcript: string } }
              return resultItem[0]?.transcript ?? ''
            })
            .join(' ')
          setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript))
        }
        recognition.onerror = () => {
          setIsRecording(false)
          setMicError('No se pudo transcribir el audio. Reintenta o verifica permisos.')
        }
        recognition.onend = () => {
          setIsRecording(false)
        }
        recognitionRef.current = recognition
        setIsMicSupported(true)
      } catch (error) {
        console.warn('SpeechRecognition no disponible:', error)
      }
    }
  }, [])


  useEffect(() => {
    if (!teamMembers.length) return
    setQuickOpForm((prev) => ({
      ...prev,
      ownerId: prev.ownerId || teamMembers[0].id
    }))
  }, [teamMembers])

  // Generar vistas previas para archivos subidos (especialmente imágenes)
  useEffect(() => {
    // Limpiar URLs anteriores
    setFilePreviews((prev) => {
      prev.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
      return []
    })

    const newPreviews = uploadedFiles.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    )

    setFilePreviews(newPreviews)

    return () => {
      newPreviews.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [uploadedFiles])

  const toggleRecording = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setMicError('Este navegador no soporta dictado por voz.')
      return
    }
    if (isRecording) {
      recognition.stop()
      setIsRecording(false)
    } else {
      setMicError(null)
      recognition.start()
      setIsRecording(true)
    }
  }

  const toggleCreateOpPanel = () => {
    setIsCreateOpOpen((prev) => !prev)
    setCreateOpFeedback(null)
  }

  const handleQuickOpChange = (field: keyof typeof quickOpForm, value: string) => {
    setQuickOpForm((prev) => ({
      ...prev,
      [field]:
        field === 'priority'
          ? (value as Priority)
          : field === 'status'
          ? (value as TaskStatus)
          : field === 'impact'
          ? (value as Task['impact'])
          : value
    }))
  }

  const handleQuickOpSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!onCreateTask) {
      setCreateOpFeedback({
        type: 'error',
        message: 'La creación de OP no está disponible en esta vista.'
      })
      return
    }

    if (!quickOpForm.cliente.trim() || !quickOpForm.descripcion.trim()) {
      setCreateOpFeedback({
        type: 'error',
        message: 'Completa al menos Cliente y Descripción.'
      })
      return
    }

    const selectedColumn = BOARD_COLUMNS.find((col) => col.id === quickOpForm.status)
    const creatorName = stripEmailDomain(usuario?.nombre) ?? usuario?.nombre ?? 'Usuario'
    const newTask: Omit<Task, 'id'> = {
      opNumber: quickOpForm.opNumber.trim() || `OP-${Date.now().toString().slice(-5)}`,
      title: quickOpForm.cliente.trim(),
      dniCuit: quickOpForm.dniCuit.trim() || undefined,
      summary: quickOpForm.descripcion.trim(),
      status: quickOpForm.status,
      priority: quickOpForm.priority,
      ownerId: quickOpForm.ownerId || teamMembers[0]?.id || '',
      createdBy: creatorName,
      tags: [],
      materials: [],
      assignedSector: selectedColumn?.label ?? 'Sin sector',
      photoUrl: '',
      storyPoints: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      dueDate: quickOpForm.dueDate ? new Date(quickOpForm.dueDate).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      impact: quickOpForm.impact
    }

    try {
      setIsCreatingOp(true)
      setCreateOpFeedback(null)
      await onCreateTask(newTask, { openChecklist: false })
      setCreateOpFeedback({
        type: 'success',
        message: `OP ${newTask.opNumber} creada correctamente.`
      })
      setQuickOpForm((prev) => ({
        ...prev,
        opNumber: '',
        cliente: '',
        dniCuit: '',
        descripcion: '',
        dueDate: '',
        priority: 'media',
        impact: 'media'
      }))
    } catch (error) {
      setCreateOpFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'No se pudo crear la OP. Revisa tu conexión e intenta nuevamente.'
      })
    } finally {
      setIsCreatingOp(false)
    }
  }

  // Función para optimizar imagen si es muy grande
  // Gemini recomienda máximo 4MB para imágenes, pero acepta hasta 20MB
  const optimizeImage = (file: File, maxSize: number = 4 * 1024 * 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height
            
            // Calcular el tamaño base64 aproximado (base64 es ~33% más grande que el binario)
            // Estimación: width * height * 4 bytes (RGBA) * 1.33 (overhead base64)
            const estimatedSize = (width * height * 4) * 1.33
            
            // Si es muy grande, redimensionar manteniendo aspect ratio
            if (estimatedSize > maxSize) {
              const ratio = Math.sqrt(maxSize / estimatedSize)
              width = Math.floor(width * ratio)
              height = Math.floor(height * ratio)
              console.log(`📐 Redimensionando imagen de ${img.width}x${img.height} a ${width}x${height}`)
            }
            
            // Limitar dimensiones máximas (Gemini tiene límites)
            const maxDimension = 4096 // Gemini soporta hasta 4096x4096
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.floor((height * maxDimension) / width)
                width = maxDimension
              } else {
                width = Math.floor((width * maxDimension) / height)
                height = maxDimension
              }
              console.log(`📐 Limitando dimensiones a ${width}x${height}`)
            }
            
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('No se pudo crear el contexto del canvas'))
              return
            }
            
            // Configurar calidad de renderizado
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            
            // Dibujar imagen redimensionada
            ctx.drawImage(img, 0, 0, width, height)
            
            // Convertir a JPEG siempre para mejor compatibilidad con Gemini
            // JPEG es más eficiente y tiene mejor soporte
            const mimeType = 'image/jpeg'
            const quality = 0.85 // Calidad balanceada entre tamaño y calidad
            
            const dataUrl = canvas.toDataURL(mimeType, quality)
            
            // Verificar tamaño final
            const base64Size = (dataUrl.length * 3) / 4
            console.log(`✅ Imagen optimizada: ${(base64Size / 1024).toFixed(2)}KB (${width}x${height})`)
            
            if (base64Size > maxSize * 1.5) {
              // Si aún es muy grande, reducir calidad y tamaño
              console.log('⚠️ Imagen aún grande, reduciendo más...')
              const newMaxSize = maxSize * 0.7
              const lowerQuality = 0.7
              const lowerQualityDataUrl = canvas.toDataURL(mimeType, lowerQuality)
              const lowerQualitySize = (lowerQualityDataUrl.length * 3) / 4
              
              if (lowerQualitySize > maxSize * 1.2) {
                // Si aún es grande, reducir dimensiones más
                optimizeImage(file, newMaxSize).then(resolve).catch(reject)
              } else {
                resolve(lowerQualityDataUrl)
              }
            } else {
              resolve(dataUrl)
            }
          } catch (error) {
            console.error('❌ Error en optimización de imagen:', error)
            reject(error)
          }
        }
        img.onerror = (error) => {
          console.warn('⚠️ Error cargando imagen para optimización, intentando sin optimizar:', error)
          // Si falla la optimización, intentar con el original
          const originalReader = new FileReader()
          originalReader.onload = (e) => {
            const originalDataUrl = e.target?.result as string
            if (originalDataUrl) {
              resolve(originalDataUrl)
            } else {
              reject(new Error('No se pudo leer el archivo original'))
            }
          }
          originalReader.onerror = () => {
            reject(new Error('Error al leer el archivo original'))
          }
          originalReader.readAsDataURL(file)
        }
        img.src = e.target?.result as string
      }
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'))
      }
      reader.readAsDataURL(file)
    })
  }

  const analyzeFile = async (file: File): Promise<string> => {
    console.log('🔍 Analizando archivo:', file.name, file.type, `${(file.size / 1024).toFixed(2)}KB`)
    
    // Validar tamaño general (máximo 50MB para cualquier archivo)
    const maxFileSize = 50 * 1024 * 1024
    if (file.size > maxFileSize) {
      const errorMsg = `El archivo "${file.name}" es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 50MB. Por favor, reduce el tamaño del archivo.`
      console.error('❌ Error de tamaño:', errorMsg)
      throw new Error(errorMsg)
    }
    
    return new Promise((resolve, reject) => {
      try {
        if (file.type.startsWith('image/')) {
          // Validar tamaño (máximo 20MB para imágenes)
          const maxImageSize = 20 * 1024 * 1024
          if (file.size > maxImageSize) {
            const errorMsg = `La imagen "${file.name}" es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 20MB. Por favor, reduce el tamaño de la imagen.`
            console.error('❌ Error de tamaño:', errorMsg)
            reject(new Error(errorMsg))
            return
          }
          
          console.log('✅ Imagen válida, optimizando...')
          // Optimizar imagen si es necesario (máximo 4MB en base64)
          optimizeImage(file, 4 * 1024 * 1024)
            .then((dataUrl) => {
              console.log('✅ Imagen optimizada, tamaño base64:', `${(dataUrl.length * 3 / 4 / 1024).toFixed(2)}KB`)
              resolve(`[IMAGEN_BASE64:${dataUrl}:${file.name}]`)
            })
            .catch((error) => {
              console.warn('⚠️ Error en optimización, intentando sin optimizar:', error)
              // Si falla la optimización, intentar sin optimizar
              const reader = new FileReader()
              reader.onload = (e) => {
                try {
                  const dataUrl = e.target?.result as string
                  if (!dataUrl) {
                    throw new Error('No se pudo leer el archivo')
                  }
                  console.log('✅ Imagen leída sin optimizar, tamaño base64:', `${(dataUrl.length * 3 / 4 / 1024).toFixed(2)}KB`)
                  resolve(`[IMAGEN_BASE64:${dataUrl}:${file.name}]`)
                } catch (readError) {
                  console.error('❌ Error procesando imagen:', readError)
                  reject(new Error(`Error al procesar la imagen "${file.name}": ${readError instanceof Error ? readError.message : 'Error desconocido'}`))
                }
              }
              reader.onerror = () => {
                console.error('❌ Error leyendo archivo:', error)
                reject(new Error(`Error al leer la imagen "${file.name}". Verifica que el archivo no esté corrupto.`))
              }
              reader.readAsDataURL(file)
            })
        } else if (file.type === 'application/pdf') {
          console.log('📄 Procesando PDF:', file.name)
          // Validar tamaño (máximo 10MB para PDFs)
          const maxPdfSize = 10 * 1024 * 1024
          if (file.size > maxPdfSize) {
            const errorMsg = `El PDF "${file.name}" es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 10MB. Por favor, reduce el tamaño del PDF o convierte las páginas a imágenes.`
            console.error('❌ Error de tamaño:', errorMsg)
            reject(new Error(errorMsg))
            return
          }
          
          // Para PDFs, intentar extraer texto (aunque generalmente no funciona bien)
          // Mejor informar al usuario que convierta a imágenes
          const reader = new FileReader()
          reader.onload = () => {
            try {
              // Intentar leer como texto (puede no funcionar para PDFs binarios)
              const textReader = new FileReader()
              textReader.onload = (e) => {
                try {
                  const textContent = e.target?.result as string
                  console.log('📄 Texto extraído del PDF:', textContent ? `${textContent.length} caracteres` : 'vacío')
                  if (textContent && textContent.trim().length > 0 && !textContent.includes('%PDF')) {
                    // Si tiene texto y no es solo el header del PDF
                    const extractedText = textContent.substring(0, 50000)
                    console.log('✅ PDF procesado con texto:', extractedText.length, 'caracteres')
                    resolve(`[PDF_TEXT:${file.name}:${extractedText}]`)
                  } else {
                    // Si no hay texto extraíble, informar al usuario
                    console.warn('⚠️ PDF sin texto extraíble')
                    resolve(`[PDF_INFO:${file.name}:Este PDF no contiene texto extraíble o es un PDF escaneado. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente para que PlotAI pueda analizarlas visualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
                  }
                } catch (textError) {
                  console.error('❌ Error procesando texto del PDF:', textError)
                  resolve(`[PDF_INFO:${file.name}:No se pudo extraer texto del PDF. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente para que PlotAI pueda analizarlas visualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
                }
              }
              textReader.onerror = () => {
                console.error('❌ Error extrayendo texto del PDF')
                resolve(`[PDF_INFO:${file.name}:No se pudo extraer texto del PDF. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente para que PlotAI pueda analizarlas visualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
              }
              textReader.readAsText(file)
            } catch (error) {
              console.error('❌ Error procesando PDF:', error)
              resolve(`[PDF_INFO:${file.name}:Error al procesar el PDF. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
            }
          }
          reader.onerror = () => {
            console.error('❌ Error leyendo PDF')
            reject(new Error(`Error al leer el PDF "${file.name}". Verifica que el archivo no esté corrupto.`))
          }
          reader.readAsArrayBuffer(file)
        } else if (file.type.startsWith('text/')) {
          // Validar tamaño (máximo 5MB para archivos de texto)
          const maxTextSize = 5 * 1024 * 1024
          if (file.size > maxTextSize) {
            const errorMsg = `El archivo de texto "${file.name}" es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 5MB.`
            console.error('❌ Error de tamaño:', errorMsg)
            reject(new Error(errorMsg))
            return
          }
          
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const content = e.target?.result as string
              if (!content) {
                throw new Error('No se pudo leer el contenido del archivo')
              }
              resolve(content)
            } catch (readError) {
              console.error('❌ Error procesando archivo de texto:', readError)
              reject(new Error(`Error al procesar el archivo de texto "${file.name}": ${readError instanceof Error ? readError.message : 'Error desconocido'}`))
            }
          }
          reader.onerror = () => {
            console.error('❌ Error leyendo archivo de texto')
            reject(new Error(`Error al leer el archivo de texto "${file.name}". Verifica que el archivo no esté corrupto.`))
          }
          reader.readAsText(file)
        } else {
          // Para otros tipos de archivo, solo informar
          console.log('ℹ️ Tipo de archivo no procesable:', file.type)
          resolve(`[Archivo: ${file.name}, Tipo: ${file.type}, Tamaño: ${(file.size / 1024).toFixed(2)}KB. Este tipo de archivo no se puede analizar directamente. Por favor, convierte el contenido a texto o imágenes si es posible.]`)
        }
      } catch (error) {
        console.error('❌ Error general procesando archivo:', error)
        reject(error instanceof Error ? error : new Error(`Error desconocido al procesar "${file.name}"`))
      }
    })
  }

  const handleSendMessage = async (forcedInput?: string) => {
    const messageText = forcedInput ?? input
    const filesToSend = forcedInput ? [] : uploadedFiles

    if (!messageText.trim() && filesToSend.length === 0) return

    console.log('📤 Enviando mensaje con', filesToSend.length, 'archivos')
    
    let attachments: Array<{ name: string; type: string; content: string }> | undefined = undefined
    
    if (filesToSend.length > 0) {
      console.log('📎 Procesando archivos adjuntos...')
      try {
        // Procesar archivos uno por uno para mejor manejo de errores
        attachments = []
        for (const file of filesToSend) {
          try {
            console.log('📎 Procesando:', file.name)
            const content = await analyzeFile(file)
            console.log('✅ Archivo procesado:', file.name, 'tipo:', content.substring(0, 50))
            attachments.push({
              name: file.name,
              type: file.type,
              content: content
            })
          } catch (fileError) {
            console.error(`❌ Error procesando archivo "${file.name}":`, fileError)
            // Continuar con otros archivos pero mostrar error al usuario
            const errorMessage = fileError instanceof Error ? fileError.message : 'Error desconocido'
            throw new Error(`Error al procesar "${file.name}": ${errorMessage}`)
          }
        }
        console.log('✅ Todos los archivos procesados:', attachments.length)
      } catch (error) {
        console.error('❌ Error procesando archivos:', error)
        // Mostrar mensaje de error más claro al usuario
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar archivos'
        throw new Error(errorMessage)
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      attachments
    }

    setMessages((prev) => [...prev, userMessage])
    if (!forcedInput) {
      setInput('')
      setUploadedFiles([])
    }
    setIsLoading(true)

    try {
      const systemContext = getSystemContext(tasks, activity, teamMembers)
      
      // Usar gemini-2.5-flash (tiene capacidad de visión integrada)
      const modelName = 'gemini-2.5-flash'

      // Mantener historial de conversación (últimos 5 mensajes)
      const recentMessages = messages.slice(-5)
      const conversationHistory = recentMessages
        .map((msg) => `${msg.role === 'user' ? 'Usuario' : 'PlotAI'}: ${msg.content}`)
        .join('\n\n')

      const userPrompt = `PREGUNTA DEL USUARIO:\n${userMessage.content}`

      // Obtener nombre del usuario
      const nombreUsuario = usuario?.nombre || stripEmailDomain(usuario?.nombre) || undefined

      const response = await generateContent({
        model: modelName,
        contents: userPrompt,
        systemContext,
        conversationHistory,
        attachments: userMessage.attachments,
        agenticContext,
        useCompleteContext: true, // Usar contexto completo de todas las tablas
        useMemory: true, // Usar sistema de memoria/aprendizaje
        learnFromResponse: true, // Aprender de esta interacción
        tasks, // Pasar tasks para contexto completo
        activity, // Pasar activity para contexto completo
        teamMembers, // Pasar teamMembers para contexto completo
        userName: nombreUsuario // Pasar nombre del usuario
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error en PlotAI:', error)
      
      let errorContent = 'Lo siento, hubo un error al procesar tu mensaje.'
      
      if (error instanceof Error) {
        // Mensaje de error más amigable para cuota excedida
        if (error.message.includes('Cuota de API excedida') || error.message.includes('quota')) {
          errorContent = `⚠️ **Cuota de API excedida**\n\n${error.message}\n\n💡 **Sugerencias:**\n- Espera unos minutos antes de intentar nuevamente\n- Considera actualizar tu plan de Gemini API en https://ai.google.dev\n- El plan gratuito tiene límites de uso diarios`
        } else if (error.message.includes('API key')) {
          errorContent = `🔑 **Error de API Key**\n\n${error.message}\n\nPor favor, verifica que tu API key de Gemini esté configurada correctamente.`
        } else if (error.message.includes('demasiado grande') || error.message.includes('tamaño máximo')) {
          errorContent = `📦 **Error de tamaño de archivo**\n\n${error.message}\n\n💡 **Sugerencias:**\n- Reduce el tamaño del archivo\n- Para imágenes: comprime o redimensiona la imagen\n- Para PDFs: convierte las páginas a imágenes individuales\n- Tamaños máximos:\n  - Imágenes: 20MB\n  - PDFs: 10MB\n  - Texto: 5MB\n  - Otros: 50MB`
        } else if (error.message.includes('Error al procesar') || error.message.includes('Error al leer')) {
          errorContent = `❌ **Error procesando archivo**\n\n${error.message}\n\n💡 **Sugerencias:**\n- Verifica que el archivo no esté corrupto\n- Intenta con otro archivo\n- Para PDFs: convierte las páginas a imágenes (JPG o PNG)`
        } else if (error.message.includes('Unable to process input image') || error.message.includes('INVALID_ARGUMENT')) {
          errorContent = `🖼️ **Error procesando imagen**\n\nNo se pudo procesar la imagen con la IA. Esto puede deberse a:\n\n💡 **Soluciones:**\n- **Tamaño**: Asegúrate de que la imagen sea menor a 4MB\n- **Formato**: Usa formato JPG o PNG (evita formatos exóticos)\n- **Calidad**: La imagen puede estar corrupta o en un formato no soportado\n- **Dimensiones**: Imágenes muy grandes (>4096px) pueden causar problemas\n\n**Recomendación**: Intenta comprimir o redimensionar la imagen antes de subirla.`
        } else {
          errorContent = `❌ **Error**\n\n${error.message}\n\nSi el problema persiste, intenta con un archivo diferente o contacta al administrador.`
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    console.log('📎 Archivos seleccionados:', files.map(f => ({ name: f.name, type: f.type, size: f.size })))
    if (files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...files])
      // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestedAction = (prompt: string) => {
    handleSendMessage(prompt)
  }

  return (
    <div className="plotai-overlay" onClick={onClose}>
      <div className="plotai-chat" onClick={(e) => e.stopPropagation()}>
        <header className="plotai-header">
          <div className="plotai-header-content">
            <div>
              <h2>🤖 PlotAI</h2>
              <p>Asistente Inteligente con Capacidad Agéntica</p>
            </div>
            <button className="plotai-close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="plotai-body">
          <aside className="plotai-side-panel">
            <div className="plotai-intel-panel">
              <div className="intel-section">
                <div className="intel-header">
                  <span className="intel-label alert">Alertas críticas</span>
                </div>
                <div className="intel-list">
                  {(agenticContext.alerts.length > 0
                    ? agenticContext.alerts
                    : ['Sin alertas críticas detectadas']
                  ).map((alert, idx) => (
                    <div key={`alert-${idx}`} className="intel-pill">
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
              <div className="intel-section">
                <div className="intel-header">
                  <span className="intel-label opportunity">Oportunidades</span>
                </div>
                <div className="intel-list">
                  {(agenticContext.opportunities.length > 0
                    ? agenticContext.opportunities
                    : ['Sin oportunidades destacadas']
                  ).map((item, idx) => (
                    <div key={`opp-${idx}`} className="intel-pill">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="intel-section">
                <div className="intel-header">
                  <span className="intel-label actions">Acciones agénticas</span>
                </div>
                <div className="intel-actions">
                  {agenticContext.suggestedActions.map((action) => (
                    <button
                      key={action.id}
                      className="agent-action"
                      onClick={() => handleSuggestedAction(action.prompt)}
                      disabled={isLoading}
                    >
                      <strong>{action.label}</strong>
                      <span>{action.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="intel-section wide">
                <div className="intel-header">
                  <span className="intel-label creation">Crear OP desde el chat</span>
                  <button className="intel-toggle" onClick={toggleCreateOpPanel}>
                    {isCreateOpOpen ? 'Cerrar' : 'Abrir'}
                  </button>
                </div>
                {isCreateOpOpen ? (
                  <form className="quick-op-form" onSubmit={handleQuickOpSubmit}>
                    <div className="quick-op-grid">
                      <label>
                        N° OP (opcional)
                        <input
                          type="text"
                          value={quickOpForm.opNumber}
                          onChange={(e) => handleQuickOpChange('opNumber', e.target.value)}
                          placeholder="Ej: OP-1240"
                        />
                      </label>
                      <label>
                        Cliente / Proyecto *
                        <input
                          type="text"
                          value={quickOpForm.cliente}
                          onChange={(e) => handleQuickOpChange('cliente', e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        DNI / CUIT
                        <input
                          type="text"
                          value={quickOpForm.dniCuit}
                          onChange={(e) => handleQuickOpChange('dniCuit', e.target.value)}
                          placeholder="Ej: 12345678 o 20-12345678-9"
                        />
                      </label>
                      <label>
                        Responsable
                        <select
                          value={quickOpForm.ownerId}
                          onChange={(e) => handleQuickOpChange('ownerId', e.target.value)}
                        >
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Estado inicial
                        <select
                          value={quickOpForm.status}
                          onChange={(e) => handleQuickOpChange('status', e.target.value)}
                        >
                          {BOARD_COLUMNS.map((column) => (
                            <option key={column.id} value={column.id}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Prioridad
                        <select
                          value={quickOpForm.priority}
                          onChange={(e) => handleQuickOpChange('priority', e.target.value)}
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </label>
                      <label>
                        Impacto
                        <select
                          value={quickOpForm.impact}
                          onChange={(e) => handleQuickOpChange('impact', e.target.value)}
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="low">Baja</option>
                        </select>
                      </label>
                      <label>
                        Fecha compromiso
                        <input
                          type="date"
                          value={quickOpForm.dueDate}
                          onChange={(e) => handleQuickOpChange('dueDate', e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="quick-op-description">
                      Descripción *
                      <textarea
                        value={quickOpForm.descripcion}
                        onChange={(e) => handleQuickOpChange('descripcion', e.target.value)}
                        placeholder="Detalles de la orden, materiales, alcance..."
                        rows={3}
                        required
                      />
                    </label>
                    <div className="quick-op-actions">
                      <button type="button" className="ghost" onClick={toggleCreateOpPanel}>
                        Cancelar
                      </button>
                      <button type="submit" className="primary" disabled={isCreatingOp}>
                        {isCreatingOp ? 'Creando...' : 'Crear OP'}
                      </button>
                    </div>
                    {createOpFeedback && (
                      <div className={`quick-op-feedback ${createOpFeedback.type}`}>
                        {createOpFeedback.message}
                      </div>
                    )}
                  </form>
                ) : (
                  <p className="intel-hint">Generá una orden de producción sin salir del chat.</p>
                )}
              </div>
            </div>
          </aside>

          <section className="plotai-chat-stream">
            <div className="plotai-messages">
              {messages.map((message) => (
                <div key={message.id} className={`plotai-message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{message.content}</div>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((att, idx) => {
                          const isImage =
                            att.type.startsWith('image/') ||
                            att.content.startsWith('[IMAGEN_BASE64:') ||
                            att.content.startsWith('data:')

                          let imageSrc: string | undefined
                          if (isImage) {
                            if (att.content.startsWith('[IMAGEN_BASE64:')) {
                              const match = att.content.match(/\[IMAGEN_BASE64:(.+?):/)
                              if (match && match[1]) {
                                const base = match[1]
                                if (base.includes('data:')) {
                                  imageSrc = base
                                } else {
                                  imageSrc = `data:image/jpeg;base64,${base}`
                                }
                              }
                            } else if (att.content.startsWith('data:')) {
                              imageSrc = att.content
                            }
                          }

                          return (
                            <div key={idx} className="attachment-item">
                              {isImage && imageSrc ? (
                                <div className="attachment-image-wrapper">
                                  <img
                                    src={imageSrc}
                                    alt={att.name}
                                    className="attachment-image"
                                  />
                                  <div className="attachment-caption">📎 {att.name}</div>
                                </div>
                              ) : (
                                <span>📎 {att.name}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="message-time">
                      {message.timestamp.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="plotai-message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </section>
        </div>

        <div className="plotai-input-area">
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              {uploadedFiles.map((file, index) => {
                const isImage = file.type.startsWith('image/')
                const previewUrl = isImage ? filePreviews[index] : undefined
                return (
                  <div key={index} className="file-chip">
                    {isImage && previewUrl && (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="file-preview-image"
                      />
                    )}
                    <span>📎 {file.name}</span>
                    <button onClick={() => removeFile(index)}>×</button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="input-container">
            <button
              className="attach-button"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar archivo"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
              rows={2}
              className="plotai-textarea"
            />
            <button
              type="button"
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
              disabled={!isMicSupported || isLoading}
              title={isMicSupported ? 'Dictar con micrófono' : 'Dictado no disponible'}
            >
              {isRecording ? '⏺' : '🎙️'}
            </button>
            <button
              className="send-button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>
          {micError && <div className="mic-error">{micError}</div>}
        </div>
      </div>
    </div>
  )
}

export default PlotAIChat

