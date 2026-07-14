-- Alinear bucket legajos/empleados con patrón auth custom (como bucket archivos).
-- UPDATE/DELETE pasan a public solo en path empleados/%

DROP POLICY IF EXISTS "Permitir subida de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de fotos de legajos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de fotos de legajos" ON storage.objects;

CREATE POLICY "Permitir subida de fotos de legajos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'legajos'
  AND name LIKE 'empleados/%'
);

CREATE POLICY "Permitir actualización de fotos de legajos"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'legajos'
  AND name LIKE 'empleados/%'
)
WITH CHECK (
  bucket_id = 'legajos'
  AND name LIKE 'empleados/%'
);

CREATE POLICY "Permitir eliminación de fotos de legajos"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'legajos'
  AND name LIKE 'empleados/%'
);
