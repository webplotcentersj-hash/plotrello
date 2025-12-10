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
      content: '¡Hola! Soy PlotAI, tu asistente inteligente para el sistema Trello Plot. Puedo ayudarte a:\n\n- Analizar el estado de las tareas y órdenes\n- Identificar cuellos de botella y problemas\n- Generar reportes y estadísticas\n- Analizar archivos que subas\n- Responder preguntas sobre el sistema\n- Sugerir optimizaciones\n\n¿En qué puedo ayudarte hoy?',
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
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? '')
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

  const analyzeFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1]
          resolve(`[IMAGEN_BASE64:${base64}:${file.name}]`)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      } else if (file.type === 'application/pdf') {
        // Para PDFs, leemos como texto si es posible
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          resolve(`[PDF: ${file.name}, Tamaño: ${file.size} bytes, Contenido parcial: ${content.substring(0, 1000)}]`)
        }
        reader.onerror = () => {
          resolve(`[PDF: ${file.name}, Tamaño: ${file.size} bytes - No se pudo leer el contenido]`)
        }
        reader.readAsText(file)
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      attachments:
        filesToSend.length > 0
          ? await Promise.all(
              filesToSend.map(async (file) => ({
                name: file.name,
                type: file.type,
                content: await analyzeFile(file)
              }))
            )
          : undefined
    }

    setMessages((prev) => [...prev, userMessage])
    if (!forcedInput) {
      setInput('')
      setUploadedFiles([])
    }
    setIsLoading(true)

    try {
      const systemContext = getSystemContext(tasks, activity, teamMembers)
      const hasImages = userMessage.attachments?.some((att) => att.type.startsWith('image/'))
      
      // Usar gemini-2.5-flash (o gemini-pro-vision si hay imágenes)
      const modelName = hasImages ? 'gemini-2.5-flash' : 'gemini-2.5-flash'

      // Mantener historial de conversación (últimos 5 mensajes)
      const recentMessages = messages.slice(-5)
      const conversationHistory = recentMessages
        .map((msg) => `${msg.role === 'user' ? 'Usuario' : 'PlotAI'}: ${msg.content}`)
        .join('\n\n')

      const userPrompt = `PREGUNTA DEL USUARIO:\n${userMessage.content}`

      const response = await generateContent({
        model: modelName,
        contents: userPrompt,
        systemContext,
        conversationHistory,
        attachments: userMessage.attachments,
        agenticContext
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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error 
          ? `Error: ${error.message}`
          : 'Lo siento, hubo un error al procesar tu mensaje. Por favor, verifica tu API key de Gemini o intenta nuevamente.',
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
    setUploadedFiles((prev) => [...prev, ...files])
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

