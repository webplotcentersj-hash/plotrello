-- Ajustar permisos de escritura de Protocolos y Bases
-- Solo: administracion y recursos-humanos
BEGIN;

DROP POLICY IF EXISTS "protocolos_bases_write_hr_admin" ON public.protocolos_bases;

CREATE POLICY "protocolos_bases_write_hr_admin"
ON public.protocolos_bases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol IN ('recursos-humanos', 'administracion')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol IN ('recursos-humanos', 'administracion')
  )
);

COMMIT;

