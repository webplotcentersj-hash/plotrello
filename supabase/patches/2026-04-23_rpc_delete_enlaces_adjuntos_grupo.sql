-- RPC: borrar adjuntos (enlaces_adjuntos) por URL en todo el grupo OP (original + duplicadas).
-- Motivo: con RLS, el cliente puede no poder borrar filas asociadas a otras fichas del mismo numero_op / id_orden_original.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_enlaces_adjuntos_grupo(p_orden_id integer, p_url text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  root_id integer;
  numero_op_comun text;
  eliminadas integer := 0;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN 0;
  END IF;

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
      AND ea.url = btrim(p_url)
    RETURNING ea.id
  )
  SELECT count(*)::int INTO eliminadas FROM del;

  RETURN coalesce(eliminadas, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo(integer, text) TO anon;

COMMIT;
