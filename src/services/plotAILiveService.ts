import { GoogleGenAI, Modality } from '@google/genai'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

export interface LiveVoiceCallbacks {
  onOpen?: () => void
  onMessage?: (message: any) => void
  onError?: (error: Error) => void
  onClose?: (reason?: string) => void
  onAudioChunk?: (audioData: ArrayBuffer) => void
}

export class PlotAILiveVoice {
  private ai: GoogleGenAI | null = null
  private session: any = null
  private audioContext: AudioContext | null = null
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

  async startCall(callbacks: LiveVoiceCallbacks): Promise<void> {
    if (!this.ai) {
      throw new Error('GoogleGenAI no inicializado. Verifica VITE_GEMINI_API_KEY')
    }

    this.callbacks = callbacks

    try {
      // Configurar AudioContext para reproducir audio
      this.audioContext = new AudioContext({ sampleRate: 24000 })

      // Conectar a Gemini Live API
      const model = 'gemini-2.5-flash-native-audio-preview-12-2025'
      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: 'Eres PlotAI, un asistente inteligente y conversacional. Responde de forma natural y amigable, como en una conversación telefónica.',
      }

      this.session = await this.ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('🔊 Conectado a Gemini Live API')
            this.callbacks.onOpen?.()
          },
          onmessage: (message: any) => {
            this.handleMessage(message)
            this.callbacks.onMessage?.(message)
          },
          onerror: (error: any) => {
            console.error('Error en Live API:', error)
            const err = error instanceof Error ? error : new Error(String(error))
            this.callbacks.onError?.(err)
          },
          onclose: (event: any) => {
            console.log('🔇 Conexión cerrada:', event?.reason || 'Desconocido')
            this.callbacks.onClose?.(event?.reason)
          },
        },
      })

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
        },
      })

      const audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(this.mediaStream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convertir Float32Array a PCM 16-bit
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Convertir a base64 y enviar a Gemini Live
        const base64Audio = this.arrayBufferToBase64(pcmData.buffer)
        
        if (this.session) {
          this.session.sendRealtimeInput({
            audio: {
              data: base64Audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          })
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log('🎙️ Micrófono iniciado')
    } catch (error) {
      console.error('Error iniciando micrófono:', error)
      throw error
    }
  }

  private handleMessage(message: any): void {
    // Procesar mensajes de audio de Gemini
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          // Audio recibido de Gemini
          const audioData = this.base64ToArrayBuffer(part.inlineData.data)
          this.audioQueue.push(audioData)
        }
      }
    }
  }

  private async startAudioPlayback(): Promise<void> {
    const playNextChunk = async () => {
      if (this.audioQueue.length > 0 && !this.isPlaying && this.audioContext) {
        this.isPlaying = true
        const audioData = this.audioQueue.shift()!

        try {
          const audioBuffer = await this.audioContext.decodeAudioData(audioData)
          const source = this.audioContext.createBufferSource()
          source.buffer = audioBuffer
          source.connect(this.audioContext.destination)

          source.onended = () => {
            this.isPlaying = false
            playNextChunk()
          }

          source.start(0)
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
}

