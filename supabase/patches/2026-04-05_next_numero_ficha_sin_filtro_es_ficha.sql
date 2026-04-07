-- next_numero_ficha_no_op: el MAX debe mirar TODAS las filas con numero_op FICHA-<dígitos>,
-- porque ux_ordenes_op_sector aplica aunque es_ficha_no_op = false (datos viejos / inconsistentes).
-- Filtrar por es_ficha_no_op hacía que el correlativo “volviera” a un número ya existente → 23505.

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
      ),
      0
    ) + 1
  )::text;
$$;

COMMENT ON FUNCTION public.next_numero_ficha_no_op() IS
  'Siguiente FICHA-<n>: MAX sobre cualquier fila con numero_op FICHA-dígitos (+1). VOLATILE.';

GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO anon;
GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO authenticated;
