/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL de imagen del QR estático de Mercado Pago (caja) para mostrar en el tótem tras pedir impresión */
  readonly VITE_TOTEM_MP_QR_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

