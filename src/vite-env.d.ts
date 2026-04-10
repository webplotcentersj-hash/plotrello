/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL de imagen del QR estático de Mercado Pago (caja) para mostrar en el tótem tras pedir impresión */
  readonly VITE_TOTEM_MP_QR_URL?: string
  /** Origen público de la app (ej. https://app.plotcenter.com.ar) para el QR de subida desde celular; si falta, se usa window.location.origin */
  readonly VITE_PUBLIC_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

