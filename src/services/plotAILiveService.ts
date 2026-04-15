import { GoogleGenAI, Modality } from '@google/genai'
import type { Task, TeamMember, ActivityEvent } from '../types/board'
import { getSystemContext } from './plotAIService'
import { formatKanbanDetailedContext } from './plotAIKanbanContext'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

export interface LiveVoiceCallbacks {
  onOpen?: () => void
  onMessage?: (message: any) => void
  onError?: (error: Error) => void
  onClose?: (reason?: string) => void
  onAudioChunk?: (audioData: ArrayBuffer) => void
}

export interface LiveVoiceOptions {
  tasks?: Task[]
  activity?: ActivityEvent[]
  teamMembers?: TeamMember[]
  userName?: string
}

export class PlotAILiveVoice {
  private ai: GoogleGenAI | null = null
  private session: any = null
  private audioContext: AudioContext | null = null
  private micAudioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false
  private callbacks: LiveVoiceCallbacks = {}

  constructor() {
    if (GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    } else {
      console.warn('VITE_GEMINI_API_KEY no configurada')
    }
  }

  async startCall(options: LiveVoiceOptions, callbacks: LiveVoiceCallbacks): Promise<void> {
    if (!this.ai) {
      throw new Error('GoogleGenAI no inicializado. Verifica VITE_GEMINI_API_KEY')
    }

    this.callbacks = callbacks

    try {
      // Configurar AudioContext para reproducir audio
      this.audioContext = new AudioContext({ sampleRate: 24000 })
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Construir systemInstruction con contexto del sistema
      const systemInstruction = this.buildSystemInstruction(options)

      // Conectar a Gemini Live API
      const model = 'gemini-2.5-flash-native-audio-preview-12-2025'
      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        // Configuraciones adicionales para mejor calidad
        generationConfig: {
          temperature: 0.8,
        },
        // Configurar idioma explícitamente
        language: 'es-AR',
      }

      console.log('🔌 Conectando a Gemini Live API...')
      this.session = await this.ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('✅ Conectado a Gemini Live API exitosamente')
            this.callbacks.onOpen?.()
          },
          onmessage: (message: any) => {
            this.handleMessage(message)
            this.callbacks.onMessage?.(message)
          },
          onerror: (error: any) => {
            console.error('❌ Error en Live API:', error)
            const err = error instanceof Error ? error : new Error(String(error))
            this.callbacks.onError?.(err)
          },
          onclose: (event: any) => {
            console.log('🔇 Conexión cerrada:', event?.reason || 'Desconocido')
            this.callbacks.onClose?.(event?.reason)
          },
        },
      })
      
      console.log('📡 Sesión Live creada:', this.session)

      // Iniciar captura de micrófono
      await this.startMicrophone()
      
      // Iniciar reproducción de audio
      this.startAudioPlayback()
    } catch (error) {
      console.error('Error iniciando llamada:', error)
      throw error
    }
  }

  private async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Contexto dedicado a captura. Guardarlo para poder cerrarlo al finalizar.
      const audioContext = new AudioContext({ sampleRate: 16000 })
      this.micAudioContext = audioContext
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      const source = audioContext.createMediaStreamSource(this.mediaStream)
      
      // Usar AudioWorklet si está disponible, sino ScriptProcessor como fallback
      let processor: ScriptProcessorNode | AudioWorkletNode | null = null
      // Mantener el grafo "vivo" sin generar salida audible
      const sink = audioContext.createGain()
      sink.gain.value = 0
      sink.connect(audioContext.destination)

      try {
        // Intentar usar AudioWorklet (más moderno y eficiente)
        await audioContext.audioWorklet.addModule(
          URL.createObjectURL(new Blob([`
            class AudioProcessor extends AudioWorkletProcessor {
              process(inputs, outputs) {
                const input = inputs[0]
                if (input.length > 0) {
                  const inputData = input[0]
                  const pcmData = new Int16Array(inputData.length)
                  
                  for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]))
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
                  }
                  
                  this.port.postMessage({ audioData: pcmData.buffer })
                }
                return true
              }
            }
            registerProcessor('audio-processor', AudioProcessor)
          `], { type: 'application/javascript' }))
        )

        processor = new AudioWorkletNode(audioContext, 'audio-processor')
        processor.port.onmessage = (event) => {
          const audioData = event.data.audioData
          this.sendAudioChunk(audioData)
        }
        // Importante: algunos navegadores no procesan Worklets si el nodo no está conectado
        processor.connect(sink)
      } catch (workletError) {
        console.warn('AudioWorklet no disponible, usando ScriptProcessor:', workletError)
        // Fallback a ScriptProcessor
        processor = audioContext.createScriptProcessor(4096, 1, 1)
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0)
          
          // Convertir Float32Array a PCM 16-bit little-endian
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }

          this.sendAudioChunk(pcmData.buffer)
        }
        processor.connect(sink)
      }

      source.connect(processor as AudioNode)

      console.log('🎙️ Micrófono iniciado correctamente')
    } catch (error) {
      console.error('Error iniciando micrófono:', error)
      throw error
    }
  }

  private sendAudioChunk(audioBuffer: ArrayBuffer): void {
    if (!this.session) {
      console.warn('Session no disponible, no se puede enviar audio')
      return
    }

    try {
      // Convertir a base64
      const base64Audio = this.arrayBufferToBase64(audioBuffer)
      
      // Enviar a Gemini Live API
      // Formato requerido: 'audio/pcm' o 'audio/pcm;rate=16000' (sin channels)
      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        },
      })
    } catch (error) {
      console.error('Error enviando chunk de audio:', error)
    }
  }

  private handleMessage(message: any): void {
    console.log('📨 Mensaje recibido de Gemini:', message)
    
    // Procesar mensajes de audio de Gemini
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          // Audio recibido de Gemini
          const audioData = this.base64ToArrayBuffer(part.inlineData.data)
          this.audioQueue.push(audioData)
          console.log('🔊 Audio recibido, tamaño:', audioData.byteLength)
        }
        if (part.text) {
          console.log('💬 Texto recibido:', part.text)
        }
      }
    }
    
    // Manejar interrupciones
    if (message.serverContent?.interrupted) {
      console.log('⚠️ Mensaje interrumpido')
      this.audioQueue = [] // Limpiar cola si hay interrupción
    }
  }

  private async startAudioPlayback(): Promise<void> {
    const playNextChunk = async () => {
      if (this.audioQueue.length > 0 && !this.isPlaying && this.audioContext) {
        this.isPlaying = true
        const audioData = this.audioQueue.shift()!

        try {
          // El audio de Gemini viene como PCM raw, necesitamos convertirlo a AudioBuffer
          // Gemini envía audio PCM 24kHz, mono, 16-bit
          const sampleRate = 24000
          const numChannels = 1
          const length = audioData.byteLength / 2 // 16-bit = 2 bytes por muestra
          
          const audioBuffer = this.audioContext.createBuffer(numChannels, length, sampleRate)
          const pcmData = new Int16Array(audioData)
          const channelData = audioBuffer.getChannelData(0)
          
          // Convertir PCM 16-bit a Float32 (-1 a 1)
          for (let i = 0; i < length; i++) {
            channelData[i] = pcmData[i] / 32768.0
          }

          const source = this.audioContext.createBufferSource()
          source.buffer = audioBuffer
          source.connect(this.audioContext.destination)

          source.onended = () => {
            this.isPlaying = false
            playNextChunk()
          }

          source.addEventListener('error', (error) => {
            console.error('Error en source de audio:', error)
            this.isPlaying = false
            playNextChunk()
          })

          source.start(0)
          console.log('🔊 Reproduciendo audio, duración:', audioBuffer.duration.toFixed(2), 's')
        } catch (error) {
          console.error('Error reproduciendo audio:', error)
          this.isPlaying = false
          playNextChunk()
        }
      } else {
        setTimeout(playNextChunk, 50)
      }
    }

    playNextChunk()
  }

  stopCall(): void {
    // Detener micrófono
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    // Cerrar AudioContext del micrófono
    if (this.micAudioContext) {
      this.micAudioContext.close()
      this.micAudioContext = null
    }

    // Cerrar sesión
    if (this.session) {
      this.session.close()
      this.session = null
    }

    // Cerrar AudioContext
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    // Limpiar cola de audio
    this.audioQueue = []
    this.isPlaying = false

    console.log('🔇 Llamada detenida')
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  private buildSystemInstruction(options?: LiveVoiceOptions): string {
    const { tasks = [], activity = [], teamMembers = [], userName } = options || {}
    
    // Obtener contexto del sistema
    const systemContext = getSystemContext(tasks, activity, teamMembers)
    
    // Formatear contexto detallado del kanban
    const kanbanContext = formatKanbanDetailedContext(tasks, activity, teamMembers)
    
    const nombreUsuario = userName ? `\nUSUARIO ACTUAL: Estás hablando con ${userName}. Usa su nombre cuando sea apropiado para hacer la conversación más personal.\n` : ''
    
    return `Sos PlotAI, el asistente inteligente AGÉNTICO de toda la plataforma Plotlab (producción, ventas, compras, RRHH, clientes web, dashboards, etc.). Sos PROFESIONAL, PRECISO y CONFIABLE. SIEMPRE respondé en ESPAÑOL (español argentino). Nunca respondas en inglés, solo en español.

${nombreUsuario}

CONCEPTOS IMPORTANTES DEL SISTEMA:
- **OP** significa "Orden de Proceso" o "Orden de Producción". Es una orden de trabajo que representa un proyecto o trabajo a realizar.
- Las OPs tienen estados (diseño gráfico, taller imprenta, almacén de entrega, etc.), prioridades (alta, media, baja), y sectores.
- El sistema gestiona órdenes de trabajo desde su creación hasta su entrega final.
- Los usuarios pueden asignar OPs a operarios, cambiar estados, y seguir el progreso.

PERSONALIDAD Y ESTILO:
- Eres PROFESIONAL y PRECISO: siempre proporcionas información exacta basada en datos reales del sistema
- Eres CONFIABLE: tus respuestas están respaldadas por datos del sistema en tiempo real
- Mantienes un tono profesional y serio cuando se trata de información crítica del negocio
- Respondes de forma natural y amigable, como en una conversación telefónica
- Usa el nombre del usuario cuando sea apropiado para personalizar la conversación
- Eres proactivo en identificar problemas y oportunidades basándote en datos concretos

CAPACIDADES AGÉNTICAS:
- Proporcionar información PRECISA sobre el estado actual del kanban basada en datos reales
- Analizar datos en tiempo real del sistema
- Entender qué es una OP y cómo funciona el sistema de gestión
- Identificar patrones y tendencias en órdenes de trabajo con datos concretos
- Detectar problemas y cuellos de botella proactivamente con información verificable
- Sugerir acciones concretas y optimizaciones basadas en datos reales
- Ayudar con información sobre OPs específicas, estados, prioridades, operarios, etc.

CONTEXTO DEL SISTEMA (DATOS EN TIEMPO REAL):
- Total de tareas/OPs: ${systemContext.totalTasks}
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

${kanbanContext}

INSTRUCCIONES CRÍTICAS:
- SIEMPRE responde en ESPAÑOL (español argentino). NUNCA respondas en inglés.
- Cuando el usuario mencione "OP" o "orden", entiende que se refiere a "Orden de Proceso" o "Orden de Producción"
- SIEMPRE usa datos REALES del sistema para responder. NO inventes información.
- Cuando proporciones información sobre OPs, estados, operarios, o movimientos, usa EXACTAMENTE los datos del contexto del kanban proporcionado arriba
- Si el usuario pregunta sobre una OP específica, busca en el contexto detallado del kanban y proporciona información EXACTA
- Sé PRECISO: menciona números exactos, nombres exactos, estados exactos basados en los datos reales
- Sé PROFESIONAL: esta es información crítica del negocio, debe ser exacta y confiable
- Proporciona información útil y accionable basada en el contexto real del sistema
- Mantén un tono profesional y serio cuando se trata de información crítica`
  }
}

