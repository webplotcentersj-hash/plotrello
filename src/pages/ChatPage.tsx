import { useState, useRef, useEffect } from 'react'
import type { TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { apiService } from '../services/api'
import { supabase } from '../services/supabaseClient'
import './ChatPage.css'

type ChatMessage = {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  timestamp: Date
  channel: string
  type?: 'message' | 'buzz' | 'alert'
  status?: 'sending' | 'error' | 'sent'
}

type Channel = {
  id: string
  name: string
  description: string
  unread?: number
}

const CHANNELS: Channel[] = [
  { id: 'general', name: '# general', description: 'Canal general del equipo' },
  { id: 'produccion', name: '# producción', description: 'Coordinación de producción' },
  { id: 'diseno', name: '# diseño', description: 'Diseño gráfico y creativo' },
  { id: 'imprenta', name: '# imprenta', description: 'Área de imprenta' },
  { id: 'instalaciones', name: '# instalaciones', description: 'Equipo de instalaciones' },
  { id: 'random', name: '# random', description: 'Conversaciones casuales' }
]

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

// Mapeo de canales a room_id (usando los mismos IDs que la API)
const getRoomIdForChannel = (channel: string): number => {
  return chatChannelToRoom[channel] ?? 1
}

const ChatPage = ({ onBack, teamMembers }: { onBack: () => void; teamMembers: TeamMember[] }) => {
  const { usuario } = useAuth()
  const resolvedMembers =
    teamMembers.length > 0
      ? teamMembers
      : [
          {
            id: usuario?.id.toString() || 'user1',
            name: usuario?.nombre || 'Usuario',
            role: 'Miembro',
            avatar: (usuario?.nombre || 'U').charAt(0).toUpperCase(),
            productivity: 0
          }
        ]
  const [currentChannel, setCurrentChannel] = useState<string>('general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState<TeamMember[]>([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const mentionSuggestionsRef = useRef<HTMLDivElement>(null)
  const realtimeSubscriptionRef = useRef<any>(null)
  const currentUser = resolvedMembers[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const findMentionedMembers = (text: string): TeamMember[] => {
    const mentions = Array.from(text.matchAll(/@([\w.\-]+)/g)).map((m) => m[1].toLowerCase())
    if (mentions.length === 0) return []
    return resolvedMembers.filter((member) =>
      mentions.some((m) => member.name.toLowerCase().includes(m))
    )
  }

  // Cargar mensajes reales del canal
  useEffect(() => {
    const loadMessages = async () => {
      if (!usuario?.id) {
        console.warn('⚠️ Chat: Usuario no autenticado')
        return
      }
      
      setIsLoadingMessages(true)
      try {
        console.log(`📥 Cargando mensajes del canal: ${currentChannel}`)
        const response = await apiService.getMensajesChat(currentChannel, 100)
        
        if (!response.success) {
          console.error('❌ Error en getMensajesChat:', response.error)
          setMessages([])
          return
        }

        if (response.data && response.data.length > 0) {
          console.log(`✅ Cargados ${response.data.length} mensajes`)
          const chatMessages: ChatMessage[] = response.data.map((msg) => ({
            id: msg.id.toString(),
            userId: msg.usuario_id.toString(),
            userName: msg.nombre_usuario || 'Usuario',
            userAvatar: (msg.nombre_usuario || 'U').charAt(0).toUpperCase(),
            content: msg.contenido,
            timestamp: new Date(msg.timestamp),
            channel: msg.canal || currentChannel,
            type: msg.tipo || 'message'
          }))
          setMessages(chatMessages)
        } else {
          console.log('ℹ️ No hay mensajes en este canal')
          setMessages([])
        }
      } catch (error) {
        console.error('❌ Error cargando mensajes:', error)
        setMessages([])
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [currentChannel, usuario?.id])

  // Suscripción a Supabase Realtime para mensajes nuevos
  useEffect(() => {
    if (!supabase) {
      console.warn('⚠️ Chat: Supabase no está disponible')
      return
    }
    
    if (!usuario?.id) {
      console.warn('⚠️ Chat: Usuario no autenticado para Realtime')
      return
    }

    const roomId = getRoomIdForChannel(currentChannel)
    console.log(`🔔 Suscribiéndose a Realtime para room_id: ${roomId} (canal: ${currentChannel})`)

    // Limpiar suscripción anterior
    if (realtimeSubscriptionRef.current) {
      console.log('🧹 Limpiando suscripción anterior')
      supabase.removeChannel(realtimeSubscriptionRef.current)
      realtimeSubscriptionRef.current = null
    }

    // Crear nueva suscripción
    const channel = supabase
      .channel(`chat:${roomId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('📨 Nuevo mensaje recibido vía Realtime:', payload)
          const newMsg = payload.new as any
          // Evitar duplicados: verificar si el mensaje ya existe
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id.toString())
            if (exists) {
              console.log('⚠️ Mensaje duplicado ignorado:', newMsg.id)
              return prev
            }

            const chatMessage: ChatMessage = {
              id: newMsg.id.toString(),
              userId: newMsg.id_usuario.toString(),
              userName: newMsg.nombre_usuario || 'Usuario',
              userAvatar: (newMsg.nombre_usuario || 'U').charAt(0).toUpperCase(),
              content: newMsg.mensaje,
              timestamp: new Date(newMsg.timestamp),
              channel: currentChannel,
              type: newMsg.mensaje?.includes('zumbido') || newMsg.mensaje?.includes('Zumbido') ? 'buzz' : newMsg.mensaje?.includes('Atención') || newMsg.mensaje?.includes('ALERTA') ? 'alert' : 'message'
            }
            console.log('✅ Mensaje agregado:', chatMessage)
            return [...prev, chatMessage]
          })
        }
      )
      .subscribe((status) => {
        console.log(`📡 Estado de suscripción Realtime: ${status}`)
      })

    realtimeSubscriptionRef.current = channel

    return () => {
      if (realtimeSubscriptionRef.current && supabase) {
        console.log('🧹 Limpiando suscripción al desmontar')
        supabase.removeChannel(realtimeSubscriptionRef.current)
        realtimeSubscriptionRef.current = null
      }
    }
  }, [currentChannel, usuario?.id])

  const handleSendMessage = async (mode: 'message' | 'alert' = 'message') => {
    if (!input.trim() && attachedFiles.length === 0 && mode === 'message') {
      console.warn('⚠️ Intento de enviar mensaje vacío')
      return
    }
    if (!usuario?.id) {
      console.error('❌ No se puede enviar mensaje: usuario no autenticado')
      alert('Debes estar autenticado para enviar mensajes')
      return
    }

    const content = input.trim()
    let finalContent = content

    if (attachedFiles.length > 0) {
      const fileInfo = attachedFiles
        .map((f) => `📎 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`)
        .join('\n')
      finalContent = content ? `${content}\n\n${fileInfo}` : fileInfo
    }

    const savedContent = content
    const savedFiles = [...attachedFiles]

    setInput('')
    setAttachedFiles([])
    setShowEmojiPicker(false)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      userId: usuario.id.toString(),
      userName: usuario.nombre || 'Yo',
      userAvatar: (usuario.nombre || 'Y').charAt(0).toUpperCase(),
      content: finalContent || (mode === 'alert' ? '¡Atención! Revisar esto de inmediato.' : ''),
      timestamp: new Date(),
      channel: currentChannel,
      type: mode === 'alert' ? 'alert' : 'message',
      status: 'sending'
    }
    setMessages((prev) => [...prev, optimistic])
    setIsSending(true)

    try {
      if (savedFiles.length > 0) {
        console.log('📎 Archivos adjuntos:', savedFiles.map((f) => f.name))
      }

      const response = await apiService.enviarMensajeChat({
        canal: currentChannel,
        contenido: finalContent || (mode === 'alert' ? '¡Atención! Revisar esto de inmediato.' : ''),
        usuario_id: usuario.id,
        tipo: mode === 'alert' ? 'alert' : 'message'
      })

      if (!response.success || !response.data) {
        console.error('❌ Error enviando mensaje:', response.error)
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
        )
        setInput(savedContent)
        setAttachedFiles(savedFiles)
        return
      }

      const mentions = mode === 'message' ? findMentionedMembers(savedContent) : []

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: response.data!.id.toString(),
                content: response.data!.contenido || finalContent,
                status: 'sent'
              }
            : m
        )
      )

      if (mentions.length > 0) {
        for (const member of mentions) {
          const memberId = Number(member.id)
          if (Number.isNaN(memberId)) continue
          await apiService.createNotification({
            user_id: memberId,
            title: `Te mencionaron en #${currentChannel}`,
            description: savedContent || 'Tienes una mención',
            type: 'mention'
          })
        }
      }

      if (mode === 'alert') {
        for (const member of resolvedMembers) {
          const memberId = Number(member.id)
          if (Number.isNaN(memberId) || memberId === usuario.id) continue
          await apiService.createNotification({
            user_id: memberId,
            title: '🚨 Sirena en chat',
            description: finalContent || 'Revisar mensaje de alerta',
            type: 'warning'
          })
        }
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 1200)
      }
    } catch (error) {
      console.error('❌ Excepción al enviar mensaje:', error)
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
      )
      setInput(savedContent)
      setAttachedFiles(savedFiles)
    } finally {
      setIsSending(false)
    }
  }

  // Detectar menciones @usuario mientras se escribe
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)
    
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
    
    // Detectar @ para autocompletado
    const cursorPosition = e.target.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Si no hay espacio después del @, mostrar sugerencias
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const query = textAfterAt.toLowerCase()
        setMentionQuery(query)
        setMentionStartIndex(lastAtIndex)
        
        // Filtrar usuarios que coincidan
        const filtered = resolvedMembers.filter(
          (member) =>
            member.name.toLowerCase().includes(query) &&
            member.id !== currentUser.id
        )
        setMentionSuggestions(filtered.slice(0, 5))
        setShowMentionSuggestions(filtered.length > 0)
      } else {
        setShowMentionSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
    }
  }

  // Insertar mención seleccionada
  const insertMention = (member: TeamMember) => {
    if (mentionStartIndex === -1) return
    
    const beforeMention = input.substring(0, mentionStartIndex + 1)
    const afterMention = input.substring(mentionStartIndex + 1 + mentionQuery.length)
    const newInput = `${beforeMention}${member.name} ${afterMention}`
    
    setInput(newInput)
    setShowMentionSuggestions(false)
    setMentionQuery('')
    setMentionStartIndex(-1)
    
    // Enfocar el input y posicionar cursor
    setTimeout(() => {
      if (inputRef.current) {
        const cursorPos = mentionStartIndex + 1 + member.name.length + 1
        inputRef.current.focus()
        inputRef.current.setSelectionRange(cursorPos, cursorPos)
      }
    }, 0)
  }

  // Renderizar mensaje con menciones resaltadas
  const renderMessageWithMentions = (content: string) => {
    const parts = content.split(/(@\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1)
        const isMentioned = resolvedMembers.some(
          (m) => m.name.toLowerCase() === username.toLowerCase()
        )
        const isCurrentUser = currentUser.name.toLowerCase() === username.toLowerCase()
        
        return (
          <span
            key={index}
            className={`mention ${isCurrentUser ? 'mention-self' : ''} ${isMentioned ? 'mention-valid' : ''}`}
          >
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Si hay sugerencias de menciones abiertas
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        // TODO: Implementar navegación con flechas
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        // TODO: Implementar navegación con flechas
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionSuggestions[0])
        return
      }
      if (e.key === 'Escape') {
        setShowMentionSuggestions(false)
        return
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files])
      console.log('📎 Archivos seleccionados:', files.map(f => f.name))
    }
    // Resetear el input para permitir seleccionar el mismo archivo de nuevo
    if (event.target) {
      event.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤']

  const handleEmojiClick = (emoji: string) => {
    setInput((prev) => prev + emoji)
    setShowEmojiPicker(false)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Cerrar emoji picker al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showEmojiPicker])

  // Función para reproducir sonido de sirena
  const playAlertSound = () => {
    try {
      // Crear un audio context para generar el sonido de sirena
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Configurar frecuencia de sirena (alternando entre dos tonos)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3)

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.4)
    } catch (error) {
      console.error('Error al reproducir sonido:', error)
    }
  }

  // Función para activar animación de shake
  const triggerShake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 500)
  }

  // Función para enviar zumbido
  const handleSendBuzz = async (targetUserId?: string) => {
    if (!usuario?.id) {
      alert('Debes estar autenticado para enviar un zumbido')
      return
    }

    // Buscar un usuario diferente al actual
    const availableUsers = resolvedMembers.filter((m) => m.id !== currentUser.id)
    if (availableUsers.length === 0) {
      alert('No hay otros usuarios en línea para enviar un zumbido')
      return
    }

    const targetUser = targetUserId 
      ? resolvedMembers.find((m) => m.id === targetUserId && m.id !== currentUser.id)
      : availableUsers[Math.floor(Math.random() * availableUsers.length)]

    if (!targetUser) {
      alert('No se pudo encontrar un usuario destino')
      return
    }

    try {
      const targetUserIdNum = parseInt(targetUser.id)
      if (isNaN(targetUserIdNum)) {
        alert('ID de usuario inválido')
        return
      }

      console.log(`🔔 Enviando zumbido a ${targetUser.name}`)
      const response = await apiService.enviarZumbido(targetUserIdNum, usuario.id, currentChannel)
      
      if (response.success) {
        console.log('✅ Zumbido enviado exitosamente')
        // El mensaje se agregará automáticamente vía Realtime
      } else {
        alert(`Error al enviar zumbido: ${response.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('❌ Error enviando zumbido:', error)
      alert(`Error al enviar zumbido: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  // Función para enviar alerta con sirena (broadcast)
  const handleSendAlert = async () => {
    playAlertSound()
    await handleSendMessage('alert')
  }

  // Efecto para detectar zumbidos y alertas recibidos
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && (lastMessage.type === 'buzz' || lastMessage.type === 'alert')) {
      // Activar si el mensaje es para el usuario actual (no es del usuario actual)
      if (lastMessage.userId !== currentUser.id) {
        triggerShake()
        if (lastMessage.type === 'alert') {
          playAlertSound()
        }
      }
    }
  }, [messages, currentUser.id])

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const shouldShowAvatar = (currentIndex: number) => {
    if (currentIndex === 0) return true
    const currentMsg = messages[currentIndex]
    const previousMsg = messages[currentIndex - 1]
    return (
      currentMsg.userId !== previousMsg.userId ||
      currentMsg.timestamp.getTime() - previousMsg.timestamp.getTime() > 300000 // 5 minutos
    )
  }

  const channelMessages = messages.filter((msg) => msg.channel === currentChannel)

  return (
    <div className={`chat-page ${isShaking ? 'shaking' : ''}`}>
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img 
              src="https://trello.plotcenter.com.ar/Group%20187.png" 
              alt="Plot Center Logo" 
              className="sidebar-logo"
            />
            <h2>Plot Chat</h2>
          </div>
          <button className="back-button-small" onClick={onBack} title="Volver al tablero">
            ←
          </button>
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <span>CANALES</span>
          </div>
          <div className="channels-list">
            {CHANNELS.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item ${currentChannel === channel.id ? 'active' : ''}`}
                onClick={() => setCurrentChannel(channel.id)}
              >
                <span className="channel-name">{channel.name}</span>
                {channel.unread && channel.unread > 0 && (
                  <span className="unread-badge">{channel.unread}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <span>MIEMBROS EN LÍNEA ({resolvedMembers.length})</span>
          </div>
          <div className="members-list">
            {resolvedMembers.map((member) => (
              <div key={member.id} className="member-item">
                <div className="member-avatar">
                  <span>{member.avatar}</span>
                  <span className="online-indicator"></span>
                </div>
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                  <span className="member-role">{member.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="channel-info">
            <h3>{CHANNELS.find((c) => c.id === currentChannel)?.name}</h3>
            <p>{CHANNELS.find((c) => c.id === currentChannel)?.description}</p>
          </div>
          <div className="header-actions">
            <button className="header-action-btn" title="Información del canal">
              ℹ️
            </button>
            <button className="header-action-btn" title="Notificaciones">
              🔔
            </button>
            <button className="header-action-btn" title="Más opciones">
              ⋮
            </button>
          </div>
        </div>

        <div className="messages-container">
          {!usuario?.id && (
            <div style={{ 
              padding: '12px', 
              background: '#ff4d4f', 
              color: 'white', 
              textAlign: 'center',
              margin: '8px',
              borderRadius: '8px'
            }}>
              ⚠️ Debes estar autenticado para usar el chat
            </div>
          )}
          <div className="messages-list">
            {isLoadingMessages ? (
              <div className="empty-state">
                <p>Cargando mensajes...</p>
              </div>
            ) : channelMessages.length === 0 ? (
              <div className="empty-state">
                <p>No hay mensajes en este canal todavía.</p>
                <p className="empty-hint">Sé el primero en escribir algo 👋</p>
                {usuario?.id && (
                  <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
                    Usuario: {usuario.nombre} (ID: {usuario.id})
                  </p>
                )}
              </div>
            ) : (
              channelMessages.map((message, index) => {
                const showAvatar = shouldShowAvatar(index)
                const isCurrentUser = message.userId === currentUser.id

                return (
                  <div
                    key={message.id}
                    className={`message-wrapper ${isCurrentUser ? 'own-message' : ''} ${message.type === 'buzz' ? 'buzz-message' : ''} ${message.type === 'alert' ? 'alert-message' : ''}`}
                  >
                    {showAvatar && (
                      <div className="message-avatar">
                        <span>{message.userAvatar}</span>
                      </div>
                    )}
                    {!showAvatar && <div className="message-spacer"></div>}
                    <div className="message-content">
                      {showAvatar && (
                        <div className="message-header">
                          <span className="message-author">{message.userName}</span>
                          <span className="message-time">{formatMessageTime(message.timestamp)}</span>
                        </div>
                      )}
                      <div className={`message-text ${message.type === 'buzz' ? 'buzz-text' : ''} ${message.type === 'alert' ? 'alert-text' : ''}`}>
                        {renderMessageWithMentions(message.content)}
                        {message.status === 'sending' && <span className="message-status">Enviando…</span>}
                        {message.status === 'error' && <span className="message-status error">Error</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          {attachedFiles.length > 0 && (
            <div className="attached-files-preview">
              {attachedFiles.map((file, index) => (
                <div key={index} className="attached-file-item">
                  <span>📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={() => removeFile(index)} className="remove-file-btn">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="input-wrapper">
            <div className="input-container">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={`Mensaje en ${CHANNELS.find((c) => c.id === currentChannel)?.name} (usa @ para mencionar)`}
                rows={1}
                className="chat-input"
              />
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div className="mention-suggestions" ref={mentionSuggestionsRef}>
                  {mentionSuggestions.map((member) => (
                    <button
                      key={member.id}
                      className="mention-suggestion-item"
                      onClick={() => insertMention(member)}
                      type="button"
                    >
                      <span className="mention-avatar">{member.avatar}</span>
                      <span className="mention-name">{member.name}</span>
                      <span className="mention-role">{member.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="input-actions">
              <button
                className="input-action-btn buzz-btn"
                onClick={() => handleSendBuzz()}
                title="Enviar zumbido"
                disabled={!usuario?.id}
              >
                🔔
              </button>
              <button
                className="input-action-btn alert-btn"
                onClick={() => handleSendAlert()}
                title="Enviar alerta con sirena"
                disabled={!usuario?.id || isSending}
              >
                🚨
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*,application/pdf,.txt,.doc,.docx"
              />
              <button
                className="input-action-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar archivo"
                disabled={!usuario?.id || isSending}
              >
                📎
              </button>
              <div className="emoji-picker-wrapper" ref={emojiPickerRef}>
                <button
                  className={`input-action-btn ${showEmojiPicker ? 'active' : ''}`}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emoji"
                  disabled={!usuario?.id}
                >
                  😊
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker">
                    <div className="emoji-grid">
                      {emojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          className="emoji-item"
                          onClick={() => handleEmojiClick(emoji)}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="send-group">
                <button
                  className="input-action-btn alert-btn"
                  onClick={() => handleSendAlert()}
                  title="Sirena (alerta a todos)"
                  disabled={!usuario?.id || isSending}
                >
                  🚨 Sirena
                </button>
                <button
                  className="send-button"
                  onClick={() => handleSendMessage()}
                  disabled={!usuario?.id || isSending || (!input.trim() && attachedFiles.length === 0)}
                  title="Enviar (Enter)"
                >
                  {isSending ? '…' : '➤'}
                </button>
              </div>
            </div>
          </div>
          <div className="input-hint">
            <span>Enter: enviar • Shift+Enter: salto de línea • 🚨 Sirena: alerta a todos</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPage

