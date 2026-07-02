import { GoogleGenAI, Modality } from '@google/genai'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'
const LIVE_CONFIG_PATH = '/api/plotai/live-voice'
const TOTEM_CONTEXT_PATH = '/api/plotai/totem-live-context'

export type TotemLiveContextPayload = {
  contextBlock: string
  fingerprint: string
  plotCenterKnowledge?: string
  numeroOp?: string | null
}

export async function fetchTotemLiveContext(
  userTexts: string[],
  options?: {
    modo?: string
    nombre?: string
    empresa?: string
    dni?: string
    cuit?: string
    op?: string
  }
): Promise<TotemLiveContextPayload> {
  const res = await fetch(plotLabApiUrl(TOTEM_CONTEXT_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userTexts: userTexts.slice(-24),
      modo: options?.modo || 'totem',
      nombre: options?.nombre,
      empresa: options?.empresa,
      dni: options?.dni,
      cuit: options?.cuit,
      op: options?.op
    })
  })
  const data = (await res.json().catch(() => ({}))) as TotemLiveContextPayload & {
    success?: boolean
    error?: string
  }
  if (!res.ok || !data.contextBlock) {
    throw new Error(data.error || 'No se pudo cargar el contexto de OPs y clientes')
  }
  return {
    contextBlock: data.contextBlock,
    fingerprint: data.fingerprint || data.contextBlock.slice(0, 200),
    plotCenterKnowledge: data.plotCenterKnowledge,
    numeroOp: data.numeroOp ?? null
  }
}

function buildTotemLiveSystemInstruction(contextBlock?: string, plotCenterKnowledge?: string): string {
  const knowledge = (plotCenterKnowledge || '').trim() || `
EMPRESA: Plot Center — comunicación visual integral en San Juan Argentina.
Dirección: 9 de Julio 622 (Oeste). Teléfono: 2646212163. Email: contacto@plotcenter.com.ar.
Horarios: lun a vie 9 a 19 hs, sábados 9 a 14 hs.
`.trim()

  const clienteBlock = contextBlock?.trim()
    ? `

${contextBlock}

REGLAS SOBRE OPs Y CLIENTES (obligatorio):
- Citá SOLO números de OP estados fechas y ubicaciones que aparezcan arriba.
- Si dice que no se encontró la OP o el cliente decilo sin inventar.
- Cuando diga LISTO PARA RETIRO avisá que puede pasar a retirar por 9 de Julio 622.
- Si aún no hay nombre DNI ni OP pedilos solo cuando pregunte por su trabajo.`
    : `

Aún no hay datos del cliente en el sistema para esta charla. Si pregunta por su pedido pedile nombre DNI CUIT o número de OP para buscarlo.`

  return `Sos PlotAI el asistente de voz del mostrador de Plot Center en un tótem con pantalla táctil en recepción.

IDIOMA: SIEMPRE español argentino natural para voz. Nunca inglés.

PERSONALIDAD: cordial cálida servicial como buena atención en mostrador. Frases completas que suenen bien al hablar en voz alta. No seas robótica ni telegráfica.

CONOCIMIENTO DE LA EMPRESA (solo esta info para datos de Plot Center):
${knowledge}
${clienteBlock}

REGLAS DE VOZ (obligatorio):
- No uses markdown asteriscos listas con guiones ni emojis.
- Evitá comas y puntos innecesarios; uní ideas con "y" o pausas naturales.
- Respuestas concisas: una a tres frases salvo que el cliente pida detalle.
- NUNCA inventes precios fechas de entrega ni números de OP.
- Orientá sobre sectores: diseño gráfico y marketing en 1° piso impresión y mostrador en planta baja.
- Si piden dibujar o ver una imagen deciles que la vas a mostrar en pantalla.

SALUDO INICIAL: cuando el cliente se acerca saludá breve presentándote como PlotAI de Plot Center y preguntá en qué podés ayudar hoy.`
}

export interface TotemLiveCallbacks {
  onOpen?: () => void
  onUserTranscript?: (text: string) => void
  onModelTranscript?: (text: string) => void
  onSpeakingChange?: (speaking: boolean) => void
  onError?: (error: Error) => void
  onClose?: (reason?: string) => void
}

export async function fetchTotemGeminiApiKey(): Promise<string> {
  const fromEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
  if (fromEnv) return fromEnv

  const res = await fetch(plotLabApiUrl(LIVE_CONFIG_PATH))
  const data = (await res.json().catch(() => ({}))) as { apiKey?: string; error?: string }
  if (!res.ok || !data.apiKey) {
    throw new Error(
      data.error ||
        'Gemini Live no configurado. Agregá GEMINI_API_KEY en Vercel o VITE_GEMINI_API_KEY en local.'
    )
  }
  return data.apiKey
}

export type TotemLiveStartOptions = {
  callbacks: TotemLiveCallbacks
  initialContext?: TotemLiveContextPayload
  /** Stream ya autorizado en el gesto del usuario (tap). */
  micStream?: MediaStream
  /** Reemplaza el prompt del tótem (p. ej. chat web embebido). */
  systemInstruction?: string
}

export class TotemPlotAILive {
  private ai: GoogleGenAI
  private session: any = null
  private audioContext: AudioContext | null = null
  private micAudioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false
  private wasSpeaking = false
  private callbacks: TotemLiveCallbacks = {}
  private playbackTimer: ReturnType<typeof setInterval> | null = null

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey })
  }

  async start(options: TotemLiveStartOptions): Promise<void> {
    const { callbacks, initialContext, micStream, systemInstruction: customInstruction } = options
    this.callbacks = callbacks

    await this.startMicrophone(micStream)

    this.audioContext = new AudioContext({ sampleRate: 24000 })
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    const systemInstruction =
      customInstruction?.trim() ||
      buildTotemLiveSystemInstruction(
        initialContext?.contextBlock,
        initialContext?.plotCenterKnowledge
      )

    this.session = await this.ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
        },
        generationConfig: { temperature: 0.88 }
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onOpen?.()
        },
        onmessage: (message: unknown) => {
          this.handleMessage(message)
        },
        onerror: (error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error))
          this.callbacks.onError?.(err)
        },
        onclose: (event: { reason?: string }) => {
          this.callbacks.onClose?.(event?.reason)
        }
      }
    })

    this.startAudioPlaybackLoop()
  }

  sendTextTurn(text: string): void {
    if (!this.session || !text.trim()) return
    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: text.trim() }] }],
        turnComplete: true
      })
    } catch (e) {
      console.warn('[TotemPlotAILive] sendTextTurn:', e)
    }
  }

  sendGreetingNudge(): void {
    this.sendTextTurn(
      '[El cliente se acercó al tótem del mostrador. Saludalo con una frase breve y cálida en español argentino presentándote como PlotAI de Plot Center y preguntale en qué podés ayudarlo hoy.]'
    )
  }

  /** Inyecta OP/cliente/precios actualizados mid-session (misma fuente que chat-public). */
  injectContextUpdate(contextBlock: string): void {
    const block = contextBlock.trim()
    if (!block) return
    this.sendTextTurn(
      `[CONTEXTO ACTUALIZADO DEL SISTEMA — usá SOLO estos datos reales para OPs pedidos ubicación y precios. No inventes nada que no figure acá:\n${block}]`
    )
  }

  stop(): void {
    if (this.playbackTimer != null) {
      clearInterval(this.playbackTimer)
      this.playbackTimer = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }

    if (this.micAudioContext) {
      void this.micAudioContext.close()
      this.micAudioContext = null
    }

    if (this.session) {
      try {
        this.session.close()
      } catch {
        /* noop */
      }
      this.session = null
    }

    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }

    this.audioQueue = []
    this.isPlaying = false
    this.updateSpeakingState()
  }

  private async startMicrophone(existingStream?: MediaStream): Promise<void> {
    if (existingStream) {
      this.mediaStream = existingStream
    } else {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      })
    }

    const audioContext = new AudioContext({ sampleRate: 16000 })
    this.micAudioContext = audioContext
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const source = audioContext.createMediaStreamSource(this.mediaStream)
    const sink = audioContext.createGain()
    sink.gain.value = 0
    sink.connect(audioContext.destination)

    let processor: ScriptProcessorNode | AudioWorkletNode

    try {
      await audioContext.audioWorklet.addModule(
        URL.createObjectURL(
          new Blob(
            [
              `class AudioProcessor extends AudioWorkletProcessor {
                process(inputs) {
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
              registerProcessor('totem-audio-processor', AudioProcessor)`
            ],
            { type: 'application/javascript' }
          )
        )
      )
      const worklet = new AudioWorkletNode(audioContext, 'totem-audio-processor')
      worklet.port.onmessage = (event: MessageEvent<{ audioData: ArrayBuffer }>) => {
        this.sendAudioChunk(event.data.audioData)
      }
      worklet.connect(sink)
      source.connect(worklet)
      processor = worklet
    } catch {
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        this.sendAudioChunk(pcmData.buffer)
      }
      scriptProcessor.connect(sink)
      source.connect(scriptProcessor)
      processor = scriptProcessor
    }

    void processor
  }

  private sendAudioChunk(audioBuffer: ArrayBuffer): void {
    if (!this.session) return
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: this.arrayBufferToBase64(audioBuffer),
          mimeType: 'audio/pcm;rate=16000'
        }
      })
    } catch (e) {
      console.warn('[TotemPlotAILive] sendAudioChunk:', e)
    }
  }

  private handleMessage(message: unknown): void {
    const msg = message as {
      serverContent?: {
        inputTranscription?: { text?: string }
        outputTranscription?: { text?: string }
        modelTurn?: { parts?: Array<{ text?: string; inlineData?: { data?: string } }> }
        interrupted?: boolean
        turnComplete?: boolean
      }
    }

    const inputTx = msg.serverContent?.inputTranscription?.text?.trim()
    if (inputTx) this.callbacks.onUserTranscript?.(inputTx)

    const outputTx = msg.serverContent?.outputTranscription?.text?.trim()
    if (outputTx) this.callbacks.onModelTranscript?.(outputTx)

    if (msg.serverContent?.interrupted) {
      this.audioQueue = []
      this.isPlaying = false
      this.updateSpeakingState()
    }

    const parts = msg.serverContent?.modelTurn?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.audioQueue.push(this.base64ToArrayBuffer(part.inlineData.data))
          this.updateSpeakingState()
          void this.playNextAudioChunk()
        }
      }
    }

    if (msg.serverContent?.turnComplete && this.audioQueue.length === 0 && !this.isPlaying) {
      this.updateSpeakingState()
    }
  }

  private startAudioPlaybackLoop(): void {
    if (this.playbackTimer != null) return
    this.playbackTimer = setInterval(() => {
      if (!this.isPlaying && this.audioQueue.length > 0) {
        void this.playNextAudioChunk()
      }
    }, 40)
  }

  private async playNextAudioChunk(): Promise<void> {
    if (this.isPlaying || !this.audioContext || this.audioQueue.length === 0) return

    this.isPlaying = true
    this.updateSpeakingState()

    const audioData = this.audioQueue.shift()!
    try {
      const sampleRate = 24000
      const length = audioData.byteLength / 2
      const audioBuffer = this.audioContext.createBuffer(1, length, sampleRate)
      const pcmData = new Int16Array(audioData)
      const channelData = audioBuffer.getChannelData(0)
      for (let i = 0; i < length; i++) {
        channelData[i] = pcmData[i] / 32768
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.onended = () => {
        this.isPlaying = false
        this.updateSpeakingState()
        if (this.audioQueue.length > 0) void this.playNextAudioChunk()
      }
      source.start(0)
    } catch (e) {
      console.warn('[TotemPlotAILive] playNextAudioChunk:', e)
      this.isPlaying = false
      this.updateSpeakingState()
    }
  }

  private updateSpeakingState(): void {
    const speaking = this.isPlaying || this.audioQueue.length > 0
    if (speaking !== this.wasSpeaking) {
      this.wasSpeaking = speaking
      this.callbacks.onSpeakingChange?.(speaking)
    }
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
