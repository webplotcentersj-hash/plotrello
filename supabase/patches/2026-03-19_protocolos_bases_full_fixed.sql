-- Protocolos y Bases (full / fixed)
-- Objetivo:
-- - Crear tabla + RLS
-- - SELECT permitido para todos (authenticated + public)
-- - Escritura (INSERT/UPDATE/DELETE) solo para: administracion y recursos-humanos
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.protocolos_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text,
  tipo text NOT NULL DEFAULT 'protocolo',
  tags text[] DEFAULT '{}'::text[],
  archivo_url text,
  archivo_nombre text,
  file_mime text,
  contenido_texto text,
  creado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocolos_bases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at_protocolos_bases()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_protocolos_bases ON public.protocolos_bases;
CREATE TRIGGER trg_set_updated_at_protocolos_bases
BEFORE UPDATE ON public.protocolos_bases
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_protocolos_bases();

-- SELECT: todos los usuarios logueados
DROP POLICY IF EXISTS "protocolos_bases_select_authenticated" ON public.protocolos_bases;
CREATE POLICY "protocolos_bases_select_authenticated"
ON public.protocolos_bases
FOR SELECT
TO authenticated
USING (true);

-- SELECT: public (por si se consulta sin auth)
DROP POLICY IF EXISTS "protocolos_bases_select_public" ON public.protocolos_bases;
CREATE POLICY "protocolos_bases_select_public"
ON public.protocolos_bases
FOR SELECT
TO public
USING (true);

-- Escritura: solo administracion y recursos-humanos
DROP POLICY IF EXISTS "protocolos_bases_write_hr_admin" ON public.protocolos_bases;
CREATE POLICY "protocolos_bases_write_hr_admin"
ON public.protocolos_bases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()::text::integer
      AND u.rol IN ('recursos-humanos', 'administracion')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()::text::integer
      AND u.rol IN ('recursos-humanos', 'administracion')
  )
);

CREATE INDEX IF NOT EXISTS idx_protocolos_bases_created_at ON public.protocolos_bases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_protocolos_bases_tipo ON public.protocolos_bases(tipo);

COMMIT;

