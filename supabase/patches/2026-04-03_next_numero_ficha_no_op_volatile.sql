-- next_numero_ficha_no_op debe ser VOLATILE: lee ordenes_trabajo en cada llamada.
-- Con STABLE el planificador puede asumir resultado “fijo” dentro de la consulta/transacción
-- y devolver el mismo FICHA-n dos veces → ux_ordenes_op_sector duplicate key.

CREATE OR REPLACE FUNCTION public.next_numero_ficha_no_op()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FICHA-' || (
    COALESCE(
      (
        SELECT MAX(
          CAST((regexp_match(trim(ot.numero_op), '^FICHA-([0-9]+)$'))[1] AS bigint)
        )
        FROM public.ordenes_trabajo ot
        WHERE trim(ot.numero_op) ~ '^FICHA-[0-9]+$'
          AND (ot.es_ficha_no_op IS DISTINCT FROM false)
      ),
      0
    ) + 1
  )::text;
$$;

COMMENT ON FUNCTION public.next_numero_ficha_no_op() IS
  'Siguiente FICHA-<n> (MAX correlativo numérico + 1). VOLATILE: no cachear entre llamadas.';

GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO anon;
GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO authenticated;
