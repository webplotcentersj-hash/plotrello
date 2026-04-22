-- RPC: obtener adjuntos (enlaces_adjuntos) del grupo OP (original + duplicadas).
-- Motivo: en algunos proyectos con RLS, el cliente no puede listar todas las filas de ordenes_trabajo,
-- entonces conviene resolver el "grupo" en el servidor (SECURITY DEFINER).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_enlaces_adjuntos_grupo(p_orden_id integer)
RETURNS SETOF public.enlaces_adjuntos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  root_id integer;
  numero_op_comun text;
BEGIN
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
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ea.*
  FROM public.enlaces_adjuntos ea
  WHERE ea.id_orden IN (
    SELECT ot2.id
    FROM public.ordenes_trabajo ot2
    WHERE ot2.id = root_id
       OR ot2.id_orden_original = root_id
       OR (ot2.id_orden_original IS NULL AND numero_op_comun IS NOT NULL AND ot2.numero_op = numero_op_comun)
  )
  ORDER BY ea.creado_en DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_enlaces_adjuntos_grupo(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enlaces_adjuntos_grupo(integer) TO anon;

COMMIT;

