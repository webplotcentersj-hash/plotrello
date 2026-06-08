-- Seguimiento público cliente (QR / op-public): lectura acotada sin SELECT * en ordenes_trabajo
BEGIN;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS seguimiento_token uuid DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_seguimiento_token
  ON public.ordenes_trabajo(seguimiento_token)
  WHERE seguimiento_token IS NOT NULL;

-- Backfill OPs sin token
UPDATE public.ordenes_trabajo
SET seguimiento_token = gen_random_uuid()
WHERE seguimiento_token IS NULL;

-- Vista mínima para documentación (opcional; la RPC es la vía principal)
CREATE OR REPLACE VIEW public.v_ordenes_seguimiento_publico AS
SELECT
  id,
  numero_op,
  seguimiento_token,
  cliente,
  estado,
  descripcion,
  fecha_entrega,
  visible_en_tablero,
  eliminada
FROM public.ordenes_trabajo
WHERE COALESCE(eliminada, false) = false
  AND COALESCE(visible_en_tablero, true) = true;

COMMENT ON VIEW public.v_ordenes_seguimiento_publico IS
  'Solo campos seguros para cliente. Acceso vía RPC get_orden_seguimiento_publico, no SELECT directo anon.';

CREATE OR REPLACE FUNCTION public.get_orden_seguimiento_publico(p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_row public.ordenes_trabajo%ROWTYPE;
BEGIN
  v_ref := trim(coalesce(p_ref, ''));
  IF v_ref = '' THEN
    RETURN NULL;
  END IF;

  -- Quitar prefijo OP- / FICHA para compatibilidad QR existentes
  v_ref := regexp_replace(v_ref, '^OP-?', '', 'i');
  v_ref := regexp_replace(v_ref, '^FICHA[\s-_#:]*', '', 'i');

  SELECT * INTO v_row
  FROM public.ordenes_trabajo o
  WHERE (
    o.numero_op = trim(p_ref)
    OR o.numero_op = v_ref
    OR o.seguimiento_token::text = trim(p_ref)
  )
    AND COALESCE(o.eliminada, false) = false
  ORDER BY
    CASE WHEN COALESCE(o.visible_en_tablero, true) THEN 0 ELSE 1 END,
    o.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'numero_op', v_row.numero_op,
    'seguimiento_token', v_row.seguimiento_token,
    'cliente', v_row.cliente,
    'estado', v_row.estado,
    'descripcion', v_row.descripcion,
    'fecha_entrega', v_row.fecha_entrega
  );
END;
$$;

COMMENT ON FUNCTION public.get_orden_seguimiento_publico(text) IS
  'Lectura pública acotada para /op-public y firma cliente. Sin precios, notas internas ni PII extra.';

GRANT EXECUTE ON FUNCTION public.get_orden_seguimiento_publico(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_orden_seguimiento_publico(text) TO authenticated;

COMMIT;
