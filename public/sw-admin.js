// Service Worker para Plot Lab Admin PWA
const CACHE_NAME = 'plotlab-admin-v1'
const RUNTIME_CACHE = 'plotlab-admin-runtime-v1'

// Assets estáticos para cachear
const STATIC_ASSETS = [
  '/admin',
  '/admin.html',
  '/favicon.png',
  '/admin-manifest.json'
]

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW Admin] Instalando Service Worker...')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Admin] Cacheando assets estáticos')
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
      })
      .then(() => self.skipWaiting())
  )
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW Admin] Activando Service Worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
          })
          .map((cacheName) => {
            console.log('[SW Admin] Eliminando cache antiguo:', cacheName)
            return caches.delete(cacheName)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Estrategia de caché: Network First para datos, Cache First para assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo cachear requests del mismo origen
  if (url.origin !== location.origin) {
    return
  }

  // API calls y datos dinámicos: Network First
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(
      networkFirstStrategy(request)
    )
    return
  }

  // Assets estáticos: Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      cacheFirstStrategy(request)
    )
    return
  }

  // HTML y navegación: Network First con fallback
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      networkFirstStrategy(request, true)
    )
    return
  }

  // Por defecto: Network First
  event.respondWith(
    networkFirstStrategy(request)
  )
})

// Estrategia Network First: Intenta red primero, luego cache
async function networkFirstStrategy(request, isNavigation = false) {
  try {
    const networkResponse = await fetch(request)
    
    // Cachear respuesta exitosa
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW Admin] Red falló, usando cache:', request.url)
    
    // Buscar en cache
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }

    // Si es navegación y no hay cache, devolver página offline
    if (isNavigation) {
      return new Response(
        `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sin conexión - Plot Lab Admin</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #0e0f16;
              color: #f9fbff;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              text-align: center;
            }
            h1 { color: #eb671b; margin-bottom: 16px; }
            p { color: #b7bed3; margin-bottom: 8px; }
            button {
              margin-top: 24px;
              padding: 12px 24px;
              background: #eb671b;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <h1>📡 Sin conexión</h1>
          <p>No hay conexión a internet disponible.</p>
          <p>Algunas funciones pueden estar limitadas.</p>
          <button onclick="window.location.reload()">Reintentar</button>
        </body>
        </html>
        `,
        {
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    throw error
  }
}

// Estrategia Cache First: Cache primero, luego red
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW Admin] Error en cache first:', error)
    throw error
  }
}

// Manejo de mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    caches.delete(CACHE_NAME)
    caches.delete(RUNTIME_CACHE)
  }
})

