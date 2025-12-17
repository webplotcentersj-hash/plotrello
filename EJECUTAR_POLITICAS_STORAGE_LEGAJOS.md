# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_add_politicas_storage_legajos.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

## Configuración del Bucket:

**IMPORTANTE:** El bucket `legajos` debe estar configurado así:

1. Ve a **Storage** en el panel de Supabase
2. Busca el bucket `legajos`
3. Configura:
   - **Public Access**: Puede estar activado o desactivado (las políticas lo manejan)
   - **File size limit**: 5MB
   - **Allowed MIME types**: image/*

## Políticas creadas:

1. **Permitir lectura de fotos de legajos** (authenticated): Usuarios autenticados pueden leer
2. **Permitir lectura pública de fotos de legajos** (public): Lectura pública para mostrar imágenes
3. **Permitir subida de fotos de legajos** (authenticated): Solo usuarios autenticados pueden subir
4. **Permitir actualización de fotos de legajos** (authenticated): Actualizar archivos existentes
5. **Permitir eliminación de fotos de legajos** (authenticated): Eliminar archivos

Todas las políticas están restringidas a archivos en la carpeta `empleados/` dentro del bucket.

