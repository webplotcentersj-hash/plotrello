# Ejecutar Sistema de Menú Diario

Este documento contiene las instrucciones para aplicar el sistema de menú diario a la base de datos.

## Pasos para Ejecutar

1. **Accede a Supabase Dashboard**
   - Ve a tu proyecto en https://supabase.com/dashboard
   - Navega a "SQL Editor"

2. **Ejecuta el Script SQL**
   - Copia el contenido completo del archivo `supabase/patches/2025-01-20_create_sistema_menu_diario.sql`
   - Pégalo en el SQL Editor
   - Haz clic en "Run" o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)

3. **Verifica la Creación**
   - Ve a "Table Editor" y verifica que se hayan creado las tablas:
     - `menus_diarios`
     - `menu_selecciones`
   - Verifica que las funciones RPC estén disponibles en "Database" > "Functions"

## Funcionalidades Implementadas

### Para RRHH/Admin:
- ✅ Crear y editar menús diarios
- ✅ Ver lista de menús con filtros por fecha
- ✅ Ver selecciones de empleados por menú
- ✅ Descargar PDF con menú y selecciones
- ✅ Eliminar menús

### Para Empleados:
- ✅ Ver menú del día actual
- ✅ Seleccionar plato (principal, secundario o vegetariano)
- ✅ Ver su selección actual
- ✅ Cambiar selección (hasta las 9:30 AM)
- ✅ Validación de horario (hasta las 9:30 AM)

## Rutas de la Aplicación

- **Administración**: `/rrhh/menu-diario` (solo RRHH/Admin)
- **Empleados**: `/menu-diario` (todos los usuarios)

## Características Técnicas

- Validación de horario en backend (hasta 9:30 AM)
- RLS policies para seguridad
- Generación de PDF con jsPDF
- Lazy loading para optimización
- Interfaz responsive

## Notas

- El sistema permite solo un menú por día
- Los empleados solo pueden seleccionar el menú del día actual
- El plazo para seleccionar/cancelar es hasta las 9:30 AM
- Las selecciones se pueden ver y descargar en PDF por RRHH/Admin

