-- =============================================================================
-- Galería / carrusel de imágenes por OP (frontend: TaskEditModal + TaskViewModal)
-- JSON: array de objetos { "url": "https://...", "nombre": "texto" }
-- Legado admitido al leer en app: clave "titulo" en lugar de "nombre"
-- Requisitos: bucket Storage "archivos" (o el que use la app) con políticas que
-- permitan subir bajo prefijo capturas/ (incl. capturas/carrusel/*)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
  ) THEN
    RAISE NOTICE 'Tabla public.ordenes_trabajo no existe; no se agrega galeria_carrusel.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
      AND column_name = 'galeria_carrusel'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
      ADD COLUMN galeria_carrusel jsonb NOT NULL DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Columna galeria_carrusel agregada a ordenes_trabajo.';
  ELSE
    RAISE NOTICE 'Columna galeria_carrusel ya existe; sin cambios.';
  END IF;
END $$;

COMMENT ON COLUMN public.ordenes_trabajo.galeria_carrusel IS
  'Galería/carrusel: jsonb array [{url, nombre}]. Legado en datos: titulo.';

-- Verificación rápida (opcional; no falla si algo raro)
DO $$
DECLARE
  has_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
      AND column_name = 'galeria_carrusel'
  ) INTO has_col;
  IF has_col THEN
    RAISE NOTICE 'OK: galeria_carrusel lista en public.ordenes_trabajo.';
  ELSE
    RAISE WARNING 'No se encontró galeria_carrusel tras el parche.';
  END IF;
END $$;
