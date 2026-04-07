-- Correlativo FICHA-n: tomar MAX solo de filas que siguen siendo fichas (No OP).
-- Las OP ya transformadas tienen es_ficha_no_op = false y numero_op tipo OP-… (no matchea FICHA-).
-- Si igual ves números enormes (ej. 2626260), hay al menos una fila con FICHA-* enorme todavía
-- marcada como ficha o con es_ficha_no_op NULL: ejecutá el diagnóstico al final y corregí datos.

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
  'Siguiente FICHA-<n>: MAX sobre filas con numero_op FICHA-dígitos y es_ficha_no_op no false (true o NULL). VOLATILE.';

GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO anon;
GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO authenticated;

-- ========== Diagnóstico (ejecutar aparte en SQL Editor) ==========
-- Ver las fichas con mayor número (encontrar la que “infla” el correlativo):
--
-- SELECT id, numero_op, cliente, es_ficha_no_op, estado, sector, fecha_creacion, visible_en_tablero
-- FROM public.ordenes_trabajo
-- WHERE trim(numero_op) ~ '^FICHA-[0-9]+$'
-- ORDER BY CAST(substring(trim(numero_op) from '^FICHA-([0-9]+)$') AS bigint) DESC
-- LIMIT 25;
--
-- Si una fila es basura / prueba y es_ficha_no_op sigue true, podés archivarla o corregir numero_op
-- (coordinar con negocio: no repetir ux_ordenes_op_sector).
