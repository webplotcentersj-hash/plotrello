-- Políticas de seguridad para el bucket de Storage 'legajos'
-- Permite a usuarios autenticados subir y leer fotos de empleados

BEGIN;

-- Eliminar políticas existentes si las hay (para evitar duplicados)
DROP POLICY IF EXISTS "Permitir lectura de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de fotos de legajos" ON storage.objects;

-- Política para permitir lectura de archivos a usuarios autenticados
CREATE POLICY "Permitir lectura de fotos de legajos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'legajos'
);

-- Política para permitir lectura pública de fotos (para mostrar las imágenes)
CREATE POLICY "Permitir lectura pública de fotos de legajos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'legajos'
);

-- Política para permitir subida de archivos a usuarios autenticados
CREATE POLICY "Permitir subida de fotos de legajos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legajos' AND
  (storage.foldername(name))[1] = 'empleados'
);

-- Política para permitir actualización de archivos
CREATE POLICY "Permitir actualización de fotos de legajos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'legajos' AND
  (storage.foldername(name))[1] = 'empleados'
)
WITH CHECK (
  bucket_id = 'legajos' AND
  (storage.foldername(name))[1] = 'empleados'
);

-- Política para permitir eliminación de archivos
CREATE POLICY "Permitir eliminación de fotos de legajos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'legajos' AND
  (storage.foldername(name))[1] = 'empleados'
);

COMMIT;

