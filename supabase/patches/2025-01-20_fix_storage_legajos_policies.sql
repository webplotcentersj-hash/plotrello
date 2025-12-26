-- Corregir políticas de Storage para el bucket 'legajos'
-- Permite subir archivos en la carpeta empleados/ sin restricciones de RLS

BEGIN;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Permitir lectura de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura pública de fotos de legajos" ON storage.objects;
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
-- Permite subir archivos en la carpeta empleados/ (sin restricción adicional)
CREATE POLICY "Permitir subida de fotos de legajos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
);

-- Política para permitir actualización de archivos
CREATE POLICY "Permitir actualización de fotos de legajos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
)
WITH CHECK (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
);

-- Política para permitir eliminación de archivos
CREATE POLICY "Permitir eliminación de fotos de legajos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
);

COMMIT;

