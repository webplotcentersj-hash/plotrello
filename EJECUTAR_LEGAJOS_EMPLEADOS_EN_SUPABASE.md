# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_create_tabla_legajos_empleados.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

## Configurar Storage para Fotos:

1. Ve a **Storage** en el panel de Supabase
2. Crea un bucket llamado `legajos` (si no existe)
3. Configura las políticas de acceso:
   - **Public Access**: Desactivado (solo usuarios autenticados)
   - **File size limit**: 5MB
   - **Allowed MIME types**: image/*

## Funciones creadas:

1. **`obtener_legajo_empleado`**: Obtiene todos los datos del legajo de un empleado
2. **`crear_actualizar_legajo`**: Crea o actualiza el legajo completo de un empleado

## Campos del Legajo:

- Información Personal: Nombre, Apellido, DNI, Fecha de Nacimiento, Estado Civil
- Información de Contacto: Teléfono, Email, Dirección, Ubicación
- Información Laboral: Sector, Funciones, Fecha de Ingreso
- Contacto de Emergencia: Nombre y Teléfono
- Foto del empleado (almacenada en Supabase Storage)
- Observaciones adicionales

