-- Mejora borrado adjuntos OP:
-- 1) Empata URL con o sin query (?token=...) para URLs firmadas vs públicas.
-- 2) RPC por id de fila: lee la URL canónica en BD y borra en todo el grupo OP.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_enlaces_adjuntos_grupo(p_orden_id integer, p_url text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  root_id integer;
  numero_op_comun text;
  eliminadas integer := 0;
  url_norm text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN 0;
  END IF;

  url_norm := split_part(btrim(p_url), '?', 1);

  SELECT
    CASE
      WHEN ot.es_duplicado = true AND ot.id_orden_original IS NOT NULL THEN ot.id_orden_original
      ELSE ot.id
    END,
    ot.numero_op
  INTO root_id, numero_op_comun
  FROM public.ordenes_trabajo ot
  WHERE ot.id = p_orden_id;

  IF root_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ids AS (
    SELECT ot2.id
    FROM public.ordenes_trabajo ot2
    WHERE ot2.id = root_id
       OR ot2.id_orden_original = root_id
       OR (ot2.id_orden_original IS NULL AND numero_op_comun IS NOT NULL AND ot2.numero_op = numero_op_comun)
  ),
  del AS (
    DELETE FROM public.enlaces_adjuntos ea
    USING ids
    WHERE ea.id_orden = ids.id
      AND (
        ea.url = btrim(p_url)
        OR split_part(ea.url, '?', 1) = url_norm
      )
    RETURNING ea.id
  )
  SELECT count(*)::int INTO eliminadas FROM del;

  RETURN coalesce(eliminadas, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_enlaces_adjuntos_grupo_por_enlace_id(p_orden_id integer, p_enlace_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_url text;
BEGIN
  IF p_enlace_id IS NULL OR p_enlace_id <= 0 THEN
    RETURN 0;
  END IF;

  SELECT ea.url INTO target_url
  FROM public.enlaces_adjuntos ea
  WHERE ea.id = p_enlace_id;

  IF target_url IS NULL OR btrim(target_url) = '' THEN
    RETURN 0;
  END IF;

  RETURN public.delete_enlaces_adjuntos_grupo(p_orden_id, target_url);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo_por_enlace_id(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo_por_enlace_id(integer, integer) TO anon;

COMMIT;
