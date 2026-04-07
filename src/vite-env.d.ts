/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** ID del agente ElevenLabs ConvAI (widget en /totem). Si no se define, se usa el default del proyecto. */
  readonly VITE_ELEVENLABS_CONVAI_AGENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

