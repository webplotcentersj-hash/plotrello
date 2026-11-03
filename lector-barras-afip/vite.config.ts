import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Publicado dentro de Plot Lab en /lector-afip/ (mismo origen HTTPS → cámara OK).
  base: '/lector-afip/',
  build: {
    outDir: '../public/lector-afip',
    emptyOutDir: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lector de código de barras AFIP',
        short_name: 'Lector AFIP',
        description: 'Lee y valida con la cámara el código de barras de facturas y comprobantes AFIP (RG 1702).',
        lang: 'es-AR',
        start_url: '/lector-afip/',
        scope: '/lector-afip/',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // Todo queda en el caché del dispositivo: la lectura funciona sin conexión.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html'
      }
    })
  ]
})
