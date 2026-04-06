-- Siguiente numero_op para fichas No OP: MAX(número en FICHA-*) + 1 (evita duplicar ux_ordenes_op_sector
-- cuando la secuencia/trigger queda desfasada respecto a filas ya existentes).

CREATE OR REPLACE FUNCTION public.next_numero_ficha_no_op()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FICHA-' || (
    COALESCE(
      (
        SELECT MAX(
          CAST((regexp_match(trim(numero_op), '^FICHA-([0-9]+)$'))[1] AS bigint)
        )
        FROM public.ordenes_trabajo
        WHERE trim(numero_op) ~ '^FICHA-[0-9]+$'
      ),
      0
    ) + 1
  )::text;
$$;

COMMENT ON FUNCTION public.next_numero_ficha_no_op() IS
  'Devuelve el siguiente FICHA-<n> sin colisionar con filas existentes (basado en MAX).';

GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO anon;
GRANT EXECUTE ON FUNCTION public.next_numero_ficha_no_op() TO authenticated;
