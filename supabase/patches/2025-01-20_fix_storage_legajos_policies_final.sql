-- Corregir políticas de Storage para legajos de empleados
-- Asegurar que todos los usuarios autenticados (empleados) puedan subir y gestionar fotos

BEGIN;

-- Habilitar RLS en storage.objects si no está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes de legajos para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura pública de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de fotos de legajos" ON storage.objects;

-- Política de lectura para usuarios autenticados (empleados)
CREATE POLICY "Permitir lectura de fotos de legajos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'legajos'
);

-- Política de lectura pública (para mostrar fotos en la interfaz)
CREATE POLICY "Permitir lectura pública de fotos de legajos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'legajos'
);

-- Política de inserción para usuarios autenticados (empleados)
-- Permite subir fotos en la carpeta empleados/
CREATE POLICY "Permitir subida de fotos de legajos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
);

-- Política de actualización para usuarios autenticados
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

-- Política de eliminación para usuarios autenticados
CREATE POLICY "Permitir eliminación de fotos de legajos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
);

COMMIT;

