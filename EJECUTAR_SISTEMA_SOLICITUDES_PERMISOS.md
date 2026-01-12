# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos para configurar el sistema de solicitudes y permisos:

### 1. Crear tabla y funciones SQL

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_create_sistema_solicitudes_permisos.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

Este script crea:
- Tabla `solicitudes_permisos` con todos los campos necesarios
- Funciones SQL:
  - `crear_solicitud_permiso`: Crear nuevas solicitudes
  - `obtener_solicitudes_permisos`: Listar solicitudes con filtros
  - `aprobar_rechazar_solicitud`: Aprobar o rechazar solicitudes
  - `cancelar_solicitud`: Cancelar una solicitud (solo el usuario que la creó)
  - `eliminar_solicitud`: Eliminar una solicitud
- Políticas RLS para acceso seguro

## ✅ Funcionalidades Implementadas

### Para Todos los Usuarios:
- **Botón flotante** (📋) accesible desde toda la aplicación
- **Modal de solicitudes** para crear:
  - 🕐 Turnos
  - ❌ Ausencias
  - 🏖️ Vacaciones
  - 👕 Ropa de Trabajo
  - ✅ Permisos
  - 📝 Otros
- **Contador de solicitudes pendientes** en el botón flotante
- **Historial de solicitudes** del usuario

### Para RRHH/Admin:
- **Página de gestión** (`/rrhh/permisos`) con:
  - Filtros por estado, tipo, fechas
  - Lista de todas las solicitudes
  - Botones para aprobar/rechazar
  - Modal para ingresar motivo de rechazo
  - Eliminación de solicitudes

## 📋 Tipos de Solicitudes Disponibles

1. **Turno**: Solicitud de cambio de turno o turno especial
2. **Ausencia**: Solicitud de ausencia justificada
3. **Vacaciones**: Solicitud de días de vacaciones
4. **Ropa**: Solicitud de ropa de trabajo/uniforme
5. **Permiso**: Solicitud de permiso general
6. **Otro**: Cualquier otro tipo de solicitud

## 🔔 Próximas Mejoras

- Notificaciones cuando se apruebe/rechace una solicitud
- Integración con el sistema de horarios existente
- Adjuntar archivos (comprobantes, fotos, etc.)
- Recordatorios automáticos
- Reportes de solicitudes

