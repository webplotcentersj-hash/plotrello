# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos para agregar notificaciones a solicitudes:

### 1. Agregar campo solicitud_id a user_notifications

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_add_solicitud_id_to_notifications.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

Este script agrega:
- Columna `solicitud_id` a la tabla `user_notifications`
- Índice para mejorar el rendimiento
- Foreign key a la tabla `solicitudes_permisos`

## ✅ Funcionalidades de Notificaciones Implementadas

### Cuando se crea una solicitud:
- **Notifica a todos los usuarios de RRHH y Admin**
- Título: "📋 Nueva Solicitud de [tipo]"
- Descripción: Incluye nombre del usuario, título y descripción de la solicitud

### Cuando se aprueba una solicitud:
- **Notifica al usuario que creó la solicitud**
- Título: "✅ Solicitud Aprobada"
- Descripción: Incluye quién aprobó y observaciones si las hay
- Tipo: `success` (verde)

### Cuando se rechaza una solicitud:
- **Notifica al usuario que creó la solicitud**
- Título: "❌ Solicitud Rechazada"
- Descripción: Incluye quién rechazó y el motivo de rechazo
- Tipo: `error` (rojo)

## 📱 Dónde ver las notificaciones

Las notificaciones aparecen en:
- El dropdown de notificaciones en el header (si está implementado)
- La página de notificaciones de RRHH (si existe)
- Se pueden marcar como leídas

## 🔔 Tipos de Notificaciones

- `info`: Notificaciones informativas (nuevas solicitudes)
- `success`: Solicitudes aprobadas
- `error`: Solicitudes rechazadas

