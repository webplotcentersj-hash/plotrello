/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  // Variables VITE_* documentadas en .env.example según necesidad del proyecto
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

