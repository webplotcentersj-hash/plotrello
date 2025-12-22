-- ============================================
-- Fix: Corregir ambigüedad en crear_acta_sector
-- Problema: "column reference "id" is ambiguous"
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.crear_acta_sector(integer, integer, text, text, text, text, timestamptz);

CREATE OR REPLACE FUNCTION public.crear_acta_sector(
  p_id_sector integer,
  p_usuario_id integer,
  p_usuario_nombre text,
  p_titulo text,
  p_contenido text,
  p_tipo_novedad text DEFAULT 'general',
  p_fecha timestamptz DEFAULT now()
)
RETURNS TABLE (
  id integer,
  mensaje text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nueva_acta_id integer;
  sector_nombre_text text;
BEGIN
  -- Validar que el sector existe (usar alias explícito)
  SELECT s.nombre INTO sector_nombre_text
  FROM public.sectores s
  WHERE s.id = p_id_sector AND s.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sector no encontrado o inactivo';
  END IF;

  -- Validar campos requeridos
  IF trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'El título no puede estar vacío';
  END IF;

  IF trim(p_contenido) = '' THEN
    RAISE EXCEPTION 'El contenido no puede estar vacío';
  END IF;

  -- Validar tipo de novedad
  IF p_tipo_novedad NOT IN ('general', 'problema', 'mejora', 'incidente', 'reunion', 'capacitacion', 'otro') THEN
    p_tipo_novedad := 'general';
  END IF;

  -- Insertar acta
  INSERT INTO public.libro_actas_sectores (
    id_sector,
    sector_nombre,
    fecha,
    usuario_id,
    usuario_nombre,
    titulo,
    contenido,
    tipo_novedad
  ) VALUES (
    p_id_sector,
    sector_nombre_text,
    COALESCE(p_fecha, now()),
    p_usuario_id,
    p_usuario_nombre,
    trim(p_titulo),
    trim(p_contenido),
    p_tipo_novedad
  )
  RETURNING libro_actas_sectores.id INTO nueva_acta_id;

  RETURN QUERY
  SELECT nueva_acta_id, 'Acta creada exitosamente';
END;
$$;

COMMENT ON FUNCTION public.crear_acta_sector IS 'Crea una nueva acta en el libro de actas de un sector (corregido: ambigüedad en id)';

COMMIT;

