-- Crear tabla usuario_sectores si no existe
-- Esto evita el error "relation usuario_sectores does not exist"

BEGIN;

-- ============================================
-- Crear tabla usuario_sectores si no existe
-- ============================================
CREATE TABLE IF NOT EXISTS public.usuario_sectores (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  sector_id integer NOT NULL REFERENCES public.sectores(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_usuario_sector UNIQUE (usuario_id, sector_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_usuario_sectores_usuario ON public.usuario_sectores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_sectores_sector ON public.usuario_sectores(sector_id);

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_sectores TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE usuario_sectores_id_seq TO anon, authenticated;

-- Verificar que la tabla se creó correctamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'usuario_sectores'
  ) THEN
    RAISE NOTICE '✅ Tabla usuario_sectores creada/verificada correctamente';
  ELSE
    RAISE WARNING '⚠️ No se pudo crear la tabla usuario_sectores';
  END IF;
END $$;

COMMIT;

