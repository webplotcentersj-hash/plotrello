# Plot Lab Admin - Panel de Control

## 📱 Descripción

**Plot Lab Admin** es una aplicación separada y optimizada para **móvil y tablet**, diseñada exclusivamente para usuarios con rol de **administración** o **gerencia**. Esta app se basa principalmente en **PlotAI** para análisis inteligente y generación de reportes online.

## 🎯 Características Principales

- ✅ **Acceso restringido**: Solo usuarios con rol `administracion` o `gerencia`
- ✅ **UI Mobile-First**: Diseñada para móvil y tablet
- ✅ **PlotAI integrado**: Asistente inteligente con acceso completo al sistema
- ✅ **Reportes online**: Generación de reportes en tiempo real usando PlotAI
- ✅ **Misma información**: Conecta a la misma base de datos que la app operativa
- ✅ **URL separada**: Desplegada en `/admin` o dominio separado

## 🚀 Desarrollo

### Ejecutar en desarrollo

```bash
# App Admin (puerto por defecto, pero abre /admin.html)
npm run dev:admin

# O simplemente
npm run dev
# Luego navegar a http://localhost:5173/admin.html
```

### Build

```bash
# Build de ambas apps (operativa + admin)
npm run build

# Build solo admin (si se necesita)
npm run build:admin
```

## 📂 Estructura

```
src/admin/
├── main.tsx              # Punto de entrada de la app Admin
├── App.tsx               # Componente principal de la app Admin
├── App.css               # Estilos globales Admin
├── components/
│   └── AdminProtectedRoute.tsx  # Guard de autenticación/rol
├── pages/
│   ├── AdminDashboard.tsx       # Dashboard principal con PlotAI
│   ├── AdminDashboard.css
│   ├── AdminReports.tsx         # Página de reportes
│   └── AdminReports.css
└── services/
    └── adminReportService.ts    # Servicio de generación de reportes
```

## 🔐 Autenticación

La app Admin verifica:
1. **Usuario autenticado**: Debe haber iniciado sesión
2. **Rol permitido**: Debe tener rol `administracion` o `gerencia`

Si el usuario no cumple estos requisitos, se muestra un mensaje de acceso denegado.

## 📊 Reportes

La app Admin permite generar reportes online usando PlotAI:

- **Kanban**: Estado del tablero, distribución de OPs, cuellos de botella
- **Rendimiento**: Métricas de productividad, análisis por operario/sector
- **Carga de Trabajo**: Distribución de carga, sobrecargas, balance
- **Cuellos de Botella**: Identificación de bloqueos y estancamientos
- **Personalizado**: Reporte completo con todos los análisis

Los reportes se generan en tiempo real usando los datos del sistema y pueden exportarse a PDF.

## 🌐 Despliegue

### Vercel

La app Admin se despliega automáticamente junto con la app operativa. Las rutas están configuradas en `vercel.json`:

- `/` → App operativa (`index.html`)
- `/admin` o `/admin/*` → App Admin (`admin.html`)

### URLs Separadas (Recomendado)

Para tener URLs completamente separadas:

1. **App Operativa**: `https://app.tudominio.com`
2. **App Admin**: `https://admin.tudominio.com`

Configura en Vercel dos proyectos separados:
- Proyecto 1: Build normal → `app.tudominio.com`
- Proyecto 2: Build con `admin.html` como entrada → `admin.tudominio.com`

## 📱 Responsive

- **Mobile**: Diseño optimizado para pantallas pequeñas
- **Tablet**: Layout mejorado para tablets
- **Desktop**: Modal/overlay para PlotAI, mejor uso del espacio

## 🔧 Configuración

No requiere configuración adicional. Usa las mismas variables de entorno que la app operativa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (para PlotAI)

## 🎨 UI/UX

- **Tema oscuro**: Consistente con la app operativa
- **Botones grandes**: Optimizados para touch
- **Navegación simple**: Mínimo de clicks para acceder a funciones
- **PlotAI prominente**: Acceso rápido desde el dashboard

## 📝 Notas

- La app Admin **NO modifica** la app operativa
- Ambas apps comparten la misma base de datos
- Los reportes se generan usando PlotAI con contexto completo del sistema
- El guard de autenticación redirige al login de la app operativa si no hay sesión

