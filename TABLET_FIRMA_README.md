# Tablet Firma - App Dedicada para Firma Digital

## 📱 Descripción

**Tablet Firma** es una app móvil dedicada optimizada para tablet, diseñada exclusivamente para el proceso de firma digital de entregas. Modo kiosco, pantalla completa, sin navegación compleja.

## 🎯 Características Principales

- ✅ **Modo Kiosco**: Pantalla completa, sin navegación compleja
- ✅ **Área de Firma Grande**: Canvas optimizado para tablet (400px de altura)
- ✅ **Touch Optimizado**: Sensibilidad mejorada para dedos y stylus
- ✅ **Acceso Rápido**: Selección de orden o acceso directo por URL
- ✅ **UI Simplificada**: Solo lo esencial para firmar
- ✅ **URL Separada**: Disponible en `/tablet-firma` o dominio separado

## 🚀 Desarrollo

### Ejecutar en desarrollo

```bash
# App Tablet Firma
npm run dev
# Luego navegar a http://localhost:5173/tablet-firma.html
```

### Build

```bash
# Build de todas las apps (operativa + admin + tablet-firma)
npm run build
```

## 📂 Estructura

```
src/tablet-firma/
├── main.tsx              # Punto de entrada de la app Tablet Firma
├── App.tsx               # Componente principal
├── App.css               # Estilos globales (modo kiosco)
└── pages/
    ├── TabletFirmaSelectPage.tsx    # Página de selección de orden
    ├── TabletFirmaSelectPage.css
    ├── TabletFirmaPage.tsx          # Página principal de firma
    └── TabletFirmaPage.css
```

## 🔧 Configuración de Tablet

### Modo Kiosco (Recomendado)

1. **Android (Chrome)**:
   - Abrir Chrome
   - Ir a `/tablet-firma`
   - Menú → "Agregar a pantalla de inicio"
   - Abrir desde el ícono (modo pantalla completa)

2. **iPad (Safari)**:
   - Abrir Safari
   - Ir a `/tablet-firma`
   - Compartir → "Agregar a pantalla de inicio"
   - Abrir desde el ícono (modo pantalla completa)

3. **Modo Kiosco Avanzado (Android)**:
   - Usar una app de modo kiosco (ej: Fully Kiosk Browser)
   - Configurar URL: `https://tudominio.com/tablet-firma`
   - Bloquear navegación, habilitar solo esta app

### Acceso Directo

- **Selección de orden**: `/tablet-firma` - Muestra lista de órdenes listas
- **Firma directa**: `/tablet-firma/:id` - Acceso directo a una orden específica

## 📱 Características Técnicas

### Canvas de Firma

- **Tamaño**: 1200px ancho máximo, 400px alto
- **Resolución**: Alta resolución (devicePixelRatio)
- **Línea**: 4px de grosor (optimizado para tablet)
- **Touch**: Soporte completo para dedos y stylus
- **Calidad**: PNG con calidad máxima

### Modo Kiosco

- **Pantalla completa**: `100vw x 100vh`
- **Sin zoom**: Prevención de zoom con doble tap
- **Touch optimizado**: `touch-action: none`
- **Sin selección**: Texto no seleccionable (excepto inputs)
- **Sin navegación**: Solo botón "Volver" básico

### Optimizaciones

- **Inputs grandes**: Font-size 16px+ para evitar zoom en iOS
- **Botones táctiles**: Mínimo 44x44px
- **Área de firma grande**: 400px de altura mínimo
- **Feedback visual**: Estados claros (firma completada, error, éxito)

## 🌐 Despliegue

### Vercel

La app Tablet Firma se despliega automáticamente junto con las otras apps. Las rutas están configuradas en `vercel.json`:

- `/tablet-firma` o `/tablet-firma/*` → App Tablet Firma (`tablet-firma.html`)

### URLs Separadas (Recomendado)

Para tener una URL completamente separada:

1. **App Operativa**: `https://app.tudominio.com`
2. **App Admin**: `https://admin.tudominio.com`
3. **Tablet Firma**: `https://firma.tudominio.com` o `https://tablet.tudominio.com`

Configura en Vercel un proyecto separado con:
- Build normal
- Entrada: `tablet-firma.html`
- Dominio: `firma.tudominio.com`

## 🎨 UI/UX

- **Pantalla completa**: Sin barras de navegación
- **Área de firma prominente**: Ocupa la mayor parte de la pantalla
- **Botones grandes**: Fáciles de tocar
- **Feedback inmediato**: Estados visuales claros
- **Minimalista**: Solo lo esencial

## 📝 Flujo de Uso

1. **Abrir app** en tablet (modo kiosco)
2. **Seleccionar orden** de la lista o acceder directamente por URL
3. **Ingresar nombre** de quien retira (prellenado con cliente)
4. **Ingresar DNI** (opcional)
5. **Firmar** en el área grande
6. **Confirmar entrega** - La orden se marca como entregada automáticamente

## ⚙️ Configuración

### Usuario por Defecto

La app usa el usuario almacenado en `localStorage`:
- Si hay sesión activa, usa ese usuario
- Si no, usa usuario ID 1 por defecto

**Recomendación**: Configurar un usuario específico para la tablet en `localStorage` antes de ponerla en modo kiosco.

### Variables de Entorno

Usa las mismas variables que la app principal:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔒 Seguridad

- **Modo kiosco**: Bloquea navegación fuera de la app
- **Sin acceso a otras páginas**: Solo puede procesar entregas
- **Usuario limitado**: Usa usuario específico de tablet (configurar)

## 📝 Notas

- La app Tablet Firma **NO modifica** las otras apps
- Comparte la misma base de datos
- Optimizada específicamente para tablets (no móviles pequeños)
- Ideal para tener una tablet dedicada en el mostrador

