# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos para configurar el sistema de capacitaciones:

### 1. Crear tablas y funciones SQL

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_create_sistema_capacitaciones.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

Este script crea:
- Tabla `capacitaciones` con todos los campos necesarios
- Tabla `capacitaciones_inscripciones` para las inscripciones
- Funciones SQL:
  - `crear_capacitacion`: Crear nuevas capacitaciones
  - `obtener_capacitaciones`: Listar capacitaciones con filtros
  - `inscribirse_capacitacion`: Inscribirse a una capacitación
  - `aprobar_rechazar_inscripcion`: Aprobar o rechazar inscripciones
  - `obtener_inscripciones_capacitacion`: Ver inscripciones de una capacitación
  - `obtener_capacitaciones_usuario`: Ver capacitaciones de un usuario
  - `actualizar_capacitacion`: Actualizar una capacitación
  - `registrar_asistencia_capacitacion`: Registrar asistencia y calificación
  - `cancelar_inscripcion`: Cancelar una inscripción
  - `eliminar_capacitacion`: Eliminar una capacitación
- Políticas RLS para acceso seguro

## ✅ Funcionalidades Implementadas

### Para RRHH/Admin:
- **Página de gestión** (`/rrhh/capacitaciones`) con:
  - Crear/Editar/Eliminar capacitaciones
  - Filtros por estado, tipo, categoría, fechas
  - Ver y gestionar inscripciones
  - Aprobar/Rechazar inscripciones
  - Registrar asistencia y calificaciones

### Para Todos los Usuarios:
- **Página de capacitaciones** (`/capacitaciones`) con:
  - Ver todas las capacitaciones disponibles
  - Inscribirse a capacitaciones
  - Ver sus capacitaciones inscritas
  - Cancelar inscripciones
  - Ver materiales y links

## 📋 Características

- **Tipos de capacitación**: Presencial, Virtual, Mixta, Online
- **Categorías**: Técnica, Seguridad, Soft Skills, Compliance, Otra
- **Gestión de cupos**: Control de cupos máximos
- **Aprobación**: Sistema opcional de aprobación de inscripciones
- **Asistencia**: Registro de asistencia y calificaciones
- **Materiales**: URLs para materiales adjuntos
- **Estados**: Planificada, Abierta, En Curso, Completada, Cancelada

## 🔔 Próximas Mejoras

- Notificaciones cuando se crea una nueva capacitación
- Recordatorios de capacitaciones próximas
- Certificados de finalización
- Evaluaciones post-capacitación

