/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLOTLAB_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
