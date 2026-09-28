import { GoogleGenAI, Modality, Type, type LiveConnectConfig, type Tool } from '@google/genai'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import { fetchGeminiLiveApiKey } from './geminiLiveKey'

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'
const TOTEM_CONTEXT_PATH = '/api/plotai/totem-live-context'

export type TotemLiveContextPayload = {
  contextBlock: string
  fingerprint: string
  plotCenterKnowledge?: string
  voiceSystemInstruction?: string
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
    telefono?: string
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
      op: options?.op,
      telefono: options?.telefono,
      whatsapp: options?.telefono
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
    voiceSystemInstruction: data.voiceSystemInstruction,
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
- Citá SOLO números de OP estados fechas y ubicaciones que aparezcan arriba o que devuelva la herramienta consultar_orden.
- Si dice que no se encontró la OP o el cliente decilo sin inventar.
- Cuando diga LISTO PARA RETIRO avisá que puede pasar a retirar por 9 de Julio 622.`
    : ''

  return `Sos PlotAI el asistente de voz del mostrador de Plot Center en un tótem con pantalla táctil en recepción. Estás hablando en vivo con una persona parada frente al tótem.

IDIOMA: SIEMPRE español argentino natural para voz. Nunca inglés.

PERSONALIDAD: simpática cálida y servicial como la mejor atención de mostrador. Hablá como una persona real: frases completas y naturales, con calidez, sin sonar robótica ni telegráfica. Usá el voseo. Podés hacer alguna broma suave si el cliente está relajado.

CONOCIMIENTO DE LA EMPRESA (solo esta info para datos de Plot Center):
${knowledge}
${clienteBlock}

HERRAMIENTAS (usalas siempre que corresponda, no adivines):
- consultar_precios: cada vez que pregunten cuánto sale algo llamala ANTES de responder, con el producto y la cantidad que dijo. Cotizá SOLO con lo que devuelva. Decí el precio unitario y el total si hay cantidad. Si el producto no figura decilo con honestidad y ofrecé que mostrador lo cotice. Si hay muchas opciones nombrá las dos o tres más parecidas y ofrecé seguir con otras.
- consultar_orden: cuando den un número de OP un DNI un CUIT o un nombre para saber cómo va su trabajo llamala con esos datos y contale el estado real.
- mostrar_imagen: si piden dibujar generar imaginar o ver una imagen o foto llamala con una descripción detallada en español y decile en una frase que ya la estás preparando en pantalla. Cuando el sistema te avise que ya está en pantalla confirmalo brevemente.
- Mientras esperás el resultado de una herramienta no te quedes callada: decí algo corto como "ya te lo busco".

REGLAS DE VOZ (obligatorio):
- No uses markdown asteriscos listas con guiones ni emojis.
- Respuestas concisas de una a tres frases salvo que el cliente pida detalle. Una sola pregunta por vez.
- Los importes decilos en voz natural: por ejemplo "novecientos cuarenta pesos con cincuenta".
- NUNCA inventes precios plazos de entrega descuentos ni números de OP. Si no tenés el dato decilo y derivá a mostrador o al 2646212163.
- Orientá sobre sectores: diseño gráfico y marketing en 1° piso impresión y mostrador en planta baja.
- La conversación la termina el cliente: no te despidas ni cierres vos salvo que el cliente se despida. Si hay silencio esperá sin repetir lo que dijiste.
- Si no entendiste algo pedí que lo repita con amabilidad.

SALUDO INICIAL: cuando el cliente se acerca saludá breve presentándote como PlotAI de Plot Center y preguntá en qué podés ayudar hoy.`
}

export interface TotemLiveCallbacks {
  onOpen?: () => void
  onUserTranscript?: (text: string) => void
  onModelTranscript?: (text: string) => void
  onSpeakingChange?: (speaking: boolean) => void
  /**
   * Si se define, el modelo recibe las herramientas mostrar_imagen, consultar_precios y consultar_orden.
   * La respuesta vuelve al modelo como resultado de la herramienta.
   */
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** true mientras se reconecta la sesión de voz sin cortar la conversación. */
  onReconnecting?: (reconnecting: boolean) => void
  onError?: (error: Error) => void
  onClose?: (reason?: string) => void
}

export async function fetchTotemGeminiApiKey(): Promise<string> {
  return fetchGeminiLiveApiKey()
}

export type TotemLiveStartOptions = {
  callbacks: TotemLiveCallbacks
  initialContext?: TotemLiveContextPayload
  /** Stream ya autorizado en el gesto del usuario (tap). */
  micStream?: MediaStream
  /** Reemplaza el prompt del tótem (p. ej. chat web embebido). */
  systemInstruction?: string
}

const TOTEM_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'mostrar_imagen',
        description:
          'Genera una imagen y la muestra en la pantalla del tótem. Usala cuando el cliente pida dibujar, generar, imaginar o ver una imagen o foto.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            descripcion: {
              type: Type.STRING,
              description: 'Descripción detallada de la imagen en español: sujeto, estilo, colores y ambiente.'
            }
          },
          required: ['descripcion']
        }
      },
      {
        name: 'consultar_precios',
        description:
          'Busca en la Lista 1 de precios de Plot Center y devuelve importes reales. Usala siempre que el cliente pregunte cuánto sale, cuánto cuesta o pida una cotización de un producto o servicio.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            producto: {
              type: Type.STRING,
              description: 'Producto o servicio con sus detalles, por ejemplo "impresiones A4 color papel ilustración" o "stickers".'
            },
            cantidad: { type: Type.NUMBER, description: 'Cantidad pedida si el cliente la dijo.' }
          },
          required: ['producto']
        }
      },
      {
        name: 'consultar_orden',
        description:
          'Busca una orden de trabajo (OP) o los trabajos de un cliente y devuelve su estado real. Usala cuando el cliente dé un número de OP, DNI, CUIT o nombre para saber cómo va su pedido.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            numero_op: { type: Type.STRING, description: 'Número de OP si lo dijo.' },
            dni: { type: Type.STRING, description: 'DNI si lo dijo.' },
            cuit: { type: Type.STRING, description: 'CUIT si lo dijo.' },
            nombre: { type: Type.STRING, description: 'Nombre o empresa si lo dijo.' }
          }
        }
      }
    ]
  }
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class TotemPlotAILive {
  private ai: GoogleGenAI
  private session: any = null
  private sessionSeq = 0
  private stopped = false
  private reconnecting = false
  private resumeHandle: string | null = null
  private systemInstruction = ''
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

  private buildConfig(): LiveConnectConfig {
    const cb = this.callbacks
    return {
      responseModalities: [Modality.AUDIO],
      systemInstruction: this.systemInstruction,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
      },
      // sin estas dos, Gemini nunca manda lo que dijo la persona y onUserTranscript no se dispara
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // sin compresión las sesiones de solo audio se cortan a los pocos minutos
      contextWindowCompression: { slidingWindow: {} },
      // permite retomar la misma conversación si el servidor cierra la conexión
      sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
      // espera un poco más de silencio antes de darle el turno al modelo: no le corta la frase a la persona
      realtimeInputConfig: {
        automaticActivityDetection: { silenceDurationMs: 900, prefixPaddingMs: 200 }
      },
      ...(cb.onToolCall ? { tools: TOTEM_TOOLS } : {}),
      generationConfig: { temperature: 0.85 }
    }
  }

  private async openSession(): Promise<void> {
    const seq = ++this.sessionSeq
    const session = await this.ai.live.connect({
      model: LIVE_MODEL,
      config: this.buildConfig(),
      callbacks: {
        onopen: () => {
          /* onOpen se dispara desde start() cuando this.session ya existe */
        },
        onmessage: (message: unknown) => {
          if (seq !== this.sessionSeq) return
          this.handleMessage(message)
        },
        onerror: (error: unknown) => {
          if (seq !== this.sessionSeq) return
          const err = error instanceof Error ? error : new Error(String(error))
          if (this.reconnecting) return
          this.callbacks.onError?.(err)
        },
        onclose: (event: { reason?: string }) => {
          if (seq !== this.sessionSeq) return
          if (this.stopped) {
            this.callbacks.onClose?.(event?.reason)
            return
          }
          void this.reconnect(event?.reason)
        }
      }
    })
    if (seq !== this.sessionSeq || this.stopped) {
      try {
        session.close()
      } catch {
        /* noop */
      }
      return
    }
    this.session = session
  }

  /** Reabre la sesión con el handle de reanudación para que la conversación siga sin cortarse. */
  private async reconnect(reason?: string): Promise<void> {
    if (this.reconnecting || this.stopped) return
    this.reconnecting = true
    this.callbacks.onReconnecting?.(true)
    const old = this.session
    this.session = null
    this.sessionSeq++
    try {
      old?.close()
    } catch {
      /* noop */
    }

    let ok = false
    for (let attempt = 1; attempt <= 5 && !this.stopped; attempt++) {
      await sleep(500 * attempt)
      if (this.stopped) break
      try {
        await this.openSession()
        ok = !!this.session
        if (ok) break
      } catch (e) {
        console.warn(`[TotemPlotAILive] reconexión ${attempt}/5 falló:`, e)
      }
    }

    this.reconnecting = false
    this.callbacks.onReconnecting?.(false)
    if (!ok && !this.stopped) this.callbacks.onClose?.(reason)
  }

  async start(options: TotemLiveStartOptions): Promise<void> {
    const { callbacks, initialContext, micStream, systemInstruction: customInstruction } = options
    this.callbacks = callbacks
    this.stopped = false

    await this.startMicrophone(micStream)

    this.audioContext = new AudioContext({ sampleRate: 24000 })
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.systemInstruction =
      customInstruction?.trim() ||
      buildTotemLiveSystemInstruction(
        initialContext?.contextBlock,
        initialContext?.plotCenterKnowledge
      )

    await this.openSession()
    this.startAudioPlaybackLoop()
    // recién ahora existe this.session: si se disparara desde onopen el saludo se perdía
    this.callbacks.onOpen?.()
  }

  /** turnComplete=false agrega contexto sin que el modelo hable de inmediato. */
  sendTextTurn(text: string, opts?: { respond?: boolean }): void {
    if (!this.session || !text.trim()) return
    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: text.trim() }] }],
        turnComplete: opts?.respond !== false
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
    // sin respuesta inmediata: si no, el modelo habla solo cada vez que se actualiza el contexto
    this.sendTextTurn(
      `[CONTEXTO ACTUALIZADO DEL SISTEMA — usá SOLO estos datos reales para OPs pedidos ubicación y precios. No inventes nada que no figure acá. No respondas a este mensaje, seguí la conversación normal:\n${block}]`,
      { respond: false }
    )
  }

  stop(): void {
    this.stopped = true
    this.reconnecting = false
    this.resumeHandle = null
    this.sessionSeq++
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

  private async handleToolCall(calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>): Promise<void> {
    const responses = await Promise.all(
      calls.map(async (c) => {
        try {
          const response = this.callbacks.onToolCall
            ? await this.callbacks.onToolCall(String(c.name ?? ''), c.args ?? {})
            : { estado: 'error', mensaje: 'Herramienta no disponible.' }
          return { id: c.id, name: c.name, response }
        } catch (e) {
          console.warn('[TotemPlotAILive] herramienta falló:', c.name, e)
          return { id: c.id, name: c.name, response: { estado: 'error', mensaje: 'No se pudo completar la consulta. Ofrecé que mostrador lo resuelva.' } }
        }
      })
    )
    try {
      this.session?.sendToolResponse({ functionResponses: responses })
    } catch (e) {
      console.warn('[TotemPlotAILive] sendToolResponse:', e)
    }
  }

  private handleMessage(message: unknown): void {
    const extra = message as {
      toolCall?: { functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }> }
      sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean }
      goAway?: unknown
    }
    if (extra.toolCall?.functionCalls?.length) void this.handleToolCall(extra.toolCall.functionCalls)
    const upd = extra.sessionResumptionUpdate
    if (upd?.resumable && upd.newHandle) this.resumeHandle = upd.newHandle
    // el servidor avisa que va a cerrar: pasamos a una sesión nueva antes de que se corte
    if (extra.goAway) void this.reconnect('goAway')

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

/** Herramienta consultar_precios: Lista 1 real según lo que pidió el cliente. */
export async function fetchTotemPrecios(producto: string, cantidad?: number): Promise<string> {
  const texto = `cuánto sale ${producto}${cantidad && cantidad > 0 ? ` ${cantidad} unidades` : ''}`
  const res = await fetch(plotLabApiUrl(TOTEM_CONTEXT_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userTexts: [texto], modo: 'totem', soloPrecios: true })
  })
  const data = (await res.json().catch(() => ({}))) as { preciosContext?: string; error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return (
    data.preciosContext?.trim() ||
    'No hay artículos en la Lista 1 para esa búsqueda. No inventes precios: ofrecé que mostrador cotice con medidas y cantidad.'
  ).slice(0, 6000)
}
