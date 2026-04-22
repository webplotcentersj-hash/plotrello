-- Replicar adjuntos (enlaces_adjuntos) entre fichas duplicadas de una misma OP.
-- Objetivo: si se sube un PDF/foto desde cualquier ficha (sector), que aparezca en todas las fichas del grupo.
--
-- Requiere: ordenes_trabajo.es_duplicado + ordenes_trabajo.id_orden_original (ver patches de duplicación).
--
-- Estrategia:
-- - Trigger AFTER INSERT en enlaces_adjuntos.
-- - Calcula root_id del grupo (original).
-- - Inserta el mismo enlace en el resto de ids del grupo.
-- - Usa pg_trigger_depth() para evitar loops.
-- - Agrega índice único (id_orden, url) para deduplicar y permitir ON CONFLICT DO NOTHING.

BEGIN;

-- Deduplicación: evita múltiples filas iguales por orden+url
CREATE UNIQUE INDEX IF NOT EXISTS ux_enlaces_adjuntos_orden_url
  ON public.enlaces_adjuntos (id_orden, url);

CREATE OR REPLACE FUNCTION public.replicar_enlace_adjunto_a_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  root_id integer;
BEGIN
  -- Evitar recursión: los INSERT generados por esta función vuelven a disparar el trigger.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Determinar el root del grupo OP.
  SELECT
    CASE
      WHEN ot.es_duplicado = true AND ot.id_orden_original IS NOT NULL THEN ot.id_orden_original
      ELSE ot.id
    END
  INTO root_id
  FROM public.ordenes_trabajo ot
  WHERE ot.id = NEW.id_orden;

  IF root_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Replicar a todas las fichas del grupo (original + duplicadas), excepto la actual.
  INSERT INTO public.enlaces_adjuntos (id_orden, titulo, url, creado_en, es_evidencia_campo, origen_relevamiento)
  SELECT
    ot.id,
    NEW.titulo,
    NEW.url,
    NEW.creado_en,
    NEW.es_evidencia_campo,
    NEW.origen_relevamiento
  FROM public.ordenes_trabajo ot
  WHERE (ot.id = root_id OR ot.id_orden_original = root_id)
    AND ot.id <> NEW.id_orden
  ON CONFLICT (id_orden, url) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_replicar_enlace_adjunto_a_grupo ON public.enlaces_adjuntos;

CREATE TRIGGER trigger_replicar_enlace_adjunto_a_grupo
AFTER INSERT ON public.enlaces_adjuntos
FOR EACH ROW
EXECUTE FUNCTION public.replicar_enlace_adjunto_a_grupo();

COMMIT;

