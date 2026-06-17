import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        // No precachear HTML: tras un deploy el index viejo apunta a chunks que ya no existen.
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff,woff2,ttf,txt,md}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'plotlab-pages',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ],
        // Chunks pesados: no precachear (carga inicial + riesgo SW corrupto tras deploy).
        globIgnores: [
          '**/xlsx*.js',
          '**/jspdf*.js',
          '**/html2canvas*.js',
          '**/CategoricalChart*.js',
          '**/pdf.worker*.js',
          '**/pdf.worker*.mjs',
          '**/main*.js',
          '**/api*.js',
          '**/vendor-*.js'
        ],
        maximumFileSizeToCacheInBytes: 400_000
      }
    })
  ],
  server: {
    // LAN solo si VITE_DEV_LAN=1 (evita exponer dev en toda la red)
    host: process.env.VITE_DEV_LAN === '1'
  },
  build: {
    modulePreload: {
      // El polyfill compartido terminaba en el chunk `api` y lo arrastraba al login.
      polyfill: false,
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('/api.') && !dep.includes('vendor-pdf'))
    },
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
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            // El helper de preload de Vite termina aquí (mejor que en vendor-pdf).
            if (id.includes('/src/services/api.ts')) return 'api'
            if (id.includes('/src/services/supabaseClient.ts')) return 'supabase-client'
            if (id.includes('/src/utils/plotLabApiOrigin')) return 'plotlab-api'
            return undefined
          }
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) {
            return 'vendor-pdf'
          }
          if (id.includes('xlsx') || id.includes('sheetjs')) return 'vendor-xlsx'
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs'
          if (id.includes('@google/genai') || id.includes('@google/generative-ai')) return 'vendor-google-ai'
          if (id.includes('date-fns')) return 'vendor-date'
        }
      }
    }
  }
})


