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
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map((result: SpeechRecognitionResult) => result[0]?.transcript ?? '')
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
  const optimizeImage = (file: File, maxSize: number = 4 * 1024 * 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Calcular el tamaño base64 aproximado (base64 es ~33% más grande que el binario)
          const estimatedSize = (width * height * 4) * 1.33
          
          // Si es muy grande, redimensionar
          if (estimatedSize > maxSize) {
            const ratio = Math.sqrt(maxSize / estimatedSize)
            width = Math.floor(width * ratio)
            height = Math.floor(height * ratio)
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('No se pudo crear el contexto del canvas'))
            return
          }
          
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convertir a JPEG con calidad 0.85 para reducir tamaño
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          const quality = mimeType === 'image/png' ? 1.0 : 0.85
          const dataUrl = canvas.toDataURL(mimeType, quality)
          
          // Verificar tamaño final
          const base64Size = (dataUrl.length * 3) / 4
          if (base64Size > maxSize * 1.5) {
            // Si aún es muy grande, reducir más
            const newMaxSize = maxSize * 0.7
            optimizeImage(file, newMaxSize).then(resolve).catch(reject)
          } else {
            resolve(dataUrl)
          }
        }
        img.onerror = () => {
          // Si falla la optimización, intentar con el original
          const originalReader = new FileReader()
          originalReader.onload = (e) => {
            resolve(e.target?.result as string)
          }
          originalReader.onerror = reject
          originalReader.readAsDataURL(file)
        }
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const analyzeFile = async (file: File): Promise<string> => {
    console.log('🔍 Analizando archivo:', file.name, file.type, `${(file.size / 1024).toFixed(2)}KB`)
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        // Validar tamaño (máximo 20MB para imágenes)
        const maxFileSize = 20 * 1024 * 1024
        if (file.size > maxFileSize) {
          const errorMsg = `La imagen es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El tamaño máximo es 20MB. Por favor, reduce el tamaño de la imagen.`
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
              const dataUrl = e.target?.result as string
              console.log('✅ Imagen leída sin optimizar, tamaño base64:', `${(dataUrl.length * 3 / 4 / 1024).toFixed(2)}KB`)
              resolve(`[IMAGEN_BASE64:${dataUrl}:${file.name}]`)
            }
            reader.onerror = () => {
              console.error('❌ Error leyendo archivo:', error)
              reject(error)
            }
            reader.readAsDataURL(file)
          })
      } else if (file.type === 'application/pdf') {
        console.log('📄 Procesando PDF:', file.name)
        // Para PDFs, extraer texto primero (Gemini no puede procesar PDFs directamente)
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            // Intentar leer como texto primero
            const textReader = new FileReader()
            textReader.onload = (e) => {
              const textContent = e.target?.result as string
              console.log('📄 Texto extraído del PDF:', textContent ? `${textContent.length} caracteres` : 'vacío')
              if (textContent && textContent.trim().length > 0) {
                // Extraer texto del PDF (si es texto extraíble)
                const extractedText = textContent.substring(0, 50000)
                console.log('✅ PDF procesado con texto:', extractedText.length, 'caracteres')
                resolve(`[PDF_TEXT:${file.name}:${extractedText}]`)
              } else {
                // Si no hay texto extraíble, informar al usuario
                console.warn('⚠️ PDF sin texto extraíble')
                resolve(`[PDF_INFO:${file.name}:Este PDF no contiene texto extraíble. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente para que PlotAI pueda analizarlas visualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
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
          console.error('❌ Error leyendo PDF como ArrayBuffer')
          resolve(`[PDF_INFO:${file.name}:No se pudo leer el PDF. Por favor, convierte las páginas del PDF a imágenes (JPG o PNG) y súbelas individualmente. Tamaño: ${(file.size / 1024).toFixed(2)}KB]`)
        }
        reader.readAsArrayBuffer(file)
      } else if (file.type.startsWith('text/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve(e.target?.result as string)
        }
        reader.onerror = reject
        reader.readAsText(file)
      } else {
        resolve(`[Archivo: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size} bytes]`)
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
        attachments = await Promise.all(
          filesToSend.map(async (file) => {
            console.log('📎 Procesando:', file.name)
            const content = await analyzeFile(file)
            console.log('✅ Archivo procesado:', file.name, 'tipo:', content.substring(0, 50))
            return {
              name: file.name,
              type: file.type,
              content: content
            }
          })
        )
        console.log('✅ Todos los archivos procesados:', attachments.length)
      } catch (error) {
        console.error('❌ Error procesando archivos:', error)
        throw error
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
        } else {
          errorContent = `Error: ${error.message}`
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
                        {message.attachments.map((att, idx) => (
                          <div key={idx} className="attachment-item">
                            📎 {att.name}
                          </div>
                        ))}
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
              {uploadedFiles.map((file, index) => (
                <div key={index} className="file-chip">
                  <span>📎 {file.name}</span>
                  <button onClick={() => removeFile(index)}>×</button>
                </div>
              ))}
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

