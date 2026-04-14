import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,txt,md}'],
        // Chunks muy grandes: precachearlos rompe a veces el SW (bytes corruptos / "Bad uncompressed size") tras deploys.
        globIgnores: ['**/xlsx*.js', '**/pdf.worker*.js', '**/pdf.worker*.mjs']
      }
    })
  ],
  server: {
    host: true
  },
  build: {
    // Agregar hash a los nombres de archivos para evitar cache
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        'tablet-firma': resolve(__dirname, 'tablet-firma.html')
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})


